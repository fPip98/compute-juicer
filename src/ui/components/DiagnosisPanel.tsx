import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Lightbulb, Stethoscope } from 'lucide-react';
import { CARD_REGISTRY } from '../../data/cards';
import { FailureDiagnosis } from '../../engine/types';
import { useI18n } from './i18n';
import { cn, domainColor, fmt } from './primitives';

/**
 * Root-cause post-mortem: Top-3 physical causes (each opens its GDB entry) + a "WHAT IF" counterfactual
 * replay computed from the cards the player actually held on the last turn.
 */
export function DiagnosisPanel({
  diagnosis,
  tone = 'dark',
  onOpenKnowledge,
  className,
}: {
  diagnosis: FailureDiagnosis;
  tone?: 'paper' | 'dark';
  onOpenKnowledge: (id: string) => void;
  className?: string;
}) {
  const { tx, en, card } = useI18n();
  const paper = tone === 'paper';
  const causes = diagnosis.topCauses.slice(0, 3);
  const cf = diagnosis.counterfactual;
  const latBetter = cf ? cf.whatIfLatencyMs < cf.actualLatencyMs - 0.005 : false;
  const accBetter = cf ? cf.whatIfAccuracy > cf.actualAccuracy + 0.05 : false;

  return (
    <div className={cn('flex flex-col gap-2', className)} data-diagnosis>
      <div className={cn('flex items-center gap-1.5 font-mono text-[10px] font-black tracking-[0.16em]', paper ? 'text-[#6d6b66]' : 'text-mute')}>
        <Stethoscope size={12} className={paper ? 'text-[#d31616]' : 'text-estop'} />
        ROOT-CAUSE DIAGNOSIS{!en && ' · 根因诊断'}
      </div>

      {causes.length > 0 ? (
        <div className={cn('grid gap-1.5', causes.length >= 3 ? 'grid-cols-3' : causes.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
          {causes.map((c, i) => {
            const crit = c.severity === 'CRITICAL';
            return (
              <motion.button
                key={c.id}
                data-root-cause={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
                onClick={() => onOpenKnowledge(c.knowledgeId)}
                title={`${en ? c.titleEn : c.titleZh}\n${en ? c.detailEn : c.detailZh}`}
                className={cn(
                  'group flex min-w-0 flex-col gap-1 rounded-[8px] border px-2.5 py-2 text-left transition',
                  paper
                    ? 'border-[#c9c7c0] bg-[#f1efe9] hover:border-[#d31616]/60 hover:bg-white'
                    : 'border-[#2b2b30] bg-black/40 hover:border-estop/60 hover:bg-black/70',
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      'rounded-[3px] px-1 font-mono text-[8.5px] font-black',
                      crit ? 'bg-[#d31616] text-white' : paper ? 'bg-[#c9a227] text-black' : 'bg-amber text-black',
                    )}
                  >
                    #{i + 1} {c.severity}
                  </span>
                  <BookOpen size={11} className={cn('shrink-0', paper ? 'text-[#8a8780] group-hover:text-[#0e7fb0]' : 'text-dim group-hover:text-scope')} />
                </span>
                <span className={cn('line-clamp-2 text-[11.5px] leading-snug font-bold', paper ? 'text-[#141414]' : 'text-ink')}>
                  {en ? c.titleEn : c.titleZh}
                </span>
                <span className={cn('line-clamp-2 text-[10.5px] leading-snug', paper ? 'text-[#5a5955]' : 'text-ink-2')}>
                  {en ? c.detailEn : c.detailZh}
                </span>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className={cn('text-[11.5px]', paper ? 'text-[#5a5955]' : 'text-mute')}>
          {tx('未定位到单一物理根因：多项指标小幅越线，建议从时间轴最长段着手。', 'No single dominant cause: several metrics marginally over — start from the longest timeline stage.')}
        </div>
      )}

      {/* WHAT IF */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        data-what-if={cf ? (cf.wouldPassSla ? 'pass' : 'closer') : 'none'}
        className={cn(
          'relative overflow-hidden rounded-[10px] border-2 px-3 py-2.5',
          cf?.wouldPassSla
            ? paper
              ? 'border-[#0f9f4f] bg-[#e6f4ea]'
              : 'border-signal/70 bg-signal/[0.07]'
            : paper
              ? 'border-[#e0731a] bg-[#fbeee2]'
              : 'border-te/60 bg-te/[0.07]',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={cn('flex items-center gap-1.5 font-mono text-[10px] font-black tracking-wider', paper ? 'text-[#b4470a]' : 'text-te')}>
            <Lightbulb size={12} />
            WHAT IF{!en && ' · 如果当时…'}
          </span>
          {cf && (
            <span
              className={cn(
                'rotate-[-4deg] rounded-[4px] border-2 px-1.5 font-display text-[11px] font-black',
                cf.wouldPassSla ? 'border-[#0f9f4f] text-[#0f9f4f]' : paper ? 'border-[#b4470a] text-[#b4470a]' : 'border-te text-te',
              )}
            >
              {cf.wouldPassSla ? tx('→ 本波达标', '→ WOULD PASS') : tx('→ 更接近达标', '→ CLOSER')}
            </span>
          )}
        </div>
        {cf ? (
          <>
            <p className={cn('mt-1 line-clamp-2 text-[12px] leading-snug', paper ? 'text-[#2e2d2a]' : 'text-ink')} title={en ? cf.summaryEn : cf.summaryZh}>
              {en ? cf.summaryEn : cf.summaryZh}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1">
              {cf.suggestedCardIds.map((id, i) => {
                const def = CARD_REGISTRY[id];
                if (!def) return null;
                const c = domainColor(def.domain);
                return (
                  <span key={`${id}-${i}`} className="flex items-center gap-1">
                    {i > 0 && <ArrowRight size={11} className={paper ? 'text-[#8a8780]' : 'text-dim'} />}
                    <span
                      className="flex max-w-[170px] items-center gap-1 rounded-[4px] border px-1.5 py-[1px] text-[10.5px] font-bold"
                      style={{ borderColor: `${c}88`, background: paper ? `${c}22` : `${c}18`, color: paper ? '#141414' : c }}
                      title={card(def).summary}
                    >
                      <span className="font-mono text-[9px] opacity-70">{i + 1}</span>
                      <span className="truncate">{card(def).name}</span>
                    </span>
                  </span>
                );
              })}
            </div>
            <div className={cn('tnum mt-1.5 flex flex-wrap gap-x-4 font-mono text-[11px]', paper ? 'text-[#2e2d2a]' : 'text-ink-2')}>
              <span>
                LAT {fmt(cf.actualLatencyMs, 2)}ms <ArrowRight size={10} className="inline" />{' '}
                <b className={latBetter ? (paper ? 'text-[#0f9f4f]' : 'text-signal') : ''}>{fmt(cf.whatIfLatencyMs, 2)}ms</b>
              </span>
              <span>
                ACC {fmt(cf.actualAccuracy)}% <ArrowRight size={10} className="inline" />{' '}
                <b className={accBetter ? (paper ? 'text-[#0f9f4f]' : 'text-signal') : ''}>{fmt(cf.whatIfAccuracy)}%</b>
              </span>
            </div>
          </>
        ) : (
          <p className={cn('mt-1 text-[11.5px] leading-snug', paper ? 'text-[#5a5955]' : 'text-ink-2')}>
            {tx(
              '当时手里的牌在 40 种编排内都无法扭转局面——问题出在构筑：去商店/营地补齐对应互斥轴的 PATCH。',
              'No ordering of the cards you held (40 candidates searched) would have saved it — this is a build problem: shop for the missing rack-axis PATCH.',
            )}
          </p>
        )}
      </motion.div>
    </div>
  );
}
