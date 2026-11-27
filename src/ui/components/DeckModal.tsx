import { AnimatePresence, motion } from 'framer-motion';
import { Layers, Trash2, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { CARD_REGISTRY } from '../../data/cards';
import { Domain } from '../../engine/types';
import { CardFace } from './CardFace';
import { useI18n } from './i18n';
import { domainColor } from './primitives';

const DOMAIN_ORDER: Domain[] = ['SILICON', 'KERNEL', 'NETWORK', 'CPP', 'DEPLOY', 'VLA'];
/** Engine refuses removals that would shrink the deck to fewer than this. */
const MIN_DECK = 6;

export function DeckModal({
  open,
  deckCardIds,
  mode = 'view',
  title,
  subtitle,
  onPick,
  onClose,
  onBook,
}: {
  open: boolean;
  deckCardIds: string[];
  mode?: 'view' | 'remove';
  title?: string;
  subtitle?: string;
  onPick?: (deckIndex: number) => void;
  onClose: () => void;
  onBook?: (knowledgeId: string) => void;
}) {
  const { t, tx } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Keep original deck indices (engine removes by index), sorted for browsing: faults first in remove mode.
  const entries = useMemo(() => {
    const list = deckCardIds.map((id, index) => ({ id, index, def: CARD_REGISTRY[id] }));
    return list.sort((a, b) => {
      const fa = a.def?.type === 'FAULT' ? 0 : 1;
      const fb = b.def?.type === 'FAULT' ? 0 : 1;
      if (mode === 'remove' && fa !== fb) return fa - fb;
      const da = a.def ? DOMAIN_ORDER.indexOf(a.def.domain) : 9;
      const db = b.def ? DOMAIN_ORDER.indexOf(b.def.domain) : 9;
      return da - db || (a.def?.cost ?? 0) - (b.def?.cost ?? 0);
    });
  }, [deckCardIds, mode]);

  const domainCounts = useMemo(() => {
    const m = new Map<Domain, number>();
    for (const e of entries) if (e.def && e.def.type !== 'FAULT') m.set(e.def.domain, (m.get(e.def.domain) ?? 0) + 1);
    return m;
  }, [entries]);
  const faults = entries.filter((e) => e.def?.type === 'FAULT').length;
  const canRemove = deckCardIds.length > MIN_DECK;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-label={title ?? t('viewDeck')}
            initial={{ y: 24, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="panel flex max-h-[calc(100dvh-32px)] w-full max-w-[1180px] flex-col"
          >
            <div className="flex flex-wrap items-center gap-3 border-b border-[#1e1e22] px-4 py-2.5">
              {mode === 'remove' ? <Trash2 size={16} className="text-estop" /> : <Layers size={16} className="text-te" />}
              <div className="leading-tight">
                <div className="font-display text-[14px] font-black tracking-wider">{title ?? t('viewDeck')}</div>
                <div className="text-[11px] text-mute">
                  {subtitle ??
                    tx(`共 ${deckCardIds.length} 张 · 其中技术债 ${faults} 张`, `${deckCardIds.length} cards · ${faults} tech-debt FAULT`)}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {DOMAIN_ORDER.filter((d) => domainCounts.get(d)).map((d) => (
                  <span
                    key={d}
                    className="tnum rounded-[4px] border px-1.5 py-[1px] font-mono text-[9.5px] font-bold"
                    style={{ color: domainColor(d), borderColor: `${domainColor(d)}55` }}
                  >
                    {d} ×{domainCounts.get(d)}
                  </span>
                ))}
              </div>
              <div className="flex-1" />
              <button onClick={onClose} className="keycap flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] font-bold">
                <X size={13} /> {tx('关闭', 'CLOSE')} · ESC
              </button>
            </div>
            {mode === 'remove' && !canRemove && (
              <div className="border-b border-estop/30 bg-estop/10 px-4 py-1.5 text-[11px] text-estop">
                {tx(`牌库至少保留 ${MIN_DECK} 张，无法继续删减。`, `Deck must keep at least ${MIN_DECK} cards.`)}
              </div>
            )}
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] justify-items-center gap-3">
                {entries.map((e) => (
                  <CardFace
                    key={`${e.id}-${e.index}`}
                    cardId={e.id}
                    size="sm"
                    onBook={mode === 'view' ? onBook : undefined}
                    onClick={mode === 'remove' && onPick ? () => onPick(e.index) : undefined}
                    disabled={mode === 'remove' && !canRemove}
                    className={mode === 'remove' ? 'hover:!border-estop' : undefined}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
