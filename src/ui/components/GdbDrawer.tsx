import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Bot, CircleStop, KeyRound, Search, Send, Settings2, X } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { DOMAINS } from '../../data/domains';
import { Domain, BattleState, ComputedTelemetry, KnowledgeEntry } from '../../engine/types';
import { KNOWLEDGE_BASE, KNOWLEDGE_LIST } from '../../gdb/knowledgeBase';
import { askGdbAssistant, GdbChatMessage, LlmConfig, loadLlmConfig, saveLlmConfig } from '../../gdb/llmClient';
import { useI18n } from './i18n';
import { cn, COLORS, domainColor, DomainChip, fmt } from './primitives';

interface GdbDrawerProps {
  open: boolean;
  focusId: string | null;
  /** Null outside battle: L1 manual stays fully usable, L2 needs a live snapshot. */
  battle: BattleState | null;
  telemetry: ComputedTelemetry | null;
  onFocus: (id: string) => void;
  onClose: () => void;
}

const DOMAIN_ORDER: Domain[] = ['SILICON', 'KERNEL', 'NETWORK', 'CPP', 'DEPLOY', 'VLA'];

export function GdbDrawer({ open, focusId, battle, telemetry, onFocus, onClose }: GdbDrawerProps) {
  const { t, tx, en } = useI18n();
  const [domainFilter, setDomainFilter] = useState<Domain | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'L1' | 'L2'>('L1');
  const [pendingQuestion, setPendingQuestion] = useState('');

  const entry: KnowledgeEntry | undefined = (focusId && KNOWLEDGE_BASE[focusId]) || KNOWLEDGE_LIST[0];

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return KNOWLEDGE_LIST.filter((k) => {
      if (domainFilter !== 'ALL' && k.domain !== domainFilter) return false;
      if (!q) return true;
      return (
        k.title.toLowerCase().includes(q) ||
        k.tldr.toLowerCase().includes(q) ||
        k.principle.toLowerCase().includes(q) ||
        k.id.toLowerCase().includes(q)
      );
    });
  }, [domainFilter, query]);

  // Make sure the focused entry's domain is visible when GDB is opened from a card
  useEffect(() => {
    if (open && focusId && KNOWLEDGE_BASE[focusId] && domainFilter !== 'ALL' && KNOWLEDGE_BASE[focusId].domain !== domainFilter) {
      setDomainFilter('ALL');
    }
  }, [open, focusId, domainFilter]);

  const askAbout = (q: string) => {
    setPendingQuestion(q);
    setTab('L2');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="gdb"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          className="fixed top-0 right-0 bottom-0 z-40 flex w-full max-w-[1020px] flex-col border-l border-[#2b2b30] bg-[#0c0c0e] shadow-[-30px_0_60px_-20px_rgba(0,0,0,0.9)]"
          role="dialog"
          aria-label={tx('GDB / JTAG 硬件断点终端', 'GDB / JTAG hardware breakpoint terminal')}
        >
          <div className="hazard-estop h-1.5 w-full opacity-90" />

          {/* Header */}
          <div className="flex flex-wrap items-center gap-3 border-b border-[#1e1e22] px-4 py-3">
            <div className="flex items-center gap-2">
              <CircleStop size={18} className="text-estop" />
              <div className="leading-tight">
                <div className="font-display text-[14px] font-black tracking-wider">
                  GDB <span className="text-mute">/</span> JTAG DEBUG PROBE
                </div>
                <div className="font-mono text-[9px] text-estop glow-estop">
                  {battle ? `Program received signal SIGTRAP · CPU HALTED @ wave ${battle.wave}` : tx('离线模式 · 硬件手册查阅（无活动战局）', 'Offline mode · datasheet browsing (no active battle)')}
                </div>
              </div>
            </div>
            <div className="flex-1" />
            {en && (
              <span className="rounded-[4px] border border-[#2b2b30] px-1.5 py-[1px] font-mono text-[9px] text-mute" title="Knowledge-base entries are currently authored in Chinese">
                L1 content: 中文
              </span>
            )}
            <div className="flex rounded-[10px] bg-black/50 p-1">
              <TabKey active={tab === 'L1'} onClick={() => setTab('L1')} icon={<BookOpen size={13} />} label={t('gdbManualTab')} />
              <TabKey active={tab === 'L2'} onClick={() => setTab('L2')} icon={<Bot size={13} />} label={t('gdbAiTab')} />
            </div>
            <button onClick={onClose} className="keycap flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] font-bold" title={tx('继续运行 (F5 / Esc)', 'Resume (F5 / Esc)')}>
              <X size={13} /> CONTINUE
            </button>
          </div>

          {/* Register snapshot */}
          {battle && telemetry && <Registers battle={battle} t={telemetry} />}

          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
            {/* Index */}
            <div className="flex min-h-0 flex-col border-r border-[#1e1e22] max-md:max-h-[34vh]">
              <div className="flex flex-col gap-2 p-3">
                <label className="flex items-center gap-2 rounded-[8px] border border-[#2b2b30] bg-black/60 px-2 py-1.5">
                  <Search size={13} className="text-mute" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('gdbSearchPlaceholder')}
                    className="w-full bg-transparent font-mono text-[11px] text-ink outline-none placeholder:text-dim"
                  />
                </label>
                <div className="flex flex-wrap gap-1">
                  <FilterChip active={domainFilter === 'ALL'} color="#ecebe6" onClick={() => setDomainFilter('ALL')}>
                    {t('gdbAllDomains')}
                  </FilterChip>
                  {DOMAIN_ORDER.map((d) => (
                    <FilterChip key={d} active={domainFilter === d} color={domainColor(d)} onClick={() => setDomainFilter(d)}>
                      {DOMAINS[d].shortName}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {list.length === 0 && <div className="px-2 font-mono text-[11px] text-dim">No symbol table is loaded.</div>}
                {list.map((k) => {
                  const active = entry?.id === k.id;
                  const c = domainColor(k.domain);
                  return (
                    <button
                      key={k.id}
                      onClick={() => {
                        onFocus(k.id);
                        setTab('L1');
                      }}
                      className={cn(
                        'mb-1 flex w-full items-start gap-2 rounded-[7px] border px-2 py-1.5 text-left transition',
                        active ? 'border-[#3a3a40] bg-[#18181c]' : 'border-transparent hover:bg-[#141417]',
                      )}
                    >
                      <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c, boxShadow: active ? `0 0 6px ${c}` : undefined }} />
                      <span className="min-w-0">
                        <span className={cn('block truncate text-[12px]', active ? 'font-bold text-ink' : 'text-ink-2')}>{k.title}</span>
                        <span className="block truncate font-mono text-[9px] text-dim">{k.id}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail / Chat */}
            <div className="flex min-h-0 flex-col">
              {tab === 'L1' && entry ? (
                <EntryView entry={entry} onAsk={askAbout} />
              ) : (
battle ? (
                <LlmPanel battle={battle} entry={entry} pendingQuestion={pendingQuestion} onConsumePending={() => setPendingQuestion('')} />
              ) : (
                <div className="grid flex-1 place-items-center p-8 text-center">
                  <div className="max-w-[360px] space-y-2">
                    <Bot size={28} className="mx-auto text-dim" />
                    <div className="font-mono text-[12px] font-bold text-ink-2">{t('gdbAiTab')}</div>
                    <div className="text-[12px] leading-relaxed text-mute">
                      {tx(
                        'L2 需要注入实时战局寄存器快照，请在战斗中按 F5 使用。L1 离线手册可随时查阅全部词条。',
                        'L2 injects a live battle register snapshot — press F5 during a battle to use it. The L1 offline manual is always available.',
                      )}
                    </div>
                    {pendingQuestion && <div className="font-mono text-[11px] text-scope">“{pendingQuestion}”</div>}
                  </div>
                </div>
              )
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */

function TabKey({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      data-pressed={active}
      className={cn('keycap flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold', active && 'keycap-light')}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterChip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-[4px] border px-1.5 py-[2px] font-mono text-[9px] font-bold transition"
      style={{
        color: active ? '#0a0a0b' : color,
        background: active ? color : 'transparent',
        borderColor: active ? color : `${color}44`,
      }}
    >
      {children}
    </button>
  );
}

function Registers({ battle, t }: { battle: BattleState; t: ComputedTelemetry }) {
  const regs: Array<[string, string, string?]> = [
    ['$lat', `${fmt(t.totalLatencyMs, 2)}ms`, t.totalLatencyMs > battle.effectiveSlaTarget.maxLatencyMs ? COLORS.estop : undefined],
    ['$sla', `≤${fmt(battle.effectiveSlaTarget.maxLatencyMs)}ms`],
    ['$io', `${fmt(t.ioTotalMs)}ms`],
    ['$roof', `${fmt(t.rooflineMs)}ms`],
    ['$os', `${fmt(t.osTotalMs)}ms`],
    ['$ai', `${fmt(t.arithmeticIntensity)}`],
    ['$ridge', `${fmt(t.ridgePoint)}`],
    ['$bound', t.bottleneck === 'MEMORY_BOUND' ? 'MEM' : 'CMP', t.bottleneck === 'MEMORY_BOUND' ? COLORS.scope : COLORS.te],
    ['$ram', `${t.ramUsedMB}MB/${fmt(t.ramPercent)}%`, t.ramPercent > 90 ? COLORS.estop : undefined],
    ['$acc', `${fmt(t.accuracyClamped)}%`, t.accuracyClamped < battle.effectiveSlaTarget.minAccuracy ? COLORS.estop : undefined],
    ['$temp', `${fmt(battle.baseMetrics.tempC)}°C`, t.isThermalThrottled ? COLORS.estop : undefined],
  ];
  return (
    <div className="scroll-thin flex gap-px overflow-x-auto border-b border-[#1e1e22] bg-[#1e1e22] font-mono text-[10px]">
      <div className="shrink-0 bg-black px-3 py-1.5 text-dim">(gdb) info registers</div>
      {regs.map(([k, v, c]) => (
        <div key={k} className="shrink-0 bg-black px-2.5 py-1.5">
          <span className="text-dim">{k} </span>
          <span className="tnum font-bold" style={{ color: c ?? COLORS.signal }}>
            {v}
          </span>
        </div>
      ))}
    </div>
  );
}

function EntryView({ entry, onAsk }: { entry: KnowledgeEntry; onAsk: (q: string) => void }) {
  const { tx, en } = useI18n();
  return (
    <motion.div
      key={entry.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5"
    >
      <div className="mb-2 flex items-center gap-2">
        <DomainChip domain={entry.domain} />
        <span className="font-mono text-[10px] text-dim">symbol: {entry.id}</span>
      </div>
      <h2 className="font-display text-[22px] leading-tight font-bold">{entry.title}</h2>
      <div className="mt-3 rounded-[8px] border-l-2 border-te bg-te/[0.06] px-3 py-2 text-[13px] leading-relaxed text-ink">
        <span className="mr-2 font-mono text-[10px] font-black text-te">TL;DR</span>
        {entry.tldr}
      </div>

      <SectionLabel>PRINCIPLE{!en && ' · 底层原理'}</SectionLabel>
      <p className="text-[13px] leading-[1.8] text-ink-2">{entry.principle}</p>

      <SectionLabel>
        SOURCE · <span className="text-scope">{entry.codeLang}</span>
      </SectionLabel>
      <CodeBlock code={entry.codeSnippet} lang={entry.codeLang} />

      <SectionLabel>TRADE-OFFS{!en && ' · 工程权衡'}</SectionLabel>
      <ul className="flex flex-col gap-1.5">
        {entry.tradeoffs.map((t, i) => (
          <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-2">
            <span className="font-mono text-[11px] text-amber">{String(i + 1).padStart(2, '0')}</span>
            {t}
          </li>
        ))}
      </ul>

      {entry.suggestedQuestions.length > 0 && (
        <>
          <SectionLabel>ASK THE ARCHITECT · {tx('结合当前战局提问', 'with the live bench snapshot')}</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {entry.suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                className="flex items-center gap-2 rounded-[7px] border border-[#2b2b30] bg-black/40 px-3 py-2 text-left text-[12px] text-ink-2 transition hover:border-scope/50 hover:text-ink"
              >
                <Bot size={13} className="shrink-0 text-scope" />
                {q}
              </button>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="silk mt-5 mb-2">{children}</div>;
}

/* ---------------- Minimal syntax highlighter (no deps) ---------------- */

const KEYWORDS: Record<KnowledgeEntry['codeLang'], string[]> = {
  cpp: ['auto', 'const', 'constexpr', 'struct', 'class', 'template', 'typename', 'return', 'if', 'else', 'for', 'while', 'void', 'int', 'float', 'double', 'char', 'bool', 'static', 'inline', 'alignas', 'alignof', 'std', 'new', 'delete', 'namespace', 'using', 'uint8_t', 'uint32_t', 'size_t', 'int8_t', 'int32_t', 'true', 'false', 'nullptr', 'noexcept', 'volatile', 'unsigned'],
  c: ['struct', 'return', 'if', 'else', 'for', 'while', 'void', 'int', 'char', 'static', 'const', 'unsigned', 'long', 'sizeof', 'volatile', 'NULL', 'u32', 'u8', 'size_t'],
  python: ['def', 'return', 'import', 'from', 'as', 'with', 'for', 'in', 'if', 'else', 'elif', 'class', 'None', 'True', 'False', 'lambda', 'and', 'or', 'not'],
  bash: ['sudo', 'echo', 'cat', 'export', 'if', 'then', 'fi', 'for', 'do', 'done', 'tee', 'sysctl', 'taskset', 'chrt', 'paste', 'ip', 'ethtool', 'nvpmodel'],
};

function highlightLine(line: string, lang: KnowledgeEntry['codeLang'], lineKey: number): ReactNode[] {
  const kw = new Set(KEYWORDS[lang]);
  const commentRe = lang === 'bash' || lang === 'python' ? /#.*$/ : /\/\/.*$/;
  const out: ReactNode[] = [];
  let rest = line;
  let commentPart = '';
  const cm = rest.match(commentRe);
  if (cm && cm.index !== undefined) {
    // For C/C++ keep `#include` style preprocessor as keyword (handled below)
    commentPart = rest.slice(cm.index);
    rest = rest.slice(0, cm.index);
  }
  const tokenRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?[a-zA-Z]*\b)|(#\s*\w+)|(--?[a-zA-Z][\w-]*)|([A-Za-z_][\w]*)(?=\s*\()|([A-Za-z_][\w]*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = tokenRe.exec(rest))) {
    if (m.index > last) out.push(rest.slice(last, m.index));
    const k = `${lineKey}-${i++}`;
    if (m[1]) out.push(<span key={k} className="tok-string">{m[1]}</span>);
    else if (m[2]) out.push(<span key={k} className="tok-number">{m[2]}</span>);
    else if (m[3]) out.push(<span key={k} className="tok-keyword">{m[3]}</span>);
    else if (m[4] && lang === 'bash') out.push(<span key={k} className="tok-flag">{m[4]}</span>);
    else if (m[4]) out.push(m[4]);
    else if (m[5]) out.push(<span key={k} className={kw.has(m[5]) ? 'tok-keyword' : 'tok-fn'}>{m[5]}</span>);
    else if (m[6]) out.push(kw.has(m[6]) ? <span key={k} className="tok-keyword">{m[6]}</span> : m[6]);
    last = tokenRe.lastIndex;
  }
  if (last < rest.length) out.push(rest.slice(last));
  if (commentPart) out.push(<span key={`${lineKey}-c`} className="tok-comment">{commentPart}</span>);
  return out;
}

function CodeBlock({ code, lang }: { code: string; lang: KnowledgeEntry['codeLang'] }) {
  const lines = code.split('\n');
  return (
    <div className="oled">
      <div className="flex items-center gap-1.5 border-b border-[#15161a] px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-estop/80" />
        <span className="h-2 w-2 rounded-full bg-amber/80" />
        <span className="h-2 w-2 rounded-full bg-signal/80" />
        <span className="ml-2 font-mono text-[9px] text-dim">{lang === 'bash' ? 'tty0 — bash' : `snippet.${lang === 'python' ? 'py' : lang}`}</span>
      </div>
      <pre className="code-block scroll-thin relative z-10 overflow-x-auto px-0 py-2 text-ink-2">
        {lines.map((ln, i) => (
          <div key={i} className="flex">
            <span className="tnum w-9 shrink-0 pr-3 text-right text-[#3a3a40] select-none">{i + 1}</span>
            <code className="pr-4 whitespace-pre">{highlightLine(ln, lang, i)}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}

/* ---------------- L2: BYOK / Ollama ---------------- */

function LlmPanel({
  battle,
  entry,
  pendingQuestion,
  onConsumePending,
}: {
  battle: BattleState;
  entry?: KnowledgeEntry;
  pendingQuestion: string;
  onConsumePending: () => void;
}) {
  const { tx } = useI18n();
  const [config, setConfig] = useState<LlmConfig>(() => loadLlmConfig());
  const [showConfig, setShowConfig] = useState(false);
  const [history, setHistory] = useState<GdbChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pendingQuestion) {
      setInput(pendingQuestion);
      onConsumePending();
    }
  }, [pendingQuestion, onConsumePending]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setError(null);
    const prior = history;
    setHistory([...prior, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const answer = await askGdbAssistant(config, battle, q, prior, entry);
      setHistory((h) => [...h, { role: 'assistant', content: answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const isLocal = /localhost|127\.0\.0\.1/.test(config.endpoint);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1e1e22] px-4 py-2">
        <Bot size={14} className="text-scope" />
        <span className="text-[12px] font-bold">{tx('AI 架构师 · 注入当前寄存器快照', 'AI Architect · live register snapshot injected')}</span>
        <span className="rounded-[4px] border border-[#2b2b30] px-1.5 font-mono text-[9px] text-mute">
          {isLocal ? 'LOCAL · OLLAMA' : 'BYOK · REMOTE'} · {config.model}
        </span>
        {entry && (
          <span className="truncate font-mono text-[9px] text-dim">ctx: {entry.id}</span>
        )}
        <div className="flex-1" />
        <button onClick={() => setShowConfig((s) => !s)} data-pressed={showConfig} className="keycap flex items-center gap-1.5 px-2 py-1 font-mono text-[10px]">
          <Settings2 size={12} /> CONFIG
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showConfig && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-[#1e1e22] bg-black/40"
          >
            <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1fr_1fr]">
              <ConfigField label={tx('ENDPOINT (OpenAI 兼容 /chat/completions)', 'ENDPOINT (OpenAI-compatible /chat/completions)')} value={config.endpoint} onChange={(v) => setConfig({ ...config, endpoint: v })} className="sm:col-span-2" />
              <ConfigField label="MODEL" value={config.model} onChange={(v) => setConfig({ ...config, model: v })} />
              <ConfigField label={tx('API KEY (本地 Ollama 可留空)', 'API KEY (optional for local Ollama)')} value={config.apiKey} type="password" onChange={(v) => setConfig({ ...config, apiKey: v })} />
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <button
                  onClick={() => {
                    saveLlmConfig(config);
                    setShowConfig(false);
                  }}
                  className="keycap keycap-te flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold"
                >
                  <KeyRound size={12} /> {tx('SAVE · 仅存于本机 localStorage', 'SAVE · local localStorage only')}
                </button>
                <button
                  onClick={() => setConfig({ endpoint: 'http://localhost:11434/v1/chat/completions', apiKey: '', model: 'qwen2.5-coder:7b' })}
                  className="keycap px-3 py-1.5 font-mono text-[10px]"
                >
                  PRESET · OLLAMA
                </button>
                <span className="text-[11px] text-dim">{tx('Key 不会离开浏览器，直接请求你填写的端点。', 'Your key never leaves the browser except to the endpoint you set.')}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[12px] leading-relaxed">
        {history.length === 0 && !loading && (
          <div className="text-dim">
            <div>
              <span className="text-signal">(gdb)</span> {tx('当前战局快照（延迟拆解 / Roofline / RAM / 温度 / 已部署补丁 / 最近日志）', 'Live bench snapshot (latency breakdown / Roofline / RAM / temp / deployed PATCHes / recent trace)')}
            </div>
            <div>{tx('会随问题一起发送给你配置的模型。L1 手册离线可用，L2 为可选增强。', 'is sent with your question to the model you configured. L1 works offline; L2 is optional.')}</div>
            <div className="mt-3 text-mute">{tx('示例：“为什么我刚才先打超频延迟没降？”', 'e.g. "Why did DVFS overclock not lower my latency?"')}</div>
          </div>
        )}
        {history.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
            <div className={cn('mb-0.5 text-[10px] font-black', msg.role === 'user' ? 'text-te' : 'text-scope')}>
              {msg.role === 'user' ? '(gdb) ask' : '>>> architect'}
            </div>
            <div className={cn('font-sans text-[13px] whitespace-pre-wrap', msg.role === 'user' ? 'text-ink' : 'text-ink-2')}>{msg.content}</div>
          </motion.div>
        ))}
        {loading && (
          <div className="text-scope">
            &gt;&gt;&gt; architect is reading the registers <span className="blink">▌</span>
          </div>
        )}
        {error && (
          <div className="mt-2 rounded-[6px] border border-estop/40 bg-estop/10 px-3 py-2 text-[11px] text-estop">
            {error}
            <div className="mt-1 text-ink-2">{tx('检查端点 / 模型名 / CORS（Ollama 需设置 OLLAMA_ORIGINS）或使用 L1 离线手册。', 'Check endpoint / model name / CORS (Ollama needs OLLAMA_ORIGINS), or use the L1 offline manual.')}</div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-center gap-2 border-t border-[#1e1e22] p-3"
      >
        <span className="font-mono text-[12px] text-signal">(gdb)</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tx('ask 为什么当前是 Memory-Bound？', 'ask Why am I Memory-Bound right now?')}
          className="flex-1 rounded-[8px] border border-[#2b2b30] bg-black/60 px-3 py-2 font-mono text-[12px] text-ink outline-none placeholder:text-dim focus:border-scope/60"
        />
        <button type="submit" disabled={loading || !input.trim()} className="keycap keycap-te flex items-center gap-1.5 px-3 py-2 text-[11px] font-black">
          <Send size={12} /> SEND
        </button>
      </form>
    </div>
  );
}

function ConfigField({
  label,
  value,
  onChange,
  type = 'text',
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="silk !text-[9px]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="rounded-[7px] border border-[#2b2b30] bg-black/60 px-2.5 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-scope/60"
      />
    </label>
  );
}
