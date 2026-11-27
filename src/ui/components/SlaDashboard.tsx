import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { ReactNode } from 'react';
import { FAULT_REGISTRY } from '../../data/faults';
import { predictWavesToRelease } from '../../engine/physics';
import { ComputedTelemetry, SlaTarget, SystemMetrics } from '../../engine/types';
import { useI18n } from './i18n';
import { cn, COLORS, domainColor, DynIcon, fmt, fmtDelta, Led, PanelHeader } from './primitives';

interface Snapshot {
  t: ComputedTelemetry;
  m: SystemMetrics;
}

interface SlaDashboardProps {
  now: Snapshot;
  sim: Snapshot;
  showSim: boolean;
  simSource: 'HOVER' | 'PIPELINE' | null;
  sla: SlaTarget;
  baseSla: SlaTarget;
  upcomingFaultIds: string[];
  wave: number;
  onOpenKnowledge: (id: string) => void;
}

interface Segment {
  key: string;
  value: number;
  color: string;
}

interface Marker {
  at: number;
  color: string;
  key: string;
}

/* -------------------------------------------------------------------------- */

function StackBar({ segments, min = 0, max, sim }: { segments: Segment[]; min?: number; max: number; sim?: boolean }) {
  const span = Math.max(1e-6, max - min);
  const toPct = (x: number) => ((Math.max(min, Math.min(max, x)) - min) / span) * 100;
  let acc = 0;
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-[2px]',
        sim ? 'h-[5px] outline-1 outline-dashed outline-[#303036] tall:h-[7px]' : 'h-[7px] bg-[#0f0f12] tall:h-[10px]',
      )}
    >
      {segments.map((s) => {
        const startPct = toPct(acc);
        acc += s.value;
        const endPct = toPct(acc);
        return (
          <motion.div
            key={s.key}
            className="absolute top-0 bottom-0"
            initial={false}
            animate={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
            transition={{ type: 'spring', stiffness: 220, damping: 28 }}
            style={{
              background: sim ? `repeating-linear-gradient(-45deg, ${s.color}dd 0 3px, ${s.color}55 3px 6px)` : s.color,
              boxShadow: sim ? undefined : `0 0 8px ${s.color}55`,
              borderRight: '1px solid #000',
            }}
          />
        );
      })}
    </div>
  );
}

/** NOW bar + reserved SIM lane (no layout jump when a preview appears) + vertical red-line markers. */
function Bars({
  now,
  sim,
  showSim,
  min = 0,
  max,
  markers,
  band,
}: {
  now: Segment[];
  sim: Segment[];
  showSim: boolean;
  min?: number;
  max: number;
  markers: Marker[];
  /** Shaded range, e.g. 78–85°C thermal hysteresis band. */
  band?: { from: number; to: number; title: string };
}) {
  const span = Math.max(1e-6, max - min);
  const pctOf = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));
  return (
    <div className="relative mt-1.5 flex flex-col gap-[3px] tall:mt-3">
      {band && (
        <div
          className="hatch-amber pointer-events-none absolute -top-[2px] -bottom-[2px] z-[5] rounded-[1px]"
          style={{ left: `${pctOf(band.from)}%`, width: `${Math.max(0, pctOf(band.to) - pctOf(band.from))}%` }}
          title={band.title}
        />
      )}
      <StackBar segments={now} min={min} max={max} />
      {showSim ? <StackBar segments={sim} min={min} max={max} sim /> : <div className="h-[5px] rounded-[2px] bg-[#0b0b0d] tall:h-[7px]" />}
      {markers.map((mk) => {
        const pct = Math.max(0, Math.min(100, ((mk.at - min) / span) * 100));
        return (
          <div
            key={mk.key}
            className="pointer-events-none absolute -top-[2px] -bottom-[2px] z-10 w-[2px] -translate-x-1/2"
            style={{ left: `${pct}%`, background: mk.color, boxShadow: `0 0 6px ${mk.color}` }}
          />
        );
      })}
    </div>
  );
}

