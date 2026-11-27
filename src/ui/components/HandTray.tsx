import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Layers } from 'lucide-react';
import { CARD_REGISTRY } from '../../data/cards';
import { DOMAINS } from '../../data/domains';
import { CardDef, CardInstance } from '../../engine/types';
import { useI18n } from './i18n';
import { RackAxisBadge, RackSlots } from './RackBadge';
import { cn, COLORS, domainColor, DynIcon, PanelHeader, TypeBadge } from './primitives';

interface HandTrayProps {
  hand: CardInstance[];
  /** Mounted exclusive rack slots (for ⇄ / + axis badges on PATCH cards). */
  rackSlots?: RackSlots;
  /** Card ids that counter a telegraphed fault this wave → cyan breathing outline. */
  counterCardIds?: Set<string>;
  cyclesRemaining: number;
  locked: boolean;
  /** True once the encounter is decided (victory/defeat). */
  ended?: boolean;
  hoveredId: string | null;
  drawCount: number;
  discardCount: number;
  exhaustCount: number;
  onHover: (id: string | null) => void;
  onStage: (id: string) => void;
  onOpenKnowledge: (id: string) => void;
}

export function HandTray({
  hand,
  rackSlots,
  counterCardIds,
  cyclesRemaining,
  locked,
  ended = false,
  hoveredId,
  drawCount,
  discardCount,
  exhaustCount,
  onHover,
  onStage,
  onOpenKnowledge,
}: HandTrayProps) {
  const { t, tx } = useI18n();
  const mid = (hand.length - 1) / 2;
  return (
    <section className="panel relative flex min-h-0 flex-col">
      {/* Narrow screens: regular header row */}
      <div className="lg:hidden">
        <PanelHeader
          index="05"
          title={t('panelHand')}
          right={
            <div className="flex items-center gap-3 font-mono text-[10px] text-mute">
              <Pile label="DRAW" n={drawCount} />
              <Pile label="DISC" n={discardCount} />
              <Pile label="EXH" n={exhaustCount} />
            </div>
          }
        />
      </div>
      {/* Wide screens: labels live in the empty side gutters so the cards get the full height */}
      <div className="pointer-events-none absolute top-3 bottom-3 left-3 hidden w-[118px] flex-col justify-between lg:flex max-xl:w-[84px]">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] font-bold text-te">05</span>
            <span className="font-display text-[11px] font-bold tracking-[0.14em] text-ink uppercase">{t('panelHand')}</span>
          </div>
          <div className="mt-1.5 space-y-0.5 font-mono text-[9.5px] leading-snug text-dim">
            <div>CLICK · {tx('入槽', 'stage')}</div>
            <div>HOVER · {tx('预演', 'SIM')}</div>
            <div>📖 · {tx('GDB 词条', 'GDB entry')}</div>
          </div>
        </div>
        <div className="font-mono text-[9px] leading-snug text-[#3a3a40]">
          ENTER · BENCHMARK
          <br />
          F5 · HALT
        </div>
      </div>
      <div className="pointer-events-none absolute top-3 right-3 bottom-3 hidden w-[118px] flex-col items-end justify-end gap-1 lg:flex max-xl:w-[84px]">
        <Pile label="DRAW" n={drawCount} />
        <Pile label="DISCARD" n={discardCount} />
        <Pile label="EXHAUST" n={exhaustCount} />
      </div>
      <div className="scroll-thin flex min-h-0 flex-1 items-end overflow-x-auto px-3 pt-[14px] pb-2 lg:px-[136px] max-xl:lg:px-[96px]" onMouseLeave={() => onHover(null)}>
        <div className="relative mx-auto flex w-max items-end gap-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {hand.map((inst, i) => {
            const def = CARD_REGISTRY[inst.cardId];
            if (!def) return null;
            const affordable = def.cost <= cyclesRemaining;
            return (
              <HandCard
                key={inst.instanceId}
                def={def}
                rackSlots={rackSlots}
                isCounter={!!counterCardIds?.has(def.id)}
                tilt={(i - mid) * 0.5}
                affordable={affordable}
                locked={locked}
                hovered={hoveredId === inst.instanceId}
                onEnter={() => !locked && onHover(inst.instanceId)}
                onLeave={() => onHover(null)}
                onClick={() => {
                  if (!locked && affordable) onStage(inst.instanceId);
                }}
                onBook={() => onOpenKnowledge(def.knowledgeId)}
              />
            );
          })}
        </AnimatePresence>
          {hand.length === 0 && (
            <div className="grid h-[188px] w-[420px] place-items-center short:h-[160px] rounded-xl border border-dashed border-line font-mono text-[11px] text-dim">
              {ended ? tx('战局已结束 · 查看战报或切换关卡', 'Encounter over · open the report or switch stage') : t('allStaged')}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Pile({ label, n }: { label: string; n: number }) {
  return (
    <span className="flex items-center gap-1 font-mono text-[10px] text-mute">
      <Layers size={11} className="text-dim" />
      {label}
      <span className="tnum font-bold text-ink">{n}</span>
    </span>
  );
}

function HandCard({
  def,
  rackSlots,
  isCounter,
  tilt,
  affordable,
  locked,
  hovered,
  onEnter,
  onLeave,
  onClick,
  onBook,
}: {
  def: CardDef;
  rackSlots?: RackSlots;
  isCounter: boolean;
  tilt: number;
  affordable: boolean;
  locked: boolean;
  hovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
  onBook: () => void;
}) {
  const c = domainColor(def.domain);
  const { tx, card } = useI18n();
  const text = card(def);
  const isFault = def.type === 'FAULT';
  const disabled = locked || !affordable;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, rotate: 0 }}
      animate={{ opacity: 1, y: hovered ? -10 : 0, rotate: hovered ? 0 : tilt, scale: hovered ? 1.03 : 1 }}
      exit={{ opacity: 0, y: -60, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      className={cn(
        'group relative flex h-[188px] w-[160px] shrink-0 tall:h-[204px] tall:w-[170px] short:h-[162px] short:w-[150px] cursor-pointer flex-col overflow-hidden rounded-[12px] border text-left outline-none select-none',
        isCounter && 'counter-glow',
        'focus-visible:ring-2 focus-visible:ring-scope',
        disabled && 'cursor-not-allowed',
      )}
      style={{
        borderColor: hovered ? c : '#2b2b30',
        background: isFault
          ? 'linear-gradient(180deg, #1c0c0c 0%, #120808 100%)'
          : 'linear-gradient(180deg, #1c1c20 0%, #121214 100%)',
        boxShadow: hovered
          ? `0 0 0 1px ${c}, 0 18px 40px -12px ${c}66, inset 0 1px 0 rgba(255,255,255,0.07)`
          : 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 18px -10px rgba(0,0,0,0.9)',
        opacity: !affordable && !locked ? 0.55 : 1,
      }}
    >
      {/* Domain band */}
      <div className="relative flex h-[24px] shrink-0 items-center justify-between px-2" style={{ background: isFault ? undefined : `${c}` }}>
        {isFault && <div className="hazard-estop absolute inset-0 opacity-80" />}
        <span className="relative font-mono text-[10px] font-black tracking-wider text-[#0a0a0b]">
          {def.code}
        </span>
        {isCounter ? (
          <span
            className="relative mr-8 rounded-[3px] bg-[#04141c] px-1 font-mono text-[8.5px] leading-[13px] font-black tracking-wider text-scope"
            title={tx('对症解牌：可化解本波预告的故障', 'Counter card: directly mitigates a telegraphed fault this wave')}
          >
            COUNTER
          </span>
        ) : (
          <span className="relative mr-8 truncate font-mono text-[9px] font-bold text-[#0a0a0b]/75">
            {DOMAINS[def.domain].shortName}
          </span>
        )}
      </div>

      {/* Cost keycap */}
      <div
        className={cn(
          'absolute top-[12px] right-1.5 grid h-7 w-7 place-items-center rounded-full border-2 font-display text-[14px] font-black',
          affordable ? 'border-[#0a0a0b] bg-ink text-chassis' : 'border-estop bg-[#1a0606] text-estop',
        )}
        style={{ boxShadow: '0 3px 0 #050506, inset 0 -2px 0 rgba(0,0,0,0.2)' }}
        title={tx(`${def.cost} 预算 (CYCLES)`, `${def.cost} CYCLES`)}
      >
        {def.cost}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pt-2 pb-1.5">
        <div className="flex items-start gap-1.5 pr-6">
          <span className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded" style={{ background: `${c}22`, color: c }}>
            <DynIcon name={def.icon} size={11} />
          </span>
          <span className="line-clamp-2 text-[12.5px] leading-[1.2] font-bold text-ink">{text.name}</span>
        </div>
        <p className="line-clamp-3 text-[10.5px] leading-[1.35] text-ink-2 tall:line-clamp-4 tall:text-[11px]" title={text.summary}>
          {text.summary}
        </p>
        {text.orderHint && (
          <p className="line-clamp-2 border-l-2 border-amber/60 pl-1.5 text-[9.5px] leading-[1.3] text-amber/90 short:line-clamp-1" title={text.orderHint}>
            {text.orderHint}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-1">
          <div className="flex min-w-0 flex-wrap gap-[3px]">
            <TypeBadge type={def.type} />
            {def.type === 'PATCH' && <RackAxisBadge def={def} rackSlots={rackSlots} />}
            {def.tags.slice(0, def.type === 'PATCH' ? 1 : 2).map((t) => (
              <span
                key={t}
                className="rounded-[3px] border border-[#2e2e34] bg-black/40 px-1 font-mono text-[8.5px] font-bold"
                style={{ color: tagColor(t) }}
              >
                {t}
              </span>
            ))}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBook();
            }}
            title={tx('打开 GDB 权威词条', 'Open GDB manual entry')}
            className="keycap grid h-[22px] w-[22px] shrink-0 place-items-center !rounded-[5px] text-mute hover:text-scope"
          >
            <BookOpen size={12} />
          </button>
        </div>
      </div>

      {!affordable && !locked && (
        <div className="absolute inset-x-2 top-[46%] rounded-[4px] border border-estop/50 bg-[#1a0606]/95 py-0.5 text-center font-mono text-[9px] font-black text-estop">
          INSUFFICIENT CYCLES
        </div>
      )}
    </motion.div>
  );
}

function tagColor(tag: string) {
  if (tag.endsWith('--')) return COLORS.signal;
  if (tag.endsWith('++')) return COLORS.te;
  if (tag.endsWith('-')) return COLORS.amber;
  if (tag.endsWith('+')) return COLORS.scope;
  if (tag.includes('FAULT')) return COLORS.estop;
  return '#b9b8b2';
}
