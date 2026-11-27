import { initBattle, shuffle } from './battle';
import { computeTelemetry } from './physics';
import { RelicRegistry } from './battle';
import {
  CardDef,
  EncounterDef,
  JuiceGrade,
  MapNode,
  RandomEventDef,
  RelicDef,
  RunState,
  ShopInventory,
  StarterProfile,
} from './types';

export interface RunContentPools {
  cards: CardDef[];
  relics: RelicDef[];
  relicRegistry: RelicRegistry;
  encounters: Record<string, EncounterDef>;
  events: Record<string, RandomEventDef>;
  profiles: Record<string, StarterProfile>;
}

const ACT_MAP_BLUEPRINTS: Record<
  1 | 2 | 3,
  {
    startEncounter: string;
    midBattle: string;
    eliteEncounter: string;
    lateBattle: string;
    bossEncounter: string;
    eventPool: string[];
  }
> = {
  1: {
    startEncounter: 'act1_bringup',
    midBattle: 'act1_camera_pipe',
    eliteEncounter: 'act1_elite_leak',
    lateBattle: 'act1_thermal_bench',
    bossEncounter: 'act1_boss_egg',
    eventPool: ['evt_pm_4k', 'evt_intern_malloc'],
  },
  2: {
    startEncounter: 'act2_multi_sensor',
    midBattle: 'act2_dds_storm',
    eliteEncounter: 'act2_elite_irq',
    lateBattle: 'act2_kv_bloat',
    bossEncounter: 'act2_boss_quadruped',
    eventPool: ['evt_legacy_asm', 'evt_supply_chip'],
  },
  3: {
    startEncounter: 'act3_hot_chassis',
    midBattle: 'act3_ota_storm',
    eliteEncounter: 'act3_elite_vla_long',
    lateBattle: 'act3_net_blackout',
    bossEncounter: 'act3_boss_autonomous',
    eventPool: ['evt_kernel_panic_prod', 'evt_investor_demo'],
  },
};

/**
 * Generates a crisp 5-column branching DAG for a given Act:
 * Col 0: Start Battle (1 node)
 * Col 1: Mid Battle (row 0) | Random Event (row 1)
 * Col 2: Elite Fault (row 0) | Hardware Shop (row 1)
 * Col 3: Rest/Refactor Bench (row 0) | Late Battle (row 1)
 * Col 4: Act Boss (1 node)
 */
