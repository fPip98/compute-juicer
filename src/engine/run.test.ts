import { describe, expect, it } from 'vitest';
import { CARD_LIST } from '../data/cards';
import { ENCOUNTER_REGISTRY } from '../data/encounters';
import { EVENT_REGISTRY } from '../data/events';
import { PROFILE_REGISTRY, STARTER_PROFILES } from '../data/profiles';
import { RELIC_LIST, RELIC_REGISTRY } from '../data/relics';
import {
  buyShopCard,
  claimRestBonusCredits,
  claimRewardCard,
  claimRewardRelic,
  createInitialRunState,
  enterMapNode,
  finishBattleInRun,
  proceedToMapFromNode,
  removeDeckCardAtRest,
  resolveEventChoice,
  RunContentPools,
  skipRewardCard,
  startRunWithProfile,
} from './run';

const pools: RunContentPools = {
  cards: CARD_LIST,
  relics: RELIC_LIST,
  relicRegistry: RELIC_REGISTRY,
  encounters: ENCOUNTER_REGISTRY,
  events: EVENT_REGISTRY,
  profiles: PROFILE_REGISTRY,
};

describe('Milestone 2 Roguelike Run State Machine', () => {
  it('starts at SELECT_PROFILE and initializes Act 1 map when a profile is chosen', () => {
    const init = createInitialRunState();
    expect(init.phase).toBe('SELECT_PROFILE');

    const run = startRunWithProfile(STARTER_PROFILES[0], 1, () => 0.3);
    expect(run.phase).toBe('MAP');
    expect(run.act).toBe(1);
    expect(run.nodes.length).toBe(8);
    expect(run.reachableNodeIds).toEqual(['act1_start']);
    expect(run.deckCardIds.length).toBeGreaterThanOrEqual(14);
  });

  it('deduplicates owned PATCH cards and applies 2+1 focus-domain weighting in reward drafts', () => {
    const profile = STARTER_PROFILES[0]; // focus: DEPLOY, VLA, SILICON
    let run = startRunWithProfile(profile, 1, () => 0.3);
    run = enterMapNode(run, 'act1_start', pools, () => 0.3);
    run = { ...run, activeBattle: { ...run.activeBattle!, status: 'VICTORY', slaPasses: 2 } };
    run = finishBattleInRun(run, pools, () => 0.3);

    const choices = run.activeReward!.cardChoices;
    expect(choices.length).toBe(3);
    // No already-owned PATCH should appear
    const owned = new Set(run.deckCardIds);
    for (const cid of choices) {
      const def = CARD_LIST.find((c) => c.id === cid)!;
      if (def.type === 'PATCH') {
        expect(owned.has(cid)).toBe(false);
      }
    }
    // 2 focus-domain + 1 cross-domain
    const focusSet = new Set(profile.focusDomains);
    const focusCount = choices.filter((cid) =>
      focusSet.has(CARD_LIST.find((c) => c.id === cid)!.domain),
    ).length;
    expect(focusCount).toBe(2);
  });

  it('progresses from battle victory -> reward draft -> map -> event -> shop -> rest -> Act 2', () => {
    let run = startRunWithProfile(STARTER_PROFILES[1], 1, () => 0.4);

    // 1. Enter Act 1 start battle
    run = enterMapNode(run, 'act1_start', pools, () => 0.4);
    expect(run.phase).toBe('BATTLE');
    expect(run.activeBattle).not.toBeNull();

    // Simulate battle victory
    run = {
      ...run,
      activeBattle: { ...run.activeBattle!, status: 'VICTORY', slaPasses: 2 },
    };
    run = finishBattleInRun(run, pools, () => 0.4);
    expect(run.phase).toBe('REWARD');
    expect(run.activeReward?.cardChoices.length).toBe(3);

    // Claim drafted card
    const picked = run.activeReward!.cardChoices[0];
    const prevDeckLen = run.deckCardIds.length;
    run = claimRewardCard(run, picked);
    expect(run.deckCardIds.length).toBe(prevDeckLen + 1);
    run = proceedToMapFromNode(run, () => 0.4);
    expect(run.phase).toBe('MAP');
    expect(run.reachableNodeIds).toContain('act1_event');

    // 2. Enter Random Event & resolve choice
    run = enterMapNode(run, 'act1_event', pools, () => 0.4);
    expect(run.phase).toBe('EVENT');
    const ev = EVENT_REGISTRY[run.activeEvent!.eventId];
    run = resolveEventChoice(run, ev.choices[0].id, pools);
    expect(run.activeEvent?.resolvedText).toBeTruthy();
    run = proceedToMapFromNode(run, () => 0.4);

    // 3. Enter Shop & buy first card
    run = enterMapNode(run, 'act1_shop', pools, () => 0.4);
    expect(run.phase).toBe('SHOP');
    const creditsBefore = run.credits;
    run = buyShopCard(run, 0);
    expect(run.credits).toBeLessThan(creditsBefore);
    run = proceedToMapFromNode(run, () => 0.4);

    // 4. Enter Rest Bench & remove 1 card
    run = enterMapNode(run, 'act1_rest', pools, () => 0.4);
    expect(run.phase).toBe('REST');
    const deckBeforeRemove = run.deckCardIds.length;
    run = removeDeckCardAtRest(run, 0);
    expect(run.deckCardIds.length).toBe(deckBeforeRemove - 1);
    expect(run.restDone).toBe(true);
    // Double-claiming rest credits after removing should be no-op
    const creditsAfterRest = run.credits;
    run = claimRestBonusCredits(run);
    expect(run.credits).toBe(creditsAfterRest);
    run = proceedToMapFromNode(run, () => 0.4);

    // 5. Enter Act 1 Boss -> Win -> Relic Drop -> Advance to Act 2!
    expect(run.reachableNodeIds).toEqual(['act1_boss']);
    run = enterMapNode(run, 'act1_boss', pools, () => 0.4);
    expect(run.phase).toBe('BATTLE');
    run = {
      ...run,
      activeBattle: { ...run.activeBattle!, status: 'VICTORY', slaPasses: 3 },
    };
    run = finishBattleInRun(run, pools, () => 0.4);
    expect(run.phase).toBe('REWARD');
    expect(run.activeReward?.relicChoice).toBeDefined();

    run = skipRewardCard(run);
    run = claimRewardRelic(run);
    run = proceedToMapFromNode(run, () => 0.4);
    expect(run.act).toBe(2);
    expect(run.phase).toBe('MAP');
    expect(run.reachableNodeIds).toEqual(['act2_start']);
  });
});
