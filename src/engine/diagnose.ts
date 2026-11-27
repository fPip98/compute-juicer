import { cloneMetrics, computeTelemetry, evaluateSla, predictWavesToRelease } from './physics';
import { CardRegistry, evaluatePipeline } from './pipeline';
import { FaultRegistry } from './battle';
import {
  BattleState,
  CardInstance,
  CounterfactualHint,
  FailureDiagnosis,
  RootCauseItem,
} from './types';

const MAX_COUNTERFACTUAL_CANDIDATES = 40;

/**
 * Analyzes why a wave or battle failed:
 * 1. Extracts Top-3 physical/architectural root causes (OOM, thermal hysteresis, TCP HOL lock,
 *    Memory-Bound anti-pattern, SLA bottleneck).
 * 2. Runs a bounded counterfactual search (<= 40 candidates) using ONLY the cards the player
 *    actually held on the last turn to produce a concrete "What if..." engineering lesson.
 */
export function diagnoseBattleFailure(
  battle: BattleState,
  cardRegistry: CardRegistry,
  faultRegistry: FaultRegistry,
): FailureDiagnosis {
  const causes: RootCauseItem[] = [];
  const tel = computeTelemetry(battle.baseMetrics);
  const m = battle.baseMetrics;

  // 1. OOM / Memory pressure
  if (tel.isOom || tel.ramPercent >= 90) {
    causes.push({
      id: 'rc_oom',
      severity: 'CRITICAL',
      titleZh: `显存/内存逼近或触及 OOM 红线 (${tel.ramUsedMB}/${m.ramCapMB}MB)`,
      titleEn: `VRAM/RAM Hit OOM Ceiling (${tel.ramUsedMB}/${m.ramCapMB}MB)`,
      detailZh: `权重 ${m.ramWeightsMB}MB + KV ${m.ramKvCacheMB}MB + 泄漏/碎片 ${m.ramLeakedMB + m.ramFragMB}MB；需部署量化/PagedAttention 或用 cgroup 回收/OPS 重启清泄漏。`,
      detailEn: `Weights ${m.ramWeightsMB}MB + KV ${m.ramKvCacheMB}MB + Leak/Frag ${m.ramLeakedMB + m.ramFragMB}MB. Deploy quantization/PagedAttention or purge leaks via cgroup/OPS Reboot.`,
      knowledgeId: 'k_oom_cgroup',
    });
  }

  // 2. Thermal Hysteresis Lock
  if (tel.isThermalThrottled || tel.isThermalShutdown) {
    const waves = predictWavesToRelease(m);
    causes.push({
      id: 'rc_thermal',
      severity: 'CRITICAL',
      titleZh: `芯片处于热滞回锁频态 (${m.tempC}°C · 算力 -35%)`,
      titleEn: `Thermal Hysteresis Throttled (${m.tempC}°C · -35% FLOPS)`,
      detailZh:
        waves === -1
          ? `当前功耗过高，自然散热无法降回 ≤${tel.thermalReleaseTempC}°C 解锁线，必须主动排热（PWM/降压）或 OPS 重启！`
          : `需降温至 ≤${tel.thermalReleaseTempC}°C 才恢复满频（当前自然散热约需 ${waves} 波）。`,
      detailEn:
        waves === -1
          ? `Passive cooling cannot reach ≤${tel.thermalReleaseTempC}°C release line at current power — use active cooling or OPS Reboot!`
          : `Requires cooling to ≤${tel.thermalReleaseTempC}°C to unlock (~${waves} waves passively).`,
      knowledgeId: 'k_thermal_throttling',
    });
  }

  // 3. Hard TCP HOL Lock
  if (m.flags['tcp_hol_locked']) {
    causes.push({
      id: 'rc_tcp_hol',
      severity: 'CRITICAL',
      titleZh: 'TCP 队头阻塞硬锁死网络段 (≥7.5ms)',
      titleEn: 'TCP Head-of-Line Hard Floor (≥7.5ms)',
      detailZh: '未对症解除 TCP 阻塞导致网络延迟被锁死在 7.5ms 以上，需用 TCP_NODELAY / UDP+FEC / Iceoryx 解除。',
      detailEn: 'Uncleared TCP HOL locked net bus latency ≥7.5ms. Clear it with TCP_NODELAY, UDP+FEC, or Iceoryx.',
      knowledgeId: 'k_tcp_nodelay',
    });
  }

  // 4. Anti-pattern warnings from last turn trace
  const antiPattern = battle.lastTurnTrace.find((t) => t.kind === 'ANTI_PATTERN_WARN');
  if (antiPattern) {
    causes.push({
      id: 'rc_antipattern',
      severity: 'WARNING',
      titleZh: '流水线存在架构反模式/顺序错误',
      titleEn: 'Pipeline Anti-Pattern / Ordering Mistake',
      detailZh: antiPattern.detail,
      detailEn: antiPattern.detail,
      knowledgeId: 'k_dvfs_roofline',
    });
  }

  // 5. Accuracy collapse
  if (tel.accuracyClamped < battle.effectiveSlaTarget.minAccuracy) {
    causes.push({
      id: 'rc_acc',
      severity: 'CRITICAL',
      titleZh: `模型精度跌破 SLA (${tel.accuracyClamped}% < ${battle.effectiveSlaTarget.minAccuracy}%)`,
      titleEn: `Accuracy Below SLA (${tel.accuracyClamped}% < ${battle.effectiveSlaTarget.minAccuracy}%)`,
      detailZh: '激进量化或电磁干扰导致精度不足，应在量化前先排 QAT 校准，或补打触觉力反馈校验。',
      detailEn: 'Aggressive quantization or EMI hurt accuracy. Stage QAT before quantizing or add Tactile Verification.',
      knowledgeId: 'k_qat_quant',
    });
  }

  // 6. Roofline / Latency bottleneck fallback
  if (causes.length < 3 && tel.totalLatencyMs > battle.effectiveSlaTarget.maxLatencyMs) {
    const isMem = tel.bottleneck === 'MEMORY_BOUND';
    causes.push({
      id: 'rc_latency',
      severity: 'WARNING',
      titleZh: isMem
        ? `端到端延迟超标 · 卡在 MEMORY-BOUND (${tel.memoryMs}ms 访存)`
        : `端到端延迟超标 · 卡在 COMPUTE-BOUND (${tel.computeMs}ms 算力)`,
      titleEn: isMem
        ? `Latency Over SLA · Stalled in MEMORY-BOUND (${tel.memoryMs}ms mem)`
        : `Latency Over SLA · Stalled in COMPUTE-BOUND (${tel.computeMs}ms comp)`,
      detailZh: isMem
        ? `总延迟 ${tel.totalLatencyMs}ms > SLA ${battle.effectiveSlaTarget.maxLatencyMs}ms，优先削减访存搬运量（INT4 / FlashAttention / 带宽卡）。`
        : `总延迟 ${tel.totalLatencyMs}ms > SLA ${battle.effectiveSlaTarget.maxLatencyMs}ms，算力已吃满，优先 NPU 卸载 / 超频 / Token 剪枝。`,
      detailEn: isMem
        ? `Total ${tel.totalLatencyMs}ms > SLA ${battle.effectiveSlaTarget.maxLatencyMs}ms. Cut memory traffic (INT4 / FlashAttention / BW) first.`
        : `Total ${tel.totalLatencyMs}ms > SLA ${battle.effectiveSlaTarget.maxLatencyMs}ms. Compute saturated — use NPU offload, DVFS, or Token Pruning.`,
      knowledgeId: isMem ? 'k_flash_attention' : 'k_dvfs_roofline',
    });
  }

  const counterfactual = computeCounterfactual(battle, cardRegistry, faultRegistry);

  return {
    topCauses: causes.slice(0, 3),
    counterfactual,
  };
}

