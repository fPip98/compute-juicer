export type Domain =
  | 'SILICON'
  | 'KERNEL'
  | 'NETWORK'
  | 'CPP'
  | 'DEPLOY'
  | 'VLA';

export type CardType = 'PATCH' | 'RUNTIME' | 'FAULT';

export type BottleneckState = 'MEMORY_BOUND' | 'COMPUTE_BOUND';

export type RobotMood =
  | 'NOMINAL'
  | 'WORKING'
  | 'THERMAL_THROTTLE'
  | 'EGG_CRUSHED'
  | 'EGG_DROPPED'
  | 'OOM_PANIC'
  | 'VICTORY';

export interface DomainMeta {
  id: Domain;
  name: string;
  shortName: string;
  accentHex: string;
  description: string;
}

export interface SystemMetrics {
  // Roofline workload & hardware (SI-aligned units)
  flopsG: number;          // Effective GFLOPs per inference
  bytesMB: number;         // Effective memory traffic in MB per inference
  peakFlopsG: number;      // Hardware peak GFLOPs/s (1000 = 1 TFLOPS)
  bandwidthGBs: number;    // Effective memory bandwidth in GB/s

  // End-to-End I/O & OS latency components (ms)
  ioSensorMs: number;      // Camera / IMU / LiDAR ingest latency
  ioNetBusMs: number;      // CAN-FD / EtherCAT / DDS / TCP latency
  ioCopyMs: number;        // Kernel <-> User space copy overhead
  osBaseMs: number;        // Base scheduler / context switch overhead
  osJitterMs: number;      // P99 IRQ storm / preemption jitter

  // Memory components (MB)
  ramWeightsMB: number;
  ramKvCacheMB: number;
  ramBuffersMB: number;
  ramFragMB: number;
  ramLeakedMB: number;
  ramCapMB: number;

  // Accuracy (%)
  accuracy: number;
  accuracyCap: number;

  // Thermal & Power
  tempC: number;
  ambientTempC: number;
  throttleTempC: number;
  shutdownTempC: number;
  powerW: number;
  coolingFactor: number;

  // Flags / Immunities granted by deployed patches or relics
  flags: Record<string, boolean>;
}

export interface ComputedTelemetry {
  effectivePeakFlopsG: number;
  computeMs: number;
  memoryMs: number;
  rooflineMs: number;
  ioTotalMs: number;
  osTotalMs: number;
  totalLatencyMs: number;

  arithmeticIntensity: number; // FLOPs / Byte
  ridgePoint: number;          // FLOPs / Byte
  bottleneck: BottleneckState;

  ramUsedMB: number;
  ramPercent: number;
  isOom: boolean;
  isThermalThrottled: boolean;
  isThermalShutdown: boolean;

  accuracyClamped: number;
}

export interface SlaTarget {
  maxLatencyMs: number;
  minAccuracy: number;
}

export interface SlaEvaluation {
  latencyMet: boolean;
  accuracyMet: boolean;
  ramSafe: boolean;
  thermalSafe: boolean;
  allMet: boolean;
  robotMood: RobotMood;
  failureReason?: string;
}

export type TraceEventKind =
  | 'CARD_EXEC'
  | 'SYNERGY_PROC'
  | 'CHAIN_OVERDRIVE'
  | 'ANTI_PATTERN_WARN'
  | 'ROOFLINE_SHIFT'
  | 'THERMAL_THROTTLE'
  | 'OOM_TRIGGERED'
  | 'WATCHDOG_SAVE'
  | 'FAULT_HIT'
  | 'SLA_PASS'
  | 'SLA_FAIL';

export type JuiceGrade = 'S' | 'A' | 'B' | 'C';

export interface TraceEvent {
  kind: TraceEventKind;
  cardInstanceId?: string;
  cardId?: string;
  title: string;
  detail: string;
  deltaLatencyMs?: number;
  deltaRamMB?: number;
  deltaTempC?: number;
  deltaAccuracy?: number;
}

export interface PipelineEvalContext {
  metrics: SystemMetrics;
  telemetryBefore: ComputedTelemetry;
  priorCardIds: string[];
  deployedPatchIds: string[];
  relicIds: string[];
  slaTarget: SlaTarget;
  cyclesRefunded: number;
  extraDraw: number;
  clearedFaultIds: string[];
}

export interface CardApplyOutcome {
  metrics: SystemMetrics;
  synergyNotice?: string;
  warningNotice?: string;
  cyclesRefund?: number;
  extraDraw?: number;
  clearFaultTag?: string;
  slaLatencyBonusMs?: number;
}

export interface CardDef {
  id: string;
  code: string;            // Industrial code e.g. DEP-01, KER-02
  name: string;
  domain: Domain;
  type: CardType;
  cost: number;
  icon: string;            // Lucide icon name
  tags: string[];          // e.g. ['BYTES--', 'RAM--', 'ACC-']
  summary: string;
  orderHint?: string;      // Hint about pipeline ordering / synergy
  knowledgeId: string;
  faultTag?: string;       // For FAULT cards that can be cleared by specific ops
  apply: (ctx: PipelineEvalContext) => CardApplyOutcome;
}

export interface CardInstance {
  instanceId: string;
  cardId: string;
}

export interface RelicDef {
  id: string;
  code: string;
  name: string;
  domain: Domain;
  icon: string;
  summary: string;
  knowledgeId: string;
  onBattleStart?: (metrics: SystemMetrics) => SystemMetrics;
  onTurnStart?: (metrics: SystemMetrics, turn: number) => SystemMetrics;
}

