import { cloneMetrics, computeTelemetry, evaluateSla, stepThermal } from './physics';
import { CardRegistry, evaluatePipeline } from './pipeline';
import {
  BattleState,
  CardInstance,
  EncounterDef,
  FaultDef,
  RelicDef,
  TraceEvent,
} from './types';

export type RelicRegistry = Record<string, RelicDef>;
export type FaultRegistry = Record<string, FaultDef>;

const HAND_SIZE = 5;

let nextInstanceSeq = 1;
export function createCardInstance(cardId: string): CardInstance {
  return {
    instanceId: `${cardId}#${nextInstanceSeq++}`,
    cardId,
  };
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function drawCards(
  drawPile: CardInstance[],
  discardPile: CardInstance[],
  count: number,
  rng: () => number = Math.random,
): { drawn: CardInstance[]; drawPile: CardInstance[]; discardPile: CardInstance[] } {
  let dPile = [...drawPile];
  let discPile = [...discardPile];
  const drawn: CardInstance[] = [];

  for (let i = 0; i < count; i++) {
    if (dPile.length === 0) {
      if (discPile.length === 0) break;
      dPile = shuffle(discPile, rng);
      discPile = [];
    }
    const top = dPile.pop();
    if (top) drawn.push(top);
  }

  return { drawn, drawPile: dPile, discardPile: discPile };
}

export function initBattle(
  encounter: EncounterDef,
  deckCardIds: string[],
  relicIds: string[],
  relicRegistry: RelicRegistry,
  rng: () => number = Math.random,
): BattleState {
  let baseMetrics = cloneMetrics(encounter.baseMetrics);
  for (const rid of relicIds) {
    const relic = relicRegistry[rid];
    if (relic?.onBattleStart) {
      baseMetrics = relic.onBattleStart(cloneMetrics(baseMetrics));
    }
  }

  const initialDeck = shuffle(
    deckCardIds.map((id) => createCardInstance(id)),
    rng,
  );
  const { drawn, drawPile, discardPile } = drawCards(
    initialDeck,
    [],
    HAND_SIZE,
    rng,
  );

  const upcomingFaultIds = encounter.waveFaultSchedule[0] ?? [];

  const maxStability = encounter.isBoss ? 4 : 3;

  return {
    encounterId: encounter.id,
    wave: 1,
    totalWaves: encounter.totalWaves,
    slaPasses: 0,
    requiredSlaPasses: encounter.requiredSlaPasses,
    stability: maxStability,
    maxStability,
    cycles: 3,
    maxCycles: 3,
    baseMetrics,
    effectiveSlaTarget: { ...encounter.slaTarget },
    relicIds: [...relicIds],
    deployedPatchIds: [],
    watchdogAvailable: relicIds.includes('relic_watchdog'),
    drawPile,
    hand: drawn,
    stagedPipeline: [],
    discardPile,
    exhaustPile: [],
    upcomingFaultIds: [...upcomingFaultIds],
    lastTurnTrace: [],
    robotMood: 'NOMINAL',
    status: 'PLANNING',
  };
}

export function stageCard(state: BattleState, instanceId: string): BattleState {
  if (state.status !== 'PLANNING') return state;
  const card = state.hand.find((c) => c.instanceId === instanceId);
  if (!card) return state;
  return {
    ...state,
    hand: state.hand.filter((c) => c.instanceId !== instanceId),
    stagedPipeline: [...state.stagedPipeline, card],
  };
}

export function unstageCard(state: BattleState, instanceId: string): BattleState {
  if (state.status !== 'PLANNING') return state;
  const card = state.stagedPipeline.find((c) => c.instanceId === instanceId);
  if (!card) return state;
  return {
    ...state,
    stagedPipeline: state.stagedPipeline.filter((c) => c.instanceId !== instanceId),
    hand: [...state.hand, card],
  };
}

export function reorderStagedCard(
  state: BattleState,
  fromIndex: number,
  toIndex: number,
): BattleState {
  if (state.status !== 'PLANNING') return state;
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= state.stagedPipeline.length ||
    toIndex >= state.stagedPipeline.length ||
    fromIndex === toIndex
  ) {
    return state;
  }
  const next = [...state.stagedPipeline];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return {
    ...state,
    stagedPipeline: next,
  };
}

