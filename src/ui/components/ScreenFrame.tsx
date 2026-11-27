import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from './primitives';

/** Shared full-height instrument panel used by every out-of-battle run screen. */
export function ScreenFrame({
  code,
  title,
  subtitle,
  icon,
  accent = '#ff4f00',
  right,
  footer,
  children,
  className,
  bodyClassName,
}: {
  code: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  accent?: string;
  right?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={cn('panel flex min-h-0 flex-1 flex-col', className)}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#1c1c20] px-4 py-2.5">
        {icon && (
          <span className="grid h-8 w-8 place-items-center rounded-md border bg-black/50" style={{ borderColor: `${accent}66`, color: accent, boxShadow: `inset 0 0 14px ${accent}22` }}>
            {icon}
          </span>
        )}
        <div className="min-w-0 leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] font-bold" style={{ color: accent }}>
              {code}
            </span>
            <h1 className="font-display text-[16px] font-black tracking-[0.08em] text-ink uppercase">{title}</h1>
          </div>
          {subtitle && <p className="truncate text-[11.5px] text-mute">{subtitle}</p>}
        </div>
        <div className="flex-1" />
        {right}
      </div>
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
      {footer && <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-[#1c1c20] px-4 py-2.5">{footer}</div>}
    </motion.section>
  );
}
