import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARD_REGISTRY } from '../data/cards';
import { ACT1_ENCOUNTERS, STARTER_DECK_IDS, STARTER_RELIC_IDS } from '../data/encounters';
import { FAULT_LIST, FAULT_REGISTRY } from '../data/faults';
import { RELIC_LIST, RELIC_REGISTRY } from '../data/relics';
import { KNOWLEDGE_BASE } from '../gdb/knowledgeBase';
import { commitTurn, createCardInstance, initBattle, reorderStagedCard, stageCard } from './battle';
import { computeTelemetry, evaluateSla, stepThermal } from './physics';
import { evaluatePipeline } from './pipeline';

describe('Compute Juicer Physics Engine', () => {
  it('computes exact SI Roofline metrics and detects Memory-Bound vs Compute-Bound', () => {
    const base = { ...ACT1_ENCOUNTERS[0].baseMetrics };
    // flopsG = 14, peak = 1600 -> computeMs = 8.75ms
    // bytesMB = 1350, bw = 90 -> memoryMs = 15.0ms
    const tel = computeTelemetry(base);
    expect(tel.computeMs).toBe(8.75);
    expect(tel.memoryMs).toBe(15);
    expect(tel.rooflineMs).toBe(15);
    expect(tel.bottleneck).toBe('MEMORY_BOUND');
    expect(tel.arithmeticIntensity).toBeCloseTo((14 * 1000) / 1350, 1);
    expect(tel.ridgePoint).toBeCloseTo(1600 / 90, 1);

    // Cut bytes in half -> memoryMs = 7.5ms < 8.75ms -> COMPUTE_BOUND
    const computeBound = computeTelemetry({ ...base, bytesMB: 675 });
    expect(computeBound.bottleneck).toBe('COMPUTE_BOUND');
    expect(computeBound.rooflineMs).toBe(8.75);
  });

  it('triggers thermal throttling (-35% peak FLOPS) at >= 85°C', () => {
    const cool = computeTelemetry({ ...ACT1_ENCOUNTERS[0].baseMetrics, tempC: 70 });
    const hot = computeTelemetry({ ...ACT1_ENCOUNTERS[0].baseMetrics, tempC: 86 });
    expect(cool.isThermalThrottled).toBe(false);
    expect(hot.isThermalThrottled).toBe(true);
    expect(hot.effectivePeakFlopsG).toBeCloseTo(cool.effectivePeakFlopsG * 0.65, 1);
    expect(hot.computeMs).toBeGreaterThan(cool.computeMs);
  });

  it('triggers EGG_CRUSHED when accuracy drops below SLA and OOM_PANIC at 100% RAM', () => {
    const lowAcc = computeTelemetry({ ...ACT1_ENCOUNTERS[1].baseMetrics, accuracy: 82 });
    const evalAcc = evaluateSla(lowAcc, ACT1_ENCOUNTERS[1].slaTarget);
    expect(evalAcc.allMet).toBe(false);
    expect(evalAcc.robotMood).toBe('EGG_CRUSHED');

    const oom = computeTelemetry({ ...ACT1_ENCOUNTERS[1].baseMetrics, ramLeakedMB: 500 });
    const evalOom = evaluateSla(oom, ACT1_ENCOUNTERS[1].slaTarget);
    expect(evalOom.allMet).toBe(false);
    expect(evalOom.robotMood).toBe('OOM_PANIC');
  });

  it('cools down naturally when ambient temperature is lower than chip temp', () => {
    const hot = { ...ACT1_ENCOUNTERS[0].baseMetrics, tempC: 82, powerW: 12, coolingFactor: 1.6 };
    const after = stepThermal(hot);
    expect(after.tempC).toBeLessThan(hot.tempC);
  });
});

