import { motion } from 'framer-motion';
import { Check, Crown, MapPin, Route, Skull, Sparkles, Store, Swords, Wrench } from 'lucide-react';
import { ReactNode } from 'react';
import { ENCOUNTER_REGISTRY } from '../../data/encounters';
import { EVENT_REGISTRY } from '../../data/events';
import { MapNode, MapNodeType, RunState } from '../../engine/types';
import { useI18n } from './i18n';
import { cn, COLORS, fmt, useElementSize } from './primitives';
import { ScreenFrame } from './ScreenFrame';

const NODE_W = 168;
const NODE_H = 86;

export const NODE_STYLE: Record<MapNodeType, { color: string; icon: ReactNode; zh: string; en: string }> = {
  BATTLE: { color: '#38bdf8', icon: <Swords size={15} />, zh: '压测战斗', en: 'BENCHMARK' },
  ELITE: { color: '#ffb020', icon: <Skull size={15} />, zh: '精英 P0', en: 'ELITE P0' },
  SHOP: { color: '#2cf07f', icon: <Store size={15} />, zh: '采购商店', en: 'SHOP' },
  EVENT: { color: '#c4a5ff', icon: <Sparkles size={15} />, zh: '研发事件', en: 'INCIDENT' },
  REST: { color: '#10b981', icon: <Wrench size={15} />, zh: '重构营地', en: 'REFACTOR' },
  BOSS: { color: '#ff2a2a', icon: <Crown size={15} />, zh: '章节 BOSS', en: 'ACT BOSS' },
};