export function buildActMap(act: 1 | 2 | 3, rng: () => number = Math.random): MapNode[] {
  const bp = ACT_MAP_BLUEPRINTS[act];
  const evtId = bp.eventPool[Math.floor(rng() * bp.eventPool.length)] ?? bp.eventPool[0];

  const n0: MapNode = {
    id: `act${act}_start`,
    act,
    col: 0,
    row: 0,
    type: 'BATTLE',
    label: act === 1 ? '单板 Bring-up' : act === 2 ? '多传感器联调' : '高温机箱压测',
    labelEn: act === 1 ? 'Board Bring-up' : act === 2 ? 'Multi-Sensor Sync' : 'Hot Chassis Stress',
    encounterId: bp.startEncounter,
    nextNodeIds: [`act${act}_mid_battle`, `act${act}_event`],
    visited: false,
  };

  const n1a: MapNode = {
    id: `act${act}_mid_battle`,
    act,
    col: 1,
    row: 0,
    type: 'BATTLE',
    label: act === 1 ? '相机管线调优' : act === 2 ? 'DDS 总线风暴' : '后台 OTA 抢占',
    labelEn: act === 1 ? 'Camera Pipeline' : act === 2 ? 'DDS Bus Storm' : 'OTA Preemption',
    encounterId: bp.midBattle,
    nextNodeIds: [`act${act}_elite`, `act${act}_shop`],
    visited: false,
  };

  const n1b: MapNode = {
    id: `act${act}_event`,
    act,
    col: 1,
    row: 1,
    type: 'EVENT',
    label: '研发随机事件',
    labelEn: 'R&D Incident',
    eventId: evtId,
    nextNodeIds: [`act${act}_elite`, `act${act}_shop`],
    visited: false,
  };

  const n2a: MapNode = {
    id: `act${act}_elite`,
    act,
    col: 2,
    row: 0,
    type: 'ELITE',
    label: '精英 P0 故障',
    labelEn: 'Elite P0 Fault',
    encounterId: bp.eliteEncounter,
    nextNodeIds: [`act${act}_rest`, `act${act}_late_battle`],
    visited: false,
  };

  const n2b: MapNode = {
    id: `act${act}_shop`,
    act,
    col: 2,
    row: 1,
    type: 'SHOP',
    label: '架构采购商店',
    labelEn: 'Hardware Shop',
    nextNodeIds: [`act${act}_rest`, `act${act}_late_battle`],
    visited: false,
  };

  const n3a: MapNode = {
    id: `act${act}_rest`,
    act,
    col: 3,
    row: 0,
    type: 'REST',
    label: '代码重构营地',
    labelEn: 'Refactor Bench',
    nextNodeIds: [`act${act}_boss`],
    visited: false,
  };

  const n3b: MapNode = {
    id: `act${act}_late_battle`,
    act,
    col: 3,
    row: 1,
    type: 'BATTLE',
    label: act === 1 ? '热风道拷机' : act === 2 ? '长上下文膨胀' : '弱网丢包降级',
    labelEn: act === 1 ? 'Thermal Soak' : act === 2 ? 'KV Cache Bloat' : 'Weak-Net Fallback',
    encounterId: bp.lateBattle,
    nextNodeIds: [`act${act}_boss`],
    visited: false,
  };

  const n4: MapNode = {
    id: `act${act}_boss`,
    act,
    col: 4,
    row: 0,
    type: 'BOSS',
    label: act === 1 ? 'BOSS · 机械臂抓鸡蛋' : act === 2 ? 'BOSS · 四足盲走楼梯' : 'BOSS · 暴雨无风扇智驾',
    labelEn: act === 1 ? 'BOSS · Egg Arm' : act === 2 ? 'BOSS · Blind Quadruped' : 'BOSS · Fanless Storm VLA',
    encounterId: bp.bossEncounter,
    nextNodeIds: [],
    visited: false,
  };

  return [n0, n1a, n1b, n2a, n2b, n3a, n3b, n4];
}

export function createInitialRunState(): RunState {
  return {
    phase: 'SELECT_PROFILE',
    profileId: null,
    act: 1,
    credits: 0,
    deckCardIds: [],
    relicIds: [],
    nodes: [],
    currentNodeId: null,
    reachableNodeIds: [],
    activeBattle: null,
    activeEncounterId: null,
    activeReward: null,
    activeShop: null,
    activeEvent: null,
    restDone: false,
    battlesWon: 0,
    seenEventIds: [],
    lastGrade: null,
  };
}

export function startRunWithProfile(
  profile: StarterProfile,
  startAct: 1 | 2 | 3 = 1,
  rng: () => number = Math.random,
): RunState {
  const nodes = buildActMap(startAct, rng);
  const actCreditBonus = (startAct - 1) * 100;
  return {
    phase: 'MAP',
    profileId: profile.id,
    act: startAct,
    credits: profile.startingCredits + actCreditBonus,
    deckCardIds: [...profile.deckCardIds],
    relicIds: [...profile.relicIds],
    nodes,
    currentNodeId: null,
    reachableNodeIds: [nodes[0].id],
    activeBattle: null,
    activeEncounterId: null,
    activeReward: null,
    activeShop: null,
    activeEvent: null,
    restDone: false,
    battlesWon: 0,
    seenEventIds: [],
    lastGrade: null,
  };
}

export function switchRunAct(
  run: RunState,
  targetAct: 1 | 2 | 3,
  rng: () => number = Math.random,
): RunState {
  if (run.phase === 'SELECT_PROFILE') return run;
  if (run.phase === 'MAP' && run.act === targetAct) return run;
  const nodes = buildActMap(targetAct, rng);
  return {
    ...run,
    phase: 'MAP',
    act: targetAct,
    nodes,
    currentNodeId: null,
    reachableNodeIds: [nodes[0].id],
    activeBattle: null,
    activeEncounterId: null,
    activeReward: null,
    activeShop: null,
    activeEvent: null,
  };
}

