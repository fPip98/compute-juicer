import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARD_REGISTRY } from '../data/cards';
import { ALL_ENCOUNTERS, ENCOUNTER_REGISTRY } from '../data/encounters';
import { EVENT_REGISTRY } from '../data/events';
import { FAULT_REGISTRY } from '../data/faults';
import { PROFILE_REGISTRY, STARTER_PROFILES } from '../data/profiles';
import { RELIC_LIST, RELIC_REGISTRY } from '../data/relics';
import { commitTurn, initBattle, stageCard } from './battle';
import { evaluatePipeline } from './pipeline';
import {
  buyShopCard,
  buyShopRelic,
  claimRestBonusCredits,
  claimRewardCard,
  claimRewardRelic,
  enterMapNode,
  finishBattleInRun,
  proceedToMapFromNode,
  resolveEventChoice,
  RunContentPools,
  startRunWithProfile,
} from './run';
import { BattleState, CardInstance, EncounterDef, RunState } from './types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pools: RunContentPools = {
  cards: CARD_LIST,
  relics: RELIC_LIST,
  relicRegistry: RELIC_REGISTRY,
  encounters: ENCOUNTER_REGISTRY,
  events: EVENT_REGISTRY,
  profiles: PROFILE_REGISTRY,
};

/**
 * Smart playtest bot: evaluates candidate ordered pipelines from the current hand
 * (up to 4 cards, respecting cycles & ordering synergies) and picks the best play.
 */
function chooseBestPipeline(state: BattleState): CardInstance[] {
  const hand = state.hand;
  let bestOrder: CardInstance[] = [];
  let bestScore = -1e9;

  const evalCandidate = (order: CardInstance[]) => {
    const res = evaluatePipeline(state, order, CARD_REGISTRY);
    if (!res.preview.valid) return;
    const tel = res.preview.finalTelemetry;
    const sla = res.preview.effectiveSlaTarget;
    const m = res.preview.finalMetrics;

    let score = 0;
    // Fatal avoidance is #1 priority
    if (tel.isOom) score -= 10000;
    if (tel.isThermalShutdown) score -= 10000;
    if (tel.ramPercent > 90) score -= 400;
    if (m.tempC >= m.throttleTempC) score -= 250;
    if (m.tempC >= m.throttleTempC - 6) score -= 60;

    // Meeting SLA is huge
    if (res.preview.slaEval.allMet) {
      score += 500;
    } else {
      const latExcess = Math.max(0, tel.totalLatencyMs - sla.maxLatencyMs);
      const accDeficit = Math.max(0, sla.minAccuracy - tel.accuracyClamped);
      score -= latExcess * 20 + accDeficit * 35;
    }

    // Persistent PATCHes are high long-term value early in a battle
    const remainingWaves = state.totalWaves - state.wave;
    for (const inst of order) {
      const def = CARD_REGISTRY[inst.cardId];
      if (def?.type === 'PATCH') {
        score += 45 + remainingWaves * 22;
      }
      if (def?.type === 'FAULT') {
        score += 15;
      }
    }

    // Reward synergies & overdrive, penalize anti-patterns
    score += res.preview.synergies.length * 35;
    score -= res.preview.warnings.length * 40;
    if (res.preview.overdriveActive) score += 70;

    // Prefer lower latency, lower temp, lower RAM
    score -= tel.totalLatencyMs * 3;
    score -= m.tempC * 0.8;
    score -= tel.ramPercent * 0.6;

    if (score > bestScore) {
      bestScore = score;
      bestOrder = order;
    }
  };

  // Evaluate empty pipeline
  evalCandidate([]);

  // DFS up to length 4 (hand size is 5~6, so <= ~200 valid permutations per turn)
  const used = new Array<boolean>(hand.length).fill(false);
  const current: CardInstance[] = [];
  const dfs = (costSoFar: number) => {
    if (current.length > 0) evalCandidate([...current]);
    if (current.length >= 4) return;
    for (let i = 0; i < hand.length; i++) {
      if (used[i]) continue;
      const def = CARD_REGISTRY[hand[i].cardId];
      if (!def) continue;
      // Allow +1 overshoot in case FlashAttention refunds 1 cycle
      if (costSoFar + def.cost > state.cycles + 1) continue;
      used[i] = true;
      current.push(hand[i]);
      dfs(costSoFar + def.cost);
      current.pop();
      used[i] = false;
    }
  };
  dfs(0);

  return bestOrder;
}

