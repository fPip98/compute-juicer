import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { ComputedTelemetry, Domain, RobotMood, SlaTarget, SystemMetrics } from '../../engine/types';
import { useI18n } from './i18n';
import { cn, COLORS, domainColor, fmt, fmtDelta, PanelHeader } from './primitives';

interface LatencyTimelineProps {
  nowM: SystemMetrics;
  nowT: ComputedTelemetry;
  simM: SystemMetrics;
  simT: ComputedTelemetry;
  sla: SlaTarget;
  showSim: boolean;
  mood: RobotMood;
  predictedMood: RobotMood | null;
  onOpenKnowledge: (id: string) => void;
}

interface StageSpec {
  key: string;
  labelZh: string;
  labelEn: string;
  color: string;
  nowMs: number;
  simMs: number;
  hintDomain: Domain;
  hintText: string;
  knowledgeId: string;
  /** Hard incompressible floor (e.g. TCP HOL lock) drawn as a red hatched block. */
  floorMs?: number;
}

const MOOD_BADGE: Record<
  RobotMood,
  { eyes: string; tag: string; lineZh: string; lineEn: string; color: string }
> = {
  NOMINAL: {
    eyes: '• •',
    tag: 'NOMINAL',
    lineZh: '闭环平稳：载体待命中，按时间轴针对性优化最长瓶颈段。',
    lineEn: 'Loop nominal: target the longest bottleneck stage below.',
    color: COLORS.signal,
  },
  WORKING: {
    eyes: '> <',
    tag: 'RUNNING',
    lineZh: '流水线压测执行中：正在逐 Pass 压缩端到端延迟…',
    lineEn: 'Benchmark running: compressing E2E latency pass by pass…',
    color: COLORS.scope,
  },
  THERMAL_THROTTLE: {
    eyes: '= =',
    tag: 'THROTTLE',
    lineZh: '芯片冒烟降频 (-35% 算力)：ROOFLINE 计算段正在急剧拉长！',
    lineEn: 'Thermal throttle (-35% FLOPS): Roofline compute is spiking!',
    color: COLORS.amber,
  },
  EGG_CRUSHED: {
    eyes: 'O O',
    tag: 'ACC FAIL',
    lineZh: '精度崩塌：误判目标捏爆易碎品！请补校准/减少激进量化。',
    lineEn: 'Accuracy collapse: gripper crushed target! Restore precision.',
    color: COLORS.estop,
  },
  EGG_DROPPED: {
    eyes: 'o o',
    tag: 'SLA MISS',
    lineZh: '延迟超标：端到端闭环超时，目标已脱手！',
    lineEn: 'Latency miss: closed-loop deadline breached!',
    color: COLORS.estop,
  },
  OOM_PANIC: {
    eyes: 'X X',
    tag: 'OOM PANIC',
    lineZh: 'Out of memory: Killed process (vla_infer) — 显存爆红！',
    lineEn: 'Out of memory: Killed process (vla_infer) — RAM exhausted!',
    color: '#4f8cff',
  },
  VICTORY: {
    eyes: '^ ^',
    tag: 'SLA PASS',
    lineZh: '端到端压测达标：稳稳拿捏，产线验收签字！',
    lineEn: 'E2E SLA passed: rock-solid execution signed off!',
    color: COLORS.signal,
  },
};