export function enterMapNode(
  run: RunState,
  nodeId: string,
  pools: RunContentPools,
  rng: () => number = Math.random,
): RunState {
  if (run.phase !== 'MAP' || !run.reachableNodeIds.includes(nodeId)) {
    return run;
  }
  const node = run.nodes.find((n) => n.id === nodeId);
  if (!node) return run;

  const updatedNodes = run.nodes.map((n) =>
    n.id === nodeId ? { ...n, visited: true } : n,
  );

  if (node.type === 'BATTLE' || node.type === 'ELITE' || node.type === 'BOSS') {
    const enc = node.encounterId ? pools.encounters[node.encounterId] : undefined;
    if (!enc) return run;
    const battle = initBattle(enc, run.deckCardIds, run.relicIds, pools.relicRegistry, rng);
    return {
      ...run,
      phase: 'BATTLE',
      nodes: updatedNodes,
      currentNodeId: nodeId,
      reachableNodeIds: [],
      activeBattle: battle,
      activeEncounterId: enc.id,
    };
  }

  if (node.type === 'SHOP') {
    const shop = buildShopInventory(run, pools, rng);
    return {
      ...run,
      phase: 'SHOP',
      nodes: updatedNodes,
      currentNodeId: nodeId,
      reachableNodeIds: [],
      activeShop: shop,
    };
  }

  if (node.type === 'EVENT') {
    const eventId = node.eventId ?? Object.keys(pools.events)[0];
    return {
      ...run,
      phase: 'EVENT',
      nodes: updatedNodes,
      currentNodeId: nodeId,
      reachableNodeIds: [],
      activeEvent: { eventId },
      seenEventIds: [...run.seenEventIds, eventId],
    };
  }

  if (node.type === 'REST') {
    return {
      ...run,
      phase: 'REST',
      nodes: updatedNodes,
      currentNodeId: nodeId,
      reachableNodeIds: [],
      restDone: false,
    };
  }

  return run;
}

export function finishBattleInRun(
  run: RunState,
  pools: RunContentPools,
  rng: () => number = Math.random,
): RunState {
  const battle = run.activeBattle;
  if (run.phase !== 'BATTLE' || !battle) return run;

  if (battle.status === 'DEFEAT') {
    return {
      ...run,
      phase: 'RUN_DEFEAT',
    };
  }
  if (battle.status !== 'VICTORY') return run;

  const currentNode = run.nodes.find((n) => n.id === run.currentNodeId);
  const enc = run.activeEncounterId ? pools.encounters[run.activeEncounterId] : undefined;

  // Compute grade from final telemetry
  const tel = computeTelemetry(battle.baseMetrics);
  const latMargin = battle.effectiveSlaTarget.maxLatencyMs - tel.totalLatencyMs;
  const grade: JuiceGrade =
    battle.stability === battle.maxStability && latMargin >= 3
      ? 'S'
      : battle.stability >= 2
        ? 'A'
        : 'B';

  // If Act 3 Boss beaten -> RUN_VICTORY!
  if (currentNode?.type === 'BOSS' && run.act === 3) {
    return {
      ...run,
      phase: 'RUN_VICTORY',
      battlesWon: run.battlesWon + 1,
      lastGrade: grade,
      credits: run.credits + (enc?.rewardCredits ?? 200),
    };
  }

  // Smart weighted 2+1 draft (2 focus-domain + 1 cross-domain, deduplicating owned PATCHes)
  const cardChoices = draftSmartCards(run, pools, 3, rng);

  // Drop an unowned relic on ELITE or BOSS clears
  let relicChoice: string | undefined;
  if (currentNode?.type === 'ELITE' || currentNode?.type === 'BOSS') {
    const unowned = pools.relics.filter((r) => !run.relicIds.includes(r.id));
    if (unowned.length > 0) {
      relicChoice = shuffle(unowned, rng)[0].id;
    }
  }

  const rewardCredits = (enc?.rewardCredits ?? 90) + (grade === 'S' ? 30 : 0);

  return {
    ...run,
    phase: 'REWARD',
    battlesWon: run.battlesWon + 1,
    credits: run.credits + rewardCredits,
    lastGrade: grade,
    activeReward: {
      credits: rewardCredits,
      cardChoices,
      relicChoice,
      skipBonusCredits: 35,
      cardClaimed: false,
      relicClaimed: !relicChoice,
      grade,
    },
  };
}

