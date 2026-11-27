import { CardDef, RackAxis, SlaTarget, SystemMetrics } from './types';
import { cloneMetrics, computeTelemetry } from './physics';

export interface RackAxisMeta {
  axis: RackAxis;
  labelZh: string;
  labelEn: string;
  defaultLabel: string;
}

export const RACK_AXES: RackAxisMeta[] = [
  { axis: 'QUANT', labelZh: '量化', labelEn: 'QUANT', defaultLabel: 'FP16' },
  { axis: 'GRAPH', labelZh: '图/算子', labelEn: 'GRAPH', defaultLabel: 'Eager' },
  { axis: 'MEMORY', labelZh: '内存', labelEn: 'MEM', defaultLabel: 'glibc' },
  { axis: 'KERNEL', labelZh: '内核', labelEn: 'KERN', defaultLabel: 'Std OS' },
  { axis: 'BUS', labelZh: '总线', labelEn: 'BUS', defaultLabel: 'TCP' },
  { axis: 'POLICY', labelZh: '策略/热', labelEn: 'POLICY', defaultLabel: '1-Sys' },
];

const CARD_TO_AXIS: Record<string, RackAxis> = {
  // QUANT (mutually exclusive weight/activation precision)
  dep_int4_awq: 'QUANT',
  dep_smoothquant_int8: 'QUANT',
  // GRAPH (compiler/accelerator execution graph)
  dep_trt_graph: 'GRAPH',
  dep_static_plan: 'GRAPH',
  sil_npu_offload: 'GRAPH',
  sil_sram_scratchpad: 'GRAPH',
  // MEMORY (allocator / KV layout / OOM shield)
  cpp_arena_pool: 'MEMORY',
  cpp_soa_layout: 'MEMORY',
  vla_paged_kv: 'MEMORY',
  vla_gqa_head: 'MEMORY',
  ker_oom_adj: 'MEMORY',
  // KERNEL (driver zero-copy / RT scheduling / HugePages)
  ker_v4l2_dmabuf: 'KERNEL',
  ker_preempt_rt: 'KERNEL',
  ker_hugepages: 'KERNEL',
  cpp_lockfree_spsc: 'KERNEL',
  sil_pcie_gen5: 'KERNEL',
  // BUS (IPC / industrial bus transport)
  net_iceoryx_shm: 'BUS',
  net_ethercat_sync: 'BUS',
  net_xdp_bypass: 'BUS',
  net_tsn_gate: 'BUS',
  // POLICY (VLA control architecture / PMIC thermal mod)
  vla_action_chunk: 'POLICY',
  vla_moe_route: 'POLICY',
  vla_sys1_sys2: 'POLICY',
  sil_undervolt: 'POLICY',
  sil_liquid_metal: 'POLICY',
};

export function getRackAxis(card: CardDef): RackAxis | undefined {
  if (card.type !== 'PATCH') return undefined;
  return card.rackAxis ?? CARD_TO_AXIS[card.id] ?? 'POLICY';
}

/**
 * Recomputes persistent SystemMetrics from clean initialMetrics + mounted rackSlots,
 * preserving accumulated runtime thermal/leak/frag/lock state.
 * Guarantees replacing a PATCH on the same axis NEVER leaves phantom multipliers behind!
 */
export function recomputeMetricsFromRack(
  initialMetrics: SystemMetrics,
  currentBase: SystemMetrics,
  rackSlots: Partial<Record<RackAxis, string>>,
  cardRegistry: Record<string, CardDef>,
  baseSlaTarget: SlaTarget,
  relicIds: string[],
): { metrics: SystemMetrics; slaTarget: SlaTarget } {
  let m = cloneMetrics(initialMetrics);
  const slaTarget: SlaTarget = { ...baseSlaTarget };

  // Preserve dynamic cross-wave accumulations (heat, leaks, fragmentation, hard locks)
  m.tempC = currentBase.tempC;
  m.thermalThrottled = currentBase.thermalThrottled;
  m.ramLeakedMB = currentBase.ramLeakedMB;
  m.ramFragMB = currentBase.ramFragMB;
  if (currentBase.flags['tcp_hol_locked']) {
    m.flags['tcp_hol_locked'] = true;
  }

  const mountedIds = Object.values(rackSlots).filter((id): id is string => Boolean(id));
  for (const cid of mountedIds) {
    const def = cardRegistry[cid];
    if (!def) continue;
    const outcome = def.apply({
      metrics: cloneMetrics(m),
      telemetryBefore: computeTelemetry(m),
      priorCardIds: [],
      deployedPatchIds: mountedIds,
      relicIds,
      slaTarget: { ...slaTarget },
      cyclesRefunded: 0,
      extraDraw: 0,
      clearedFaultIds: [],
    });
    m = outcome.metrics;
    if (outcome.slaLatencyBonusMs) {
      slaTarget.maxLatencyMs = Number(
        (slaTarget.maxLatencyMs + outcome.slaLatencyBonusMs).toFixed(1),
      );
    }
  }

  return { metrics: m, slaTarget };
}