export function commitTurn(
  state: BattleState,
  encounter: EncounterDef,
  cardRegistry: CardRegistry,
  faultRegistry: FaultRegistry,
  relicRegistry: RelicRegistry,
  rng: () => number = Math.random,
): BattleState {
  if (state.status !== 'PLANNING') return state;

  const evalDetail = evaluatePipeline(state, state.stagedPipeline, cardRegistry);
  if (!evalDetail.preview.valid) {
    return state; // Not enough cycles
  }

  const trace: TraceEvent[] = [...evalDetail.trace];
  let turnMetrics = cloneMetrics(evalDetail.preview.finalMetrics);
  let persistentMetrics = cloneMetrics(evalDetail.persistentMetrics);
  const effectiveSlaTarget = { ...evalDetail.preview.effectiveSlaTarget };

  const newDiscard = [...state.discardPile];
  const newExhaust = [...state.exhaustPile];
  const injectedFaultCards: CardInstance[] = [];

  // Move staged cards to exhaust (PATCH / cleared FAULT) or discard (RUNTIME)
  for (const inst of state.stagedPipeline) {
    const def = cardRegistry[inst.cardId];
    if (def?.type === 'PATCH' || def?.type === 'FAULT') {
      newExhaust.push(inst);
    } else {
      newDiscard.push(inst);
    }
  }

  // Discard remaining hand (and clear any FAULT cards matching clearedFaultTags)
  for (const inst of state.hand) {
    const def = cardRegistry[inst.cardId];
    if (def?.faultTag && evalDetail.clearedFaultTags.includes(def.faultTag)) {
      newExhaust.push(inst);
    } else {
      newDiscard.push(inst);
    }
  }

  // Apply telegraphed wave faults
  for (const fid of state.upcomingFaultIds) {
    const fault = faultRegistry[fid];
    if (!fault) continue;
    const faultResult = fault.apply(cloneMetrics(turnMetrics));
    turnMetrics = faultResult.metrics;

    // Also persist leak/fragmentation/temp shocks into persistentMetrics
    const persResult = fault.apply(cloneMetrics(persistentMetrics));
    persistentMetrics.ramLeakedMB = persResult.metrics.ramLeakedMB;
    persistentMetrics.ramFragMB = persResult.metrics.ramFragMB;
    persistentMetrics.tempC = persResult.metrics.tempC;

    trace.push({
      kind: 'FAULT_HIT',
      title: faultResult.blockedBy
        ? `故障被拦截：${fault.name}`
        : `线上故障冲击：${fault.name}`,
      detail: faultResult.blockedBy
        ? `已由 [${faultResult.blockedBy}] 免疫！`
        : faultResult.logDetail,
    });

    if (!faultResult.blockedBy && fault.injectFaultCardId) {
      injectedFaultCards.push(createCardInstance(fault.injectFaultCardId));
    }
  }

  // Evaluate SLA & fatal conditions
  let telemetry = computeTelemetry(turnMetrics);
  let slaEval = evaluateSla(telemetry, effectiveSlaTarget);
  let watchdogAvailable = state.watchdogAvailable;

  // Watchdog relic saves once from fatal OOM or Thermal Shutdown
  if ((telemetry.isOom || telemetry.isThermalShutdown) && watchdogAvailable) {
    watchdogAvailable = false;
    turnMetrics.ramLeakedMB = 0;
    turnMetrics.ramFragMB = 0;
    turnMetrics.tempC = Math.min(turnMetrics.tempC, turnMetrics.throttleTempC - 8);
    persistentMetrics.ramLeakedMB = 0;
    persistentMetrics.ramFragMB = 0;
    persistentMetrics.tempC = turnMetrics.tempC;

    telemetry = computeTelemetry(turnMetrics);
    slaEval = evaluateSla(telemetry, effectiveSlaTarget);

    trace.push({
      kind: 'WATCHDOG_SAVE',
      title: '硬件 Watchdog 紧急复位！',
      detail: '看门狗在宕机瞬间强制重启子进程，清空内存泄漏并紧急降温，本关仅生效一次。',
    });
  }

  let slaPasses = state.slaPasses;
  let stability = state.stability;
  let status: BattleState['status'] = 'PLANNING';
  let defeatReason: string | undefined;

  if (telemetry.isOom || telemetry.isThermalShutdown) {
    status = 'DEFEAT';
    defeatReason = slaEval.failureReason;
    trace.push({
      kind: 'OOM_TRIGGERED',
      title: telemetry.isOom ? 'KERNEL PANIC: OOM KILLER' : 'HARDWARE THERMAL SHUTDOWN',
      detail: slaEval.failureReason ?? '系统致命宕机',
    });
  } else if (slaEval.allMet) {
    slaPasses += 1;
    trace.push({
      kind: 'SLA_PASS',
      title: `波次 ${state.wave} SLA 压测达标！`,
      detail: `延迟 ${telemetry.totalLatencyMs}ms (≤${effectiveSlaTarget.maxLatencyMs}ms) · 精度 ${telemetry.accuracyClamped}% (≥${effectiveSlaTarget.minAccuracy}%)`,
    });
  } else {
    stability -= 1;
    trace.push({
      kind: 'SLA_FAIL',
      title: `波次 ${state.wave} SLA 未达标（稳定性 -1）`,
      detail: slaEval.failureReason ?? '未满足本波次 SLA 指标',
    });
    if (stability <= 0) {
      status = 'DEFEAT';
      defeatReason = `系统稳定性归零：${slaEval.failureReason ?? '多次 SLA 违约导致产线验收失败'}`;
    }
  }

  // Natural thermal dissipation into next wave
  persistentMetrics = stepThermal(persistentMetrics);

  // Check victory / end-of-waves
  const nextWave = state.wave + 1;
  if (status === 'PLANNING') {
    if (slaPasses >= state.requiredSlaPasses) {
      status = 'VICTORY';
    } else if (nextWave > state.totalWaves) {
      status = 'DEFEAT';
      defeatReason = `压测波次耗尽，仅完成 ${slaPasses}/${state.requiredSlaPasses} 次 SLA 验收达标`;
    }
  }

  // Prepare next turn
  let drawPile = state.drawPile;
  let hand: CardInstance[] = [];
  let discardPile = newDiscard;
  let upcomingFaultIds: string[] = [];

  if (status === 'PLANNING') {
    for (const rid of state.relicIds) {
      const relic = relicRegistry[rid];
      if (relic?.onTurnStart) {
        persistentMetrics = relic.onTurnStart(cloneMetrics(persistentMetrics), nextWave);
      }
    }
    // Place newly injected FAULT cards onto the top of drawPile so players actually face them next wave
    const drawWithFaults = [...drawPile, ...injectedFaultCards];
    const drawRes = drawCards(
      drawWithFaults,
      discardPile,
      HAND_SIZE + evalDetail.extraDraw,
      rng,
    );
    hand = drawRes.drawn;
    drawPile = drawRes.drawPile;
    discardPile = drawRes.discardPile;
    upcomingFaultIds = encounter.waveFaultSchedule[nextWave - 1] ?? [];
  }

  return {
    ...state,
    wave: status === 'PLANNING' ? nextWave : state.wave,
    slaPasses,
    stability,
    cycles: state.maxCycles,
    baseMetrics: persistentMetrics,
    effectiveSlaTarget,
    deployedPatchIds: [
      ...state.deployedPatchIds,
      ...evalDetail.deployedNewPatchIds,
    ],
    watchdogAvailable,
    drawPile,
    hand,
    stagedPipeline: [],
    discardPile,
    exhaustPile: newExhaust,
    upcomingFaultIds,
    lastTurnTrace: trace,
    robotMood: status === 'VICTORY' ? 'VICTORY' : slaEval.robotMood,
    status,
    defeatReason,
  };
}
