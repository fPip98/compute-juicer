import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARD_REGISTRY } from '../data/cards';
import { ACT1_ENCOUNTERS, ALL_ENCOUNTERS, STARTER_DECK_IDS, STARTER_RELIC_IDS } from '../data/encounters';
import { FAULT_LIST, FAULT_REGISTRY } from '../data/faults';
import { RELIC_LIST, RELIC_REGISTRY } from '../data/relics';
import { KNOWLEDGE_BASE } from '../gdb/knowledgeBase';
import { EN_CARD_META, EN_ENCOUNTER_META, EN_FAULT_META, EN_RELIC_META } from '../i18n';
import { applyOpsAction, commitTurn, createCardInstance, FAULT_COUNTERS, initBattle, reorderStagedCard, stageCard } from './battle';
import { diagnoseBattleFailure } from './diagnose';
import { computeTelemetry, evaluateSla, predictWavesToRelease, stepThermal } from './physics';
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
    // 2 PATCH cards (+1 each) + FULL-STACK OVERDRIVE (+1) = 3
    expect(res.extraDraw).toBe(3);
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

  it('injects FAULT cards into next wave hand when triggered and exhausts them when cleared', () => {
    // act1_camera_pipe wave 1 triggers fault_tcp_hol -> injects fault_card_tcp_hol
    const enc = ALL_ENCOUNTERS.find((e) => e.id === 'act1_camera_pipe')!;
    const state = initBattle(enc, STARTER_DECK_IDS, [], RELIC_REGISTRY, () => 0.5);
    const wave2 = commitTurn(state, enc, CARD_REGISTRY, FAULT_REGISTRY, RELIC_REGISTRY, () => 0.5);
    const faultInHand = wave2.hand.find((c) => c.cardId === 'fault_card_tcp_hol');
    expect(faultInHand).toBeDefined();

    const staged = stageCard(wave2, faultInHand!.instanceId);
    const wave3 = commitTurn(staged, enc, CARD_REGISTRY, FAULT_REGISTRY, RELIC_REGISTRY, () => 0.5);
    expect(wave3.exhaustPile.some((c) => c.cardId === 'fault_card_tcp_hol')).toBe(true);
  });

  it('enforces 6-axis exclusive rack replacement (INT8 -> INT4 replaces instead of stacking)', () => {
    const enc = ACT1_ENCOUNTERS[0];
    let state = initBattle(enc, ['dep_smoothquant_int8', 'dep_int4_awq', 'cpp_cache_align', 'sil_pwm_fan', 'net_tcp_nodelay'], [], RELIC_REGISTRY, () => 0.5);
    const int8 = state.hand.find((c) => c.cardId === 'dep_smoothquant_int8')!;
    state = stageCard(state, int8.instanceId);
    const wave2 = commitTurn(state, enc, CARD_REGISTRY, FAULT_REGISTRY, RELIC_REGISTRY, () => 0.5);
    expect(wave2.rackSlots.QUANT).toBe('dep_smoothquant_int8');

    // Now stage INT4 AWQ on the same QUANT axis -> replaces INT8 cleanly from initialMetrics
    const int4 = createCardInstance('dep_int4_awq');
    const evalRes = evaluatePipeline(wave2, [int4], CARD_REGISTRY);
    expect(evalRes.preview.rackReplacements.length).toBe(1);
    expect(evalRes.preview.rackReplacements[0]).toEqual({
      axis: 'QUANT',
      fromCardId: 'dep_smoothquant_int8',
      toCardId: 'dep_int4_awq',
    });
    // Exact INT4 weights RAM = round(480 * 0.42) = 202 (NOT stacked 480 * 0.65 * 0.42 = 131!)
    expect(evalRes.persistentMetrics.ramWeightsMB).toBe(Math.round(enc.baseMetrics.ramWeightsMB * 0.42));
  });

  it('enforces 78-85°C thermal hysteresis and OPS RESTART_SERVICE emergency recovery', () => {
    const enc = ACT1_ENCOUNTERS[0];
    const hotLatched = { ...enc.baseMetrics, tempC: 81.0, thermalThrottled: true };
    // At 81°C (> 78°C release), must STAY throttled!
    expect(computeTelemetry(hotLatched).isThermalThrottled).toBe(true);
    // At 78°C (<= release), unlocks!
    expect(computeTelemetry({ ...hotLatched, tempC: 78.0 }).isThermalThrottled).toBe(false);

    // OPS RESTART_SERVICE clears leaks, TCP lock, thermal hysteresis, and costs 1 stability
    const state = initBattle(enc, STARTER_DECK_IDS, [], RELIC_REGISTRY, () => 0.5);
    state.baseMetrics.ramLeakedMB = 200;
    state.baseMetrics.tempC = 90;
    state.baseMetrics.thermalThrottled = true;
    state.baseMetrics.flags['tcp_hol_locked'] = true;

    const rebooted = applyOpsAction(state, 'RESTART_SERVICE', enc, RELIC_REGISTRY, () => 0.5);
    expect(rebooted.stability).toBe(state.stability - 1);
    expect(rebooted.baseMetrics.ramLeakedMB).toBe(0);
    expect(rebooted.baseMetrics.thermalThrottled).toBe(false);
    expect(rebooted.baseMetrics.flags['tcp_hol_locked']).toBe(false);
    expect(rebooted.baseMetrics.tempC).toBeLessThanOrEqual(72);
  });

  it('predicts thermal release waves and generates counterfactual root-cause diagnosis', () => {
    const enc = ACT1_ENCOUNTERS[0];
    // At 86°C with low power (10W) and good cooling, passive cooling releases within 1..8 waves
    const waves = predictWavesToRelease({ ...enc.baseMetrics, tempC: 86, powerW: 10, coolingFactor: 1.5, thermalThrottled: true });
    expect(waves).toBeGreaterThan(0);
    // At 90°C with huge power (45W), passive cooling can never release -> -1
    expect(predictWavesToRelease({ ...enc.baseMetrics, tempC: 90, powerW: 45, coolingFactor: 0.7, thermalThrottled: true })).toBe(-1);

    // Exported FAULT_COUNTERS covers TCP HOL
    expect(FAULT_COUNTERS['fault_tcp_hol']).toContain('net_tcp_nodelay');

    // Counterfactual diagnosis: player plays INT4 before QAT (wrong order / misses SLA),
    // diagnosis finds a better play from the held cards!
    let state = initBattle(enc, ['dep_int4_awq', 'dep_qat_calib', 'dep_flash_fusion', 'sil_dvfs_turbo', 'ker_v4l2_dmabuf'], [], RELIC_REGISTRY, () => 0.5);
    const dvfs = state.hand.find((c) => c.cardId === 'sil_dvfs_turbo')!;
    state = stageCard(state, dvfs.instanceId); // Anti-pattern: overclock while Memory-Bound!
    const after = commitTurn(state, enc, CARD_REGISTRY, FAULT_REGISTRY, RELIC_REGISTRY, () => 0.5);
    const diag = diagnoseBattleFailure(after, CARD_REGISTRY, FAULT_REGISTRY);
    expect(diag.topCauses.length).toBeGreaterThan(0);
    expect(diag.counterfactual).not.toBeNull();
    expect(diag.counterfactual!.whatIfLatencyMs).toBeLessThan(diag.counterfactual!.actualLatencyMs);
  });

  it('ensures every card, relic, fault, and encounter has valid L1 KnowledgeEntry & EN i18n coverage', () => {
    for (const c of CARD_LIST) {
      expect(KNOWLEDGE_BASE[c.knowledgeId], `Missing knowledgeId for card ${c.id}`).toBeDefined();
      expect(EN_CARD_META[c.id], `Missing EN_CARD_META for card ${c.id}`).toBeDefined();
    }
    for (const r of RELIC_LIST) {
      expect(KNOWLEDGE_BASE[r.knowledgeId], `Missing knowledgeId for relic ${r.id}`).toBeDefined();
      expect(EN_RELIC_META[r.id], `Missing EN_RELIC_META for relic ${r.id}`).toBeDefined();
    }
    for (const f of FAULT_LIST) {
      expect(KNOWLEDGE_BASE[f.knowledgeId], `Missing knowledgeId for fault ${f.id}`).toBeDefined();
      expect(EN_FAULT_META[f.id], `Missing EN_FAULT_META for fault ${f.id}`).toBeDefined();
    }
    for (const e of ALL_ENCOUNTERS) {
      expect(EN_ENCOUNTER_META[e.id], `Missing EN_ENCOUNTER_META for encounter ${e.id}`).toBeDefined();
    }
  });
});