function simulateWithFaults(
  baseBattle: BattleState,
  order: CardInstance[],
  upcomingFaultIds: string[],
  cardRegistry: CardRegistry,
  faultRegistry: FaultRegistry,
): { valid: boolean; latencyMs: number; accuracy: number; allMet: boolean; isFatal: boolean } {
  const res = evaluatePipeline(baseBattle, order, cardRegistry);
  if (!res.preview.valid) {
    return { valid: false, latencyMs: 999, accuracy: 0, allMet: false, isFatal: true };
  }
  let m = cloneMetrics(res.preview.finalMetrics);
  for (const fid of upcomingFaultIds) {
    const f = faultRegistry[fid];
    if (f) m = f.apply(m).metrics;
  }
  const tel = computeTelemetry(m);
  const slaEval = evaluateSla(tel, res.preview.effectiveSlaTarget);
  return {
    valid: true,
    latencyMs: tel.totalLatencyMs,
    accuracy: tel.accuracyClamped,
    allMet: slaEval.allMet,
    isFatal: tel.isOom || tel.isThermalShutdown,
  };
}

function computeCounterfactual(
  battle: BattleState,
  cardRegistry: CardRegistry,
  faultRegistry: FaultRegistry,
): CounterfactualHint | null {
  const snap = battle.lastTurnSnapshot;
  if (!snap || snap.handAndStaged.length === 0) return null;

  const snapBattle: BattleState = {
    ...battle,
    wave: snap.wave,
    cycles: battle.maxCycles,
    baseMetrics: cloneMetrics(snap.baseMetrics),
    effectiveSlaTarget: { ...snap.effectiveSlaTarget },
    rackSlots: { ...snap.rackSlots },
    deployedPatchIds: Object.values(snap.rackSlots).filter((id): id is string => Boolean(id)),
    opsUsedThisWave: null,
  };

  const actual = simulateWithFaults(
    snapBattle,
    snap.stagedPipeline,
    snap.upcomingFaultIds,
    cardRegistry,
    faultRegistry,
  );

  // Build up to MAX_COUNTERFACTUAL_CANDIDATES ordered plays from the exact cards held that turn:
  // 1) Reorderings of the played cards (catches QAT->INT4 or FlashAttention->DVFS!)
  // 2) Single-card swaps / additions from the rest of the hand
  const candidates: CardInstance[][] = [];
  const seenKeys = new Set<string>([
    snap.stagedPipeline.map((c) => c.cardId).join(','),
  ]);

  const pushCand = (arr: CardInstance[]) => {
    if (candidates.length >= MAX_COUNTERFACTUAL_CANDIDATES) return;
    const key = arr.map((c) => c.cardId).join(',');
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    candidates.push(arr);
  };

  // Reorderings of staged cards (adjacent swaps + reverse)
  if (snap.stagedPipeline.length >= 2) {
    pushCand([...snap.stagedPipeline].reverse());
    for (let i = 0; i < snap.stagedPipeline.length - 1; i++) {
      const copy = [...snap.stagedPipeline];
      [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
      pushCand(copy);
    }
  }

  // Greedy combinations up to 3 cards from handAndStaged
  const pool = snap.handAndStaged;
  for (let i = 0; i < pool.length && candidates.length < MAX_COUNTERFACTUAL_CANDIDATES; i++) {
    pushCand([pool[i]]);
    for (let j = 0; j < pool.length && candidates.length < MAX_COUNTERFACTUAL_CANDIDATES; j++) {
      if (i === j) continue;
      const c2 = [pool[i], pool[j]];
      const cost2 =
        (cardRegistry[pool[i].cardId]?.cost ?? 0) +
        (cardRegistry[pool[j].cardId]?.cost ?? 0);
      if (cost2 <= snapBattle.cycles + 1) pushCand(c2);
      for (let k = j + 1; k < pool.length && candidates.length < MAX_COUNTERFACTUAL_CANDIDATES; k++) {
        if (k === i) continue;
        const cost3 = cost2 + (cardRegistry[pool[k].cardId]?.cost ?? 0);
        if (cost3 <= snapBattle.cycles + 1) {
          pushCand([pool[i], pool[j], pool[k]]);
        }
      }
    }
  }

  let bestOrder: CardInstance[] | null = null;
  let bestRes = actual;
  for (const cand of candidates) {
    const r = simulateWithFaults(
      snapBattle,
      cand,
      snap.upcomingFaultIds,
      cardRegistry,
      faultRegistry,
    );
    if (!r.valid || r.isFatal) continue;
    const betterPass = r.allMet && !bestRes.allMet;
    const samePassBetterLat =
      r.allMet === bestRes.allMet &&
      r.latencyMs + 0.8 < bestRes.latencyMs &&
      r.accuracy >= snap.effectiveSlaTarget.minAccuracy - 1;
    if (betterPass || samePassBetterLat) {
      bestRes = r;
      bestOrder = cand;
    }
  }

  if (!bestOrder) return null;

  const namesZh = bestOrder
    .map((c) => cardRegistry[c.cardId]?.name ?? c.cardId)
    .join(' → ');
  const codesEn = bestOrder
    .map((c) => cardRegistry[c.cardId]?.code ?? c.cardId)
    .join(' → ');

  return {
    summaryZh: bestRes.allMet
      ? `如果当时按「${namesZh}」编排，延迟可从 ${actual.latencyMs}ms 降至 ${bestRes.latencyMs}ms（精度 ${bestRes.accuracy}%），直接满足 SLA！`
      : `如果当时改打「${namesZh}」，延迟可从 ${actual.latencyMs}ms 压低至 ${bestRes.latencyMs}ms（精度 ${bestRes.accuracy}%）。`,
    summaryEn: bestRes.allMet
      ? `Staging [${codesEn}] would drop latency ${actual.latencyMs}ms → ${bestRes.latencyMs}ms (Acc ${bestRes.accuracy}%) and PASS SLA!`
      : `Staging [${codesEn}] would improve latency ${actual.latencyMs}ms → ${bestRes.latencyMs}ms (Acc ${bestRes.accuracy}%).`,
    suggestedCardIds: bestOrder.map((c) => c.cardId),
    actualLatencyMs: actual.latencyMs,
    whatIfLatencyMs: bestRes.latencyMs,
    actualAccuracy: actual.accuracy,
    whatIfAccuracy: bestRes.accuracy,
    wouldPassSla: bestRes.allMet,
  };
}