describe('Pipeline Order-Dependent Synergies & Anti-Patterns', () => {
  it('protects INT4 quantization accuracy ONLY when QAT is ordered before INT4', () => {
    const state = initBattle(ACT1_ENCOUNTERS[0], STARTER_DECK_IDS, [], RELIC_REGISTRY, () => 0.5);
    const qat = createCardInstance('dep_qat_calib');
    const int4 = createCardInstance('dep_int4_awq');

    const goodOrder = evaluatePipeline(state, [qat, int4], CARD_REGISTRY);
    const badOrder = evaluatePipeline(state, [int4, qat], CARD_REGISTRY);

    expect(goodOrder.preview.finalTelemetry.accuracyClamped).toBeGreaterThan(
      badOrder.preview.finalTelemetry.accuracyClamped,
    );
    expect(goodOrder.preview.synergies.length).toBeGreaterThan(0);
    expect(badOrder.preview.warnings.length).toBeGreaterThan(0);
  });

  it('warns when DVFS overclock is played under Memory-Bound, and rewards FlashAttention crossing Ridge Point', () => {
    const state = initBattle(ACT1_ENCOUNTERS[0], STARTER_DECK_IDS, [], RELIC_REGISTRY, () => 0.5);
    const dvfs = createCardInstance('sil_dvfs_turbo');
    const int4 = createCardInstance('dep_int4_awq');
    const flash = createCardInstance('dep_flash_fusion');

    // Overclocking first while Memory-Bound triggers anti-pattern warning & saves 0ms
    const bad = evaluatePipeline(state, [dvfs], CARD_REGISTRY);
    expect(bad.preview.warnings.length).toBe(1);
    expect(bad.preview.finalTelemetry.rooflineMs).toBe(
      computeTelemetry(state.baseMetrics).rooflineMs,
    );

    // INT4 + FlashAttention pushes into Compute-Bound, then DVFS gives real latency drop
    const good = evaluatePipeline(state, [int4, flash, dvfs], CARD_REGISTRY);
    expect(good.preview.finalTelemetry.bottleneck).toBe('COMPUTE_BOUND');
    expect(good.preview.finalTelemetry.rooflineMs).toBeLessThan(bad.preview.finalTelemetry.rooflineMs);
  });

  it('triggers FULL-STACK OVERDRIVE and extra draw when chaining 3+ distinct domains', () => {
    const state = initBattle(ACT1_ENCOUNTERS[0], STARTER_DECK_IDS, [], RELIC_REGISTRY, () => 0.5);
    const v4l2 = createCardInstance('ker_v4l2_dmabuf'); // KERNEL
    const int4 = createCardInstance('dep_int4_awq');    // DEPLOY
    const cache = createCardInstance('cpp_cache_align'); // CPP (0 cost)

    const res = evaluatePipeline(state, [v4l2, int4, cache], CARD_REGISTRY);
    expect(res.preview.overdriveActive).toBe(true);
    expect(res.preview.distinctDomains.length).toBe(3);
    expect(res.extraDraw).toBe(1);
    expect(res.trace.some((e) => e.kind === 'CHAIN_OVERDRIVE')).toBe(true);
  });
});

describe('Battle State Machine, Watchdog & Content Integrity', () => {
  it('allows staging, reordering, committing turns, and persists PATCH cards across waves', () => {
    let state = initBattle(
      ACT1_ENCOUNTERS[0],
      ['dep_int4_awq', 'ker_preempt_rt', 'cpp_cache_align', 'sil_pwm_fan', 'net_tcp_nodelay'],
      STARTER_RELIC_IDS,
      RELIC_REGISTRY,
      () => 0.5,
    );
    const int4Inst = state.hand.find((c) => c.cardId === 'dep_int4_awq')!;
    const cacheInst = state.hand.find((c) => c.cardId === 'cpp_cache_align')!;
    state = stageCard(state, int4Inst.instanceId);
    state = stageCard(state, cacheInst.instanceId);
    state = reorderStagedCard(state, 0, 1);
    expect(state.stagedPipeline[0].cardId).toBe('cpp_cache_align');

    const next = commitTurn(
      state,
      ACT1_ENCOUNTERS[0],
      CARD_REGISTRY,
      FAULT_REGISTRY,
      RELIC_REGISTRY,
      () => 0.5,
    );
    expect(next.wave).toBe(2);
    expect(next.deployedPatchIds).toContain('dep_int4_awq');
    expect(next.baseMetrics.flags['quant_int4']).toBe(true);
  });

  it('ensures every card, relic, and fault links to a valid L1 KnowledgeEntry', () => {
    for (const c of CARD_LIST) {
      expect(KNOWLEDGE_BASE[c.knowledgeId], `Missing knowledgeId for card ${c.id}`).toBeDefined();
    }
    for (const r of RELIC_LIST) {
      expect(KNOWLEDGE_BASE[r.knowledgeId], `Missing knowledgeId for relic ${r.id}`).toBeDefined();
    }
    for (const f of FAULT_LIST) {
      expect(KNOWLEDGE_BASE[f.knowledgeId], `Missing knowledgeId for fault ${f.id}`).toBeDefined();
    }
  });
});
