import { motion } from 'framer-motion';
import { Coins, FileText, Languages, Layers, Music, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { DOMAINS } from '../../data/domains';
import { RELIC_REGISTRY } from '../../data/relics';
import { BattleState, EncounterDef, RunPhase } from '../../engine/types';
import { useI18n } from './i18n';
import { cn, COLORS, domainColor, DynIcon, HoverTip, Led } from './primitives';

const MAX_RELIC_SLOTS = 5;

interface TopBarProps {
  phase: RunPhase;
  act: 1 | 2 | 3;
  credits: number;
  deckCount: number;
  relicIds: string[];
  /** Present only during BATTLE. */
  battle: BattleState | null;
  encounter: EncounterDef | null;
  muted: boolean;
  bgmEnabled: boolean;
  gdbOpen: boolean;
  /** Set when the battle ended and the report overlay was dismissed. */
  reportPending: 'VICTORY' | 'DEFEAT' | null;
  onOpenDeck: () => void;
  onRestartRun: () => void;
  onSwitchAct: (act: 1 | 2 | 3) => void;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onToggleLocale: () => void;
  onShowReport: () => void;
  onToggleGdb: () => void;
  onOpenKnowledge: (id: string) => void;
}

export function TopBar({
  phase,
  act,
  credits,
  deckCount,
  relicIds,
  battle,
  encounter,
  muted,
  bgmEnabled,
  gdbOpen,
  reportPending,
  onOpenDeck,
  onRestartRun,
  onSwitchAct,
  onToggleMute,
  onToggleBgm,
  onToggleLocale,
  onShowReport,
  onToggleGdb,
  onOpenKnowledge,
}: TopBarProps) {
  const { t, tx, en, relic: relicText, encounter: encText } = useI18n();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const inRun = phase !== 'SELECT_PROFILE';
  const inBattle = phase === 'BATTLE' && !!battle;
  const shownRelics = relicIds.slice(0, MAX_RELIC_SLOTS);
  const hiddenRelics = relicIds.length - shownRelics.length;

  return (
    <header className="panel flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 px-2 py-1.5 desk:h-[48px] desk:flex-nowrap">
      {/* Brand plate */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative grid h-8 w-8 place-items-center rounded-md bg-te text-chassis shadow-[0_0_16px_-4px_#ff4f00]">
          <span className="font-display text-[13px] leading-none font-black">CJ</span>
          <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border-2 border-chassis bg-signal" />
        </div>
        <div className={cn('font-display text-[14px] leading-none font-bold tracking-tight whitespace-nowrap', inBattle && 'hidden min-[1400px]:block')}>
          {!en && (
            <>
              算力榨汁机 <span className="text-mute">/</span>{' '}
            </>
          )}
          <span className="text-te">COMPUTE JUICER</span>
        </div>
      </div>

      {inRun && (
        <>
          <span className="hidden h-6 w-px bg-line desk:block" />

          {/* ACT switcher (+ encounter name in battle) */}
          <div
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-te/50 bg-te/10 px-2"
            title={tx('点击数字随时切换章节路线图', 'Click 1 / 2 / 3 to switch Act roadmap anytime')}
          >
            <span className="font-display text-[11px] font-black tracking-wider text-te glow-te">
              {t('actLabel')}
            </span>
            <span className="flex gap-1">
              {([1, 2, 3] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => onSwitchAct(a)}
                  className={cn(
                    'grid h-5 w-5 cursor-pointer place-items-center rounded-[4px] font-mono text-[10px] font-black transition',
                    a === act && phase === 'MAP'
                      ? 'bg-te text-chassis shadow-[0_0_8px_#ff4f00]'
                      : a === act
                        ? 'border border-te bg-te/25 text-te hover:bg-te hover:text-chassis'
                        : 'border border-line bg-black/50 text-ink-2 hover:border-te/70 hover:text-te',
                  )}
                  title={tx(`切换到 ACT ${a} 路线图`, `Switch to ACT ${a} Roadmap`)}
                >
                  {a}
                </button>
              ))}
            </span>
            {inBattle && encounter && (
              <span className={cn('hidden max-w-[180px] truncate text-[11px] font-bold min-[1400px]:inline', encounter.isBoss ? 'text-estop' : 'text-ink-2')}>
                {encText(encounter).name}
              </span>
            )}
          </div>

          {/* Credits */}
          <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-black bg-oled px-2" title={t('credits')}>
            <Coins size={13} className="text-amber" />
            <motion.span
              key={credits}
              initial={{ y: -6, opacity: 0.3 }}
              animate={{ y: 0, opacity: 1 }}
              className="tnum font-mono text-[12px] font-black text-amber glow-amber"
            >
              {credits}
            </motion.span>
            <span className="hidden font-mono text-[8.5px] text-dim xl:inline">{en ? 'CR' : t('credits')}</span>
          </div>

          {/* Deck inspector */}
          <button
            onClick={onOpenDeck}
            className="keycap flex h-8 shrink-0 items-center gap-1.5 !rounded-[7px] px-2"
            title={t('viewDeck')}
            aria-label={`${t('viewDeck')} (${deckCount})`}
          >
            <Layers size={13} className="text-scope" />
            <span className="tnum font-mono text-[12px] font-black">{deckCount}</span>
            <span className="hidden font-mono text-[8.5px] text-mute xl:inline">{t('deckCount')}</span>
          </button>

          {/* Relic slots */}
          <div className="flex shrink-0 gap-1">
            {shownRelics.map((rid) => {
              const relic = RELIC_REGISTRY[rid];
              if (!relic) return null;
              const c = domainColor(relic.domain);
              const spent = rid === 'relic_watchdog' && battle && !battle.watchdogAvailable;
              return (
                <div key={rid} className="group relative">
                  <button
                    onClick={() => onOpenKnowledge(relic.knowledgeId)}
                    className={cn('grid h-8 w-8 place-items-center rounded-md border bg-black/50 transition', spent && 'opacity-40')}
                    style={{ borderColor: `${c}66`, color: c, boxShadow: `inset 0 0 12px ${c}22` }}
                    aria-label={`${relic.code} ${relicText(relic).name}`}
                  >
                    <DynIcon name={relic.icon} size={15} />
                  </button>
                  <HoverTip className="top-10 left-0">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-mono text-[10px]" style={{ color: c }}>
                        {relic.code} · {DOMAINS[relic.domain].shortName}
                      </span>
                      {rid === 'relic_watchdog' && battle && (
                        <span className={cn('font-mono text-[9px]', battle.watchdogAvailable ? 'text-signal' : 'text-estop')}>
                          {battle.watchdogAvailable ? 'ARMED' : 'SPENT'}
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] font-bold">{relicText(relic).name}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-ink-2">{relicText(relic).summary}</div>
                    <div className="mt-2 font-mono text-[10px] text-scope">▸ {tx('点击打开 GDB 词条', 'Click to open GDB entry')}</div>
                  </HoverTip>
                </div>
              );
            })}
            {hiddenRelics > 0 && (
              <span
                className="grid h-8 min-w-8 place-items-center rounded-md border border-line bg-black/50 px-1 font-mono text-[10px] font-bold text-mute"
                title={relicIds
                  .slice(MAX_RELIC_SLOTS)
                  .map((r) => (RELIC_REGISTRY[r] ? relicText(RELIC_REGISTRY[r]).name : r))
                  .join('\n')}
              >
                +{hiddenRelics}
              </span>
            )}
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Battle counters: wave / SLA / stability */}
      {inBattle && battle && (
        <div className="flex h-8 shrink-0 items-center gap-3 rounded-[8px] border border-black bg-oled px-2.5 shadow-[inset_0_6px_14px_rgba(0,0,0,0.9)]">
          <Counter label="WAVE" title={t('wave')}>
            <div className="flex gap-[3px]">
              {Array.from({ length: battle.totalWaves }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-3 w-1.5 rounded-[2px]',
                    i + 1 < battle.wave ? 'bg-scope/70' : i + 1 === battle.wave ? 'bg-scope shadow-[0_0_6px_#38bdf8]' : 'bg-[#1c1c20]',
                  )}
                />
              ))}
            </div>
            <span className="tnum font-mono text-[11px] font-bold text-scope glow-scope">
              {battle.wave}/{battle.totalWaves}
            </span>
          </Counter>
          <Divider />
          <Counter label="SLA" title={t('slaPasses')}>
            <div className="flex gap-[3px]">
              {Array.from({ length: battle.requiredSlaPasses }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={false}
                  animate={{ scale: i < battle.slaPasses ? [1.5, 1] : 1 }}
                  className={cn(
                    'h-2.5 w-2.5 rounded-full border',
                    i < battle.slaPasses ? 'border-signal bg-signal shadow-[0_0_8px_#2cf07f]' : 'border-[#2a2a2e]',
                  )}
                />
              ))}
            </div>
            <span className="tnum font-mono text-[11px] font-bold text-signal glow-signal">
              {battle.slaPasses}/{battle.requiredSlaPasses}
            </span>
          </Counter>
          <Divider />
          <Counter label="STAB" title={t('stability')}>
            <div className="flex gap-[3px]">
              {Array.from({ length: battle.maxStability }).map((_, i) => {
                const on = i < battle.stability;
                const crit = battle.stability <= 1;
                return (
                  <span
                    key={i}
                    className={cn('h-3 w-1.5 rounded-[1px]', !on && 'bg-[#1c1c20]', on && crit && 'blink')}
                    style={on ? { background: crit ? COLORS.estop : COLORS.amber, boxShadow: `0 0 6px ${crit ? COLORS.estop : COLORS.amber}` } : undefined}
                  />
                );
              })}
            </div>
            <span className={cn('tnum font-mono text-[11px] font-bold', battle.stability <= 1 ? 'text-estop glow-estop' : 'text-amber glow-amber')}>
              {battle.stability}/{battle.maxStability}
            </span>
          </Counter>
        </div>
      )}

      {/* Battle over + report dismissed: status entry to bring the report back */}
      {reportPending && (
        <button
          onClick={onShowReport}
          className={cn(
            'keycap flex h-8 shrink-0 items-center gap-1.5 !rounded-[7px] px-2 font-mono text-[10px] font-black',
            reportPending === 'VICTORY' ? 'text-signal' : 'text-estop',
          )}
          title={reportPending === 'VICTORY' ? t('viewVictoryReport') : t('viewDefeatReport')}
        >
          <Led on color={reportPending === 'VICTORY' ? COLORS.signal : COLORS.estop} blink />
          <FileText size={13} />
          {reportPending === 'VICTORY' ? 'PASS' : 'FAIL'}
        </button>
      )}

      {/* Locale */}
      <button
        onClick={onToggleLocale}
        className="keycap keycap-light flex h-8 shrink-0 items-center gap-1 !rounded-[7px] px-2 font-mono text-[11px] font-black"
        title={tx('切换为 English', 'Switch to 中文')}
        aria-label={tx('切换语言', 'Switch language')}
      >
        <Languages size={12} />
        <span className={cn(en ? 'opacity-35' : '')}>中</span>
        <span className="opacity-40">/</span>
        <span className={cn(!en ? 'opacity-35' : '')}>EN</span>
      </button>

      {/* BGM */}
      <button
        onClick={onToggleBgm}
        data-pressed={bgmEnabled}
        className="keycap flex h-8 shrink-0 items-center gap-1.5 !rounded-[7px] px-2 font-mono text-[10px] font-black"
        title={bgmEnabled ? t('bgmOn') : t('bgmOff')}
        aria-label={bgmEnabled ? t('bgmOn') : t('bgmOff')}
        aria-pressed={bgmEnabled}
      >
        <Led on={bgmEnabled && !muted} color={COLORS.signal} />
        <Music size={13} className={bgmEnabled && !muted ? 'text-ink' : 'text-mute'} />
        BGM
      </button>

      {/* SFX / master mute */}
      <button
        onClick={onToggleMute}
        className="keycap grid h-8 w-8 shrink-0 place-items-center !rounded-[7px]"
        title={muted ? t('sfxOff') : t('sfxOn')}
        aria-label={muted ? t('sfxOff') : t('sfxOn')}
        data-pressed={muted}
      >
        {muted ? <VolumeX size={14} className="text-mute" /> : <Volume2 size={14} />}
      </button>

      {/* Restart run (two-step confirm, no blocking dialog) */}
      {inRun && (
        <button
          onClick={() => {
            if (confirmRestart) {
              setConfirmRestart(false);
              onRestartRun();
            } else {
              setConfirmRestart(true);
              window.setTimeout(() => setConfirmRestart(false), 2600);
            }
          }}
          className={cn(
            'keycap flex h-8 shrink-0 items-center justify-center gap-1 !rounded-[7px] px-2 font-mono text-[10px] font-black',
            confirmRestart ? 'keycap-estop' : 'text-mute',
          )}
          title={tx('重开 Run（需再次点击确认）', 'Restart run (click again to confirm)')}
          aria-label={tx('重开 Run', 'Restart run')}
        >
          <RotateCcw size={13} />
          {confirmRestart && tx('确认重开?', 'CONFIRM?')}
        </button>
      )}

      {/* HALT / GDB breaker */}
      <button
        onClick={onToggleGdb}
        data-pressed={gdbOpen}
        className="keycap keycap-estop flex h-8 shrink-0 items-center gap-2 !rounded-[7px] pr-2 pl-1.5"
        title={tx('硬件断点：冻结战场并打开 GDB / JTAG 终端 (F5)', 'Hardware breakpoint: freeze the bench and open the GDB / JTAG terminal (F5)')}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-[#5e0000] bg-[#ff5a5a]">
          <span className={cn('h-1.5 w-1.5 rounded-full bg-[#2a0000]', gdbOpen && 'blink')} />
        </span>
        <span className="font-display text-[12px] font-black tracking-wider whitespace-nowrap">HALT / GDB</span>
        <span className="rounded-[3px] bg-[#1a0000]/25 px-1 font-mono text-[9px] font-bold">F5</span>
      </button>
    </header>
  );
}

function Counter({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5" title={title}>
      <span className="font-mono text-[8px] tracking-[0.16em] text-dim">{label}</span>
      {children}
    </div>
  );
}

function Divider() {
  return <span className="h-4 w-px bg-[#25252a]" />;
}
