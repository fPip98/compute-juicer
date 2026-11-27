import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { ReactNode } from 'react';
import { CARD_REGISTRY } from '../../data/cards';
import { DOMAINS } from '../../data/domains';
import { RELIC_REGISTRY } from '../../data/relics';
import { useI18n } from './i18n';
import { RackAxisBadge } from './RackBadge';
import { cn, domainColor, DynIcon, TypeBadge } from './primitives';

/**
 * Full industrial card face used outside battle (reward draft, shop shelf, deck inspector).
 * Visual language matches the in-battle hand cards.
 */
export function CardFace({
  cardId,
  onClick,
  onBook,
  disabled,
  selected,
  footer,
  size = 'md',
  className,
}: {
  cardId: string;
  onClick?: () => void;
  onBook?: (knowledgeId: string) => void;
  disabled?: boolean;
  selected?: boolean;
  footer?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const { tx, card } = useI18n();
  const def = CARD_REGISTRY[cardId];
  if (!def) return null;
  const c = domainColor(def.domain);
  const text = card(def);
  const isFault = def.type === 'FAULT';
  const sm = size === 'sm';
  const interactive = !!onClick && !disabled;

  return (
    <motion.div
      whileHover={interactive ? { y: -6, scale: 1.02 } : undefined}
      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
      onClick={interactive ? onClick : undefined}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.stopPropagation();
          onClick?.();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-disabled={onClick ? !!disabled : undefined}
      data-card-id={cardId}
      className={cn(
        'group relative flex shrink-0 flex-col overflow-hidden rounded-[12px] border text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-scope',
        sm ? 'h-[150px] w-[132px]' : 'h-[204px] w-[168px]',
        interactive && 'cursor-pointer',
        disabled && 'cursor-not-allowed opacity-45 grayscale-[0.5]',
        className,
      )}
      style={{
        borderColor: selected ? c : '#2b2b30',
        background: isFault ? 'linear-gradient(180deg, #1c0c0c 0%, #120808 100%)' : 'linear-gradient(180deg, #1c1c20 0%, #121214 100%)',
        boxShadow: selected
          ? `0 0 0 1px ${c}, 0 14px 32px -12px ${c}88`
          : 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 18px -10px rgba(0,0,0,0.9)',
      }}
    >
      <div className={cn('relative flex shrink-0 items-center justify-between px-2', sm ? 'h-[20px]' : 'h-[24px]')} style={{ background: isFault ? undefined : c }}>
        {isFault && <div className="hazard-estop absolute inset-0 opacity-80" />}
        <span className="relative font-mono text-[10px] font-black tracking-wider text-[#0a0a0b]">{def.code}</span>
        <span className={cn('relative truncate font-mono text-[9px] font-bold text-[#0a0a0b]/75', sm ? 'mr-7' : 'mr-8')}>{DOMAINS[def.domain].shortName}</span>
      </div>
      <div
        className={cn(
          'absolute right-1.5 grid place-items-center rounded-full border-2 border-[#0a0a0b] bg-ink font-display font-black text-chassis',
          sm ? 'top-[9px] h-6 w-6 text-[12px]' : 'top-[12px] h-7 w-7 text-[14px]',
        )}
        style={{ boxShadow: '0 3px 0 #050506' }}
        title={tx(`${def.cost} 预算 (CYCLES)`, `${def.cost} CYCLES`)}
      >
        {def.cost}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pt-2 pb-1.5">
        <div className="flex items-start gap-1.5 pr-6">
          <span className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded" style={{ background: `${c}22`, color: c }}>
            <DynIcon name={def.icon} size={11} />
          </span>
          <span className={cn('line-clamp-2 leading-[1.2] font-bold text-ink', sm ? 'text-[11.5px]' : 'text-[12.5px]')}>{text.name}</span>
        </div>
        <p className={cn('text-ink-2', sm ? 'line-clamp-3 text-[9.5px] leading-[1.3]' : 'line-clamp-4 text-[10.5px] leading-[1.35]')} title={text.summary}>
          {text.summary}
        </p>
        {!sm && text.orderHint && (
          <p className="line-clamp-2 border-l-2 border-amber/60 pl-1.5 text-[9.5px] leading-[1.3] text-amber/90" title={text.orderHint}>
            {text.orderHint}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-1">
          <div className="flex min-w-0 flex-wrap gap-[3px]">
            <TypeBadge type={def.type} />
            {def.type === 'PATCH' && <RackAxisBadge def={def} />}
            {!sm &&
              def.tags.slice(0, def.type === 'PATCH' ? 1 : 2).map((t) => (
                <span key={t} className="rounded-[3px] border border-[#2e2e34] bg-black/40 px-1 font-mono text-[8.5px] font-bold text-ink-2">
                  {t}
                </span>
              ))}
          </div>
          {onBook && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBook(def.knowledgeId);
              }}
              title={tx('打开 GDB 权威词条', 'Open GDB manual entry')}
              aria-label={tx('打开 GDB 权威词条', 'Open GDB manual entry')}
              className="keycap grid h-[22px] w-[22px] shrink-0 place-items-center !rounded-[5px] text-mute hover:text-scope"
            >
              <BookOpen size={12} />
            </button>
          )}
        </div>
      </div>
      {footer && <div className="shrink-0 border-t border-[#222227]">{footer}</div>}
    </motion.div>
  );
}

/** Compact hardware relic plate used in reward / shop / profile screens. */
export function RelicPlate({
  relicId,
  onBook,
  footer,
  highlight,
  className,
}: {
  relicId: string;
  onBook?: (knowledgeId: string) => void;
  footer?: ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  const { tx, relic } = useI18n();
  const def = RELIC_REGISTRY[relicId];
  if (!def) return null;
  const c = domainColor(def.domain);
  const text = relic(def);
  return (
    <div
      data-relic-id={relicId}
      className={cn('flex flex-col overflow-hidden rounded-[11px] border bg-[#131316]', className)}
      style={{ borderColor: highlight ? c : `${c}55`, boxShadow: highlight ? `0 0 0 1px ${c}, 0 0 28px -8px ${c}` : undefined }}
    >
      <div className="flex items-start gap-2.5 p-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border bg-black/60" style={{ borderColor: `${c}66`, color: c, boxShadow: `inset 0 0 14px ${c}22` }}>
          <DynIcon name={def.icon} size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9.5px] font-bold" style={{ color: c }}>
              {def.code} · {DOMAINS[def.domain].shortName}
            </span>
            {onBook && (
              <button
                onClick={() => onBook(def.knowledgeId)}
                className="text-dim transition hover:text-scope"
                title={tx('打开 GDB 权威词条', 'Open GDB manual entry')}
                aria-label={tx('打开 GDB 权威词条', 'Open GDB manual entry')}
              >
                <BookOpen size={12} />
              </button>
            )}
          </div>
          <div className="truncate text-[13px] font-bold text-ink">{text.name}</div>
          <div className="line-clamp-2 text-[11px] leading-snug text-ink-2" title={text.summary}>
            {text.summary}
          </div>
        </div>
      </div>
      {footer && <div className="border-t border-[#222227]">{footer}</div>}
    </div>
  );
}