function playBattleWithBot(
  encounter: EncounterDef,
  deckIds: string[],
  relicIds: string[],
  rng: () => number,
): BattleState {
  let state = initBattle(encounter, deckIds, relicIds, RELIC_REGISTRY, rng);
  let guard = 0;
  while (state.status === 'PLANNING' && guard++ < 12) {
    const chosen = chooseBestPipeline(state);
    for (const inst of chosen) {
      state = stageCard(state, inst.instanceId);
    }
    state = commitTurn(state, encounter, CARD_REGISTRY, FAULT_REGISTRY, RELIC_REGISTRY, rng);
  }
  return state;
}

function playFullRunWithBot(profileIndex: number, seed: number): RunState {
  const rng = mulberry32(seed);
  const profile = STARTER_PROFILES[profileIndex];
  let run = startRunWithProfile(profile, 1, rng);

  let steps = 0;
  while (run.phase !== 'RUN_VICTORY' && run.phase !== 'RUN_DEFEAT' && steps++ < 60) {
    if (run.phase === 'MAP') {
      // Prefer SHOP/ELITE/REST/EVENT/BATTLE sensibly
      const candidates = run.reachableNodeIds
        .map((id) => run.nodes.find((n) => n.id === id)!)
        .filter(Boolean);
      const priority: Record<string, number> = {
        SHOP: 5,
        EVENT: 4,
        ELITE: 3,
        REST: 2,
        BATTLE: 1,
        BOSS: 1,
      };
      candidates.sort((a, b) => (priority[b.type] ?? 0) - (priority[a.type] ?? 0));
      run = enterMapNode(run, candidates[0].id, pools, rng);
    } else if (run.phase === 'BATTLE' && run.activeBattle && run.activeEncounterId) {
      const enc = ENCOUNTER_REGISTRY[run.activeEncounterId];
      let b = run.activeBattle;
      let guard = 0;
      while (b.status === 'PLANNING' && guard++ < 12) {
        const chosen = chooseBestPipeline(b);
        for (const inst of chosen) b = stageCard(b, inst.instanceId);
        b = commitTurn(b, enc, CARD_REGISTRY, FAULT_REGISTRY, RELIC_REGISTRY, rng);
      }
      run = { ...run, activeBattle: b };
      run = finishBattleInRun(run, pools, rng);
    } else if (run.phase === 'REWARD' && run.activeReward) {
      if (!run.activeReward.relicClaimed && run.activeReward.relicChoice) {
        run = claimRewardRelic(run);
      }
      if (run.activeReward && !run.activeReward.cardClaimed) {
        // Pick PATCH cards preferentially for stronger late-game scaling
        const bestCard =
          run.activeReward.cardChoices.find((id) => CARD_REGISTRY[id]?.type === 'PATCH') ??
          run.activeReward.cardChoices[0];
        run = claimRewardCard(run, bestCard);
      }
      run = proceedToMapFromNode(run, rng);
    } else if (run.phase === 'SHOP' && run.activeShop) {
      // Buy relics first, then PATCH cards
      run.activeShop.relics.forEach((_, idx) => {
        run = buyShopRelic(run, idx);
      });
      run.activeShop.cards.forEach((item, idx) => {
        if (CARD_REGISTRY[item.cardId]?.type === 'PATCH') {
          run = buyShopCard(run, idx);
        }
      });
      run = proceedToMapFromNode(run, rng);
    } else if (run.phase === 'EVENT' && run.activeEvent) {
      const ev = EVENT_REGISTRY[run.activeEvent.eventId];
      // Avoid taking tech debt if possible (pick choice 1 when choice 0 adds fault)
      const safeChoice =
        ev.choices.find(
          (c) => !(c.outcome.addCardIds ?? []).some((id) => id.startsWith('fault_')),
        ) ?? ev.choices[0];
      run = resolveEventChoice(run, safeChoice.id, pools);
      run = proceedToMapFromNode(run, rng);
    } else if (run.phase === 'REST') {
      run = claimRestBonusCredits(run);
      run = proceedToMapFromNode(run, rng);
    }
  }
  return run;
}