export function claimRewardCard(run: RunState, cardId: string): RunState {
  if (run.phase !== 'REWARD' || !run.activeReward || run.activeReward.cardClaimed) {
    return run;
  }
  if (!run.activeReward.cardChoices.includes(cardId)) return run;
  return {
    ...run,
    deckCardIds: [...run.deckCardIds, cardId],
    activeReward: {
      ...run.activeReward,
      cardClaimed: true,
    },
  };
}

export function skipRewardCard(run: RunState): RunState {
  if (run.phase !== 'REWARD' || !run.activeReward || run.activeReward.cardClaimed) {
    return run;
  }
  return {
    ...run,
    credits: run.credits + run.activeReward.skipBonusCredits,
    activeReward: {
      ...run.activeReward,
      cardClaimed: true,
    },
  };
}

export function claimRewardRelic(run: RunState): RunState {
  if (
    run.phase !== 'REWARD' ||
    !run.activeReward ||
    run.activeReward.relicClaimed ||
    !run.activeReward.relicChoice
  ) {
    return run;
  }
  const rid = run.activeReward.relicChoice;
  return {
    ...run,
    relicIds: run.relicIds.includes(rid) ? run.relicIds : [...run.relicIds, rid],
    activeReward: {
      ...run.activeReward,
      relicClaimed: true,
    },
  };
}

export function proceedToMapFromNode(
  run: RunState,
  rng: () => number = Math.random,
): RunState {
  const currentNode = run.nodes.find((n) => n.id === run.currentNodeId);

  // Advancing from Act 1/2 Boss -> Next Act!
  if (currentNode?.type === 'BOSS' && run.act < 3) {
    const nextAct = (run.act + 1) as 1 | 2 | 3;
    const nextNodes = buildActMap(nextAct, rng);
    return {
      ...run,
      phase: 'MAP',
      act: nextAct,
      nodes: nextNodes,
      currentNodeId: null,
      reachableNodeIds: [nextNodes[0].id],
      activeBattle: null,
      activeEncounterId: null,
      activeReward: null,
      activeShop: null,
      activeEvent: null,
    };
  }

  return {
    ...run,
    phase: 'MAP',
    reachableNodeIds: currentNode ? [...currentNode.nextNodeIds] : run.reachableNodeIds,
    activeBattle: null,
    activeEncounterId: null,
    activeReward: null,
    activeShop: null,
    activeEvent: null,
  };
}

function draftSmartCards(
  run: RunState,
  pools: RunContentPools,
  count: number,
  rng: () => number,
): string[] {
  const ownedSet = new Set(run.deckCardIds);
  // Exclude FAULT cards and already-owned persistent PATCH cards
  const eligible = pools.cards.filter(
    (c) => c.type !== 'FAULT' && !(c.type === 'PATCH' && ownedSet.has(c.id)),
  );
  const profile = run.profileId ? pools.profiles[run.profileId] : undefined;
  const focus = new Set(profile?.focusDomains ?? []);

  if (focus.size === 0 || count < 3) {
    return shuffle(eligible, rng)
      .slice(0, count)
      .map((c) => c.id);
  }

  const inFocus = shuffle(
    eligible.filter((c) => focus.has(c.domain)),
    rng,
  );
  const crossDomain = shuffle(
    eligible.filter((c) => !focus.has(c.domain)),
    rng,
  );

  const focusQuota = Math.max(1, count - 1); // 2+1 for 3-card draft, 3+1 for 4-card shop
  const picked: CardDef[] = [];
  picked.push(...inFocus.slice(0, focusQuota));
  picked.push(...crossDomain.slice(0, count - picked.length));

  if (picked.length < count) {
    const pickedIds = new Set(picked.map((c) => c.id));
    const rest = shuffle(
      eligible.filter((c) => !pickedIds.has(c.id)),
      rng,
    );
    picked.push(...rest.slice(0, count - picked.length));
  }

  return shuffle(picked, rng).map((c) => c.id);
}

function buildShopInventory(
  run: RunState,
  pools: RunContentPools,
  rng: () => number,
): ShopInventory {
  const shopCardIds = draftSmartCards(run, pools, 4, rng);
  const nonFaultCards = shopCardIds
    .map((id) => pools.cards.find((c) => c.id === id))
    .filter((c): c is CardDef => Boolean(c));
  const unownedRelics = shuffle(
    pools.relics.filter((r) => !run.relicIds.includes(r.id)),
    rng,
  ).slice(0, 2);

  return {
    cards: nonFaultCards.map((c) => ({
      cardId: c.id,
      price: c.type === 'PATCH' ? 75 : c.cost === 0 ? 65 : 55,
      sold: false,
    })),
    relics: unownedRelics.map((r) => ({
      relicId: r.id,
      price: 140,
      sold: false,
    })),
    removePrice: 60,
    removedThisVisit: false,
  };
}

