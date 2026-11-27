import { cloneMetrics, computeTelemetry, evaluateSla } from './physics';
import {
  BattleState,
  CardDef,
  CardInstance,
  Domain,
  JuiceGrade,
  PipelinePreviewResult,
  PipelineStepSnapshot,
  SlaTarget,
  SystemMetrics,
  TraceEvent,
} from './types';

export type CardRegistry = Record<string, CardDef>;

export interface PipelineExecutionDetail {
  preview: PipelinePreviewResult;
  persistentMetrics: SystemMetrics;
  deployedNewPatchIds: string[];
  trace: TraceEvent[];
  extraDraw: number;
  clearedFaultTags: string[];
}

/**
 * Evaluates a staged pipeline in strict sequential order (Compiler Pass model).
 * Pure function — used both for real-time UI preview and for COMMIT execution.
 */
export function evaluatePipeline(
  state: BattleState,
  stagedCards: CardInstance[],
  cardRegistry: CardRegistry,
): PipelineExecutionDetail {
  let workingMetrics = cloneMetrics(state.baseMetrics);
  let persistentMetrics = cloneMetrics(state.baseMetrics);
  const effectiveSlaTarget: SlaTarget = { ...state.effectiveSlaTarget };

  const priorCardIds: string[] = [];
  const deployedPatchIds = [...state.deployedPatchIds];
  const deployedNewPatchIds: string[] = [];
  const steps: PipelineStepSnapshot[] = [];
  const trace: TraceEvent[] = [];
  const warnings: string[] = [];
  const synergies: string[] = [];
  const clearedFaultTags: string[] = [];

  let totalCost = 0;
  let cyclesRefunded = 0;
  let extraDraw = 0;

  for (let i = 0; i < stagedCards.length; i++) {
    const inst = stagedCards[i];
    const def = cardRegistry[inst.cardId];
    if (!def) continue;

    const telemetryBefore = computeTelemetry(workingMetrics);
    totalCost += def.cost;

    const outcome = def.apply({
      metrics: cloneMetrics(workingMetrics),
      telemetryBefore,
      priorCardIds: [...priorCardIds],
      deployedPatchIds: [...deployedPatchIds],
      relicIds: state.relicIds,
      slaTarget: { ...effectiveSlaTarget },
      cyclesRefunded,
      extraDraw,
      clearedFaultIds: [...clearedFaultTags],
    });

    workingMetrics = outcome.metrics;
    const telemetryAfter = computeTelemetry(workingMetrics);

    if (outcome.slaLatencyBonusMs) {
      effectiveSlaTarget.maxLatencyMs = Number(
        (effectiveSlaTarget.maxLatencyMs + outcome.slaLatencyBonusMs).toFixed(1),
      );
    }

    if (def.type === 'PATCH') {
      // Apply the same transformation to persistentMetrics so patches survive into next waves
      const persistentOutcome = def.apply({
        metrics: cloneMetrics(persistentMetrics),
        telemetryBefore: computeTelemetry(persistentMetrics),
        priorCardIds: [...priorCardIds],
        deployedPatchIds: [...deployedPatchIds],
        relicIds: state.relicIds,
        slaTarget: { ...effectiveSlaTarget },
        cyclesRefunded: 0,
        extraDraw: 0,
        clearedFaultIds: [],
      });
      persistentMetrics = persistentOutcome.metrics;
      if (!deployedPatchIds.includes(def.id)) {
        deployedPatchIds.push(def.id);
        deployedNewPatchIds.push(def.id);
      }
    } else if (def.type === 'RUNTIME') {
      // Thermal heat and RAM leak cleanups from runtime ops carry over to persistent state
      const tempDelta = workingMetrics.tempC - telemetryBefore.effectivePeakFlopsG * 0;
      void tempDelta;
      const heatDiff = outcome.metrics.tempC - state.baseMetrics.tempC;
      // Preserve explicit delta on tempC and ramLeakedMB/ramFragMB between before and after this step
      const prevRawTemp = i === 0 ? state.baseMetrics.tempC : steps[i - 1].metricsAfter.tempC;
      const prevRawLeaked = i === 0 ? state.baseMetrics.ramLeakedMB : steps[i - 1].metricsAfter.ramLeakedMB;
      const prevRawFrag = i === 0 ? state.baseMetrics.ramFragMB : steps[i - 1].metricsAfter.ramFragMB;

      const stepTempDelta = workingMetrics.tempC - prevRawTemp;
      const stepLeakedDelta = workingMetrics.ramLeakedMB - prevRawLeaked;
      const stepFragDelta = workingMetrics.ramFragMB - prevRawFrag;

      persistentMetrics.tempC = Math.max(
        persistentMetrics.ambientTempC,
        Number((persistentMetrics.tempC + stepTempDelta).toFixed(1)),
      );
      persistentMetrics.ramLeakedMB = Math.max(
        0,
        persistentMetrics.ramLeakedMB + stepLeakedDelta,
      );
      persistentMetrics.ramFragMB = Math.max(
        0,
        persistentMetrics.ramFragMB + stepFragDelta,
      );
      void heatDiff;
    }

    if (outcome.cyclesRefund) {
      cyclesRefunded += outcome.cyclesRefund;
    }
    if (outcome.extraDraw) {
      extraDraw += outcome.extraDraw;
    }
    if (outcome.clearFaultTag) {
      clearedFaultTags.push(outcome.clearFaultTag);
    }

    const bottleneckChanged =
      telemetryBefore.bottleneck !== telemetryAfter.bottleneck;

    const deltaLatencyMs = Number(
      (telemetryAfter.totalLatencyMs - telemetryBefore.totalLatencyMs).toFixed(2),
    );
    const deltaRamMB = telemetryAfter.ramUsedMB - telemetryBefore.ramUsedMB;
    const prevTemp = i === 0 ? state.baseMetrics.tempC : steps[i - 1].metricsAfter.tempC;
    const deltaTempC = Number((workingMetrics.tempC - prevTemp).toFixed(1));
    const deltaAccuracy = Number(
      (telemetryAfter.accuracyClamped - telemetryBefore.accuracyClamped).toFixed(1),
    );

    trace.push({
      kind: 'CARD_EXEC',
      cardInstanceId: inst.instanceId,
      cardId: def.id,
      title: `执行 [${def.code}] ${def.name}`,
      detail: `延迟 ${formatSigned(deltaLatencyMs)}ms · RAM ${formatSigned(deltaRamMB)}MB · 温度 ${formatSigned(deltaTempC)}°C`,
      deltaLatencyMs,
      deltaRamMB,
      deltaTempC,
      deltaAccuracy,
    });

    if (outcome.synergyNotice) {
      synergies.push(outcome.synergyNotice);
      trace.push({
        kind: 'SYNERGY_PROC',
        cardInstanceId: inst.instanceId,
        cardId: def.id,
        title: '流水线协同触发',
        detail: outcome.synergyNotice,
      });
    }

    if (outcome.warningNotice) {
      warnings.push(outcome.warningNotice);
      trace.push({
        kind: 'ANTI_PATTERN_WARN',
        cardInstanceId: inst.instanceId,
        cardId: def.id,
        title: '架构反模式警告',
        detail: outcome.warningNotice,
      });
    }

    if (bottleneckChanged) {
      trace.push({
        kind: 'ROOFLINE_SHIFT',
        cardInstanceId: inst.instanceId,
        cardId: def.id,
        title: `Roofline 拐点切换 → ${telemetryAfter.bottleneck}`,
        detail: `算术强度 ${telemetryAfter.arithmeticIntensity} vs 拐点 ${telemetryAfter.ridgePoint} FLOPs/Byte`,
      });
    }

    if (!telemetryBefore.isThermalThrottled && telemetryAfter.isThermalThrottled) {
      trace.push({
        kind: 'THERMAL_THROTTLE',
        cardInstanceId: inst.instanceId,
        cardId: def.id,
        title: '触发热节流降频！',
        detail: `结温达到 ${workingMetrics.tempC}°C，峰值算力被迫下降 35%`,
      });
    }

    steps.push({
      stepIndex: i,
      cardInstanceId: inst.instanceId,
      cardId: def.id,
      cardName: def.name,
      domain: def.domain,
      telemetryAfter,
      metricsAfter: cloneMetrics(workingMetrics),
      bottleneckChanged,
      synergyNotice: outcome.synergyNotice,
      warningNotice: outcome.warningNotice,
    });

    priorCardIds.push(def.id);
  }

  const finalTelemetryBeforeOverdrive = computeTelemetry(workingMetrics);
  const distinctDomains = Array.from(
    new Set(
      stagedCards
        .map((c) => cardRegistry[c.cardId])
        .filter((d): d is CardDef => Boolean(d) && d.type !== 'FAULT')
        .map((d) => d.domain),
    ),
  ) as Domain[];

  const overdriveActive = distinctDomains.length >= 3;
  if (overdriveActive) {
    workingMetrics.bandwidthGBs = Number((workingMetrics.bandwidthGBs * 1.12).toFixed(1));
    workingMetrics.peakFlopsG = Math.round(workingMetrics.peakFlopsG * 1.12);
    workingMetrics.osBaseMs = Number(Math.max(0.2, workingMetrics.osBaseMs - 1.0).toFixed(2));
    extraDraw += 1;

    const afterOd = computeTelemetry(workingMetrics);
    const odDeltaLat = Number(
      (afterOd.totalLatencyMs - finalTelemetryBeforeOverdrive.totalLatencyMs).toFixed(2),
    );
    const msg = `FULL-STACK OVERDRIVE（跨 ${distinctDomains.length} 域协同）！带宽 & 算力 ×1.12、额外 ${formatSigned(odDeltaLat)}ms，下波次多抽 1 张牌！`;
    synergies.push(msg);
    trace.push({
      kind: 'CHAIN_OVERDRIVE',
      title: `FULL-STACK OVERDRIVE ×${distinctDomains.length}`,
      detail: msg,
      deltaLatencyMs: odDeltaLat,
    });
  }

  const finalTelemetry = computeTelemetry(workingMetrics);
  const slaEval = evaluateSla(finalTelemetry, effectiveSlaTarget);
  const netCost = Math.max(0, totalCost - cyclesRefunded);
  const cyclesRemaining = state.cycles - netCost;

  let juiceGrade: JuiceGrade | null = null;
  if (slaEval.allMet) {
    const latMargin = effectiveSlaTarget.maxLatencyMs - finalTelemetry.totalLatencyMs;
    const accMargin = finalTelemetry.accuracyClamped - effectiveSlaTarget.minAccuracy;
    const score =
      latMargin * 2 +
      accMargin * 1.5 +
      (overdriveActive ? 6 : 0) +
      (warnings.length === 0 ? 3 : -3);
    juiceGrade = score >= 16 ? 'S' : score >= 9 ? 'A' : score >= 3 ? 'B' : 'C';
  }

  return {
    preview: {
      valid: cyclesRemaining >= 0,
      totalCost: netCost,
      cyclesRemaining,
      steps,
      finalMetrics: workingMetrics,
      finalTelemetry,
      effectiveSlaTarget,
      slaEval,
      warnings,
      synergies,
      distinctDomains,
      overdriveActive,
      juiceGrade,
    },
    persistentMetrics,
    deployedNewPatchIds,
    trace,
    extraDraw,
    clearedFaultTags,
  };
}

function formatSigned(n: number): string {
  if (n > 0) return `+${n}`;
  return `${n}`;
}
