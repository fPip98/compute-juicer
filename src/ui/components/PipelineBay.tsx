import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronLeft, ChevronRight, ChevronUp, CornerDownLeft, FileText, Gauge, Play, RotateCcw, Sparkles, Terminal, TriangleAlert, X, Zap } from 'lucide-react';
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CARD_REGISTRY } from '../../data/cards';
import { DOMAINS } from '../../data/domains';
import { getRackAxis, RACK_AXES } from '../../engine/rack';
import {
  BattleState,
  CardInstance,
  ComputedTelemetry,
  Domain,
  OpsActionId,
  PipelinePreviewResult,
  PipelineStepSnapshot,
  RackAxis,
  TraceEvent,
  TraceEventKind,
} from '../../engine/types';
import { useI18n } from './i18n';
import { GradeStamp } from './JuiceGrade';
import { cn, COLORS, domainColor, DynIcon, fmt, fmtDelta, Led } from './primitives';

interface PipelineBayProps {
  battle: BattleState;
  baseTelemetry: ComputedTelemetry;
  stagedPreview: PipelinePreviewResult;
  hoverPreview: PipelinePreviewResult;
  hoveringHand: boolean;
  isExecuting: boolean;
  activeExecStep: number | null;
  /** Battle finished and the report overlay was dismissed → the main action key reopens it. */
  reportPending: 'VICTORY' | 'DEFEAT' | null;
  onShowReport: () => void;
  onUnstage: (instanceId: string) => void;
  onReorder: (from: number, to: number) => void;
  onOpsAction: (actionId: OpsActionId) => void;
  onCommit: () => void;
  onOpenKnowledge: (id: string) => void;
}

const MIN_SLOTS = 5;
const OVERDRIVE_DOMAINS = 3;

interface Popup {
  text: string;
  color: string;
  big?: boolean;
}

/** Floating "juice" numbers for one executed pass. */
function popupsForStep(step: PipelineStepSnapshot, prevLatency: number, isLast: boolean, overdrive: boolean): Popup[] {
  const out: Popup[] = [];
  const d = step.telemetryAfter.totalLatencyMs - prevLatency;
  if (Math.abs(d) >= 0.01) out.push({ text: `${fmtDelta(d, 2)}ms`, color: d < 0 ? COLORS.signal : COLORS.estop, big: true });
  if (step.synergyNotice && /返还|refund|CYCLE/i.test(step.synergyNotice)) out.push({ text: '+1 CYCLE', color: COLORS.amber });
  if (step.bottleneckChanged) {
    out.push(
      step.telemetryAfter.bottleneck === 'COMPUTE_BOUND'
        ? { text: 'ROOFLINE BREACH!', color: '#ffffff' }
        : { text: '→ MEM-BOUND', color: COLORS.scope },
    );
  }
  if (step.synergyNotice && !/返还|refund/i.test(step.synergyNotice)) out.push({ text: 'SYNERGY!', color: COLORS.signal });
  if (step.warningNotice) out.push({ text: 'ANTI-PATTERN', color: COLORS.amber });
  if (isLast && overdrive) out.push({ text: 'OVERDRIVE!', color: '#ffc21a', big: true });
  return out;
}