function Readout({
  now,
  sim,
  showSim,
  unit,
  digits = 1,
  lowerIsBetter,
  danger,
}: {
  now: number;
  sim: number;
  showSim: boolean;
  unit: string;
  digits?: number;
  lowerIsBetter: boolean;
  danger: boolean;
}) {
  const delta = sim - now;
  const neutral = Math.abs(delta) < Math.pow(10, -digits) / 2;
  const improves = lowerIsBetter ? delta < 0 : delta > 0;
  const deltaColor = neutral ? COLORS.mute : improves ? COLORS.signal : COLORS.estop;
  return (
    <div className="flex items-baseline gap-1 whitespace-nowrap">
      <span className={cn('tnum font-mono text-[16px] leading-none font-bold tall:text-[22px]', danger ? 'text-estop glow-estop' : 'text-ink')}>
        {fmt(now, digits)}
      </span>
      <span className="font-mono text-[9px] text-mute">{unit}</span>
      <AnimatePresence>
        {showSim && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-baseline gap-1"
          >
            <span className="font-mono text-[10px] text-mute">→</span>
            <span className="tnum font-mono text-[12px] font-bold tall:text-[15px]" style={{ color: deltaColor }}>
              {fmt(sim, digits)}
            </span>
            <span className="tnum rounded-[3px] px-0.5 font-mono text-[9px] font-bold" style={{ color: deltaColor, background: `${deltaColor}1a` }}>
              {fmtDelta(delta, digits)}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function Gauge({
  code,
  title,
  statusColor,
  statusText,
  alarm,
  readout,
  bars,
  legend,
}: {
  code: string;
  title: string;
  statusColor: string;
  statusText: string;
  alarm?: boolean;
  readout: ReactNode;
  bars: ReactNode;
  legend: ReactNode;
}) {
  return (
    <div
      className={cn(
        'oled flex shrink-0 flex-col justify-center px-2.5 py-[7px] transition-shadow desk:min-h-0 desk:flex-1',
        alarm && 'shadow-[inset_0_0_0_1px_rgba(255,42,42,0.55),inset_0_0_26px_rgba(255,42,42,0.14)]',
      )}
      title={`${code} · ${statusText}`}
    >
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Led on color={statusColor} blink={alarm} />
          <span className="truncate font-display text-[10.5px] font-bold tracking-[0.12em] whitespace-nowrap text-ink-2 tall:text-[12px]">{title}</span>
        </div>
        {readout}
      </div>
      <div className="relative z-10">{bars}</div>
      <div className="relative z-10 mt-[5px] flex flex-wrap items-center gap-x-2 gap-y-0.5 tall:mt-2.5">{legend}</div>
    </div>
  );
}

function L({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span className="flex items-center gap-1 font-mono text-[8.5px] leading-none text-mute tall:text-[10px]">
      <span className="h-1.5 w-1.5 rounded-[1px]" style={{ background: color }} />
      {label}
      {value && <span className="tnum text-ink-2">{value}</span>}
    </span>
  );
}

function Status({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="ml-auto font-mono text-[8.5px] leading-none font-bold tall:text-[10px]" style={{ color }}>
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

const RAM_COLORS = { weights: '#38bdf8', kv: '#8b5cf6', buf: '#10b981', frag: '#ffb020', leak: '#ff2a2a' };
const LAT_COLORS = { io: '#10b981', roof: '#38bdf8', os: '#c4a5ff' };

export function SlaDashboard({
  now,
  sim,
  showSim,
  simSource,
  sla,
  baseSla,
  upcomingFaultIds,
  wave,
  onOpenKnowledge,
}: SlaDashboardProps) {
  const { t, tx, en, fault: faultText } = useI18n();
  const releaseWaves = predictWavesToRelease(now.m);
  /* Latency */
  const latMax = Math.max(sla.maxLatencyMs * 1.45, now.t.totalLatencyMs * 1.08, sim.t.totalLatencyMs * 1.08);
  const latSegs = (t: ComputedTelemetry): Segment[] => [
    { key: 'io', value: t.ioTotalMs, color: LAT_COLORS.io },
    { key: 'roof', value: t.rooflineMs, color: LAT_COLORS.roof },
    { key: 'os', value: t.osTotalMs, color: LAT_COLORS.os },
  ];
  const latOver = now.t.totalLatencyMs > sla.maxLatencyMs;
  const latSimOver = sim.t.totalLatencyMs > sla.maxLatencyMs;
  const slaBonus = sla.maxLatencyMs - baseSla.maxLatencyMs;

  /* RAM */
  const ramSegs = (m: SystemMetrics): Segment[] => [
    { key: 'w', value: Math.max(0, m.ramWeightsMB), color: RAM_COLORS.weights },
    { key: 'kv', value: Math.max(0, m.ramKvCacheMB), color: RAM_COLORS.kv },
    { key: 'buf', value: Math.max(0, m.ramBuffersMB), color: RAM_COLORS.buf },
    { key: 'frag', value: Math.max(0, m.ramFragMB), color: RAM_COLORS.frag },
    { key: 'leak', value: Math.max(0, m.ramLeakedMB), color: RAM_COLORS.leak },
  ];
  const ramMax = Math.max(now.m.ramCapMB, sim.m.ramCapMB) * 1.12;
  const ramCrit = now.t.ramPercent >= 90;

  /* Accuracy */
  const accLow = now.t.accuracyClamped < sla.minAccuracy;
  const accSimLow = sim.t.accuracyClamped < sla.minAccuracy;

  /* Thermal */
  const hot = now.t.isThermalThrottled;
  const simHot = sim.m.tempC >= sim.m.throttleTempC;

  return (
    <section className="panel flex min-h-0 flex-col">
      <PanelHeader
        index="01"
        title={t('panelSla')}
        right={
          <AnimatePresence>
            {showSim && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1 rounded-[4px] border border-scope/40 bg-scope/10 px-1.5 py-[1px] font-mono text-[9px] font-bold whitespace-nowrap text-scope"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-scope blink" />
                SIM · {simSource === 'HOVER' ? 'HOVER' : 'PIPELINE'}
              </motion.span>
            )}
          </AnimatePresence>
        }
      />

      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-[5px] overflow-y-auto px-2 pb-2">
        <Gauge
          code="CH1"
          title={tx('延迟 LATENCY', 'LATENCY')}
          statusColor={latOver ? COLORS.estop : COLORS.signal}
          statusText={latOver ? 'SLA BREACH' : 'WITHIN SLA'}
          alarm={latOver}
          readout={<Readout now={now.t.totalLatencyMs} sim={sim.t.totalLatencyMs} showSim={showSim} unit="ms" digits={2} lowerIsBetter danger={latOver} />}
          bars={
            <Bars
              now={latSegs(now.t)}
              sim={latSegs(sim.t)}
              showSim={showSim}
              max={latMax}
              markers={[{ key: 'sla', at: sla.maxLatencyMs, color: COLORS.estop }]}
            />
          }
          legend={
            <>
              <L color={LAT_COLORS.io} label="I/O" value={fmt(now.t.ioTotalMs)} />
              <L color={LAT_COLORS.roof} label={now.t.bottleneck === 'MEMORY_BOUND' ? 'MEM' : 'CMP'} value={fmt(now.t.rooflineMs)} />
              <L color={LAT_COLORS.os} label="OS" value={fmt(now.t.osTotalMs)} />
              <Status color={showSim && latSimOver !== latOver ? (latSimOver ? COLORS.estop : COLORS.signal) : COLORS.estop}>
                SLA≤{fmt(sla.maxLatencyMs)}
                {slaBonus > 0 && <span className="text-signal"> (+{fmt(slaBonus)})</span>}
              </Status>
            </>
          }
        />

        <Gauge
          code="CH2"
          title={tx('内存 RAM', 'RAM')}
          statusColor={now.t.isOom || ramCrit ? COLORS.estop : now.t.ramPercent > 75 ? COLORS.amber : COLORS.signal}
          statusText={now.t.isOom ? 'OOM' : ramCrit ? 'PRESSURE' : 'HEADROOM'}
          alarm={ramCrit}
          readout={<Readout now={now.t.ramUsedMB} sim={sim.t.ramUsedMB} showSim={showSim} unit={showSim ? 'MB' : `/${now.m.ramCapMB}MB`} digits={0} lowerIsBetter danger={ramCrit} />}
          bars={
            <Bars
              now={ramSegs(now.m)}
              sim={ramSegs(sim.m)}
              showSim={showSim}
              max={ramMax}
              markers={[{ key: 'oom', at: now.m.ramCapMB, color: COLORS.estop }]}
            />
          }
          legend={
            <>
              <L color={RAM_COLORS.weights} label="W" value={fmt(now.m.ramWeightsMB, 0)} />
              <L color={RAM_COLORS.kv} label="KV" value={fmt(now.m.ramKvCacheMB, 0)} />
              <L color={RAM_COLORS.buf} label="BUF" value={fmt(now.m.ramBuffersMB, 0)} />
              <L color={RAM_COLORS.frag} label="FRG" value={fmt(now.m.ramFragMB, 0)} />
              <L color={RAM_COLORS.leak} label="LK" value={fmt(now.m.ramLeakedMB, 0)} />
              {(showSim && sim.t.isOom) || ramCrit ? (
                <Status color={COLORS.estop}>{showSim && sim.t.isOom ? 'SIM→OOM!' : `${fmt(now.t.ramPercent)}%`}</Status>
              ) : null}
            </>
          }
        />

        <Gauge
          code="CH3"
          title={tx('精度 ACC', 'ACCURACY')}
          statusColor={accLow ? COLORS.estop : COLORS.signal}
          statusText={accLow ? 'BELOW SLA' : 'OK'}
          alarm={accLow}
          readout={<Readout now={now.t.accuracyClamped} sim={sim.t.accuracyClamped} showSim={showSim} unit="%" lowerIsBetter={false} danger={accLow} />}
          bars={
            <Bars
              now={[{ key: 'a', value: now.t.accuracyClamped, color: accLow ? COLORS.estop : COLORS.signal }]}
              sim={[{ key: 'a', value: sim.t.accuracyClamped, color: accSimLow ? COLORS.estop : COLORS.signal }]}
              showSim={showSim}
              min={60}
              max={100}
              markers={[{ key: 'min', at: sla.minAccuracy, color: COLORS.estop }]}
            />
          }
          legend={
            <>
              <L color={COLORS.estop} label="MIN" value={`${fmt(sla.minAccuracy)}%`} />
              <L color={COLORS.mute} label="CAP" value={`${fmt(now.m.accuracyCap)}%`} />
              <Status color={accLow || (showSim && accSimLow) ? COLORS.estop : COLORS.mute}>
                {showSim && accSimLow && !accLow ? 'SIM→BELOW SLA' : accLow ? 'BELOW SLA' : 'SCALE 60–100'}
              </Status>
            </>
          }
        />

        <Gauge
          code="CH4"
          title={tx('结温 TEMP', 'THERMAL')}
          statusColor={hot ? COLORS.estop : now.m.tempC > 75 ? COLORS.amber : COLORS.signal}
          statusText={now.t.isThermalShutdown ? 'SHUTDOWN' : hot ? 'THROTTLE −35%' : 'NOMINAL'}
          alarm={hot}
          readout={<Readout now={now.m.tempC} sim={sim.m.tempC} showSim={showSim} unit="°C" lowerIsBetter danger={hot} />}
          bars={
            <Bars
              now={[{ key: 't', value: now.m.tempC, color: hot ? COLORS.estop : now.m.tempC > 75 ? COLORS.amber : COLORS.te }]}
              sim={[{ key: 't', value: sim.m.tempC, color: simHot ? COLORS.estop : COLORS.te }]}
              showSim={showSim}
              min={25}
              max={105}
              band={{
                from: now.t.thermalReleaseTempC,
                to: now.m.throttleTempC,
                title: tx(
                  `热滞回带 ${fmt(now.t.thermalReleaseTempC, 0)}–${fmt(now.m.throttleTempC, 0)}°C：一旦锁频，需降回 ${fmt(now.t.thermalReleaseTempC, 0)}°C 才解锁`,
                  `Hysteresis band ${fmt(now.t.thermalReleaseTempC, 0)}–${fmt(now.m.throttleTempC, 0)}°C: once throttled, must cool to ${fmt(now.t.thermalReleaseTempC, 0)}°C to unlock`,
                ),
              }}
              markers={[
                { key: 'rel', at: now.t.thermalReleaseTempC, color: COLORS.scope },
                { key: 'thr', at: now.m.throttleTempC, color: COLORS.amber },
                { key: 'off', at: now.m.shutdownTempC, color: COLORS.estop },
              ]}
            />
          }
          legend={
            <>
              <L color={COLORS.scope} label="REL" value={`${fmt(now.t.thermalReleaseTempC, 0)}°`} />
              <L color={COLORS.amber} label="THR" value={`${fmt(now.m.throttleTempC, 0)}°`} />
              <L color={COLORS.estop} label="OFF" value={`${fmt(now.m.shutdownTempC, 0)}°`} />
              <Status color={hot || (showSim && simHot) ? COLORS.estop : COLORS.mute}>
                {hot
                  ? releaseWaves < 0
                    ? tx('锁频 · 需主动排热', 'LOCKED · needs active cooling')
                    : tx(`锁频 · 约${releaseWaves}波解锁`, `LOCKED · ~${releaseWaves}W to unlock`)
                  : showSim && simHot
                    ? 'SIM→THROTTLE'
                    : 'NOMINAL'}
              </Status>
            </>
          }
        />

        {/* INTENT: telegraphed incoming faults */}
        <div className="shrink-0 rounded-[9px] border border-dashed border-[#3a2a20] bg-[#120c08] px-2 py-1.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-te">{en ? t('faultForecast') : `INCOMING · ${t('faultForecast')}`}</span>
            <span className="font-mono text-[8.5px] text-dim">WAVE {wave}</span>
          </div>
          {upcomingFaultIds.length === 0 ? (
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-signal">
              <Led on color={COLORS.signal} /> {tx('风平浪静 · 适合部署常驻 PATCH', 'All quiet · good wave to deploy PATCHes')}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {upcomingFaultIds.map((fid, i) => {
                const f = FAULT_REGISTRY[fid];
                if (!f) return null;
                const c = f.severity === 'CRITICAL' ? COLORS.estop : COLORS.amber;
                return (
                  <motion.button
                    key={`${fid}-${i}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => onOpenKnowledge(f.knowledgeId)}
                    title={`${faultText(f).name}: ${faultText(f).intentText}`}
                    className="group flex w-full items-center gap-1.5 rounded-[6px] border bg-black/40 px-1.5 py-1 text-left transition hover:bg-black/70"
                    style={{ borderColor: `${c}44` }}
                  >
                    <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded" style={{ background: `${c}1f`, color: c }}>
                      <DynIcon name={f.icon} size={11} />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="flex items-center gap-1">
                        <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: domainColor(f.domain) }} />
                        <span className="truncate text-[11px] font-bold text-ink">{faultText(f).name}</span>
                      </span>
                      <span className="block truncate text-[10px] text-ink-2">{faultText(f).intentText}</span>
                    </span>
                    <BookOpen size={11} className="shrink-0 text-dim group-hover:text-scope" />
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
