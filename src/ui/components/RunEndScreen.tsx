import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { CARD_REGISTRY } from '../../data/cards';
import { FAULT_REGISTRY } from '../../data/faults';
import { diagnoseBattleFailure } from '../../engine/diagnose';
import { RotateCcw, Skull, Trophy } from 'lucide-react';
import { ReactNode } from 'react';
import { ENCOUNTER_REGISTRY } from '../../data/encounters';
import { PROFILE_REGISTRY } from '../../data/profiles';
import { RELIC_REGISTRY } from '../../data/relics';
import { RunState } from '../../engine/types';
import { useI18n } from './i18n';
import { DiagnosisPanel } from './DiagnosisPanel';
import { GradeStamp } from './JuiceGrade';
import { cn, domainColor, DynIcon } from './primitives';
import { ScreenFrame } from './ScreenFrame';

export function RunEndScreen({ run, onNewRun, onOpenKnowledge }: { run: RunState; onNewRun: () => void; onOpenKnowledge: (id: string) => void }) {
  const { t, tx, en, relic: relicText, encounter: encText } = useI18n();
  const win = run.phase === 'RUN_VICTORY';
  const profile = run.profileId ? PROFILE_REGISTRY[run.profileId] : undefined;
  const enc = run.activeEncounterId ? ENCOUNTER_REGISTRY[run.activeEncounterId] : undefined;
  const accent = win ? '#2cf07f' : '#ff2a2a';
  const cleared = run.nodes.filter((n) => n.visited).length;
  const diagnosis = useMemo(
    () => (!win && run.activeBattle && run.activeBattle.status === 'DEFEAT' ? diagnoseBattleFailure(run.activeBattle, CARD_REGISTRY, FAULT_REGISTRY) : null),
    [win, run.activeBattle],
  );
  const stats = (
    <div className={win ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : 'grid grid-cols-2 gap-2'}>
      <Stat k={t('actLabel')} v={`${run.act}/3`} />
      <Stat k={tx('胜场', 'WINS')} v={String(run.battlesWon)} />
      <Stat k={tx('节点', 'NODES')} v={String(cleared)} />
      <Stat k={t('credits')} v={String(run.credits)} accent="#ffb020" />
    </div>
  );

  return (
    <ScreenFrame
      code={win ? 'GA RELEASE' : 'POST-MORTEM'}
      title={win ? t('runVictoryTitle') : t('runDefeatTitle')}
      subtitle={profile ? (en ? profile.nameEn : profile.name) : undefined}
      icon={win ? <Trophy size={17} /> : <Skull size={17} />}
      accent={accent}
      footer={
        <>
          <span className="font-mono text-[10px] text-dim">RUN #{(run.profileId ?? 'none').toUpperCase()}-A{run.act}-W{run.battlesWon}</span>
          <div className="flex-1" />
          <button onClick={onNewRun} autoFocus className="keycap keycap-te flex h-10 items-center gap-2 px-5 text-[13px] font-black tracking-wider">
            <RotateCcw size={14} /> {t('newRun')}
          </button>
        </>
      }
      bodyClassName="grid grid-cols-1 content-center gap-5 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_300px] desk:overflow-visible short:gap-3 short:p-4"
    >
      <div className="flex min-w-0 flex-col gap-4 short:gap-2.5">
        <motion.div
          initial={{ scale: 2, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: -4, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
          className={cn('w-fit rounded-[12px] border-4 px-5 py-2 font-display leading-none font-black tracking-wider', diagnosis ? 'text-[26px] short:text-[22px]' : 'text-[34px]')}
          style={{ color: accent, borderColor: accent, textShadow: `0 0 24px ${accent}88`, boxShadow: `0 0 40px -10px ${accent}` }}
        >
          {win ? 'FULL-STACK GRAND SLAM' : 'RUN TERMINATED'}
        </motion.div>
        <p className={cn('max-w-[640px] leading-relaxed text-ink-2', diagnosis ? 'line-clamp-2 text-[12.5px]' : 'text-[14px]')}>
          {win
            ? tx(
                '从单板 Bring-up 到暴雨夜无风扇智驾，你榨干了每一个 FLOP、每一字节带宽和每一摄氏度的热余量。量产线签字放行，鸡蛋完好，四足没摔，车也没进沟。',
                'From board bring-up to a fanless VLA autopilot in a midnight storm, you squeezed every FLOP, byte of bandwidth and degree of thermal headroom. Mass production signed off: eggs intact, quadruped upright, car still on the road.',
              )
            : tx(
                '产线压测在这里中止。把 Roofline 图贴在显示器边上，换一套构筑再来——每次失败都是一次免费的 Profiling。',
                'The deployment run stops here. Tape the Roofline chart to your monitor and try another build — every failure is a free profiling session.',
              )}
        </p>
        {!win && run.activeBattle?.defeatReason && (
          <div className="rounded-[8px] border border-estop/40 bg-estop/10 px-3 py-2 font-mono text-[12px] text-ink">
            <span className="font-black text-estop">ROOT CAUSE ▸ </span>
            {enc && <span className="text-mute">[{encText(enc).name}] </span>}
            {run.activeBattle.defeatReason}
          </div>
        )}
        {diagnosis ? <DiagnosisPanel diagnosis={diagnosis} onOpenKnowledge={onOpenKnowledge} /> : stats}
      </div>

      <div className="flex flex-col gap-3">
        {diagnosis && stats}
        <div className="flex items-center gap-3">
          <GradeStamp grade={run.lastGrade} caption={t('juiceGrade')} size="lg" />
          <div className="font-mono text-[11px] leading-relaxed text-mute">
            <div>{t('juiceGrade')}</div>
            <div>
              {t('deckCount')} <span className="tnum text-ink">{run.deckCardIds.length}</span>
            </div>
            <div>
              HW <span className="tnum text-ink">{run.relicIds.length}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {run.relicIds.map((rid) => {
            const r = RELIC_REGISTRY[rid];
            if (!r) return null;
            const c = domainColor(r.domain);
            return (
              <span key={rid} className="flex items-center gap-1.5 rounded-[6px] border bg-black/50 px-2 py-1 text-[11px]" style={{ borderColor: `${c}55`, color: c }} title={relicText(r).summary}>
                <DynIcon name={r.icon} size={12} />
                <span className="text-ink-2">{relicText(r).name}</span>
              </span>
            );
          })}
        </div>
      </div>
    </ScreenFrame>
  );
}

function Stat({ k, v, accent }: { k: string; v: ReactNode; accent?: string }) {
  return (
    <div className={cn('oled px-3 py-2')}>
      <div className="relative z-10 font-mono text-[9px] tracking-wider text-dim">{k}</div>
      <div className="tnum relative z-10 font-mono text-[20px] font-black" style={{ color: accent ?? '#ecebe6' }}>
        {v}
      </div>
    </div>
  );
}
