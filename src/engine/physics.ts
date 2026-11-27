import {
  BottleneckState,
  ComputedTelemetry,
  RobotMood,
  SlaEvaluation,
  SlaTarget,
  SystemMetrics,
} from './types';

export const THERMAL_THROTTLE_FACTOR = 0.65; // -35% peak compute under thermal throttling
export const THERMAL_HYSTERESIS_C = 7.0;     // Must cool 7°C below throttleTempC (e.g. 85->78°C) to unlock

export function cloneMetrics(m: SystemMetrics): SystemMetrics {
  return {
    ...m,
    flags: { ...m.flags },
  };
}

/**
 * Pure SI-aligned Roofline + End-to-End Latency + RAM + Thermal Hysteresis evaluator.
 *
 * Units check:
 * - flopsG (GFLOPs) / effectivePeakFlopsG (GFLOPs/s) * 1000 = ms
 * - bytesMB (MB) / bandwidthGBs (GB/s) = exact ms
 * - arithmeticIntensity = (flopsG * 1000) / bytesMB = FLOPs / Byte
 * - ridgePoint = effectivePeakFlopsG / bandwidthGBs = FLOPs / Byte
 */
export function computeTelemetry(m: SystemMetrics): ComputedTelemetry {
  const thermalReleaseTempC = round1(m.throttleTempC - THERMAL_HYSTERESIS_C);
  // Real hardware thermal hysteresis:
  // - Triggers when tempC >= throttleTempC (85°C)
  // - Stays latched while tempC > thermalReleaseTempC (78°C) if previously throttled
  const isThermalThrottled =
    m.tempC >= m.throttleTempC ||
    (Boolean(m.thermalThrottled) && m.tempC > thermalReleaseTempC);
  const isThermalShutdown = m.tempC >= m.shutdownTempC;

  const effectivePeakFlopsG = Math.max(
    50,
    m.peakFlopsG * (isThermalThrottled ? THERMAL_THROTTLE_FACTOR : 1.0),
  );
  const safeBandwidthGBs = Math.max(5, m.bandwidthGBs);
  const safeBytesMB = Math.max(1, m.bytesMB);
  const safeFlopsG = Math.max(0.1, m.flopsG);

  const computeMs = (safeFlopsG / effectivePeakFlopsG) * 1000;
  const memoryMs = safeBytesMB / safeBandwidthGBs;
  const rooflineMs = Math.max(computeMs, memoryMs);

  const arithmeticIntensity = (safeFlopsG * 1000) / safeBytesMB;
  const ridgePoint = effectivePeakFlopsG / safeBandwidthGBs;
  const bottleneck: BottleneckState =
    memoryMs > computeMs ? 'MEMORY_BOUND' : 'COMPUTE_BOUND';

  const ioNetEffective = m.flags['tcp_hol_locked']
    ? Math.max(7.5, Math.max(0, m.ioNetBusMs))
    : Math.max(0, m.ioNetBusMs);
  const ioTotalMs =
    Math.max(0, m.ioSensorMs) + ioNetEffective + Math.max(0, m.ioCopyMs);
  const osTotalMs = Math.max(0, m.osBaseMs) + Math.max(0, m.osJitterMs);
  const totalLatencyMs = round2(ioTotalMs + rooflineMs + osTotalMs);

  const ramUsedMB = Math.round(
    Math.max(0, m.ramWeightsMB) +
      Math.max(0, m.ramKvCacheMB) +
      Math.max(0, m.ramBuffersMB) +
      Math.max(0, m.ramFragMB) +
      Math.max(0, m.ramLeakedMB),
  );
  const ramPercent = round1((ramUsedMB / Math.max(1, m.ramCapMB)) * 100);
  const isOom = ramUsedMB >= m.ramCapMB;

  const accuracyClamped = round1(
    Math.max(0, Math.min(m.accuracyCap, m.accuracy)),
  );

  return {
    effectivePeakFlopsG: round1(effectivePeakFlopsG),
    computeMs: round2(computeMs),
    memoryMs: round2(memoryMs),
    rooflineMs: round2(rooflineMs),
    ioTotalMs: round2(ioTotalMs),
    osTotalMs: round2(osTotalMs),
    totalLatencyMs,
    arithmeticIntensity: round2(arithmeticIntensity),
    ridgePoint: round2(ridgePoint),
    bottleneck,
    ramUsedMB,
    ramPercent,
    isOom,
    isThermalThrottled,
    isThermalShutdown,
    thermalReleaseTempC,
    accuracyClamped,
  };
}

/**
 * Thermal step at end of wave:
 * deltaT = alpha * powerW - beta * (tempC - ambientTempC) * coolingFactor
 */
export function stepThermal(m: SystemMetrics): SystemMetrics {
  const next = cloneMetrics(m);
  const alpha = 0.28;
  const beta = 0.22;
  const heatGain = alpha * next.powerW;
  const heatDissipation =
    beta * Math.max(0, next.tempC - next.ambientTempC) * next.coolingFactor;
  next.tempC = round1(
    Math.max(next.ambientTempC, next.tempC + heatGain - heatDissipation),
  );
  const releaseC = next.throttleTempC - THERMAL_HYSTERESIS_C;
  next.thermalThrottled =
    next.tempC >= next.throttleTempC ||
    (Boolean(m.thermalThrottled) && next.tempC > releaseC);
  return next;
}

export function evaluateSla(
  telemetry: ComputedTelemetry,
  target: SlaTarget,
): SlaEvaluation {
  const latencyMet = telemetry.totalLatencyMs <= target.maxLatencyMs;
  const accuracyMet = telemetry.accuracyClamped >= target.minAccuracy;
  const ramSafe = !telemetry.isOom;
  const thermalSafe = !telemetry.isThermalShutdown;
  const allMet = latencyMet && accuracyMet && ramSafe && thermalSafe;

  let robotMood: RobotMood = 'NOMINAL';
  let failureReason: string | undefined;

  if (!ramSafe) {
    robotMood = 'OOM_PANIC';
    failureReason = `OOM Killer 触发：显存/内存占用达到 ${telemetry.ramUsedMB}MB (${telemetry.ramPercent}%)`;
  } else if (!thermalSafe) {
    robotMood = 'THERMAL_THROTTLE';
    failureReason = `芯片触发过热关机保护（结温达到 ${telemetry.isThermalShutdown ? '≥100°C' : '红线'}）`;
  } else if (!accuracyMet) {
    robotMood = 'EGG_CRUSHED';
    failureReason = `模型精度崩塌 (${telemetry.accuracyClamped}% < ${target.minAccuracy}%)：机械臂误判捏爆了鸡蛋！`;
  } else if (!latencyMet) {
    robotMood = 'EGG_DROPPED';
    failureReason = `端到端延迟超标 (${telemetry.totalLatencyMs}ms > ${target.maxLatencyMs}ms)：控制闭环超时，鸡蛋滚落摔碎！`;
  } else if (telemetry.isThermalThrottled) {
    robotMood = 'THERMAL_THROTTLE';
  }

  return {
    latencyMet,
    accuracyMet,
    ramSafe,
    thermalSafe,
    allMet,
    robotMood,
    failureReason,
  };
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