export function RunMap({
  run,
  onEnter,
  onSwitchAct,
}: {
  run: RunState;
  onEnter: (nodeId: string) => void;
  onSwitchAct: (act: 1 | 2 | 3) => void;
}) {
  const { t, tx, en, encounter: encText } = useI18n();
  const [boardRef, size] = useElementSize<HTMLDivElement>({ w: 1100, h: 460 });

  const cols = Math.max(...run.nodes.map((n) => n.col)) + 1;
  const rowsPerCol = (c: number) => run.nodes.filter((n) => n.col === c).length;
  const padX = NODE_W / 2 + 18;
  const padY = NODE_H / 2 + 26;
  const pos = (n: MapNode) => {
    const x = padX + (cols <= 1 ? 0 : (n.col / (cols - 1)) * (size.w - 2 * padX));
    const rows = rowsPerCol(n.col);
    const laneH = size.h - 2 * padY;
    const y = rows <= 1 ? size.h / 2 : padY + (n.row / (rows - 1)) * laneH * 0.78 + laneH * 0.11;
    return { x, y };
  };

  const byId = new Map(run.nodes.map((n) => [n.id, n]));
  const reachable = new Set(run.reachableNodeIds);

  // PCB trace: horizontal → 45° → horizontal
  const trace = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const x1 = a.x + NODE_W / 2;
    const x2 = b.x - NODE_W / 2;
    const dy = b.y - a.y;
    const d = Math.min(Math.abs(dy), Math.max(0, (x2 - x1) / 2 - 8));
    const xm = (x1 + x2) / 2;
    if (Math.abs(dy) < 1) return `M ${x1} ${a.y} L ${x2} ${b.y}`;
    return `M ${x1} ${a.y} L ${xm - d / 2} ${a.y} L ${xm + d / 2} ${b.y} L ${x2} ${b.y}`;
  };

  const edges = run.nodes.flatMap((n) =>
    n.nextNodeIds
      .map((id) => byId.get(id))
      .filter((m): m is MapNode => !!m)
      .map((m) => {
        const walked = n.visited && m.visited;
        const live = n.id === run.currentNodeId && reachable.has(m.id);
        return { from: n, to: m, walked, live };
      }),
  );

  const visitedCount = run.nodes.filter((n) => n.visited).length;

  return (
    <ScreenFrame
      code={`ACT ${run.act}`}
      title={`${t('mapTitle')} · ${t('actLabel')} ${run.act}`}
      subtitle={t('mapSub')}
      icon={<Route size={17} />}
      right={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" title={tx('点击切换章节', 'Click to switch Act')}>
            {([1, 2, 3] as const).map((a) => (
              <button
                key={a}
                onClick={() => onSwitchAct(a)}
                className={cn(
                  'cursor-pointer rounded-[4px] border px-2 py-[2px] font-mono text-[10px] font-black transition',
                  a === run.act
                    ? 'border-te bg-te text-chassis'
                    : 'border-line text-ink-2 hover:border-te/60 hover:text-te',
                )}
              >
                ACT {a}
              </button>
            ))}
          </div>
          <span className="tnum font-mono text-[10px] text-mute">
            {tx('已完成', 'cleared')} {visitedCount}/{run.nodes.length} · {tx('胜场', 'wins')} {run.battlesWon}
          </span>
        </div>
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1">
          {(Object.keys(NODE_STYLE) as MapNodeType[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5 font-mono text-[10px] text-mute">
              <span style={{ color: NODE_STYLE[k].color }}>{NODE_STYLE[k].icon}</span>
              {en ? NODE_STYLE[k].en : NODE_STYLE[k].zh}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-te">
            <span className="h-2.5 w-2.5 rounded-[3px] border-2 border-te node-pulse" /> {tx('可部署节点', 'reachable')}
          </span>
        </div>
      }
      bodyClassName="p-3"
    >
      <div ref={boardRef} className="oled relative h-full min-h-[300px] w-full">
        {/* PCB backdrop */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(rgba(56,189,248,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.045) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`}>
          {/* column guides */}
          {Array.from({ length: cols }).map((_, c) => {
            const x = padX + (cols <= 1 ? 0 : (c / (cols - 1)) * (size.w - 2 * padX));
            return (
              <g key={c}>
                <line x1={x} x2={x} y1={14} y2={size.h - 14} stroke="#15171b" strokeDasharray="2 5" />
                <text x={x} y={16} fill="#3a3a40" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono">
                  COL {c}
                </text>
              </g>
            );
          })}
          {edges.map(({ from, to, walked, live }) => {
            const d = trace(pos(from), pos(to));
            return (
              <g key={`${from.id}-${to.id}`}>
                <path d={d} fill="none" stroke={walked ? '#ff4f00' : live ? COLORS.te : '#2a2c31'} strokeWidth={walked ? 3 : live ? 2.2 : 1.6} opacity={walked ? 0.9 : 1} />
                {live && <path d={d} fill="none" stroke="#ffd2b8" strokeWidth={2} strokeDasharray="4 10" className="trace-flow" />}
                <circle cx={pos(from).x + NODE_W / 2} cy={pos(from).y} r={3.2} fill="#0a0a0b" stroke={walked || live ? COLORS.te : '#3a3a40'} strokeWidth={1.5} />
                <circle cx={pos(to).x - NODE_W / 2} cy={pos(to).y} r={3.2} fill="#0a0a0b" stroke={walked || live ? COLORS.te : '#3a3a40'} strokeWidth={1.5} />
              </g>
            );
          })}
        </svg>

        {run.nodes.map((n, i) => {
          const p = pos(n);
          const st = NODE_STYLE[n.type];
          const isReachable = reachable.has(n.id);
          const isCurrent = n.id === run.currentNodeId;
          const enc = n.encounterId ? ENCOUNTER_REGISTRY[n.encounterId] : undefined;
          const evt = n.eventId ? EVENT_REGISTRY[n.eventId] : undefined;
          const locked = !isReachable;
          const tipAbove = p.y > size.h / 2;
          return (
            <motion.div
              key={n.id}
              className="group absolute"
              style={{ left: p.x - NODE_W / 2, top: p.y - NODE_H / 2, width: NODE_W, height: NODE_H, zIndex: isReachable ? 5 : 2 }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.04 * i }}
            >
              <button
                data-node-id={n.id}
                data-node-type={n.type}
                disabled={locked}
                onClick={() => onEnter(n.id)}
                className={cn(
                  'relative flex h-full w-full flex-col justify-between rounded-[10px] border bg-[#111114] p-2 text-left transition',
                  isReachable && 'node-pulse cursor-pointer hover:-translate-y-0.5 hover:bg-[#19140f]',
                  locked && !n.visited && 'opacity-55',
                  n.visited && 'opacity-45 saturate-50',
                )}
                style={{ borderColor: isReachable ? COLORS.te : n.visited ? '#3a2a20' : `${st.color}44` }}
                aria-label={`${en ? n.labelEn : n.label} · ${en ? st.en : st.zh}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-[9px] font-black tracking-wider" style={{ color: st.color }}>
                    {st.icon}
                    {en ? st.en : st.zh}
                  </span>
                  {n.visited && <Check size={13} className="text-te" />}
                  {isCurrent && !n.visited && <MapPin size={13} className="text-te" />}
                </div>
                <div className={cn('line-clamp-2 text-[12.5px] leading-tight font-bold', n.type === 'BOSS' ? 'text-estop' : 'text-ink')}>
                  {en ? n.labelEn : n.label}
                </div>
                {enc ? (
                  <div className="tnum flex items-center gap-2 font-mono text-[9px] text-mute">
                    <span>≤{fmt(enc.slaTarget.maxLatencyMs)}ms</span>
                    <span>≥{fmt(enc.slaTarget.minAccuracy, 0)}%</span>
                    <span>
                      {enc.requiredSlaPasses}/{enc.totalWaves}W
                    </span>
                  </div>
                ) : (
                  <div className="font-mono text-[9px] text-mute">{n.type === 'EVENT' ? evt?.code ?? 'EVT' : n.type === 'SHOP' ? 'CR → CARDS / HW' : 'PURGE / +CR'}</div>
                )}
              </button>

              {/* Hover preview */}
              <div
                className={cn(
                  'pointer-events-none absolute z-50 hidden w-[260px] rounded-lg border border-line-2 bg-[#0d0d0f]/95 p-3 shadow-2xl backdrop-blur group-hover:block',
                  n.col === 0
                    ? 'left-0'
                    : n.col === cols - 1
                      ? 'right-0'
                      : 'left-1/2 -translate-x-1/2',
                  tipAbove ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]',
                )}
              >
                <div className="mb-1 flex items-center justify-between font-mono text-[10px] font-bold" style={{ color: st.color }}>
                  <span>{en ? st.en : st.zh}</span>
                  <span className={isReachable ? 'text-te' : 'text-dim'}>
                    {isReachable ? tx('可部署', 'REACHABLE') : n.visited ? tx('已完成', 'CLEARED') : tx('未解锁', 'LOCKED')}
                  </span>
                </div>
                {enc ? (
                  <>
                    <div className="text-[13px] font-bold text-ink">{encText(enc).name}</div>
                    <div className="mt-1 line-clamp-3 text-[11.5px] leading-snug text-ink-2">{encText(enc).scenario}</div>
                    <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[10px]">
                      <Stat k="SLA LAT" v={`≤${fmt(enc.slaTarget.maxLatencyMs)}ms`} />
                      <Stat k="SLA ACC" v={`≥${fmt(enc.slaTarget.minAccuracy)}%`} />
                      <Stat k="PASS" v={`${enc.requiredSlaPasses}/${enc.totalWaves}`} />
                    </div>
                    <div className="mt-1.5 font-mono text-[10px] text-amber">+{enc.rewardCredits} CR{(n.type === 'ELITE' || n.type === 'BOSS') && tx(' · 必掉硬件遗物', ' · hardware relic drop')}</div>
                  </>
                ) : (
                  <div className="text-[12px] leading-snug text-ink-2">
                    {n.type === 'SHOP' && tx('用经费采购新卡与硬件遗物，或付费删除技术债。', 'Spend credits on cards & hardware, or pay to purge tech debt.')}
                    {n.type === 'REST' && tx('二选一：免费删除 1 张冗余卡，或领取 +65 经费补贴。', 'Pick one: purge 1 card for free, or claim +65 credits.')}
                    {n.type === 'EVENT' && (evt ? (en ? evt.titleEn : evt.title) : tx('未知研发事件', 'Unknown incident'))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </ScreenFrame>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[5px] border border-[#222227] bg-black/50 px-1.5 py-1">
      <div className="text-[8px] text-dim">{k}</div>
      <div className="tnum font-bold text-ink">{v}</div>
    </div>
  );
}