export function buyShopCard(run: RunState, index: number): RunState {
  if (run.phase !== 'SHOP' || !run.activeShop) return run;
  const item = run.activeShop.cards[index];
  if (!item || item.sold || run.credits < item.price) return run;
  const nextCards = run.activeShop.cards.map((c, i) =>
    i === index ? { ...c, sold: true } : c,
  );
  return {
    ...run,
    credits: run.credits - item.price,
    deckCardIds: [...run.deckCardIds, item.cardId],
    activeShop: { ...run.activeShop, cards: nextCards },
  };
}

export function buyShopRelic(run: RunState, index: number): RunState {
  if (run.phase !== 'SHOP' || !run.activeShop) return run;
  const item = run.activeShop.relics[index];
  if (!item || item.sold || run.credits < item.price) return run;
  const nextRelics = run.activeShop.relics.map((r, i) =>
    i === index ? { ...r, sold: true } : r,
  );
  return {
    ...run,
    credits: run.credits - item.price,
    relicIds: run.relicIds.includes(item.relicId)
      ? run.relicIds
      : [...run.relicIds, item.relicId],
    activeShop: { ...run.activeShop, relics: nextRelics },
  };
}

export function removeDeckCardInShop(run: RunState, deckIndex: number): RunState {
  if (
    run.phase !== 'SHOP' ||
    !run.activeShop ||
    run.activeShop.removedThisVisit ||
    run.credits < run.activeShop.removePrice ||
    run.deckCardIds.length <= 6
  ) {
    return run;
  }
  if (deckIndex < 0 || deckIndex >= run.deckCardIds.length) return run;
  const nextDeck = [...run.deckCardIds];
  nextDeck.splice(deckIndex, 1);
  return {
    ...run,
    credits: run.credits - run.activeShop.removePrice,
    deckCardIds: nextDeck,
    activeShop: { ...run.activeShop, removedThisVisit: true },
  };
}

export function removeDeckCardAtRest(run: RunState, deckIndex: number): RunState {
  if (run.phase !== 'REST' || run.restDone || run.deckCardIds.length <= 6) {
    return run;
  }
  if (deckIndex < 0 || deckIndex >= run.deckCardIds.length) return run;
  const nextDeck = [...run.deckCardIds];
  nextDeck.splice(deckIndex, 1);
  return {
    ...run,
    deckCardIds: nextDeck,
    restDone: true,
  };
}

export function claimRestBonusCredits(run: RunState): RunState {
  if (run.phase !== 'REST' || run.restDone) return run;
  return {
    ...run,
    credits: run.credits + 65,
    restDone: true,
  };
}

export function resolveEventChoice(
  run: RunState,
  choiceId: string,
  pools: RunContentPools,
): RunState {
  if (run.phase !== 'EVENT' || !run.activeEvent || run.activeEvent.resolvedText) {
    return run;
  }
  const ev = pools.events[run.activeEvent.eventId];
  const choice = ev?.choices.find((c) => c.id === choiceId);
  if (!choice) return run;

  const out = choice.outcome;
  let credits = Math.max(0, run.credits + (out.creditsDelta ?? 0));
  let deck = [...run.deckCardIds];
  if (out.addCardIds) {
    deck = [...deck, ...out.addCardIds];
  }
  if (out.removeRandomFault) {
    const idx = deck.findIndex((id) => id.startsWith('fault_'));
    if (idx >= 0) deck.splice(idx, 1);
  }
  const relics =
    out.addRelicId && !run.relicIds.includes(out.addRelicId)
      ? [...run.relicIds, out.addRelicId]
      : [...run.relicIds];

  return {
    ...run,
    credits,
    deckCardIds: deck,
    relicIds: relics,
    activeEvent: {
      ...run.activeEvent,
      resolvedText: out.resultText,
      resolvedTextEn: out.resultTextEn,
    },
  };
}
