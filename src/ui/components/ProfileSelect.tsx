import { motion } from 'framer-motion';
import { Coins, Cpu, Layers, Zap } from 'lucide-react';
import { useState } from 'react';
import { CARD_REGISTRY } from '../../data/cards';
import { DOMAINS } from '../../data/domains';
import { Domain, StarterProfile } from '../../engine/types';
import { RelicPlate } from './CardFace';
import { useI18n } from './i18n';
import { cn, domainColor } from './primitives';
import { ScreenFrame } from './ScreenFrame';

const DOMAIN_ORDER: Domain[] = ['SILICON', 'KERNEL', 'NETWORK', 'CPP', 'DEPLOY', 'VLA'];

const ACT_CHOICES: Array<{ act: 1 | 2 | 3; zh: string; en: string }> = [
  { act: 1, zh: 'ACT 1 · 单板 Bring-up', en: 'ACT 1 · Bring-up' },
  { act: 2, zh: 'ACT 2 · 多传感器联调', en: 'ACT 2 · Multi-Sensor' },
  { act: 3, zh: 'ACT 3 · 极端量产', en: 'ACT 3 · Mass Prod' },
];

export function ProfileSelect({
  profiles,
  onStart,
  onOpenKnowledge,
}: {
  profiles: StarterProfile[];
  onStart: (profileId: string, startAct: 1 | 2 | 3) => void;
  onOpenKnowledge: (id: string) => void;
}) {
  const { t, tx, en } = useI18n();
  const [selectedAct, setSelectedAct] = useState<1 | 2 | 3>(1);
  const creditBonus = (selectedAct - 1) * 100;

  return (
    <ScreenFrame
      code="BOOT"
      title={t('selectProfileTitle')}
      subtitle={t('selectProfileSub')}
      icon={<Cpu size={17} />}
      right={
        <div className="flex items-center gap-1.5">
          <span className="hidden font-mono text-[9.5px] text-dim xl:inline">
            {tx('起始章节', 'START ACT')}
          </span>
          {ACT_CHOICES.map((c) => {
            const active = selectedAct === c.act;
            return (
              <button
                key={c.act}
                onClick={() => setSelectedAct(c.act)}
                className={cn(
                  'keycap cursor-pointer px-2.5 py-1 font-mono text-[10px] font-black transition',
                  active ? 'keycap-te' : 'text-ink-2',
                )}
              >
                {en ? c.en : c.zh}
              </button>
            );
          })}
        </div>
      }
      bodyClassName="grid grid-cols-1 gap-3 overflow-y-auto p-3 md:grid-cols-3 desk:overflow-visible"
    >
      {profiles.map((p, i) => {
        const accent = domainColor(p.focusDomains[0]);
        const comp = new Map<Domain, number>();
        p.deckCardIds.forEach((id) => {
          const d = CARD_REGISTRY[id]?.domain;
          if (d) comp.set(d, (comp.get(d) ?? 0) + 1);
        });
        return (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, type: 'spring', stiffness: 220, damping: 24 }}
            className="group relative flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-[#2b2b30] bg-gradient-to-b from-[#18181b] to-[#111113] transition hover:border-[#4a4a52]"
            style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)` }}
            data-profile-id={p.id}
          >
            {/* Focus-domain colour bars */}
            <div className="flex h-1.5 w-full">
              {p.focusDomains.map((d) => (
                <span key={d} className="flex-1" style={{ background: domainColor(d) }} />
              ))}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] font-bold" style={{ color: accent }}>
                    {p.code}
                  </div>
                  <h2 className="font-display text-[17px] leading-tight font-black text-ink">{en ? p.nameEn : p.name}</h2>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border bg-black/60" style={{ borderColor: `${accent}66`, color: accent }}>
                  <Cpu size={20} />
                </span>
              </div>
              <p className="line-clamp-3 text-[12px] leading-relaxed text-ink-2">{en ? p.subtitleEn : p.subtitle}</p>

              <div className="flex flex-wrap gap-1">
                {p.focusDomains.map((d) => (
                  <span key={d} className="rounded-[4px] border px-1.5 py-[1px] font-mono text-[9.5px] font-bold" style={{ color: domainColor(d), borderColor: `${domainColor(d)}66`, background: `${domainColor(d)}14` }}>
                    {DOMAINS[d].shortName}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-1.5 font-mono">
                <div className="rounded-[8px] border border-black bg-oled px-2.5 py-1.5">
                  <div className="flex items-center gap-1 text-[8.5px] tracking-wider text-dim">
                    <Coins size={10} /> {t('credits')}
                  </div>
                  <div className="tnum text-[17px] font-black text-amber glow-amber">
                    {p.startingCredits + creditBonus}
                    {creditBonus > 0 && (
                      <span className="ml-1 text-[10px] font-bold text-te">+{creditBonus}</span>
                    )}
                  </div>
                </div>
                <div className="rounded-[8px] border border-black bg-oled px-2.5 py-1.5">
                  <div className="flex items-center gap-1 text-[8.5px] tracking-wider text-dim">
                    <Layers size={10} /> {t('deckCount')}
                  </div>
                  <div className="tnum text-[17px] font-black text-scope glow-scope">{p.deckCardIds.length}</div>
                </div>
              </div>

              {/* Deck composition bar */}
              <div>
                <div className="mb-1 font-mono text-[8.5px] tracking-wider text-dim">{tx('初始牌库构成', 'STARTER DECK MIX')}</div>
                <div className="flex h-2 overflow-hidden rounded-[2px] bg-black">
                  {DOMAIN_ORDER.filter((d) => comp.get(d)).map((d) => (
                    <span key={d} title={`${d} ×${comp.get(d)}`} style={{ flex: comp.get(d), background: domainColor(d) }} className="border-r border-black" />
                  ))}
                </div>
              </div>

              {/* Starter relics */}
              <div className="flex min-h-0 flex-col gap-1.5">
                <div className="font-mono text-[8.5px] tracking-wider text-dim">{tx('初始硬件遗物', 'STARTER HARDWARE')}</div>
                {p.relicIds.map((rid) => (
                  <RelicPlate key={rid} relicId={rid} onBook={onOpenKnowledge} />
                ))}
              </div>

              <button
                onClick={() => onStart(p.id, selectedAct)}
                className="keycap keycap-te mt-auto flex h-11 w-full items-center justify-center gap-2 text-[13px] font-black tracking-wider"
              >
                <Zap size={14} fill="currentColor" />
                {t('startRun')} · ACT {selectedAct}
              </button>
            </div>
          </motion.article>
        );
      })}
    </ScreenFrame>
  );
}
