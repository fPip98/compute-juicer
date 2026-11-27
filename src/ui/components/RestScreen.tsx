import { motion } from 'framer-motion';
import { ArrowLeft, Check, Coins, Trash2, Wrench } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { CARD_REGISTRY } from '../../data/cards';
import { RunState } from '../../engine/types';
import { DeckModal } from './DeckModal';
import { useI18n } from './i18n';
import { cn } from './primitives';
import { ScreenFrame } from './ScreenFrame';

const MIN_DECK = 6;

export function RestScreen({
  run,
  onRemoveCard,
  onTakeCredits,
  onLeave,
}: {
  run: RunState;
  onRemoveCard: (deckIndex: number) => void;
  onTakeCredits: () => void;
  onLeave: () => void;
}) {
  const { t, tx } = useI18n();
  const [purging, setPurging] = useState(false);
  const faults = run.deckCardIds.filter((id) => CARD_REGISTRY[id]?.type === 'FAULT').length;
  const canPurge = !run.restDone && run.deckCardIds.length > MIN_DECK;

  return (
    <ScreenFrame
      code="REST"
      title={t('restTitle')}
      subtitle={tx('深夜的实验室只剩风扇声。二选一，然后继续上路。', 'Only the fans hum in the late-night lab. Pick one, then move on.')}
      icon={<Wrench size={17} />}
      accent="#10b981"
      footer={
        <>
          <span className="text-[11.5px] text-mute">{run.restDone ? tx('维护完成。', 'Maintenance done.') : tx('也可以什么都不做直接离开。', 'You may also leave without doing anything.')}</span>
          <div className="flex-1" />
          <button onClick={onLeave} className="keycap keycap-te flex h-10 items-center gap-2 px-5 text-[13px] font-black tracking-wider">
            <ArrowLeft size={14} /> {t('continueMap')}
          </button>
        </>
      }
      bodyClassName="grid grid-cols-1 content-center gap-4 overflow-y-auto p-6 md:grid-cols-2 desk:overflow-visible"
    >
      <Option
        icon={<Trash2 size={26} />}
        color="#ff2a2a"
        title={t('restRemoveCard')}
        body={tx(
          `牌库 ${run.deckCardIds.length} 张，其中技术债 ${faults} 张。精简牌库能让核心 Combo 更稳定地抽到。`,
          `Deck: ${run.deckCardIds.length} cards, ${faults} tech-debt FAULT. A leaner deck draws your core combo more reliably.`,
        )}
        cta={tx('选择要删除的卡', 'CHOOSE A CARD')}
        disabled={!canPurge}
        done={run.restDone}
        onClick={() => setPurging(true)}
      />
      <Option
        icon={<Coins size={26} />}
        color="#ffb020"
        title={t('restBonusCredits')}
        body={tx('写一份漂亮的压测周报，向老板申请专项经费，用来在下一家商店采购硬件。', 'Write a slick benchmark report and expense +65 credits for the next hardware shop.')}
        cta="+65 CR"
        disabled={run.restDone}
        done={run.restDone}
        onClick={onTakeCredits}
      />

      <DeckModal
        open={purging}
        mode="remove"
        deckCardIds={run.deckCardIds}
        title={t('restRemoveCard')}
        subtitle={tx('免费：点击一张卡将其永久删除（技术债优先显示）。', 'Free: click a card to purge it permanently (FAULT cards listed first).')}
        onPick={(idx) => {
          onRemoveCard(idx);
          setPurging(false);
        }}
        onClose={() => setPurging(false)}
      />
    </ScreenFrame>
  );
}

function Option({
  icon,
  color,
  title,
  body,
  cta,
  disabled,
  done,
  onClick,
}: {
  icon: ReactNode;
  color: string;
  title: string;
  body: string;
  cta: string;
  disabled: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: done ? 0.55 : 1, y: 0 }}
      className={cn('flex min-h-[240px] flex-col gap-3 rounded-[14px] border bg-gradient-to-b from-[#18181b] to-[#111113] p-5')}
      style={{ borderColor: `${color}55`, boxShadow: `inset 0 0 40px -20px ${color}` }}
    >
      <span className="grid h-14 w-14 place-items-center rounded-xl border bg-black/60" style={{ borderColor: `${color}77`, color }}>
        {icon}
      </span>
      <h2 className="font-display text-[18px] leading-tight font-black">{title}</h2>
      <p className="text-[12.5px] leading-relaxed text-ink-2">{body}</p>
      <button onClick={onClick} disabled={disabled} className="keycap mt-auto flex h-11 items-center justify-center gap-2 text-[13px] font-black" style={{ color: disabled ? undefined : color }}>
        {done ? <Check size={14} /> : null}
        {cta}
      </button>
    </motion.div>
  );
}
