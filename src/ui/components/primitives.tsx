import {
  Activity,
  ArrowLeftRight,
  Box,
  Brain,
  CalendarClock,
  CloudRain,
  Columns2,
  Combine,
  Download,
  Eye,
  Gauge,
  GitBranch,
  GitCommitHorizontal,
  Link,
  LockOpen,
  LogOut,
  Package,
  Power,
  Send,
  Shield,
  Sparkles,
  Wifi,
  ZapOff,

  AlignJustify,
  BatteryCharging,
  BookOpen,
  Bug,
  Camera,
  Clock,
  Cpu,
  Database,
  FastForward,
  Flame,
  GitMerge,
  Grid3x3,
  Hand,
  HardDrive,
  Layers,
  LucideIcon,
  Minimize2,
  Network,
  OctagonAlert,
  Radio,
  Repeat,
  Scissors,
  Share2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Terminal,
  Thermometer,
  Trash2,
  TriangleAlert,
  WifiOff,
  Wind,
  Zap,
} from 'lucide-react';
import { ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DOMAINS } from '../../data/domains';
import { Domain } from '../../engine/types';

export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

/** Data files reference Lucide icons by name; map them (including legacy aliases). */
const ICONS: Record<string, LucideIcon> = {
  Activity,
  ArrowLeftRight,
  Box,
  Brain,
  CalendarClock,
  CloudRain,
  Columns: Columns2,
  Columns2,
  Combine,
  Download,
  Eye,
  Gauge,
  GitBranch,
  GitCommit: GitCommitHorizontal,
  GitCommitHorizontal,
  Link,
  LogOut,
  Package,
  Power,
  Send,
  Shield,
  Sparkles,
  Unlock: LockOpen,
  LockOpen,
  Wifi,
  ZapOff,
  AlertOctagon: OctagonAlert,
  OctagonAlert,
  AlertTriangle: TriangleAlert,
  TriangleAlert,
  AlignJustify,
  BatteryCharging,
  BookOpen,
  Bug,
  Camera,
  Clock,
  Cpu,
  Database,
  FastForward,
  Flame,
  GitMerge,
  Grid: Grid3x3,
  Grid3x3,
  Hand,
  HardDrive,
  Layers,
  Minimize2,
  Network,
  Radio,
  Repeat,
  Scissors,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sliders: SlidersHorizontal,
  SlidersHorizontal,
  Snowflake,
  Terminal,
  Thermometer,
  Trash2,
  WifiOff,
  Wind,
  Zap,
};

export function DynIcon({
  name,
  size = 14,
  className,
  strokeWidth = 2,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ICONS[name] ?? Cpu;
  return <Icon size={size} className={className} strokeWidth={strokeWidth} />;
}

export const domainColor = (d: Domain) => DOMAINS[d]?.accentHex ?? '#888';

export const COLORS = {
  te: '#ff4f00',
  scope: '#38bdf8',
  signal: '#2cf07f',
  amber: '#ffb020',
  estop: '#ff2a2a',
  mute: '#7d7d84',
  line: '#2b2b30',
};

export function fmt(v: number, digits = 1) {
  if (!Number.isFinite(v)) return '--';
  return v.toFixed(digits);
}

export function fmtDelta(v: number, digits = 1) {
  if (!Number.isFinite(v) || Math.abs(v) < Math.pow(10, -digits) / 2) return '±0';
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;
}

export function Led({
  on,
  color = COLORS.signal,
  className,
  blink,
}: {
  on: boolean;
  color?: string;
  className?: string;
  blink?: boolean;
}) {
  return (
    <span
      className={cn('led', on && 'led-on', on && blink && 'blink', className)}
      style={{ color }}
    />
  );
}

export function PanelHeader({
  index,
  title,
  sub,
  right,
}: {
  index: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex h-[30px] shrink-0 items-center justify-between gap-2 px-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="font-mono text-[10px] font-bold text-te">{index}</span>
        <span className="font-display text-[11px] font-bold tracking-[0.14em] whitespace-nowrap text-ink uppercase">
          {title}
        </span>
        {sub && <span className="truncate font-sans text-[10.5px] text-mute">{sub}</span>}
      </div>
      {right}
    </div>
  );
}

export function DomainChip({ domain, className }: { domain: Domain; className?: string }) {
  const c = domainColor(domain);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-[1px] font-mono text-[9px] font-bold tracking-wider',
        className,
      )}
      style={{ color: c, borderColor: `${c}55`, background: `${c}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {DOMAINS[domain]?.shortName ?? domain}
    </span>
  );
}

export function TypeBadge({ type }: { type: 'PATCH' | 'RUNTIME' | 'FAULT' }) {
  const style =
    type === 'PATCH'
      ? 'bg-ink text-chassis border-ink'
      : type === 'RUNTIME'
        ? 'bg-transparent text-ink-2 border-line-2'
        : 'bg-estop/15 text-estop border-estop/50';
  return (
    <span
      className={cn(
        'rounded-[3px] border px-1 py-[1px] font-mono text-[9px] font-bold tracking-wider',
        style,
      )}
    >
      {type}
    </span>
  );
}

/** Very small tooltip shown on hover (CSS group-based). */
export function HoverTip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute z-50 hidden w-64 rounded-lg border border-line-2 bg-[#0d0d0f]/95 p-3 text-left shadow-2xl backdrop-blur group-hover:block',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Tracks an element's content box size (for SVGs that should fill their container exactly). */
export function useElementSize<T extends HTMLElement>(fallback: { w: number; h: number }): [RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 10 && r.height > 10) {
        setSize((prev) =>
          Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1 ? prev : { w: Math.round(r.width), h: Math.round(r.height) },
        );
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}
