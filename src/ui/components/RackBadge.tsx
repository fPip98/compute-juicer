import { CARD_REGISTRY } from '../../data/cards';
import { getRackAxis, RACK_AXES } from '../../engine/rack';
import { CardDef, RackAxis } from '../../engine/types';
import { useI18n } from './i18n';
import { cn, COLORS } from './primitives';

export type RackSlots = Partial<Record<RackAxis, string>>;

export function rackAxisMeta(axis: RackAxis) {
  return RACK_AXES.find((a) => a.axis === axis);
}

/**
 * Exclusive-axis corner badge for PATCH cards.
 * `+AXIS` (green) = mounts into an empty slot; `⇄AXIS` (amber) = replaces the mounted card; `=AXIS` = already mounted.
 * Without rackSlots (outside battle) it only names the axis.
 */
export function RackAxisBadge({ def, rackSlots, className }: { def: CardDef; rackSlots?: RackSlots; className?: string }) {
  const { tx, card } = useI18n();
  const axis = getRackAxis(def);
  if (!axis) return null;
  const meta = rackAxisMeta(axis);
  const mountedId = rackSlots?.[axis];
  const mode: 'info' | 'new' | 'swap' | 'same' = !rackSlots ? 'info' : !mountedId ? 'new' : mountedId === def.id ? 'same' : 'swap';
  const color = mode === 'swap' ? COLORS.amber : mode === 'new' ? COLORS.signal : mode === 'same' ? COLORS.mute : COLORS.scope;
  const glyph = mode === 'swap' ? '⇄' : mode === 'new' ? '+' : mode === 'same' ? '=' : '◇';
  const mountedDef = mountedId ? CARD_REGISTRY[mountedId] : undefined;
  const title =
    mode === 'swap' && mountedDef
      ? tx(
          `互斥轴 ${meta?.labelZh}：将替换已装的 ${card(mountedDef).name}`,
          `Exclusive axis ${meta?.labelEn}: replaces mounted ${card(mountedDef).name}`,
        )
      : mode === 'new'
        ? tx(`互斥轴 ${meta?.labelZh}：装入空槽（默认 ${meta?.defaultLabel}）`, `Exclusive axis ${meta?.labelEn}: mounts into empty slot (default ${meta?.defaultLabel})`)
        : mode === 'same'
          ? tx(`互斥轴 ${meta?.labelZh}：已装同款，重复部署无增益`, `Exclusive axis ${meta?.labelEn}: same card already mounted`)
          : tx(`互斥轴 ${meta?.labelZh}：同轴 PATCH 互相替换`, `Exclusive axis ${meta?.labelEn}: same-axis PATCHes replace each other`);
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 rounded-[3px] border px-1 font-mono text-[9px] leading-[14px] font-black whitespace-nowrap', className)}
      style={{ color, borderColor: `${color}77`, background: `${color}14` }}
      title={title}
      data-rack-badge={mode}
    >
      {glyph}
      {meta?.labelEn ?? axis}
    </span>
  );
}