export function PipelineBay({
  battle,
  baseTelemetry,
  stagedPreview,
  hoverPreview,
  hoveringHand,
  isExecuting,
  activeExecStep,
  reportPending,
  onShowReport,
  onUnstage,
  onReorder,
  onOpsAction,
  onCommit,
  onOpenKnowledge,
}: PipelineBayProps) {
  const { t, tx, card } = useI18n();
  // OPS REBOOT two-step confirm: first click arms, second executes; auto-disarms after 3s / on wave change.
  const [rebootArmed, setRebootArmed] = useState(false);
  useEffect(() => {
    if (!rebootArmed) return;
    const id = window.setTimeout(() => setRebootArmed(false), 3000);
    return () => window.clearTimeout(id);
  }, [rebootArmed]);
  useEffect(() => setRebootArmed(false), [battle.wave, battle.status]);
  const staged = battle.stagedPipeline;
  const planning = battle.status === 'PLANNING';
  const canCommit = planning && !isExecuting && stagedPreview.valid;
  const notices = hoveringHand ? hoverPreview : stagedPreview;
  // Exclusive-rack preview: last staged/hovered PATCH targeting each axis (works for empty slots too)
  const incomingByAxis = new Map<RackAxis, string>();
  for (const st of notices.steps) {
    const d = CARD_REGISTRY[st.cardId];
    const ax = d ? getRackAxis(d) : undefined;
    if (ax) incomingByAxis.set(ax, st.cardId);
  }
  const emptySlots = Math.max(0, MIN_SLOTS - staged.length - (hoveringHand ? 1 : 0));
  const sla = stagedPreview.slaEval;

  // Combo / overdrive: staged pipeline is the truth; hover shows what the next card would do.
  const comboDomains = notices.distinctDomains;
  const overdrive = stagedPreview.overdriveActive;
  const overdriveSim = !overdrive && hoveringHand && hoverPreview.overdriveActive;
  const grade = notices.juiceGrade;

  /* ---- Floating juice popups + staged-card inspector anchored outside the scroller ---- */
  const bayRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [popupAnchor, setPopupAnchor] = useState<{ x: number; y: number } | null>(null);
  const [inspectedSlot, setInspectedSlot] = useState<{
    cardId: string;
    x: number;
    y: number;
  } | null>(null);

  const handleInspectSlot = (index: number, cardId: string | null) => {
    if (!cardId || isExecuting) {
      setInspectedSlot(null);
      return;
    }
    const el = slotRefs.current[index];
    const bay = bayRef.current;
    if (!el || !bay) return;
    const r = el.getBoundingClientRect();
    const b = bay.getBoundingClientRect();
    const rawX = r.left - b.left + r.width / 2;
    const clampedX = Math.max(140, Math.min(b.width - 140, rawX));
    setInspectedSlot({ cardId, x: clampedX, y: r.top - b.top });
  };
  useLayoutEffect(() => {
    if (activeExecStep === null) {
      setPopupAnchor(null);
      return;
    }
    const el = slotRefs.current[activeExecStep];
    const bay = bayRef.current;
    if (!el || !bay) return;
    const r = el.getBoundingClientRect();
    const b = bay.getBoundingClientRect();
    setPopupAnchor({ x: r.left - b.left + r.width / 2, y: r.top - b.top });
  }, [activeExecStep]);
  const execStep = activeExecStep !== null ? stagedPreview.steps[activeExecStep] : undefined;
  const execPrevLat =
    activeExecStep === null || activeExecStep === 0
      ? baseTelemetry.totalLatencyMs
      : (stagedPreview.steps[activeExecStep - 1]?.telemetryAfter.totalLatencyMs ?? baseTelemetry.totalLatencyMs);
  const popups = execStep
    ? popupsForStep(execStep, execPrevLat, activeExecStep === stagedPreview.steps.length - 1, stagedPreview.overdriveActive)
    : [];

  return (
    <section className={cn('panel flex min-h-0 flex-col transition-[border-color]', overdrive && 'overdrive-glow')}>
      {/* Header: title · combo LEDs · deployed PATCH badges · cycles */}
      <div className="flex h-[30px] shrink-0 items-center gap-2 px-3">
        <span className="font-mono text-[10px] font-bold text-te">04</span>
        <span
          className="font-display text-[11px] font-bold tracking-[0.14em] whitespace-nowrap text-ink uppercase"
          title={t('panelPipelineSub')}
        >
          {t('panelPipeline')}
        </span>
        <ComboMeter domains={comboDomains} overdrive={overdrive} overdriveSim={overdriveSim} />
        {/* 6-Axis Exclusive Architecture Rack — fixed 6-column grid: every axis always visible, never scrolls */}
        <div className="ml-1 grid min-w-0 flex-1 grid-cols-6 gap-1" data-tour="rack">
          {RACK_AXES.map((slot) => {
            const mountedId = battle.rackSlots?.[slot.axis];
            const mountedDef = mountedId ? CARD_REGISTRY[mountedId] : undefined;
            const incomingId = incomingByAxis.get(slot.axis);
            const incomingDef = incomingId && incomingId !== mountedId ? CARD_REGISTRY[incomingId] : undefined;
            const mode: 'swap' | 'new' | null = incomingDef ? (mountedDef ? 'swap' : 'new') : null;
            const c = mode === 'swap' ? COLORS.amber : mode === 'new' ? COLORS.signal : mountedDef ? domainColor(mountedDef.domain) : '#3a3a40';
            const lit = !!mountedDef || !!mode;
            const codeText = mode && incomingDef ? `${mode === 'swap' ? '⇄' : '+'}${incomingDef.code}` : mountedDef ? mountedDef.code : slot.defaultLabel;
            return (
              <button
                key={slot.axis}
                data-rack-axis={slot.axis}
                data-rack-mode={mode ?? (mountedDef ? 'mounted' : 'empty')}
                onClick={() => (incomingDef ?? mountedDef) && onOpenKnowledge((incomingDef ?? mountedDef)!.knowledgeId)}
                title={
                  mode === 'swap' && incomingDef && mountedDef
                    ? tx(
                        `互斥槽 [${slot.labelZh}] 将替换：${card(mountedDef).name} ⇄ ${card(incomingDef).name}`,
                        `Exclusive slot [${slot.labelEn}] will replace: ${card(mountedDef).name} ⇄ ${card(incomingDef).name}`,
                      )
                    : mode === 'new' && incomingDef
                      ? tx(`互斥槽 [${slot.labelZh}] 将装入：${card(incomingDef).name}（替代默认 ${slot.defaultLabel}）`, `Exclusive slot [${slot.labelEn}] will mount: ${card(incomingDef).name} (over default ${slot.defaultLabel})`)
                      : mountedDef
                        ? `[${slot.labelZh}] ${card(mountedDef).name}: ${card(mountedDef).summary}`
                        : tx(`互斥槽 [${slot.labelZh}]：当前默认 ${slot.defaultLabel}（装入同轴 PATCH 自动替换）`, `Exclusive slot [${slot.labelEn}]: default ${slot.defaultLabel}`)
                }
                className={cn(
                  'flex h-[22px] min-w-0 items-center justify-center gap-1 overflow-hidden rounded-[4px] border px-1 font-mono text-[9px] leading-none font-bold transition',
                  lit ? 'cursor-pointer hover:brightness-125' : 'cursor-default',
                  mode && 'ring-1 blink-soft',
                  mode === 'swap' && 'ring-amber',
                  mode === 'new' && 'ring-signal',
                )}
                style={{
                  borderColor: lit ? `${c}88` : '#2a2a30',
                  background: lit ? `${c}18` : 'rgba(0,0,0,0.45)',
                  color: lit ? c : '#8a8a92',
                }}
              >
                <span className="shrink-0 text-[9px] opacity-80 max-xl:hidden">{tx(slot.labelZh, slot.labelEn)}</span>
                <span className="shrink-0 text-[9px] opacity-80 xl:hidden">{slot.labelEn.slice(0, 1)}</span>
                <span className="truncate">{codeText}</span>
              </button>
            );
          })}
        </div>
        <CycleMeter battle={battle} preview={stagedPreview} />
      </div>

      <div ref={bayRef} className="relative flex min-h-0 flex-1 flex-col gap-1.5 px-2 pb-2">
        {/* Slots — full panel width */}
        <div className="relative flex min-h-[104px] flex-1">
          <div className="oled scroll-thin flex min-h-0 flex-1 items-center overflow-x-auto px-2 py-1.5">
            <div className="relative z-10 mx-auto flex w-max items-stretch">
              <SlotCap label="IN" sub="sensor" />
              <AnimatePresence initial={false}>
                {staged.map((inst, i) => (
                  <StagedSlot
                    key={inst.instanceId}
                    slotRef={(el) => {
                      slotRefs.current[i] = el;
                    }}
                    inst={inst}
                    index={i}
                    count={staged.length}
                    prevLatency={i === 0 ? baseTelemetry.totalLatencyMs : stagedPreview.steps[i - 1]?.telemetryAfter.totalLatencyMs}
                    step={stagedPreview.steps[i]}
                    active={activeExecStep === i}
                    done={activeExecStep !== null && i < activeExecStep}
                    locked={!planning || isExecuting}
                    onUnstage={(id) => {
                      setInspectedSlot(null);
                      onUnstage(id);
                    }}
                    onReorder={(from, to) => {
                      setInspectedSlot(null);
                      onReorder(from, to);
                    }}
                    onOpenKnowledge={onOpenKnowledge}
                    onInspect={(entering) => handleInspectSlot(i, entering ? inst.cardId : null)}
                  />
                ))}
                {hoveringHand && hoverPreview.steps.length > staged.length && (
                  <GhostSlot key="ghost" step={hoverPreview.steps[hoverPreview.steps.length - 1]} />
                )}
              </AnimatePresence>
              {Array.from({ length: emptySlots }).map((_, i) => (
                <EmptySlot key={`e${i}`} index={staged.length + (hoveringHand ? 1 : 0) + i} />
              ))}
              <SlotCap label="OUT" sub="actuator" />
            </div>
          </div>

          {/* FULL-STACK OVERDRIVE badge */}
          <AnimatePresence>
            {(overdrive || overdriveSim) && (
              <motion.div
                key={overdrive ? 'od' : 'od-sim'}
                initial={{ opacity: 0, scale: 1.4, y: -4 }}
                animate={{ opacity: overdrive ? 1 : 0.7, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className={cn(
                  'pointer-events-none absolute top-1.5 right-2 z-20 flex items-center gap-1.5 rounded-[5px] border px-2 py-[3px] font-mono text-[10px] font-black tracking-wider',
                  overdrive ? 'border-[#ffc21a] bg-[#2a1600]/90 text-[#ffc21a] glow-amber shadow-[0_0_20px_-4px_#ff9d00]' : 'border-dashed border-[#ffc21a]/60 bg-black/70 text-[#ffc21a]/80',
                )}
              >
                <Zap size={11} fill="currentColor" />
                FULL-STACK OVERDRIVE ×1.12
                {!overdrive && <span className="text-[8.5px] text-scope">SIM</span>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating staged-card inspector tooltip (never clipped by scroller) */}
        <AnimatePresence>
          {inspectedSlot && !isExecuting && (() => {
            const def = CARD_REGISTRY[inspectedSlot.cardId];
            if (!def) return null;
            const c = domainColor(def.domain);
            const txt = card(def);
            return (
              <motion.div
                key={inspectedSlot.cardId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.12 }}
                className="pointer-events-none absolute z-50 w-[268px] -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-[10px] border border-line-2 bg-[#0d0d10]/96 p-2.5 shadow-2xl backdrop-blur"
                style={{ left: inspectedSlot.x, top: inspectedSlot.y, borderColor: `${c}88` }}
              >
                <div className="mb-1 flex items-center justify-between font-mono text-[9.5px] font-bold">
                  <span style={{ color: c }}>
                    {def.code} · {DOMAINS[def.domain].shortName}
                  </span>
                  <span className="text-mute">
                    {def.cost}C · {def.type}
                  </span>
                </div>
                <div className="text-[12.5px] font-bold text-ink">{txt.name}</div>
                <p className="mt-1 text-[11px] leading-snug text-ink-2">{txt.summary}</p>
                {txt.orderHint && (
                  <p className="mt-1.5 border-l-2 border-amber/70 pl-1.5 text-[10px] leading-snug text-amber">
                    {txt.orderHint}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {def.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[3px] border border-[#2e2e34] bg-black/50 px-1 font-mono text-[8.5px] font-bold text-ink-2"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Floating juice popups over the executing pass */}
        <AnimatePresence>
          {popupAnchor &&
            popups.map((p, i) => (
              <motion.div
                key={`${activeExecStep}-${i}-${p.text}`}
                className="pointer-events-none absolute z-40 -translate-x-1/2 font-display font-black whitespace-nowrap"
                style={{
                  left: popupAnchor.x,
                  top: popupAnchor.y,
                  color: p.color,
                  fontSize: p.big ? 20 : 12,
                  textShadow: `0 0 12px ${p.color}, 0 2px 0 #000, 0 0 2px #000`,
                }}
                initial={{ opacity: 0, y: 10, scale: 0.6 }}
                animate={{ opacity: [0, 1, 1, 0], y: [10, -14 - i * 15, -22 - i * 15, -36 - i * 15], scale: [0.6, 1.15, 1, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.95, delay: i * 0.06, times: [0, 0.25, 0.7, 1] }}
              >
                {p.text}
              </motion.div>
            ))}
        </AnimatePresence>

        {/* Notices — compact one-liners */}
        <div className="scroll-thin flex max-h-[40px] min-h-[18px] shrink-0 flex-col gap-[3px] overflow-y-auto">
          <AnimatePresence initial={false}>
            {notices.synergies.map((s, i) => (
              <Notice key={`s${i}${s}`} kind={/OVERDRIVE/.test(s) ? 'overdrive' : 'synergy'} text={s} />
            ))}
            {notices.warnings.map((w, i) => (
              <Notice key={`w${i}${w}`} kind="warning" text={w} />
            ))}
            {!stagedPreview.valid && <Notice key="invalid" kind="error" text={t('insufficientCycles')} />}
          </AnimatePresence>
          {notices.synergies.length === 0 && notices.warnings.length === 0 && stagedPreview.valid && (
            <div className="truncate font-mono text-[10px] leading-[18px] text-dim" title={t('pipelineHint')}>
              ▸ {t('pipelineHint')}
            </div>
          )}
        </div>

        {/* Commit row: SLA lamps + dmesg ticker | grade | BENCHMARK (or report key once the battle is over) */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 flex-nowrap items-center gap-x-3 overflow-hidden font-mono text-[10px] whitespace-nowrap max-xl:gap-x-2 max-xl:text-[9.5px]">
              <SlaLamp ok={sla.latencyMet} label={`LAT ${fmt(stagedPreview.finalTelemetry.totalLatencyMs, 2)}/${fmt(stagedPreview.effectiveSlaTarget.maxLatencyMs)}ms`} />
              <SlaLamp ok={sla.accuracyMet} label={`ACC ${fmt(stagedPreview.finalTelemetry.accuracyClamped)}/${fmt(stagedPreview.effectiveSlaTarget.minAccuracy, 0)}%`} />
              <SlaLamp ok={sla.ramSafe} label={`RAM ${fmt(stagedPreview.finalTelemetry.ramPercent)}%`} />
              <SlaLamp ok={sla.thermalSafe} label={`T ${fmt(stagedPreview.finalMetrics.tempC, 0)}°C`} />
            </div>
            <TraceTicker trace={battle.lastTurnTrace} wave={battle.wave} />
          </div>
          {planning && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                disabled={isExecuting || battle.opsUsedThisWave !== null}
                onClick={() => onOpsAction('THROTTLE_DEGRADE')}
                data-pressed={battle.opsUsedThisWave === 'THROTTLE_DEGRADE'}
                data-ops="degrade"
                className={cn(
                  'keycap flex h-[42px] w-[58px] flex-col items-center justify-center gap-[2px] px-1 font-mono leading-none',
                  battle.opsUsedThisWave === 'THROTTLE_DEGRADE' ? 'border-amber text-amber' : 'text-ink-2',
                )}
                title={tx(
                  'OPS 应急限流降级（0 预算，每波限 1 次 OPS）：本波次延迟 -3.5ms，但精度 -5.0%',
                  'OPS Throttle Degrade (0 Cycles, 1 OPS per wave): -3.5ms latency this wave, -5.0% accuracy',
                )}
              >
                <span className="flex items-center gap-1 text-[10px] font-black">
                  <Gauge size={11} className="text-amber" />
                  {tx('限流', 'DEGRD')}
                </span>
                <span className="text-[8.5px] font-bold text-amber">−5%ACC</span>
              </button>
              <button
                disabled={isExecuting || battle.opsUsedThisWave !== null}
                onClick={() => {
                  if (rebootArmed) {
                    setRebootArmed(false);
                    onOpsAction('RESTART_SERVICE');
                  } else {
                    setRebootArmed(true);
                  }
                }}
                onBlur={() => setRebootArmed(false)}
                data-ops="reboot"
                data-armed={rebootArmed}
                className={cn(
                  'keycap flex h-[42px] flex-col items-center justify-center gap-[2px] px-1 font-mono leading-none transition-[width]',
                  rebootArmed ? 'keycap-estop w-[92px]' : 'w-[58px] text-ink-2',
                )}
                title={tx(
                  'OPS 紧急重启服务（两段确认）：清空内存泄漏/碎片、解除 TCP 锁死并降温 -18°C（解除热滞回），代价是本波 SLA 直接判负（稳定性 -1）',
                  'OPS Restart Service (click twice): purge RAM leaks/frag, clear TCP lock & cool -18°C (breaks thermal hysteresis), at the cost of failing this wave SLA (-1 stability)',
                )}
              >
                {rebootArmed ? (
                  <>
                    <span className="flex items-center gap-1 text-[10px] font-black">
                      <RotateCcw size={11} />
                      {tx('确认重启?', 'CONFIRM?')}
                    </span>
                    <span className="text-[8.5px] font-black">{tx('−1 稳定 · 判负', 'STAB−1 · FAIL')}</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-[10px] font-black">
                      <RotateCcw size={11} className="text-estop" />
                      {tx('重启', 'REBOOT')}
                    </span>
                    <span className="text-[8.5px] font-bold text-estop">STAB−1</span>
                  </>
                )}
              </button>
            </div>
          )}
          {planning && <GradeStamp grade={grade} caption="SLA GRADE" animateKey={`${staged.length}-${hoveringHand}`} />}
          {reportPending ? (
            <motion.button
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onShowReport}
              className={cn(
                'keycap flex h-[42px] min-w-[210px] shrink-0 items-center justify-between gap-3 px-3.5 max-xl:min-w-[156px] max-xl:gap-2 max-xl:px-2.5',
                reportPending === 'VICTORY' ? 'keycap-te' : 'keycap-estop',
              )}
              title={reportPending === 'VICTORY' ? t('viewVictoryReport') : t('viewDefeatReport')}
            >
              <span className="flex items-center gap-2">
                <span className={cn('grid h-7 w-7 place-items-center rounded-full bg-black/80', reportPending === 'VICTORY' ? 'text-signal' : 'text-estop')}>
                  <FileText size={14} />
                </span>
                <span className="flex flex-col items-start leading-none">
                  <span className="font-display text-[14px] font-black tracking-wider">
                    {reportPending === 'VICTORY' ? t('viewVictoryReport') : t('viewDefeatReport')}
                  </span>
                  <span className="mt-0.5 font-mono text-[9px] font-bold opacity-70">
                    {reportPending === 'VICTORY' ? 'FACTORY ACCEPTANCE' : 'INCIDENT POST-MORTEM'}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-1 rounded-[4px] bg-black/20 px-1.5 py-1 font-mono text-[9px] font-bold max-xl:hidden">
                <CornerDownLeft size={10} /> ENTER
              </span>
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={!canCommit}
              onClick={onCommit}
              data-pressed={isExecuting}
              className="keycap keycap-te flex h-[42px] min-w-[210px] shrink-0 items-center justify-between gap-3 px-3.5 max-xl:min-w-[156px] max-xl:gap-2 max-xl:px-2.5"
              title={tx('执行流水线并结算本波次 (Enter)', 'Execute the pipeline and settle this wave (Enter)')}
            >
              <span className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#120500]/85 text-te">
                  {isExecuting ? <span className="h-2.5 w-2.5 rounded-sm bg-te blink" /> : <Play size={13} fill="currentColor" />}
                </span>
                <span className="flex flex-col items-start leading-none">
                  <span className="font-display text-[15px] font-black tracking-wider">{isExecuting ? 'EXECUTING…' : t('benchmark')}</span>
                  <span className="mt-0.5 font-mono text-[9px] font-bold opacity-70">
                    {isExecuting ? `PASS ${(activeExecStep ?? 0) + 1}/${staged.length}` : `/ ${t('commitWave')}`}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-1 rounded-[4px] bg-[#120500]/20 px-1.5 py-1 font-mono text-[9px] font-bold max-xl:hidden">
                <CornerDownLeft size={10} /> ENTER
              </span>
            </motion.button>
          )}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/** 3-cell full-stack combo LEDs: one cell per distinct domain staged → OVERDRIVE at 3. */
function ComboMeter({ domains, overdrive, overdriveSim }: { domains: Domain[]; overdrive: boolean; overdriveSim: boolean }) {
  const { tx } = useI18n();
  const n = Math.min(OVERDRIVE_DOMAINS, domains.length);
  const lit = overdrive || overdriveSim;
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-[6px] border border-[#222227] bg-black/50 px-1.5 py-[3px]"
      title={tx(
        `全栈连击：编排 ≥3 个不同技术域触发 FULL-STACK OVERDRIVE（带宽/算力 ×1.12，下回合 +1 抽牌）。已连：${domains.map((d) => DOMAINS[d].shortName).join(' + ') || '无'}`,
        `Full-stack chain: stage 3+ distinct domains for FULL-STACK OVERDRIVE (BW/FLOPS ×1.12, +1 draw next wave). Linked: ${domains.map((d) => DOMAINS[d].shortName).join(' + ') || 'none'}`,
      )}
    >
      <span className="font-mono text-[8px] tracking-[0.14em] text-dim max-xl:hidden">CHAIN</span>
      <div className="flex gap-[3px]">
        {Array.from({ length: OVERDRIVE_DOMAINS }).map((_, i) => {
          const d = domains[i];
          const c = d ? domainColor(d) : undefined;
          return (
            <motion.span
              key={`${i}-${d ?? 'off'}`}
              initial={d ? { scale: 1.8 } : false}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 14 }}
              className={cn('h-[10px] w-[14px] rounded-[2px] border', lit && 'blink-soft')}
              style={
                c
                  ? { background: lit ? '#ffc21a' : c, borderColor: lit ? '#ffc21a' : c, boxShadow: `0 0 8px ${lit ? '#ff9d00' : c}` }
                  : { background: '#121215', borderColor: '#2a2a2e' }
              }
            />
          );
        })}
      </div>
      <span
        className={cn(
          'tnum min-w-[22px] font-mono text-[9.5px] font-black whitespace-nowrap',
          overdrive ? 'text-[#ffc21a] glow-amber' : overdriveSim ? 'text-[#ffc21a]/70' : n > 0 ? 'text-ink-2' : 'text-dim',
        )}
      >
        {lit ? 'OVERDRIVE!' : `${n}/${OVERDRIVE_DOMAINS}`}
      </span>
    </div>
  );
}

function CycleMeter({ battle, preview }: { battle: BattleState; preview: PipelinePreviewResult }) {
  const { t } = useI18n();
  const max = Math.max(battle.maxCycles, battle.cycles);
  const used = preview.totalCost;
  const avail = preview.cyclesRemaining + used; // includes refunds
  return (
    <div className="flex shrink-0 items-center gap-1.5" title={`${t('cycles')} — ${t('cyclesTip')}`}>
      <span className="silk whitespace-nowrap max-xl:hidden">{t('cycles')}</span>
      <span className="silk whitespace-nowrap xl:hidden">{t('cyclesShort')}</span>
      <div className="flex gap-1">
        {Array.from({ length: Math.max(max, avail) }).map((_, i) => {
          const spent = i < used;
          const exists = i < avail;
          return (
            <span
              key={i}
              className={cn('h-3.5 w-3.5 rounded-[3px] border', !exists && 'opacity-30')}
              style={{
                borderColor: spent ? COLORS.te : exists ? '#3a3a40' : '#222',
                background: spent ? COLORS.te : exists ? '#0d0d0f' : 'transparent',
                boxShadow: spent ? `0 0 8px ${COLORS.te}88` : undefined,
              }}
            />
          );
        })}
      </div>
      <span className={cn('tnum font-mono text-[11px] font-bold', preview.valid ? 'text-ink' : 'text-estop glow-estop')}>
        {preview.cyclesRemaining}/{battle.cycles}
      </span>
    </div>
  );
}

function SlotCap({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-1 text-center">
      <span className="font-mono text-[9px] font-black text-mute">{label}</span>
      <span className="font-mono text-[7px] text-dim">{sub}</span>
      <span className="mt-1 h-px w-6 bg-[#2a2a2e]" />
    </div>
  );
}

function Connector({ lit }: { lit?: boolean }) {
  return (
    <div className="flex w-4 shrink-0 items-center">
      <span className={cn('h-px w-full', lit ? 'bg-te shadow-[0_0_6px_#ff4f00]' : 'bg-[#2a2a2e]')} />
    </div>
  );
}

function StagedSlot({
  slotRef,
  inst,
  index,
  count,
  prevLatency,
  step,
  active,
  done,
  locked,
  onUnstage,
  onReorder,
  onOpenKnowledge,
  onInspect,
}: {
  slotRef: (el: HTMLDivElement | null) => void;
  inst: CardInstance;
  index: number;
  count: number;
  prevLatency?: number;
  step?: PipelinePreviewResult['steps'][number];
  active: boolean;
  done: boolean;
  locked: boolean;
  onUnstage: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onOpenKnowledge: (id: string) => void;
  onInspect: (entering: boolean) => void;
}) {
  const { tx, card } = useI18n();
  const def = CARD_REGISTRY[inst.cardId];
  if (!def) return null;
  const c = domainColor(def.domain);
  const name = card(def).name;
  const dLat = step && prevLatency !== undefined ? step.telemetryAfter.totalLatencyMs - prevLatency : 0;
  return (
    <motion.div
      ref={slotRef}
      layout
      initial={{ opacity: 0, y: 14, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: active ? 1.05 : 1 }}
      exit={{ opacity: 0, y: 14, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex shrink-0 items-stretch"
      onMouseEnter={() => onInspect(true)}
      onMouseLeave={() => onInspect(false)}
    >
      <Connector lit={active || done} />
      <div
        className={cn(
          'relative flex w-[150px] flex-col overflow-hidden rounded-[8px] border bg-[#0d0d10] transition-shadow tall:w-[180px]',
          step?.warningNotice && 'ring-1 ring-amber/70',
          step?.synergyNotice && !step.warningNotice && 'ring-1 ring-signal/60',
        )}
        style={{
          borderColor: active ? COLORS.te : `${c}55`,
          boxShadow: active ? `0 0 0 1px ${COLORS.te}, 0 0 24px -2px ${COLORS.te}aa` : undefined,
        }}
      >
        <div className="h-[3px]" style={{ background: c }} />
        <div className="flex items-center justify-between px-2 pt-1.5">
          <span className="font-mono text-[9px] font-black text-mute">
            PASS {String(index + 1).padStart(2, '0')}
          </span>
          <span className="flex items-center gap-1">
            {step?.bottleneckChanged && (
              <span className="rounded-[3px] bg-scope/15 px-1 font-mono text-[8px] font-bold text-scope">
                {step.telemetryAfter.bottleneck === 'COMPUTE_BOUND' ? '→CMP' : '→MEM'}
              </span>
            )}
            <span className="font-mono text-[9px] font-bold" style={{ color: c }}>
              {def.code}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 pt-1 tall:pt-2.5">
          <DynIcon name={def.icon} size={13} className="shrink-0" />
          <span className="truncate text-[12px] font-bold tall:text-[14px]" title={name}>{name}</span>
        </div>
        <div className="flex items-center justify-between px-2 pt-1 pb-1 font-mono text-[10px] tall:pt-2 tall:pb-2 tall:text-[11px]">
          <span className="tnum" style={{ color: dLat < -0.005 ? COLORS.signal : dLat > 0.005 ? COLORS.estop : COLORS.mute }}>
            Δ {fmtDelta(dLat, 2)}ms
          </span>
          <span className="tnum text-dim">{step ? fmt(step.telemetryAfter.totalLatencyMs, 1) : '--'}ms</span>
        </div>
        <div className="mt-auto flex items-center gap-1 border-t border-[#1a1a1e] px-1.5 py-1">
          <MiniKey disabled={locked || index === 0} onClick={() => onReorder(index, index - 1)} title={tx('左移（更早执行）', 'Move left (run earlier)')}>
            <ChevronLeft size={12} />
          </MiniKey>
          <MiniKey disabled={locked || index === count - 1} onClick={() => onReorder(index, index + 1)} title={tx('右移（更晚执行）', 'Move right (run later)')}>
            <ChevronRight size={12} />
          </MiniKey>
          <span className="flex-1 text-center font-mono text-[9px] text-dim">{def.cost}C</span>
          <MiniKey onClick={() => onOpenKnowledge(def.knowledgeId)} title={tx('查看 GDB 权威词条', 'Open GDB datasheet')}>
            <BookOpen size={11} />
          </MiniKey>
          <MiniKey disabled={locked} onClick={() => onUnstage(inst.instanceId)} title={tx('退回手牌', 'Return to hand')}>
            <X size={12} />
          </MiniKey>
        </div>
        {active && (
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ x: '-100%' }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 0.35, ease: 'linear' }}
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,79,0,0.25), transparent)' }}
          />
        )}
      </div>
    </motion.div>
  );
}

function GhostSlot({ step }: { step?: PipelinePreviewResult['steps'][number] }) {
  const { card } = useI18n();
  if (!step) return null;
  const c = domainColor(step.domain);
  const def = CARD_REGISTRY[step.cardId];
  const name = def ? card(def).name : step.cardName;
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className="flex shrink-0 items-stretch"
    >
      <Connector />
      <div
        className="flex w-[150px] flex-col justify-center gap-1 rounded-[8px] border border-dashed px-2 py-2 tall:w-[180px]"
        style={{ borderColor: `${c}88`, background: `${c}0d` }}
      >
        <span className="font-mono text-[9px] font-black text-scope">SIM · HOVER</span>
        <span className="truncate text-[12px] font-bold text-ink-2">{name}</span>
        <span className="tnum font-mono text-[10px] text-mute">→ {fmt(step.telemetryAfter.totalLatencyMs, 2)}ms</span>
      </div>
    </motion.div>
  );
}

function EmptySlot({ index }: { index: number }) {
  return (
    <div className="flex shrink-0 items-stretch">
      <Connector />
      <div className="grid min-h-[88px] w-[104px] place-items-center rounded-[8px] border border-dashed border-[#232328] tall:min-h-[120px] tall:w-[128px]">
        <span className="font-mono text-[9px] text-[#3a3a40]">PASS {String(index + 1).padStart(2, '0')}</span>
      </div>
    </div>
  );
}

function MiniKey({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className="keycap grid h-5 w-5 place-items-center !rounded-[4px]"
    >
      {children}
    </button>
  );
}

function Notice({ kind, text }: { kind: 'synergy' | 'overdrive' | 'warning' | 'error'; text: string }) {
  const color =
    kind === 'synergy' ? COLORS.signal : kind === 'overdrive' ? '#ffc21a' : kind === 'warning' ? COLORS.amber : COLORS.estop;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      title={text}
      className="flex h-[18px] shrink-0 items-center gap-1.5 rounded-[5px] border px-1.5 text-[10.5px]"
      style={{ borderColor: `${color}44`, background: `${color}10`, color }}
    >
      {kind === 'synergy' || kind === 'overdrive' ? <Sparkles size={11} className="shrink-0" /> : <TriangleAlert size={11} className="shrink-0" />}
      <span className="shrink-0 font-mono text-[8.5px] font-black">
        {kind === 'synergy' ? 'SYNERGY' : kind === 'overdrive' ? 'OVERDRIVE' : kind === 'warning' ? 'ANTI-PATTERN' : 'INVALID'}
      </span>
      <span className="truncate text-ink-2">{text}</span>
    </motion.div>
  );
}

function SlaLamp({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('tnum flex shrink-0 items-center gap-1.5 max-xl:gap-1', ok ? 'text-ink-2' : 'text-estop')}>
      <Led on color={ok ? COLORS.signal : COLORS.estop} />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

const TRACE_STYLE: Record<TraceEventKind, { tag: string; color: string }> = {
  CARD_EXEC: { tag: 'EXEC', color: '#b9b8b2' },
  SYNERGY_PROC: { tag: 'SYNG', color: COLORS.signal },
  ANTI_PATTERN_WARN: { tag: 'WARN', color: COLORS.amber },
  ROOFLINE_SHIFT: { tag: 'ROOF', color: COLORS.scope },
  THERMAL_THROTTLE: { tag: 'HEAT', color: COLORS.amber },
  OOM_TRIGGERED: { tag: 'PANC', color: COLORS.estop },
  WATCHDOG_SAVE: { tag: 'WDOG', color: '#c4a5ff' },
  FAULT_HIT: { tag: 'FALT', color: COLORS.te },
  SLA_PASS: { tag: 'PASS', color: COLORS.signal },
  SLA_FAIL: { tag: 'FAIL', color: COLORS.estop },
  CHAIN_OVERDRIVE: { tag: 'ODRV', color: '#ffc21a' },
};

function TraceTicker({ trace, wave }: { trace: TraceEvent[]; wave: number }) {
  const { t, tx } = useI18n();
  const [open, setOpen] = useState(false);
  const latest = trace[trace.length - 1];
  const st = latest ? (TRACE_STYLE[latest.kind] ?? TRACE_STYLE.CARD_EXEC) : null;
  return (
    <div className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-[18px] w-full min-w-0 items-center gap-1.5 rounded-[5px] border border-[#222227] bg-black/50 px-1.5 text-left font-mono text-[10px] transition hover:border-[#3a3a40]"
        title={t('dmesgTitle')}
        aria-expanded={open}
      >
        <Terminal size={10} className="shrink-0 text-signal" />
        <span className="shrink-0 text-dim">dmesg</span>
        {latest && st ? (
          <motion.span key={`${trace.length}-${latest.title}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 items-center gap-1">
            <span className="shrink-0 font-bold" style={{ color: st.color }}>
              [{st.tag}]
            </span>
            <span className="truncate text-ink-2">{latest.title}</span>
          </motion.span>
        ) : (
          <span className="truncate text-dim">{tx('等待首次压测…', 'Awaiting first benchmark…')}</span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-0.5 text-dim">
          {trace.length > 0 && <span className="tnum">{trace.length}</span>}
          <ChevronUp size={11} className={cn('transition-transform', !open && 'rotate-180')} />
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-[calc(100%+6px)] left-0 z-30 w-[min(480px,80vw)]"
            >
              <TraceLog trace={trace} wave={wave} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function TraceLog({ trace, wave }: { trace: TraceEvent[]; wave: number }) {
  const { tx } = useI18n();
  return (
    <div className="oled flex max-h-[min(340px,55vh)] flex-col shadow-[0_20px_60px_-10px_rgba(0,0,0,0.95)]">
      <div className="flex items-center justify-between border-b border-[#15161a] px-2.5 py-1.5">
        <span className="font-mono text-[9px] font-black tracking-wider text-mute">$ dmesg --follow</span>
        <span className="font-mono text-[9px] text-dim">LAST TURN · W{Math.max(1, wave - 1)}</span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2.5 py-1.5 font-mono text-[10px] leading-[1.45]">
        {trace.length === 0 ? (
          <div className="text-dim">
            <span className="text-signal">cj@bench</span>:~$ ./benchmark --wave 1
            <br />
            {tx('等待首次压测…', 'Awaiting first benchmark…')} <span className="blink">▌</span>
          </div>
        ) : (
          trace.map((ev, i) => {
            const st = TRACE_STYLE[ev.kind] ?? TRACE_STYLE.CARD_EXEC;
            return (
              <motion.div
                key={`${i}-${ev.title}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.035 }}
                className="mb-1"
              >
                <span className="tnum text-dim">{String(i).padStart(2, '0')} </span>
                <span className="font-bold" style={{ color: st.color }}>
                  [{st.tag}]
                </span>{' '}
                <span className="text-ink">{ev.title}</span>
                {ev.deltaLatencyMs !== undefined && Math.abs(ev.deltaLatencyMs) > 0.005 && (
                  <span className={cn('tnum ml-1', ev.deltaLatencyMs < 0 ? 'text-signal' : 'text-estop')}>
                    {fmtDelta(ev.deltaLatencyMs, 2)}ms
                  </span>
                )}
                {ev.deltaTempC !== undefined && Math.abs(ev.deltaTempC) > 0.05 && (
                  <span className={cn('tnum ml-1', ev.deltaTempC < 0 ? 'text-scope' : 'text-amber')}>
                    {fmtDelta(ev.deltaTempC)}°C
                  </span>
                )}
                <div className="pl-5 text-[9.5px] text-mute">{ev.detail}</div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