export function LatencyTimeline({
  nowM,
  nowT,
  simM,
  simT,
  sla,
  showSim,
  mood,
  predictedMood,
  onOpenKnowledge,
}: LatencyTimelineProps) {
  const { t, tx, en } = useI18n();
  const displayMood = showSim && predictedMood ? predictedMood : mood;
  const badge = MOOD_BADGE[displayMood];

  const activeT = showSim ? simT : nowT;
  const activeM = showSim ? simM : nowM;
  const isCompute = activeT.bottleneck === 'COMPUTE_BOUND';

  const stages: StageSpec[] = [
    {
      key: 'sensor',
      labelZh: 'SENSOR 采集',
      labelEn: 'SENSOR INGEST',
      color: '#38bdf8',
      nowMs: Math.max(0, nowM.ioSensorMs),
      simMs: Math.max(0, simM.ioSensorMs),
      hintDomain: 'CPP',
      hintText: 'CPP / KER',
      knowledgeId: 'k_lockfree_ring',
    },
    {
      key: 'copy',
      labelZh: 'DMA 拷贝',
      labelEn: 'DMA / COPY',
      color: '#0ea5e9',
      nowMs: Math.max(0, nowM.ioCopyMs),
      simMs: Math.max(0, simM.ioCopyMs),
      hintDomain: 'KERNEL',
      hintText: 'KERNEL',
      knowledgeId: 'k_v4l2_dmabuf',
    },
    {
      key: 'roofline',
      labelZh: isCompute ? 'ROOFLINE (算力)' : 'ROOFLINE (访存)',
      labelEn: isCompute ? 'ROOFLINE (CMP)' : 'ROOFLINE (MEM)',
      color: isCompute ? COLORS.te : '#ec4899',
      nowMs: nowT.rooflineMs,
      simMs: simT.rooflineMs,
      hintDomain: isCompute ? 'SILICON' : 'DEPLOY',
      hintText: isCompute ? 'SIL / VLA' : 'DEP / CPP',
      knowledgeId: isCompute ? 'k_dvfs_roofline' : 'k_flash_attention',
    },
    {
      key: 'os',
      labelZh: 'OS / IRQ 抖动',
      labelEn: 'OS / IRQ JITTER',
      color: '#f59e0b',
      nowMs: nowT.osTotalMs,
      simMs: simT.osTotalMs,
      hintDomain: 'KERNEL',
      hintText: 'KERNEL',
      knowledgeId: 'k_preempt_rt',
    },
    {
      key: 'net',
      labelZh: activeM.flags['tcp_hol_locked'] ? 'NET ≥7.5ms' : 'NET / 总线',
      labelEn: activeM.flags['tcp_hol_locked'] ? 'NET ≥7.5ms' : 'NET / BUS',
      color: activeM.flags['tcp_hol_locked'] ? COLORS.estop : '#10b981',
      nowMs: nowM.flags['tcp_hol_locked'] ? Math.max(7.5, Math.max(0, nowM.ioNetBusMs)) : Math.max(0, nowM.ioNetBusMs),
      simMs: simM.flags['tcp_hol_locked'] ? Math.max(7.5, Math.max(0, simM.ioNetBusMs)) : Math.max(0, simM.ioNetBusMs),
      hintDomain: 'NETWORK',
      hintText: activeM.flags['tcp_hol_locked'] ? 'LOCKED' : 'NET/BUS',
      knowledgeId: 'k_tcp_nodelay',
      floorMs: activeM.flags['tcp_hol_locked'] ? 7.5 : undefined,
    },
  ];

  // Identify #1 bottleneck stage in the active view
  let topKey = stages[0].key;
  let topVal = -1;
  for (const s of stages) {
    const v = showSim ? s.simMs : s.nowMs;
    if (v > topVal) {
      topVal = v;
      topKey = s.key;
    }
  }

  const maxTotal = Math.max(
    sla.maxLatencyMs * 1.25,
    nowT.totalLatencyMs * 1.05,
    simT.totalLatencyMs * 1.05,
    10,
  );
  const slaPct = Math.min(96, (sla.maxLatencyMs / maxTotal) * 100);
  const maxStageVal = Math.max(
    ...stages.map((s) => Math.max(s.nowMs, s.simMs)),
    1,
  );

  const totalDelta = simT.totalLatencyMs - nowT.totalLatencyMs;
  const overSla = activeT.totalLatencyMs > sla.maxLatencyMs;

  return (
    <section data-tour="timeline" className="panel flex min-h-0 flex-col">
      <PanelHeader
        index="03"
        title={t('panelRobot')}
        sub={tx('端到端耗时拆解 · 点击色块查原理', 'E2E Flamegraph · Click domain chip for GDB')}
        right={
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-[5px] border px-1.5 py-[2px] font-mono text-[9px] font-black"
            style={{
              borderColor: `${badge.color}66`,
              background: `${badge.color}14`,
              color: badge.color,
            }}
            title={en ? badge.lineEn : badge.lineZh}
          >
            <span className="rounded-[3px] bg-black/80 px-1 py-[1px] text-[9px] tracking-tighter">
              [{badge.eyes}]
            </span>
            <span>{showSim && predictedMood ? `SIM:${badge.tag}` : badge.tag}</span>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-1.5">
        {/* Stacked E2E Waterfall Bar + SLA Red Line */}
        <div className="oled flex shrink-0 flex-col gap-1 px-2 py-1.5">
          <div className="flex items-center justify-between font-mono text-[9.5px] leading-none">
            <span className="text-mute">
              {tx('帧闭环总耗时', 'FRAME E2E')}{' '}
              <span
                className={cn(
                  'tnum font-black',
                  overSla ? 'text-estop glow-estop' : 'text-signal glow-signal',
                )}
              >
                {fmt(activeT.totalLatencyMs, 2)}ms
              </span>
              {showSim && Math.abs(totalDelta) >= 0.01 && (
                <span
                  className={cn(
                    'tnum ml-1 font-bold',
                    totalDelta < 0 ? 'text-signal' : 'text-estop',
                  )}
                >
                  ({fmtDelta(totalDelta, 2)}ms)
                </span>
              )}
            </span>
            <span className="tnum text-estop">
              SLA ≤ {fmt(sla.maxLatencyMs, 1)}ms
            </span>
          </div>

          <div className="relative h-3.5 w-full rounded-[3px] border border-[#222227] bg-black/80">
            {/* Stacked segments */}
            <div className="flex h-full w-full overflow-hidden rounded-[2px]">
              {stages.map((s) => {
                const v = showSim ? s.simMs : s.nowMs;
                const wPct = (v / maxTotal) * 100;
                if (wPct <= 0.2) return null;
                return (
                  <motion.div
                    key={s.key}
                    layout
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    style={{ width: `${wPct}%`, background: s.color }}
                    className="h-full border-r border-black/60 last:border-r-0"
                    title={`${en ? s.labelEn : s.labelZh}: ${fmt(v, 2)}ms`}
                  />
                );
              })}
            </div>
            {/* SLA deadline marker */}
            <div
              className="pointer-events-none absolute top-[-2px] bottom-[-2px] w-[2px] bg-estop shadow-[0_0_8px_#ff2a2a]"
              style={{ left: `${slaPct}%` }}
            />
          </div>
        </div>

        {/* 5-Stage Breakdown Rows (strict 5-row grid — never clips) */}
        <div className="oled grid min-h-0 flex-1 grid-rows-5 items-center gap-0.5 px-2 py-1">
          {stages.map((s) => {
            const val = showSim ? s.simMs : s.nowMs;
            const delta = s.simMs - s.nowMs;
            const isTop = s.key === topKey && val > 0.5;
            const barNowPct = Math.min(100, (s.nowMs / maxStageVal) * 100);
            const barSimPct = Math.min(100, (s.simMs / maxStageVal) * 100);
            const chipColor = domainColor(s.hintDomain);
            return (
              <div key={s.key} className="flex items-center gap-1.5 font-mono text-[9.5px] leading-none">
                <div className="flex w-[98px] shrink-0 items-center gap-1 truncate">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
                    style={{ background: s.color }}
                  />
                  {s.floorMs !== undefined && <Lock size={10} strokeWidth={2.6} className="shrink-0 text-estop" aria-label="locked" />}
                  <span
                    className={cn(
                      'truncate',
                      s.floorMs !== undefined ? 'font-black text-estop' : isTop ? 'font-black text-ink' : 'text-ink-2',
                    )}
                    title={en ? s.labelEn : s.labelZh}
                  >
                    {en ? s.labelEn : s.labelZh}
                  </span>
                </div>

                {/* Bar */}
                <div className="relative h-2 flex-1 overflow-hidden rounded-[2px] bg-[#141418]">
                  {showSim && Math.abs(delta) >= 0.05 && (
                    <div
                      className="absolute inset-y-0 left-0 opacity-25"
                      style={{ width: `${barNowPct}%`, background: s.color }}
                    />
                  )}
                  {s.floorMs !== undefined && (
                    <div
                      className="hatch-red absolute inset-y-0 left-0 z-10 border-r-2 border-estop"
                      style={{ width: `${Math.min(100, (s.floorMs / maxStageVal) * 100)}%` }}
                      title={tx(`TCP 队头阻塞硬下限 ${s.floorMs}ms：只能对症解除`, `TCP HOL hard floor ${s.floorMs}ms: must be cleared directly`)}
                    />
                  )}
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-[2px]"
                    animate={{ width: `${showSim ? barSimPct : barNowPct}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    style={{
                      background: s.color,
                      boxShadow: isTop ? `0 0 8px ${s.color}88` : undefined,
                    }}
                  />
                </div>

                {/* Value & Delta */}
                <div className="tnum flex w-[70px] shrink-0 items-center justify-end gap-1 text-right">
                  <span className={cn('font-bold', isTop ? 'text-ink' : 'text-ink-2')}>
                    {fmt(val, 1)}ms
                  </span>
                  {showSim && Math.abs(delta) >= 0.05 && (
                    <span
                      className={cn(
                        'text-[8.5px] font-bold',
                        delta < 0 ? 'text-signal' : 'text-estop',
                      )}
                    >
                      {fmtDelta(delta, 1)}
                    </span>
                  )}
                </div>

                {/* Bottleneck / Domain hint chip -> opens GDB */}
                <button
                  onClick={() => onOpenKnowledge(s.knowledgeId)}
                  className={cn(
                    'flex h-[16px] w-[74px] shrink-0 cursor-pointer items-center justify-center rounded-[3px] border px-1 text-[8px] font-black whitespace-nowrap transition hover:brightness-125',
                    isTop && 'ring-1 ring-amber/70',
                  )}
                  style={{
                    borderColor: `${chipColor}66`,
                    background: `${chipColor}18`,
                    color: chipColor,
                  }}
                  title={tx(
                    `点击查阅 ${s.hintText} 相关优化原理 (GDB)`,
                    `Open ${s.hintText} optimization datasheet (GDB)`,
                  )}
                >
                  {s.floorMs !== undefined && <Lock size={9} strokeWidth={2.6} className="mr-0.5" />}
                  {isTop ? `★ ${s.hintText}` : s.hintText}
                </button>
              </div>
            );
          })}
        </div>

        {/* Compact Embodied Mood Strip */}
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-[5px] border px-2 py-[3px] font-mono text-[9.5px] leading-none"
          style={{
            borderColor: `${badge.color}44`,
            background: `${badge.color}0d`,
          }}
        >
          <span
            className="shrink-0 font-black"
            style={{ color: badge.color }}
          >
            [{badge.eyes}]
          </span>
          <span className="min-w-0 flex-1 truncate text-ink-2">
            {en ? badge.lineEn : badge.lineZh}
          </span>
          <span className="tnum shrink-0 text-[8.5px] text-mute">
            ACC {fmt(activeT.accuracyClamped)}% · {fmt(activeM.tempC)}°C
          </span>
        </div>
      </div>
    </section>
  );
}
