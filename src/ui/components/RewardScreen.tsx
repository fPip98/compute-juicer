import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Coins, Cpu, Gift, SkipForward } from 'lucide-react';
import { RunState } from '../../engine/types';
import { CardFace, RelicPlate } from './CardFace';
import { useI18n } from './i18n';
import { GradeStamp } from './JuiceGrade';
import { cn } from './primitives';
import { ScreenFrame } from './ScreenFrame';

export function RewardScreen({
  run,
  onPickCard,
  onSkip,
  onClaimRelic,
  onContinue,
  onOpenKnowledge,
}: {
  run: RunState;
  onPickCard: (cardId: string) => void;
  onSkip: () => void;
  onClaimRelic: () => void;
  onContinue: () => void;
  onOpenKnowledge: (id: string) => void;
}) {
  const { t, tx } = useI18n();
  const reward = run.activeReward;
  if (!reward) return null;
  const node = run.nodes.find((n) => n.id === run.currentNodeId);
  const advancesAct = node?.type === 'BOSS' && run.act < 3;
  const pending = !reward.cardClaimed || (!!reward.relicChoice && !reward.relicClaimed);

  return (
    <ScreenFrame
      code={`ACT ${run.act}`}
      title={t('rewardTitle')}
      subtitle={tx('选择构筑方向：一张好卡胜过三张平庸卡。', 'Shape your build: one sharp card beats three mediocre ones.')}
      icon={<Gift size={17} />}
      accent="#2cf07f"
      footer={
        <>
          <span className="text-[11.5px] text-mute">
            {pending
              ? tx('还有未领取的奖励——也可以直接离开。', 'Unclaimed rewards remain — you may still leave.')
              : tx('奖励已全部入库。', 'All rewards banked.')}
          </span>
          <div className="flex-1" />
          <button onClick={onContinue} className="keycap keycap-te flex h-10 items-center gap-2 px-5 text-[13px] font-black tracking-wider">
            {advancesAct ? `${t('advanceNextAct')} · ACT ${run.act + 1}` : t('continueMap')}
            <ArrowRight size={14} />
          </button>
        </>
      }
      bodyClassName="grid grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[250px_minmax(0,1fr)] desk:overflow-visible"
    >
      {/* Left: grade, credits, relic drop */}
      <div className="flex min-h-0 flex-col gap-3">
        <div className="oled flex items-center gap-4 p-3.5">
          <GradeStamp grade={reward.grade} caption={t('juiceGrade')} size="lg" />
          <div className="relative z-10 min-w-0">
            <div className="font-mono text-[9px] tracking-[0.16em] text-dim">{t('juiceGrade')}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <Coins size={15} className="text-amber" />
              <motion.span
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="tnum font-mono text-[22px] font-black text-amber glow-amber"
              >
                +{reward.credits}
              </motion.span>
            </div>
            <div className="font-mono text-[10px] text-mute">
              {t('credits')} → <span className="tnum text-ink">{run.credits}</span>
            </div>
          </div>
        </div>

        {reward.relicChoice ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-amber">
              <Cpu size={12} /> {t('rewardRelicDrop')}
            </div>
            <RelicPlate
              relicId={reward.relicChoice}
              highlight={!reward.relicClaimed}
              onBook={onOpenKnowledge}
              footer={
                <button
                  onClick={onClaimRelic}
                  disabled={reward.relicClaimed}
                  className={cn('flex w-full items-center justify-center gap-1.5 py-2 font-mono text-[11px] font-black', reward.relicClaimed ? 'text-signal' : 'bg-amber/10 text-amber hover:bg-amber/20')}
                >
                  {reward.relicClaimed ? (
                    <>
                      <Check size={13} /> {tx('已装入硬件槽', 'MOUNTED')}
                    </>
                  ) : (
                    t('rewardClaimRelic')
                  )}
                </button>
              }
            />
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-[#2b2b30] p-3 text-[11.5px] leading-relaxed text-mute">
            {tx('普通关卡不掉落硬件遗物。挑战精英 P0 或章节 BOSS 可获得稀有硬件！', 'Regular stages drop no hardware. Beat an Elite P0 or Act Boss for rare relics!')}
          </div>
        )}
      </div>

      {/* Right: 3-choose-1 draft */}
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold tracking-wider text-ink-2">{t('rewardPickCard')}</span>
          <button
            onClick={onSkip}
            disabled={reward.cardClaimed}
            className="keycap flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10.5px] font-bold"
          >
            <SkipForward size={12} /> {t('rewardSkip')}
          </button>
        </div>
        <div className="oled flex min-h-0 flex-1 items-center justify-center gap-5 p-4">
          <AnimatePresence>
            {reward.cardChoices.map((id, i) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 30, rotate: (i - 1) * 4 }}
                animate={{ opacity: reward.cardClaimed ? 0.35 : 1, y: 0, rotate: 0 }}
                transition={{ delay: 0.1 + i * 0.09, type: 'spring', stiffness: 240, damping: 20 }}
                className="relative z-10"
              >
                <CardFace
                  cardId={id}
                  onClick={reward.cardClaimed ? undefined : () => onPickCard(id)}
                  disabled={reward.cardClaimed}
                  onBook={onOpenKnowledge}
                  className="tall:h-[236px] tall:w-[190px]"
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {reward.cardClaimed && (
            <div className="absolute inset-x-0 bottom-3 z-20 text-center font-mono text-[11px] font-bold text-signal">
              ✓ {tx('本关抽卡已完成', 'Draft complete for this stage')}
            </div>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}
