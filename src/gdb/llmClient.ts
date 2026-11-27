import { computeTelemetry } from '../engine/physics';
import { BattleState, KnowledgeEntry } from '../engine/types';

export interface LlmConfig {
  endpoint: string; // e.g. https://api.openai.com/v1/chat/completions or http://localhost:11434/v1/chat/completions
  apiKey: string;
  model: string;
}

export interface GdbChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'compute_juicer_llm_config_v1';

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LlmConfig;
  } catch {
    // ignore storage errors
  }
  return {
    endpoint: 'http://localhost:11434/v1/chat/completions',
    apiKey: '',
    model: 'qwen2.5-coder:7b',
  };
}

export function saveLlmConfig(config: LlmConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}

export function buildGdbSystemPrompt(
  state: BattleState,
  focusedKnowledge?: KnowledgeEntry,
): string {
  const tel = computeTelemetry(state.baseMetrics);
  const recentLogs = state.lastTurnTrace
    .slice(-5)
    .map((t) => `- [${t.kind}] ${t.title}: ${t.detail}`)
    .join('\n');

  const focusSection = focusedKnowledge
    ? `\n当前玩家查阅的权威词条：\n标题：${focusedKnowledge.title}\n原理：${focusedKnowledge.principle}\n`
    : '';

  return `你是《算力榨汁机 (Compute Juicer)》内嵌的 GDB / JTAG 硬件架构师调试终端。
请用硬核、严谨、简洁的工程师风格回答玩家问题，结合真实的计算机体系结构、Linux 内核驱动、嵌入式网络、C++ 微架构与端侧模型部署原理，严禁胡编乱造。

当前被硬件断点冻结的实时系统寄存器快照：
- 关卡: ${state.encounterId} | 波次: ${state.wave}/${state.totalWaves}
- 瓶颈状态: ${tel.bottleneck} (算术强度 AI=${tel.arithmeticIntensity} vs 硬件拐点 Ridge=${tel.ridgePoint} FLOPs/Byte)
- 延迟拆解: 总计 ${tel.totalLatencyMs}ms (I/O=${tel.ioTotalMs}ms + Roofline=${tel.rooflineMs}ms [Comp=${tel.computeMs}ms, Mem=${tel.memoryMs}ms] + OS=${tel.osTotalMs}ms) | SLA 上限: ${state.effectiveSlaTarget.maxLatencyMs}ms
- 显存/内存: ${tel.ramUsedMB}/${state.baseMetrics.ramCapMB}MB (${tel.ramPercent}%) | 泄漏=${state.baseMetrics.ramLeakedMB}MB, 碎片=${state.baseMetrics.ramFragMB}MB
- 精度: ${tel.accuracyClamped}% (SLA 下限: ${state.effectiveSlaTarget.minAccuracy}%)
- 芯片结温: ${state.baseMetrics.tempC}°C (热节流阈值: ${state.baseMetrics.throttleTempC}°C, 状态: ${tel.isThermalThrottled ? '已触发热节流' : '正常'})
- 已部署常驻补丁: ${state.deployedPatchIds.join(', ') || '无'}
- 近期执行日志:
${recentLogs || '暂无'}
${focusSection}
回答要求：先给直接结论，再结合上面当前快照里的具体数值做原理解析，最后给 1 条可落地的工程优化建议，字数控制在 250 字以内。`;
}

export function normalizeChatEndpoint(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/\/(chat\/completions|completions|responses)$/i.test(trimmed)) {
    return trimmed;
  }
  if (/\/v\d+(beta)?$/i.test(trimmed)) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

export async function askGdbAssistant(
  config: LlmConfig,
  state: BattleState,
  question: string,
  history: GdbChatMessage[],
  focusedKnowledge?: KnowledgeEntry,
): Promise<string> {
  const url = normalizeChatEndpoint(config.endpoint);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  const messages = [
    { role: 'system', content: buildGdbSystemPrompt(state, focusedKnowledge) },
    ...history.slice(-6),
    { role: 'user', content: question },
  ];

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model.trim(),
      messages,
      temperature: 0.3,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    throw new Error(`LLM 请求失败 (${resp.status}) [${url}]: ${errText.slice(0, 180)}`);
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() || '（终端无返回内容）';
}
