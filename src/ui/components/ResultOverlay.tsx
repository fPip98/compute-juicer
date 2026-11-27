import { motion } from 'framer-motion';
import { ArrowRight, Eye, Gift, RotateCcw, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { CARD_REGISTRY } from '../../data/cards';
import { FAULT_REGISTRY } from '../../data/faults';
import { diagnoseBattleFailure } from '../../engine/diagnose';
import { BattleState, ComputedTelemetry, EncounterDef, JuiceGrade, RobotMood } from '../../engine/types';
import { useI18n } from './i18n';
import { DiagnosisPanel } from './DiagnosisPanel';
import { GradeStamp } from './JuiceGrade';
import { cn, COLORS, fmt } from './primitives';

interface ResultOverlayProps {
  battle: BattleState;
  encounter: EncounterDef;
  telemetry: ComputedTelemetry;
  /** Best SLA juice grade achieved across passed waves (victory only). */
  grade: JuiceGrade | null;
  /** Beating this encounter ends the whole run (Act 3 boss). */
  isFinalBoss: boolean;
  /** Victory → reward draft (or run victory); defeat → run post-mortem. */
  onProceed: () => void;
  onNewRun: () => void;
  onInspect: () => void;
  /** Opens a GDB entry (the overlay is dismissed first so the drawer is visible). */
  onOpenKnowledge: (id: string) => void;
}

type Bilingual = { zh: string; en: string };
interface Cause {
  title: Bilingual;
  quip: Bilingual;
  fix: Bilingual;
}

const DEFEAT_ROOT_CAUSE: Partial<Record<RobotMood, Cause>> = {
  OOM_PANIC: {
    title: { zh: 'OOM Killer 选择了你的推理进程', en: 'The OOM Killer chose your inference process' },
    quip: {
      zh: '内核在 1024MB 的围城里做出了艰难决定：牺牲 vla_infer，保全 sshd。至少你还能远程登录看日志。',
      en: 'Trapped inside 1024MB, the kernel made a hard call: sacrifice vla_infer, keep sshd. At least you can still SSH in and read the logs.',
    },
    fix: {
      zh: 'INT4 量化压权重、PagedAttention 回收 KV、Arena 内存池封住碎片；cgroups 给推理进程划好边界。',
      en: 'INT4 to shrink weights, PagedAttention to reclaim KV Cache, an Arena pool to stop fragmentation; fence inference with cgroups.',
    },
  },
  THERMAL_THROTTLE: {
    title: { zh: '芯片触发硬件过热保护', en: 'Hardware thermal shutdown tripped' },
    quip: {
      zh: '结温突破 100°C，PMIC 果断拉闸。机箱里现在可以煎鸡蛋了——讽刺的是这正是本关的业务对象。',
      en: 'Junction passed 100°C and the PMIC pulled the plug. You can fry eggs in the chassis now — ironically, the very thing this line handles.',
    },
    fix: {
      zh: '别在 Memory-Bound 下超频；PWM 风扇 / 液冷先行，把发热预算留给 Compute-Bound 阶段。',
      en: 'Never DVFS-overclock while Memory-Bound; cool first (PWM fan / liquid), spend the heat budget once Compute-Bound.',
    },
  },
  EGG_CRUSHED: {
    title: { zh: '力控精度崩塌：鸡蛋被捏爆', en: 'Accuracy collapse: egg crushed' },
    quip: {
      zh: '激进量化让模型把「生鸡蛋」识别成「核桃」，夹爪施加了 40N 的坚定信念。',
      en: 'Aggressive quantization made the model see a raw egg as a walnut. The gripper applied 40N of conviction.',
    },
    fix: {
      zh: '把 QAT 校准排在 INT4 之前；精度兜底卡要在量化 Pass 之后执行。',
      en: 'Stage QAT calibration before INT4; run accuracy-recovery passes after the quantization pass.',
    },
  },
  EGG_DROPPED: {
    title: { zh: '控制闭环超时：鸡蛋自由落体', en: 'Control loop timeout: egg in free fall' },
    quip: {
      zh: '推理结果抵达时，鸡蛋已经在地上完成了 9.8 m/s² 的物理实验。',
      en: 'By the time inference returned, the egg had already completed its 9.8 m/s² physics experiment.',
    },
    fix: {
      zh: '先削 Bytes 把系统推进 Compute-Bound，再超频；零拷贝 / TCP_NODELAY / PREEMPT_RT 清理 I/O 与 OS 长尾。',
      en: 'Cut Bytes to reach Compute-Bound before DVFS; zero-copy / TCP_NODELAY / PREEMPT_RT to trim I/O and OS tail latency.',
    },
  },
};

const FALLBACK_CAUSE: Cause = {
  title: { zh: '产线验收未通过', en: 'Line acceptance failed' },
  quip: {
    zh: '压测波次耗尽，客户的耐心也耗尽了。PM 正在会议室里打开 Roofline 图准备复盘。',
    en: 'Out of waves, and the customer is out of patience. The PM is opening a Roofline chart in the war room.',
  },
  fix: {
    zh: '前期优先部署常驻 PATCH，后期用 RUNTIME 卡应对预告故障。',
    en: 'Deploy persistent PATCHes early; answer telegraphed faults with RUNTIME cards later.',
  },
};

function guessCause(reason: string | undefined, mood: RobotMood): RobotMood {
  if (!reason) return mood;
  if (reason.includes('OOM')) return 'OOM_PANIC';
  if (reason.includes('过热') || reason.includes('热')) return 'THERMAL_THROTTLE';
  if (reason.includes('精度')) return 'EGG_CRUSHED';
  if (reason.includes('延迟')) return 'EGG_DROPPED';
  return mood;
}

export function ResultOverlay({ battle, encounter, telemetry, grade, isFinalBoss, onProceed, onNewRun, onInspect, onOpenKnowledge }: ResultOverlayProps) {
  const { t, tx, locale, encounter: encText } = useI18n();
  const L = (b: Bilingual) => b[locale];
  const win = battle.status === 'VICTORY';
  const cause = DEFEAT_ROOT_CAUSE[guessCause(battle.defeatReason, battle.robotMood)] ?? FALLBACK_CAUSE;
  const accent = win ? COLORS.signal : COLORS.estop;
  const reportId = `${encounter.id.toUpperCase()}-W${battle.wave}-${battle.slaPasses}${battle.requiredSlaPasses}`;
  const encName = encText(encounter).name;
  const diagnosis = useMemo(() => (win ? null : diagnoseBattleFailure(battle, CARD_REGISTRY, FAULT_REGISTRY)), [battle, win]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-[3px]"
    >
      <motion.div
        initial={{ y: 30, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.1 }}
        className={cn('relative flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-[16px]', win ? 'max-w-[660px]' : 'max-w-[780px]')}
        style={{ border: '1px solid #2b2b30', background: '#e9e7e1', color: '#141414', boxShadow: '0 40px 120px -30px rgba(0,0,0,1)' }}
        role="dialog"
        aria-label={win ? t('victoryTitle') : t('defeatTitle')}
      >
        <div className={cn('h-2 w-full', win ? 'bg-signal' : 'hazard-estop hazard-anim')} />
        <div className={cn('flex shrink-0 items-start justify-between gap-4 border-b border-[#c9c7c0] px-6', win ? 'pt-5 pb-4' : 'pt-3.5 pb-3')}>
          <div className="min-w-0">
            <div className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#6d6b66]">
              {win ? `FACTORY ACCEPTANCE TEST · ${t('victoryTitle')}` : `INCIDENT POST-MORTEM · ${t('defeatTitle')}`}
            </div>
            <h2 className={cn('mt-1 font-display leading-tight font-black', win ? 'text-[26px]' : 'text-[21px]')}>
              {win ? tx('部署成功，鸡蛋完好。', 'Deployed. Egg intact.') : L(cause.title)}
            </h2>
            <div className="mt-1 text-[13px] text-[#4a4945]">{encName}</div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {win && (
              <div className="flex flex-col items-center gap-1">
                <div className="rounded-[10px] bg-[#141414] p-1.5">
                  <GradeStamp grade={grade} caption={t('juiceGrade')} size="lg" />
                </div>
                <span className="font-mono text-[8.5px] font-bold tracking-widest text-[#6d6b66]">{t('juiceGrade')}</span>
              </div>
            )}
            <motion.div
              initial={{ scale: 2.2, rotate: -24, opacity: 0 }}
              animate={{ scale: 1, rotate: -12, opacity: 1 }}
              transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 14 }}
              className="rounded-[8px] border-[3px] px-3 py-1.5 text-center font-display text-[20px] leading-none font-black"
              style={{ color: win ? '#0f9f4f' : '#d31616', borderColor: win ? '#0f9f4f' : '#d31616' }}
            >
              {win ? 'PASSED' : 'REJECTED'}
              <div className="mt-0.5 font-mono text-[8px] tracking-widest">QA · CJ-01</div>
            </motion.div>
          </div>
        </div>

        <div className={cn('scroll-thin min-h-0 overflow-y-auto px-6', win ? 'py-4' : 'py-3')}>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-[#c9c7c0] bg-[#c9c7c0] sm:grid-cols-4">
            <Metric label="E2E LATENCY" value={`${fmt(telemetry.totalLatencyMs, 2)}ms`} sub={`SLA ≤ ${fmt(battle.effectiveSlaTarget.maxLatencyMs)}`} ok={telemetry.totalLatencyMs <= battle.effectiveSlaTarget.maxLatencyMs} />
            <Metric label="ACCURACY" value={`${fmt(telemetry.accuracyClamped)}%`} sub={`SLA ≥ ${fmt(battle.effectiveSlaTarget.minAccuracy)}`} ok={telemetry.accuracyClamped >= battle.effectiveSlaTarget.minAccuracy} />
            <Metric label="RAM PEAK" value={`${fmt(telemetry.ramPercent)}%`} sub={`${telemetry.ramUsedMB}MB`} ok={!telemetry.isOom} />
            <Metric label="JUNCTION" value={`${fmt(battle.baseMetrics.tempC)}°C`} sub={telemetry.isThermalThrottled ? 'THROTTLED' : 'NOMINAL'} ok={!telemetry.isThermalShutdown} />
          </div>

          <div className={cn('grid grid-cols-3 gap-2 font-mono text-[11px]', win ? 'mt-3' : 'mt-2')}>
            <Kv k="SLA PASSES" v={`${battle.slaPasses}/${battle.requiredSlaPasses}`} />
            <Kv k="WAVES USED" v={`${battle.wave}/${battle.totalWaves}`} />
            <Kv k="STABILITY" v={`${battle.stability}/${battle.maxStability}`} />
          </div>

          {win ? (
            <div className="mt-4 space-y-2 text-[13px] leading-relaxed text-[#2e2d2a]">
              <p>
                {tx(
                  `结论：在「${encName}」中 ${battle.slaPasses} 次压测达标。客户在验收单上签了字，PM 第一次没有说「能不能再快一点」。`,
                  `Verdict: ${battle.slaPasses} SLA-passing waves on "${encName}". The customer signed off, and for once the PM didn't ask "can it be a bit faster?"`,
                )}
              </p>
              <p className="text-[12px] text-[#5a5955]">
                {tx(
                  `已部署补丁 ${battle.deployedPatchIds.length} 项 · 奖励经费 ${encounter.rewardCredits} CR · 鸡蛋损耗率 0.00%`,
                  `${battle.deployedPatchIds.length} PATCHes deployed · ${encounter.rewardCredits} CR awarded · egg loss rate 0.00%`,
                )}
                {grade === 'S' && <b className="ml-1 text-[#0f9f4f]">{tx('· 极限榨汁达成！', '· Maximum juice extracted!')}</b>}
              </p>
            </div>
          ) : (
            <div className="mt-2.5 space-y-2.5 text-[13px] leading-relaxed text-[#2e2d2a]">
              <p className="rounded-[6px] bg-[#d3d1ca] px-3 py-1.5 font-mono text-[11.5px]" title={L(cause.quip)}>
                <span className="font-black text-[#d31616]">DEFEAT ▸ </span>
                {battle.defeatReason ?? tx('未知错误', 'Unknown failure')}
              </p>
              {diagnosis && <DiagnosisPanel diagnosis={diagnosis} tone="paper" onOpenKnowledge={onOpenKnowledge} />}
            </div>
          )}
        </div>

        <div className={cn('flex shrink-0 flex-wrap items-center gap-2 border-t border-[#c9c7c0] bg-[#dedcd5] px-6', win ? 'py-4' : 'py-2.5')}>
          <span className="font-mono text-[9px] text-[#6d6b66]">REPORT #{reportId}</span>
          <div className="flex-1" />
          <button onClick={onInspect} className="keycap flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold">
            <Eye size={13} /> {t('inspectBench')}
          </button>
          {!win && (
            <button onClick={onNewRun} className="keycap flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold">
              <RotateCcw size={13} /> {t('newRun')}
            </button>
          )}
          <button
            onClick={onProceed}
            autoFocus
            className={cn('keycap flex items-center gap-1.5 px-4 py-2 text-[12px] font-black', win ? 'keycap-te' : 'keycap-estop')}
          >
            {win ? (isFinalBoss ? <Trophy size={13} /> : <Gift size={13} />) : null}
            {win
              ? isFinalBoss
                ? tx('签收量产验收报告', 'SIGN OFF MASS PRODUCTION')
                : t('proceedReward')
              : tx('进入本轮复盘', 'OPEN RUN POST-MORTEM')}
            <ArrowRight size={13} />
          </button>
        </div>
        <div className="h-1 shrink-0" style={{ background: accent }} />
      </motion.div>
    </motion.div>
  );
}

function Metric({ label, value, sub, ok }: { label: string; value: string; sub: string; ok: boolean }) {
  return (
    <div className="bg-[#f1efe9] px-3 py-2">
      <div className="flex items-center justify-between font-mono text-[9px] font-bold text-[#6d6b66]">
        {label}
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: ok ? '#0f9f4f' : '#d31616' }} />
      </div>
      <div className="tnum font-display text-[18px] font-black">{value}</div>
      <div className="tnum font-mono text-[9px] text-[#6d6b66]">{sub}</div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-[6px] border border-[#c9c7c0] px-2 py-1">
      <span className="text-[#6d6b66]">{k}</span>
      <span className="tnum font-bold">{v}</span>
    </div>
  );
}
