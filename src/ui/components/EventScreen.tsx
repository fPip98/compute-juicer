import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Terminal } from 'lucide-react';
import { EVENT_REGISTRY } from '../../data/events';
import { RunState } from '../../engine/types';
import { useI18n } from './i18n';
import { domainColor, DomainChip } from './primitives';
import { ScreenFrame } from './ScreenFrame';

export function EventScreen({
  run,
  onChoose,
  onLeave,
}: {
  run: RunState;
  onChoose: (choiceId: string) => void;
  onLeave: () => void;
}) {
  const { t, tx, en } = useI18n();
  const active = run.activeEvent;
  const ev = active ? EVENT_REGISTRY[active.eventId] : undefined;
  if (!active || !ev) return null;
  const resolved = !!active.resolvedText;
  const c = domainColor(ev.domain);

  return (
    <ScreenFrame
      code={ev.code}
      title={t('eventTitle')}
      subtitle={en ? ev.titleEn : ev.title}
      icon={<Terminal size={17} />}
      accent="#c4a5ff"
      right={<DomainChip domain={ev.domain} />}
      footer={
        <>
          <span className="text-[11.5px] text-mute">
            {resolved ? tx('事件已结案，后果已写入你的 Run。', 'Incident closed; consequences applied to your run.') : tx('选择一个处理方案。', 'Choose how to handle it.')}
          </span>
          <div className="flex-1" />
          <button onClick={onLeave} disabled={!resolved} className="keycap keycap-te flex h-10 items-center gap-2 px-5 text-[13px] font-black tracking-wider">
            <ArrowLeft size={14} /> {t('continueMap')}
          </button>
        </>
      }
      bodyClassName="flex items-center justify-center overflow-y-auto p-4 desk:overflow-visible"
    >
      <div className="oled w-full max-w-[860px]" style={{ boxShadow: `inset 0 0 0 1px ${c}33, inset 0 0 60px -30px ${c}` }}>
        <div className="relative z-10 flex items-center gap-2 border-b border-[#15161a] px-4 py-2 font-mono text-[10px]">
          <span className="h-2 w-2 rounded-full bg-estop/80" />
          <span className="h-2 w-2 rounded-full bg-amber/80" />
          <span className="h-2 w-2 rounded-full bg-signal/80" />
          <span className="ml-2 text-dim">incident@lab:~$ cat /var/log/{ev.id}.log</span>
        </div>
        <div className="relative z-10 space-y-4 p-5">
          <h2 className="font-display text-[22px] leading-tight font-black" style={{ color: c }}>
            {en ? ev.titleEn : ev.title}
          </h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="font-sans text-[14px] leading-[1.85] text-ink"
          >
            <span className="mr-2 font-mono text-signal">&gt;</span>
            {en ? ev.storyEn : ev.story}
          </motion.p>

          <AnimatePresence mode="wait">
            {!resolved ? (
              <motion.div key="choices" exit={{ opacity: 0, y: -6 }} className="flex flex-col gap-2">
                {ev.choices.map((ch, i) => (
                  <motion.button
                    key={ch.id}
                    data-choice-id={ch.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                    onClick={() => onChoose(ch.id)}
                    className="group flex items-start gap-3 rounded-[10px] border border-[#2b2b30] bg-black/50 px-4 py-3 text-left transition hover:border-te/60 hover:bg-[#19120d]"
                  >
                    <span className="mt-0.5 font-mono text-[12px] font-black text-te">[{i + 1}]</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-ink">{en ? ch.labelEn : ch.label}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-mute">{en ? ch.hintEn : ch.hint}</span>
                    </span>
                    <ChevronRight size={16} className="mt-1 shrink-0 text-dim transition group-hover:translate-x-0.5 group-hover:text-te" />
                  </motion.button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[10px] border border-signal/40 bg-signal/[0.07] px-4 py-3"
              >
                <div className="mb-1 font-mono text-[10px] font-black tracking-wider text-signal">RESULT · EXIT 0</div>
                <p className="text-[14px] leading-relaxed text-ink">{en ? active.resolvedTextEn ?? active.resolvedText : active.resolvedText}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ScreenFrame>
  );
}