describe('Balance & Playability Simulation (All 15 Encounters + Full 3-Act Runs)', () => {
  it('verifies every single encounter (Acts 1-3) is beatable with a built deck', () => {
    const report: string[] = [];
    for (const enc of ALL_ENCOUNTERS) {
      // Simulate realistic deck/relic progression by Act
      const baseProfile = STARTER_PROFILES[0];
      const extraRelics =
        enc.act === 1
          ? []
          : enc.act === 2
            ? ['relic_l2_pinning', 'relic_liquid_cool']
            : ['relic_l2_pinning', 'relic_liquid_cool', 'relic_tvm_autotuner', 'relic_ecc_lpddr'];
      const extraCards =
        enc.act === 1
          ? []
          : enc.act === 2
            ? ['ker_preempt_rt', 'net_iceoryx_shm', 'vla_paged_kv', 'cpp_soa_layout']
            : [
                'ker_preempt_rt',
                'net_iceoryx_shm',
                'vla_paged_kv',
                'cpp_soa_layout',
                'sil_liquid_metal',
                'vla_sys1_sys2',
                'net_tsn_gate',
                'dep_smoothquant_int8',
              ];

      let wins = 0;
      const reasons: string[] = [];
      const trials = 10;
      for (let s = 1; s <= trials; s++) {
        const res = playBattleWithBot(
          enc,
          [...baseProfile.deckCardIds, ...extraCards],
          [...baseProfile.relicIds, ...extraRelics],
          mulberry32(s * 97 + enc.act * 13),
        );
        if (res.status === 'VICTORY') wins++;
        else if (res.defeatReason) reasons.push(res.defeatReason.slice(0, 42));
      }
      report.push(
        `Act ${enc.act} | ${enc.id.padEnd(22)} | ${String(wins).padStart(2)}/${trials} wins | ${reasons[0] ?? 'OK'}`,
      );
    }
    console.log('\n=== ENCOUNTER PLAYABILITY REPORT ===\n' + report.join('\n'));
    for (const line of report) {
      expect(line).not.toContain(' 0/10 wins');
    }
  });

  it('verifies full 3-Act roguelike runs can reach RUN_VICTORY across all 3 starter profiles', () => {
    const summary: string[] = [];
    const results: number[] = [];
    for (let p = 0; p < STARTER_PROFILES.length; p++) {
      let fullClears = 0;
      let act2Reached = 0;
      let act3Reached = 0;
      const failedAt: Record<string, number> = {};
      const trials = 12;
      for (let s = 1; s <= trials; s++) {
        const finalRun = playFullRunWithBot(p, 1000 + p * 100 + s);
        if (finalRun.act >= 2) act2Reached++;
        if (finalRun.act >= 3) act3Reached++;
        if (finalRun.phase === 'RUN_VICTORY') fullClears++;
        else {
          const k = `A${finalRun.act}:${finalRun.activeEncounterId}`;
          failedAt[k] = (failedAt[k] ?? 0) + 1;
        }
      }
      results.push(fullClears);
      summary.push(
        `${STARTER_PROFILES[p].code} | Clears ${fullClears}/${trials} | Act2 ${act2Reached}/${trials} | Act3 ${act3Reached}/${trials} | fails: ${JSON.stringify(failedAt)}`,
      );
    }
    console.log('\n=== FULL 3-ACT RUN SIMULATION ===\n' + summary.join('\n'));
    for (const c of results) {
      expect(c).toBeGreaterThan(0);
    }
  });
});
