import { motion } from 'framer-motion';
import { JuiceGrade } from '../../engine/types';
import { cn } from './primitives';

export const GRADE_STYLE: Record<JuiceGrade, { color: string; glow: string; label: string }> = {
  S: { color: '#2cf07f', glow: '0 0 18px rgba(44,240,127,0.65), 0 0 2px rgba(44,240,127,1)', label: 'MAX JUICE' },
  A: { color: '#ff7a3d', glow: '0 0 14px rgba(255,79,0,0.55)', label: 'HIGH YIELD' },
  B: { color: '#38bdf8', glow: '0 0 8px rgba(56,189,248,0.4)', label: 'NOMINAL' },
  C: { color: '#b9b8b2', glow: 'none', label: 'BARELY' },
};

/** Industrial steel-stamp style S/A/B/C grade badge. */
export function GradeStamp({
  grade,
  caption,
  size = 'sm',
  animateKey,
  className,
}: {
  grade: JuiceGrade | null;
  caption: string;
  size?: 'sm' | 'lg';
  animateKey?: string | number;
  className?: string;
}) {
  if (!grade) {
    return (
      <div
        className={cn(
          'flex shrink-0 flex-col items-center justify-center rounded-[6px] border border-dashed border-[#2b2b30] text-dim',
          size === 'lg' ? 'h-[78px] w-[78px]' : 'h-[42px] w-[46px]',
          className,
        )}
        title={caption}
      >
        <span className="font-display text-[16px] leading-none font-black">—</span>
        <span className="mt-0.5 font-mono text-[7px] tracking-wider">{caption}</span>
      </div>
    );
  }
  const st = GRADE_STYLE[grade];
  const big = size === 'lg';
  return (
    <motion.div
      key={`${grade}-${animateKey ?? ''}`}
      initial={{ scale: 1.8, rotate: -18, opacity: 0 }}
      animate={{ scale: 1, rotate: -6, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 16 }}
      className={cn(
        'relative flex shrink-0 flex-col items-center justify-center rounded-[6px] border-[2.5px] bg-black/60',
        big ? 'h-[78px] w-[78px]' : 'h-[42px] w-[46px]',
        className,
      )}
      style={{ borderColor: st.color, color: st.color, boxShadow: grade === 'S' || grade === 'A' ? st.glow : undefined }}
      title={`${caption}: ${grade} · ${st.label}`}
    >
      <span
        className={cn('font-display leading-none font-black', big ? 'text-[40px]' : 'text-[22px]', grade === 'S' && 'blink-soft')}
        style={{ textShadow: grade === 'S' || grade === 'A' ? st.glow : undefined }}
      >
        {grade}
      </span>
      <span className={cn('font-mono font-bold tracking-wider', big ? 'mt-1 text-[8px]' : 'text-[6.5px]')}>
        {big ? st.label : caption}
      </span>
    </motion.div>
  );
}