export interface FaultDef {
  id: string;
  name: string;
  domain: Domain;
  severity: 'WARNING' | 'CRITICAL';
  icon: string;
  intentText: string;
  knowledgeId: string;
  injectFaultCardId?: string;
  apply: (metrics: SystemMetrics) => {
    metrics: SystemMetrics;
    logDetail: string;
    blockedBy?: string;
  };
}

export interface EncounterDef {
  id: string;
  act: number;
  name: string;
  scenario: string;
  isBoss: boolean;
  totalWaves: number;
  requiredSlaPasses: number;
  slaTarget: SlaTarget;
  baseMetrics: SystemMetrics;
  waveFaultSchedule: string[][]; // fault IDs per wave (0-indexed)
  rewardCredits: number;
}

export interface PipelineStepSnapshot {
  stepIndex: number;
  cardInstanceId: string;
  cardId: string;
  cardName: string;
  domain: Domain;
  telemetryAfter: ComputedTelemetry;
  metricsAfter: SystemMetrics;
  bottleneckChanged: boolean;
  synergyNotice?: string;
  warningNotice?: string;
}

export interface PipelinePreviewResult {
  valid: boolean;
  totalCost: number;
  cyclesRemaining: number;
  steps: PipelineStepSnapshot[];
  finalMetrics: SystemMetrics;
  finalTelemetry: ComputedTelemetry;
  effectiveSlaTarget: SlaTarget;
  slaEval: SlaEvaluation;
  warnings: string[];
  synergies: string[];
  distinctDomains: Domain[];
  overdriveActive: boolean;
  juiceGrade: JuiceGrade | null;
}

export interface BattleState {
  encounterId: string;
  wave: number;
  totalWaves: number;
  slaPasses: number;
  requiredSlaPasses: number;
  stability: number;
  maxStability: number;

  cycles: number;
  maxCycles: number;

  baseMetrics: SystemMetrics;      // Metrics after persistent patches + accumulated thermal/leak
  effectiveSlaTarget: SlaTarget;

  relicIds: string[];
  deployedPatchIds: string[];      // Persistent PATCH cards deployed in this encounter
  watchdogAvailable: boolean;

  drawPile: CardInstance[];
  hand: CardInstance[];
  stagedPipeline: CardInstance[];  // Cards ordered in the execution pipeline this turn
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];

  upcomingFaultIds: string[];      // Telegraphed faults for this wave
  lastTurnTrace: TraceEvent[];
  robotMood: RobotMood;
  status: 'PLANNING' | 'VICTORY' | 'DEFEAT';
  defeatReason?: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  domain: Domain;
  tldr: string;
  principle: string;
  codeSnippet: string;
  codeLang: 'cpp' | 'bash' | 'python' | 'c';
  tradeoffs: string[];
  suggestedQuestions: string[];
}

// ==================== MILESTONE 2: RUN / ROGUELIKE TYPES ====================

export type MapNodeType = 'BATTLE' | 'ELITE' | 'SHOP' | 'EVENT' | 'REST' | 'BOSS';

export type RunPhase =
  | 'SELECT_PROFILE'
  | 'MAP'
  | 'BATTLE'
  | 'REWARD'
  | 'SHOP'
  | 'EVENT'
  | 'REST'
  | 'RUN_VICTORY'
  | 'RUN_DEFEAT';

export interface StarterProfile {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  subtitle: string;
  subtitleEn: string;
  focusDomains: Domain[];
  relicIds: string[];
  deckCardIds: string[];
  startingCredits: number;
}

export interface MapNode {
  id: string;
  act: 1 | 2 | 3;
  col: number;
  row: number;
  type: MapNodeType;
  label: string;
  labelEn: string;
  encounterId?: string;
  eventId?: string;
  nextNodeIds: string[];
  visited: boolean;
}

export interface RewardOffer {
  credits: number;
  cardChoices: string[];
  relicChoice?: string;
  skipBonusCredits: number;
  cardClaimed: boolean;
  relicClaimed: boolean;
  grade: JuiceGrade;
}

export interface ShopCardItem {
  cardId: string;
  price: number;
  sold: boolean;
}

export interface ShopRelicItem {
  relicId: string;
  price: number;
  sold: boolean;
}

export interface ShopInventory {
  cards: ShopCardItem[];
  relics: ShopRelicItem[];
  removePrice: number;
  removedThisVisit: boolean;
}

export interface EventChoiceOutcome {
  creditsDelta?: number;
  addCardIds?: string[];
  addRelicId?: string;
  removeRandomFault?: boolean;
  resultText: string;
  resultTextEn: string;
}

export interface EventChoiceDef {
  id: string;
  label: string;
  labelEn: string;
  hint: string;
  hintEn: string;
  outcome: EventChoiceOutcome;
}

export interface RandomEventDef {
  id: string;
  code: string;
  title: string;
  titleEn: string;
  domain: Domain;
  story: string;
  storyEn: string;
  choices: EventChoiceDef[];
}

export interface RunState {
  phase: RunPhase;
  profileId: string | null;
  act: 1 | 2 | 3;
  credits: number;
  deckCardIds: string[];
  relicIds: string[];
  nodes: MapNode[];
  currentNodeId: string | null;
  reachableNodeIds: string[];
  activeBattle: BattleState | null;
  activeEncounterId: string | null;
  activeReward: RewardOffer | null;
  activeShop: ShopInventory | null;
  activeEvent: {
    eventId: string;
    resolvedText?: string;
    resolvedTextEn?: string;
  } | null;
  restDone: boolean;
  battlesWon: number;
  seenEventIds: string[];
  lastGrade: JuiceGrade | null;
}

