import { AnimatePresence, motion } from 'framer-motion';
import { ComputedTelemetry, PipelineStepSnapshot, SystemMetrics } from '../../engine/types';
import { useI18n } from './i18n';
import { cn, COLORS, domainColor, fmt, PanelHeader, useElementSize } from './primitives';

interface RooflineProps {
  nowM: SystemMetrics;
  nowT: ComputedTelemetry;
  simM: SystemMetrics;
  simT: ComputedTelemetry;
  steps: PipelineStepSnapshot[];
  showSim: boolean;
  activeStep: number | null;
  /** Non-zero value (changing per event) triggers a short highlight flash, e.g. on a Roofline ridge breach. */
  flashKey?: number;
}

const M = { l: 40, r: 12, t: 12, b: 24 };

interface Pt {
  ai: number;
  perf: number;
  bound: 'MEMORY_BOUND' | 'COMPUTE_BOUND';
  color?: string;
}

function achieved(m: SystemMetrics, t: ComputedTelemetry) {
  return (Math.max(0.1, m.flopsG) / Math.max(1e-6, t.rooflineMs)) * 1000;
}

export function RooflineChart({ nowM, nowT, simM, simT, steps, showSim, activeStep, flashKey = 0 }: RooflineProps) {
  const { t, tx } = useI18n();
  // SVG user units == CSS pixels: the plot always fills its container without letterboxing or text scaling.
  const [plotRef, { w: W, h: H }] = useElementSize<HTMLDivElement>({ w: 440, h: 200 });
  const PW = Math.max(40, W - M.l - M.r);
  const PH = Math.max(30, H - M.t - M.b);
  const nowRoof = { peak: nowT.effectivePeakFlopsG, bw: Math.max(5, nowM.bandwidthGBs), ridge: nowT.ridgePoint };
  const simRoof = { peak: simT.effectivePeakFlopsG, bw: Math.max(5, simM.bandwidthGBs), ridge: simT.ridgePoint };

  const nowPt: Pt = { ai: nowT.arithmeticIntensity, perf: achieved(nowM, nowT), bound: nowT.bottleneck };
  const trail: Pt[] = steps.map((s) => ({
    ai: s.telemetryAfter.arithmeticIntensity,
    perf: achieved(s.metricsAfter, s.telemetryAfter),
    bound: s.telemetryAfter.bottleneck,
    color: domainColor(s.domain),
  }));
  const simPt: Pt = { ai: simT.arithmeticIntensity, perf: achieved(simM, simT), bound: simT.bottleneck };

  /* ---- Scales (log-log) ---- */
  const ais = [nowPt.ai, simPt.ai, nowRoof.ridge, simRoof.ridge, ...trail.map((p) => p.ai)];
  const lx0 = Math.floor(Math.log10(Math.max(0.01, Math.min(...ais) / 3)));
  let lx1 = Math.ceil(Math.log10(Math.max(...ais) * 3));
  if (lx1 - lx0 < 2) lx1 = lx0 + 2;
  const peaks = [nowRoof.peak, simRoof.peak];
  const ly1 = Math.ceil(Math.log10(Math.max(...peaks) * 1.8));
  const lowPerf = Math.min(nowRoof.bw * Math.pow(10, lx0), simRoof.bw * Math.pow(10, lx0), nowPt.perf, simPt.perf);
  let ly0 = Math.floor(Math.log10(Math.max(1, lowPerf * 0.9)));
  if (ly1 - ly0 < 2) ly0 = ly1 - 2;

  const sx = (ai: number) => M.l + ((Math.log10(Math.max(1e-6, ai)) - lx0) / (lx1 - lx0)) * PW;
  const sy = (p: number) => M.t + PH - ((Math.log10(Math.max(1e-6, p)) - ly0) / (ly1 - ly0)) * PH;

  const roofPath = (r: { peak: number; bw: number; ridge: number }) => {
    const x0 = Math.pow(10, lx0);
    const x1 = Math.pow(10, lx1);
    return `M ${sx(x0)} ${sy(r.bw * x0)} L ${sx(r.ridge)} ${sy(r.peak)} L ${sx(x1)} ${sy(r.peak)}`;
  };

  const xTicks = Array.from({ length: lx1 - lx0 + 1 }, (_, i) => lx0 + i);
  const yTicks = Array.from({ length: ly1 - ly0 + 1 }, (_, i) => ly0 + i);

  const roofChanged =
    showSim && (Math.abs(simRoof.peak - nowRoof.peak) > 0.5 || Math.abs(simRoof.bw - nowRoof.bw) > 0.05);

  const displayBound = showSim ? simPt.bound : nowPt.bound;
  const boundFlip = showSim && simPt.bound !== nowPt.bound;
  const isMem = displayBound === 'MEMORY_BOUND';

  const trailPts = [nowPt, ...trail];
  const trailD = trailPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.ai)} ${sy(p.perf)}`).join(' ');

  const ridgeX = sx(nowRoof.ridge);
  const memRegionD = `M ${sx(Math.pow(10, lx0))} ${M.t + PH} L ${sx(Math.pow(10, lx0))} ${sy(nowRoof.bw * Math.pow(10, lx0))} L ${ridgeX} ${sy(nowRoof.peak)} L ${ridgeX} ${M.t + PH} Z`;
  const cmpRegionD = `M ${ridgeX} ${M.t + PH} L ${ridgeX} ${sy(nowRoof.peak)} L ${M.l + PW} ${sy(nowRoof.peak)} L ${M.l + PW} ${M.t + PH} Z`;
  const nowRoofD = roofPath(nowRoof);
  const simRoofD = roofPath(simRoof);

  return (
    <section className="panel flex min-h-0 flex-col">
      <PanelHeader
        index="02"
        title={t('panelRoofline')}
        sub="log-log · AI vs GFLOP/s"
        right={
          <AnimatePresence mode="popLayout">
            <motion.span
              key={displayBound + String(boundFlip)}
              initial={{ y: -8, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0 }}
              className={cn(
                'flex items-center gap-1.5 rounded-[5px] border px-2 py-[2px] font-mono text-[10px] font-black tracking-wider',
                isMem ? 'border-scope/50 bg-scope/10 text-scope glow-scope' : 'border-te/60 bg-te/10 text-te glow-te',
              )}
            >
              {boundFlip && <span className="text-[9px] text-ink-2">{nowPt.bound === 'MEMORY_BOUND' ? 'MEM' : 'CMP'} →</span>}
              {isMem ? 'MEMORY-BOUND' : 'COMPUTE-BOUND'}
            </motion.span>
          </AnimatePresence>
        }
      />
      <div className="oled mx-2 mb-2 flex min-h-[150px] flex-1 flex-row">
        <div ref={plotRef} className="relative min-h-0 min-w-0 flex-1">
          <AnimatePresence>
            {flashKey > 0 && (
              <motion.div
                key={`flash-${flashKey}`}
                className="pointer-events-none absolute inset-0 z-20"
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.55), rgba(56,189,248,0.25) 45%, transparent 75%)' }}
              >
                <span className="absolute top-2 left-1/2 -translate-x-1/2 rounded-[4px] bg-white px-2 py-[1px] font-mono text-[10px] font-black text-black">
                  ROOFLINE BREACH!
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <clipPath id="plot-clip">
              <rect x={M.l} y={M.t} width={PW} height={PH} />
            </clipPath>
            <linearGradient id="mem-region" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={COLORS.scope} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLORS.scope} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="cmp-region" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={COLORS.te} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLORS.te} stopOpacity={0.02} />
            </linearGradient>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.scope} />
            </marker>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid */}
          {xTicks.map((lx) => (
            <g key={`x${lx}`}>
              <line x1={sx(Math.pow(10, lx))} x2={sx(Math.pow(10, lx))} y1={M.t} y2={M.t + PH} stroke="#16181b" />
              <text x={sx(Math.pow(10, lx))} y={M.t + PH + 11} fill="#55555b" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono">
                {lx >= 0 ? Math.pow(10, lx) : Math.pow(10, lx).toFixed(-lx)}
              </text>
            </g>
          ))}
          {yTicks.map((ly) => (
            <g key={`y${ly}`}>
              <line x1={M.l} x2={M.l + PW} y1={sy(Math.pow(10, ly))} y2={sy(Math.pow(10, ly))} stroke="#16181b" />
              <text x={M.l - 6} y={sy(Math.pow(10, ly)) + 3} fill="#55555b" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono">
                {Math.pow(10, ly) >= 1000 ? `${Math.pow(10, ly) / 1000}T` : `${Math.pow(10, ly)}G`}
              </text>
            </g>
          ))}
          <text x={M.l + PW} y={H - 3} fill="#7d7d84" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono">
            ARITHMETIC INTENSITY · FLOPs/Byte →
          </text>
          <text x={10} y={M.t + PH / 2} fill="#7d7d84" fontSize="8.5" textAnchor="middle" fontFamily="JetBrains Mono" transform={`rotate(-90 10 ${M.t + PH / 2})`}>
            GFLOP/s
          </text>

          <g clipPath="url(#plot-clip)">
            {/* Regions under roof */}
            <path
              d={memRegionD}
              fill="url(#mem-region)"
              opacity={isMem ? 1 : 0.35}
            />
            <path
              d={cmpRegionD}
              fill="url(#cmp-region)"
              opacity={isMem ? 0.35 : 1}
            />

            {/* Ridge vertical */}
            <motion.line
              initial={false}
              animate={{ x1: ridgeX, x2: ridgeX }}
              y1={M.t}
              y2={M.t + PH}
              stroke="#3a3a40"
              strokeDasharray="2 3"
            />

            {/* Current roof */}
            <path
              d={nowRoofD}
              fill="none"
              stroke="#ecebe6"
              strokeWidth={2.2}
              filter="url(#glow)"
            />
            {/* Simulated roof (DVFS / throttle / bandwidth changes) */}
            {roofChanged && (
              <motion.path
                initial={{ opacity: 0 }}
                d={simRoofD}
                animate={{ opacity: 1 }}
                fill="none"
                stroke={COLORS.scope}
                strokeWidth={1.4}
                strokeDasharray="5 4"
              />
            )}

            {/* Trajectory */}
            {showSim && trail.length > 0 && (
              <motion.path
                key={trailD}
                d={trailD}
                fill="none"
                stroke={COLORS.scope}
                strokeWidth={1.4}
                strokeDasharray="4 3"
                markerEnd="url(#arrow)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            )}
            {showSim &&
              trail.slice(0, -1).map((p, i) => (
                <g key={`tp${i}`}>
                  <circle
                    cx={sx(p.ai)}
                    cy={sy(p.perf)}
                    r={activeStep === i ? 5 : 3}
                    fill="#000"
                    stroke={p.color}
                    strokeWidth={1.5}
                  />
                  <text x={sx(p.ai) + 5} y={sy(p.perf) - 5} fill={p.color} fontSize="8" fontFamily="JetBrains Mono">
                    {i + 1}
                  </text>
                </g>
              ))}

            {/* Sim endpoint */}
            {showSim && (
              <motion.g initial={false} animate={{ x: sx(simPt.ai), y: sy(simPt.perf) }} transition={{ type: 'spring', stiffness: 200, damping: 24 }}>
                <motion.circle
                  fill="none"
                  stroke={COLORS.scope}
                  strokeWidth={1}
                  initial={{ r: 6, opacity: 0.9 }}
                  animate={{ r: [6, 13], opacity: [0.9, 0] }}
                  transition={{ duration: 1.3, repeat: Infinity }}
                />
                <circle r={5} fill="#000" stroke={COLORS.scope} strokeWidth={2} strokeDasharray="2 1.5" />
              </motion.g>
            )}

            {/* Current point */}
            <motion.g initial={false} animate={{ x: sx(nowPt.ai), y: sy(nowPt.perf) }} transition={{ type: 'spring', stiffness: 200, damping: 24 }}>
              <circle r={10} fill={nowPt.bound === 'MEMORY_BOUND' ? COLORS.scope : COLORS.te} opacity={0.18} />
              <circle r={4.5} fill={nowPt.bound === 'MEMORY_BOUND' ? COLORS.scope : COLORS.te} filter="url(#glow)" />
              <line x1={-14} x2={14} y1={0} y2={0} stroke="#ffffff33" />
              <line y1={-14} y2={14} x1={0} x2={0} stroke="#ffffff33" />
            </motion.g>
          </g>

          {/* Ridge annotation */}
          <motion.g initial={false} animate={{ x: ridgeX, y: sy(nowRoof.peak) }}>
            <rect x={-1} y={-1} width={2} height={2} fill="#fff" />
            <text x={4} y={-6} fill="#ecebe6" fontSize="8.5" fontFamily="JetBrains Mono">
              RIDGE {fmt(nowRoof.ridge)}
            </text>
          </motion.g>

          {/* Region labels */}
          <text x={M.l + 6} y={M.t + PH - 6} fill={COLORS.scope} fontSize="8.5" fontFamily="JetBrains Mono" opacity={0.85}>
            MEM-BOUND · {tx('缺带宽', 'BW-starved')}
          </text>
          <text x={M.l + PW - 6} y={M.t + PH - 6} fill={COLORS.te} fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono" opacity={0.85}>
            {tx('缺算力', 'FLOPS-starved')} · CMP-BOUND
          </text>
        </svg>
        </div>

        <div className="relative z-10 flex w-[100px] shrink-0 flex-col gap-px border-l border-[#15161a] bg-[#15161a] font-mono text-[9px]">
          <Stat label="AI" now={nowT.arithmeticIntensity} sim={simT.arithmeticIntensity} showSim={showSim} unit="F/B" />
          <Stat label="RIDGE" now={nowT.ridgePoint} sim={simT.ridgePoint} showSim={showSim} unit="F/B" />
          <Stat label="PEAK" now={nowT.effectivePeakFlopsG} sim={simT.effectivePeakFlopsG} showSim={showSim} unit="G" digits={0} warn={nowT.isThermalThrottled} />
          <Stat label="BW" now={nowM.bandwidthGBs} sim={simM.bandwidthGBs} showSim={showSim} unit="GB/s" digits={0} />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  now,
  sim,
  showSim,
  unit,
  digits = 1,
  warn,
}: {
  label: string;
  now: number;
  sim: number;
  showSim: boolean;
  unit: string;
  digits?: number;
  warn?: boolean;
}) {
  const changed = showSim && Math.abs(sim - now) >= Math.pow(10, -digits);
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center bg-oled px-2 py-0.5">
      <div className="flex items-baseline justify-between text-[8.5px] leading-none text-dim">
        {label}
        <span>{unit}</span>
      </div>
      <div className="tnum mt-0.5 flex items-baseline gap-x-0.5 leading-none whitespace-nowrap">
        <span className={cn('text-[11px] font-bold', warn ? 'text-estop' : 'text-ink')}>{fmt(now, digits)}</span>
        {changed && <span className="text-[10px] text-scope">→{fmt(sim, digits)}</span>}
      </div>
    </div>
  );
}
