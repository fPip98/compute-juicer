import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, GraduationCap, Play, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from './i18n';
import { cn } from './primitives';

export const ONBOARDED_KEY = 'compute_juicer_onboarded_v1';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return true; // storage blocked → never nag
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // ignore
  }
}

interface Step {
  target: string;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
}

const STEPS: Step[] = [
  {
    target: '[data-tour="timeline"]',
    titleZh: '① 端到端延迟时间轴',
    titleEn: '① E2E latency timeline',
    bodyZh: '帧闭环总耗时 = 各段之和，必须压到红色 SLA 线左侧。带 ★ 的就是头号瓶颈段——先打它！点段尾色块可直达 GDB 原理。',
    bodyEn: 'Frame latency is the sum of these stages and must end left of the red SLA line. The ★ stage is your #1 bottleneck — attack it first. Click a stage chip for the GDB explanation.',
  },
  {
    target: '[data-tour="roofline"]',
    titleZh: '② Roofline 瓶颈分析',
    titleEn: '② Roofline analyzer',
    bodyZh: '工作点在拐点左侧 = MEMORY-BOUND（缺带宽）：先用量化 / 算子融合削减 Bytes。此时盲目超频只会白白发热、撞上 85°C 锁频；越过拐点进入 COMPUTE-BOUND 后，超频才真正有效。',
    bodyEn: 'Left of the ridge = MEMORY-BOUND: cut Bytes first (quantization / fusion). Overclocking here only adds heat and trips the 85°C lock. Once past the ridge (COMPUTE-BOUND), DVFS finally pays off.',
  },
  {
    target: '[data-tour="pipeline"]',
    titleZh: '③ Pass 流水线 & 6 轴机架',
    titleEn: '③ Pass pipeline & 6-axis rack',
    bodyZh: '点击手牌入槽，悬停即可实时预演；顺序即因果（◀ ▶ 调整）。PATCH 装进 6 轴互斥机架，同轴是替换而非叠加（看卡面 + / ⇄ 角标）。凑齐 3 个技术域触发 OVERDRIVE，按 Enter 执行 BENCHMARK！',
    bodyEn: 'Click hand cards to stage them; hover to preview live. Order is causality (◀ ▶ to reorder). PATCHes mount into the 6-axis exclusive rack — same axis replaces, never stacks (see + / ⇄ badges). Chain 3 domains for OVERDRIVE, then press Enter to BENCHMARK!',
  },
];

const BUBBLE_W = 360;
const GAP = 12;

export function OnboardingCoach({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tx, en } = useI18n();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleH, setBubbleH] = useState(180);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const measure = useCallback(() => {
    const el = document.querySelector(STEPS[step].target);
    setRect(el ? el.getBoundingClientRect() : null);
    if (bubbleRef.current) setBubbleH(bubbleRef.current.offsetHeight);
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const id = window.setTimeout(measure, 320); // after layout animations settle
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  const finish = useCallback(() => {
    markOnboarded();
    onClose();
  }, [onClose]);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) finish();
    else setStep((s) => s + 1);
  }, [step, finish]);
  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  // Capture-phase keys so Enter never commits the battle underneath while coaching.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        finish();
      } else if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        e.stopImmediatePropagation();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopImmediatePropagation();
        back();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, next, back, finish]);

  if (!open) return null;
  const cur = STEPS[step];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 6;
  const spot = rect
    ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : { left: vw / 2 - 2, top: vh / 2 - 2, width: 4, height: 4 };

  // Bubble placement: below → above → right side → left side → centred.
  let bx = spot.left + spot.width / 2 - BUBBLE_W / 2;
  let by: number;
  if (spot.top + spot.height + GAP + bubbleH <= vh - 8) by = spot.top + spot.height + GAP;
  else if (spot.top - GAP - bubbleH >= 8) by = spot.top - GAP - bubbleH;
  else if (spot.left + spot.width + GAP + BUBBLE_W <= vw - 8) {
    bx = spot.left + spot.width + GAP;
    by = spot.top + spot.height / 2 - bubbleH / 2;
  } else if (spot.left - GAP - BUBBLE_W >= 8) {
    bx = spot.left - GAP - BUBBLE_W;
    by = spot.top + spot.height / 2 - bubbleH / 2;
  } else by = vh / 2 - bubbleH / 2;
  bx = Math.max(8, Math.min(vw - BUBBLE_W - 8, bx));
  by = Math.max(8, Math.min(vh - bubbleH - 8, by));

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={tx('新手引导', 'Tutorial')} data-coach-step={step + 1}>
      {/* click-catcher (does nothing: keep focus on the coach) */}
      <div className="absolute inset-0" />
      <div className="coach-spot pointer-events-none absolute rounded-[16px]" style={spot} />
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          ref={bubbleRef}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          className="panel absolute flex flex-col gap-2 p-3.5"
          style={{ left: bx, top: by, width: BUBBLE_W, borderColor: '#ff4f00', boxShadow: '0 0 0 1px #ff4f00, 0 24px 60px -16px rgba(0,0,0,0.95)' }}
        >
          <div className="flex items-center gap-2">
            <GraduationCap size={15} className="text-te" />
            <span className="font-mono text-[9.5px] font-black tracking-[0.16em] text-te">
              TUTORIAL · {step + 1}/{STEPS.length} · {tx('约 30 秒', '~30s')}
            </span>
            <div className="flex-1" />
            <button onClick={finish} className="flex items-center gap-1 font-mono text-[10px] font-bold text-mute hover:text-ink" data-coach-skip>
              <X size={12} /> {tx('跳过', 'SKIP')}
            </button>
          </div>
          <h3 className="font-display text-[15px] leading-tight font-black text-ink">{en ? cur.titleEn : cur.titleZh}</h3>
          <p className="text-[12.5px] leading-relaxed text-ink-2">{en ? cur.bodyEn : cur.bodyZh}</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-te' : i < step ? 'w-1.5 bg-te/60' : 'w-1.5 bg-[#3a3a40]')} />
              ))}
            </div>
            <div className="flex-1" />
            {step > 0 && (
              <button onClick={back} className="keycap flex h-8 items-center gap-1 px-2.5 font-mono text-[10.5px] font-bold">
                <ArrowLeft size={12} /> {tx('上一步', 'BACK')}
              </button>
            )}
            <button onClick={next} autoFocus className="keycap keycap-te flex h-8 items-center gap-1.5 px-3 text-[11.5px] font-black" data-coach-next>
              {step >= STEPS.length - 1 ? (
                <>
                  <Play size={12} fill="currentColor" /> {tx('开始压测', 'START')}
                </>
              ) : (
                <>
                  {tx('下一步', 'NEXT')} <ArrowRight size={12} />
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-[9px] text-dim">{tx('Enter / → 下一步 · ← 上一步 · Esc 跳过', 'Enter / → next · ← back · Esc skip')}</div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
