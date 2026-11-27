export type Locale = 'zh' | 'en';

const STORAGE_KEY = 'compute_juicer_locale_v1';

export function loadLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    // ignore
  }
  return 'zh';
}

export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

export const UI_TEXT = {
  zh: {
    appTitle: '算力榨汁机',
    wave: '波次',
    slaPasses: 'SLA 达标',
    stability: '稳定性',
    cycles: '预算 / CYCLES',
    cyclesShort: '预算',
    cyclesTip: '每回合可用工程调度预算（类似能量），部分 0 费卡会直接透支温度/RAM/精度',
    haltGdb: 'HALT / GDB',
    bgmOn: 'BGM 开',
    bgmOff: 'BGM 关',
    sfxOn: '音效开',
    sfxOff: '静音',
    // Panels
    panelSla: 'SLA 监控仪表盘',
    panelRoofline: 'Roofline 瓶颈分析',
    panelRobot: 'E2E 延迟时间轴',
    panelPipeline: 'Pass 流水线编排',
    panelPipelineSub: '编译器 Pass 式编排 · 顺序即因果 · 跨 3 域触发 OVERDRIVE',
    panelHand: '手牌区',
    panelHandSub: '点击加入流水线 · Hover 预演 · 📖 查 GDB 词条',
    // Metrics
    latency: '端到端延迟',
    ram: '显存 / RAM',
    accuracy: '模型精度',
    thermal: '芯片结温',
    faultForecast: '本波次故障预告',
    noFault: '本波次无突发故障',
    deployedPatches: '已部署常驻 PATCH',
    noPatches: '尚无常驻 PATCH',
    // Actions
    benchmark: 'BENCHMARK',
    commitWave: '提交压测波次',
    executing: '压测执行中…',
    viewVictoryReport: '查看验收报告',
    viewDefeatReport: '查看事故复盘',
    restart: '重新压测',
    nextLevel: '下一关',
    nextLevelBoss: '下一关 · BOSS',
    backToBringup: '回到 Bring-up',
    switchLevel: '切换关卡',
    inspectBench: '收起并检查现场',
    // Pipeline notices
    pipelineHint: '点击手牌加入流水线；Hover 实时预演；◀ ▶ 调整 Pass 顺序；跨 3 个技术域可触发 FULL-STACK OVERDRIVE！',
    insufficientCycles: '预算不足：总 CYCLES 超出本回合可用额度，无法提交。',
    allStaged: '手牌已全部编排 · 按 ENTER 执行 BENCHMARK',
    faultAfterCommit: '故障冲击在提交后结算',
    dmesgTitle: 'dmesg 执行日志',
    // GDB
    gdbHaltedBanner: 'JTAG 断点已命中 · 战场时钟冻结 · 按 F5 / Esc 恢复运行',
    gdbManualTab: 'L1 权威硬件手册',
    gdbAiTab: 'L2 AI 架构师答疑',
    gdbSearchPlaceholder: '搜索词条 / 寄存器 / 技术术语…',
    gdbAllDomains: '全部领域',
    // Result
    victoryTitle: '产线 SLA 验收通过',
    defeatTitle: '系统故障 · 验收失败',
    juiceGrade: '榨汁评级',
    // Milestone 2: Run / Map / Shop / Reward / Event / Rest
    selectProfileTitle: '选择目标硬件平台与架构师流派',
    selectProfileSub: '3 大章节完整肉鸽：构筑你的全栈 6 层卡组，从单板 Bring-up 一路杀到暴雨无风扇智驾量产！',
    startRun: '烧录固件 · 启动压测',
    credits: '经费',
    deckCount: '牌库',
    actLabel: 'ACT',
    mapTitle: '产线部署路线图',
    mapSub: '选择下一个可执行节点 · 精英关必掉稀有硬件遗物',
    rewardTitle: '压测通关 · 架构构筑奖励',
    rewardPickCard: '三选一：挑选 1 张新卡加入牌库',
    rewardSkip: '跳过抽卡 (+35 经费)',
    rewardRelicDrop: '精英 / BOSS 掉落硬件遗物',
    rewardClaimRelic: '装入硬件槽',
    continueMap: '返回路线图',
    advanceNextAct: '进入下一章节',
    shopTitle: '架构采购商店',
    shopSub: '采购全栈新卡、硬件遗物，或付费「代码重构」删去冗余卡/技术债',
    shopRefactor: '代码重构（删除 1 张牌）',
    shopSold: '已售罄',
    restTitle: '代码重构与维护营地',
    restRemoveCard: '免费重构：从牌库永久删除 1 张卡',
    restBonusCredits: '申请压测专项补贴 (+65 经费)',
    eventTitle: '研发随机事件',
    runVictoryTitle: '全栈量产大满贯！',
    runDefeatTitle: '本轮产线压测终止',
    newRun: '开启新一轮 Run',
    proceedReward: '领取战利品与抽卡',
    viewDeck: '查看牌库',
  },
  en: {
    appTitle: 'COMPUTE JUICER',
    wave: 'WAVE',
    slaPasses: 'SLA PASS',
    stability: 'STABILITY',
    cycles: 'CYCLES',
    cyclesShort: 'CYC',
    cyclesTip: 'Per-turn engineering scheduling budget (energy). Some 0-cost cards trade Temp/RAM/Accuracy directly.',
    haltGdb: 'HALT / GDB',
    bgmOn: 'BGM ON',
    bgmOff: 'BGM OFF',
    sfxOn: 'SFX ON',
    sfxOff: 'MUTED',
    // Panels
    panelSla: 'SLA TELEMETRY',
    panelRoofline: 'ROOFLINE ANALYZER',
    panelRobot: 'E2E TIMELINE',
    panelPipeline: 'PASS PIPELINE',
    panelPipelineSub: 'Compiler-pass ordering · Order = Causality · 3+ Domains = OVERDRIVE',
    panelHand: 'HAND TRAY',
    panelHandSub: 'Click to stage · Hover to preview · 📖 GDB Manual',
    // Metrics
    latency: 'E2E LATENCY',
    ram: 'VRAM / RAM',
    accuracy: 'ACCURACY',
    thermal: 'DIE THERMAL',
    faultForecast: 'INCOMING FAULTS',
    noFault: 'No fault scheduled this wave',
    deployedPatches: 'DEPLOYED',
    noPatches: 'No persistent PATCH deployed',
    // Actions
    benchmark: 'BENCHMARK',
    commitWave: 'COMMIT WAVE',
    executing: 'EXECUTING…',
    viewVictoryReport: 'VIEW REPORT',
    viewDefeatReport: 'POST-MORTEM',
    restart: 'RETRY',
    nextLevel: 'NEXT STAGE',
    nextLevelBoss: 'NEXT · BOSS',
    backToBringup: 'BACK TO BRING-UP',
    switchLevel: 'SWITCH STAGE',
    inspectBench: 'INSPECT BENCH',
    // Pipeline notices
    pipelineHint: 'Click hand cards to stage; Hover for live SIM; ◀ ▶ to reorder passes; chain 3+ domains for FULL-STACK OVERDRIVE!',
    insufficientCycles: 'Insufficient CYCLES: staged cost exceeds available turn budget.',
    allStaged: 'All cards staged · Press ENTER to BENCHMARK',
    faultAfterCommit: 'Faults resolve on commit',
    dmesgTitle: 'dmesg trace',
    // GDB
    gdbHaltedBanner: 'JTAG Breakpoint Hit · Clock Frozen · Press F5 / Esc to Resume',
    gdbManualTab: 'L1 Datasheet Manual',
    gdbAiTab: 'L2 AI Architect',
    gdbSearchPlaceholder: 'Search concepts, registers, terms…',
    gdbAllDomains: 'ALL',
    // Result
    victoryTitle: 'SLA ACCEPTANCE PASSED',
    defeatTitle: 'SYSTEM FAULT · REJECTED',
    juiceGrade: 'JUICE GRADE',
    // Milestone 2: Run / Map / Shop / Reward / Event / Rest
    selectProfileTitle: 'SELECT HARDWARE PLATFORM & ARCHITECT BUILD',
    selectProfileSub: '3-Act Full-Stack Roguelike: draft cards, mount hardware relics, survive P0 faults from Bring-up to Autonomous VLA.',
    startRun: 'FLASH FIRMWARE · START RUN',
    credits: 'CREDITS',
    deckCount: 'DECK',
    actLabel: 'ACT',
    mapTitle: 'DEPLOYMENT ROADMAP',
    mapSub: 'Select next reachable node · Elite faults always drop a Hardware Relic',
    rewardTitle: 'SLA PASSED · DRAFT REWARDS',
    rewardPickCard: 'Draft 1 of 3 cards into your deck',
    rewardSkip: 'Skip Draft (+35 Credits)',
    rewardRelicDrop: 'ELITE / BOSS HARDWARE DROP',
    rewardClaimRelic: 'MOUNT HARDWARE',
    continueMap: 'RETURN TO MAP',
    advanceNextAct: 'ADVANCE TO NEXT ACT',
    shopTitle: 'HARDWARE & COMPILER SHOP',
    shopSub: 'Acquire cards, mount relics, or refactor/purge tech debt from your deck',
    shopRefactor: 'Code Refactor (Purge 1 Card)',
    shopSold: 'SOLD',
    restTitle: 'REFACTOR & SOAK BENCH',
    restRemoveCard: 'Free Refactor: Purge 1 card from deck',
    restBonusCredits: 'Claim R&D Stipend (+65 Credits)',
    eventTitle: 'R&D INCIDENT',
    runVictoryTitle: 'MASS PRODUCTION SIGNED OFF!',
    runDefeatTitle: 'DEPLOYMENT RUN TERMINATED',
    newRun: 'START NEW RUN',
    proceedReward: 'CLAIM LOOT & DRAFT',
    viewDeck: 'INSPECT DECK',
  },
} as const;

export type UiTextKey = keyof typeof UI_TEXT.zh;

export const EN_ENCOUNTER_META: Record<string, { name: string; scenario: string }> = {
  act1_bringup: {
    name: 'Board Bring-up Benchmark',
    scenario:
      'First VLA bring-up on a fresh edge dev board. Break out of Memory-Bound and push E2E Latency under SLA!',
  },
  act1_camera_pipe: {
    name: 'Stereo Camera Driver Pipeline',
    scenario:
      'High kernel-to-user copy overhead! Use V4L2 Zero-Copy and C++ preprocessing to slash E2E I/O latency.',
  },
  act1_elite_leak: {
    name: 'ELITE P0 · Memory Leak Avalanche',
    scenario:
      'Critical elite fault: continuous heap leaks push toward OOM. Defeat it for a guaranteed Hardware Relic drop!',
  },
  act1_thermal_bench: {
    name: 'Sealed Chassis Thermal Soak',
    scenario:
      'Sustained high-load soak pushing die temp toward 85°C Thermal Throttling. Manage power and active cooling!',
  },
  act1_boss_egg: {
    name: 'ACT 1 BOSS · Raw Egg Sorting Arm',
    scenario:
      'High-speed conveyor: keep VLA closed-loop Latency ≤ 24ms and Accuracy ≥ 89%. Miss Latency and eggs drop; lose Accuracy and the gripper crushes them!',
  },
  act2_multi_sensor: {
    name: 'Multi-Cam + LiDAR Calibration',
    scenario:
      'Act 2 multi-sensor integration! Doubled sensor bandwidth puts bus and L2 cache under heavy stress.',
  },
  act2_dds_storm: {
    name: 'ROS2 DDS Broadcast Storm',
    scenario:
      '12 nodes broadcasting point clouds & images simultaneously. Stack copies and weak-net loss spike jitter!',
  },
  act2_elite_irq: {
    name: 'ELITE P0 · IRQ Storm + Cache Thrash',
    scenario:
      'Gigabit LiDAR hard-IRQ storm stacked with L2 Cache Thrashing — test your Linux driver & C++ micro-arch mastery!',
  },
  act2_kv_bloat: {
    name: 'Long-Context KV Cache Bloat',
    scenario:
      'Multi-step VLA planning causes history frames to pile up. Compress KV Cache before OOM Killer strikes!',
  },
  act2_boss_quadruped: {
    name: 'ACT 2 BOSS · Blind Quadruped on Wet Stairs',
    scenario:
      'High-rate joint control on slippery stairs: hold Latency ≤ 22.5ms & Accuracy ≥ 89% through IRQ storms, bus loss & fragmentation!',
  },
  act3_hot_chassis: {
    name: '42°C Sealed Hot-Chassis Soak',
    scenario:
      'Act 3 mass production! 42°C ambient kills passive cooling — break through with undervolting and architectural efficiency.',
  },
  act3_ota_storm: {
    name: 'In-Flight OTA Firmware Ambush',
    scenario:
      'Silent OTA update fires mid-mission — CPU jitter, RAM spikes, and die temperature surge simultaneously!',
  },
  act3_elite_vla_long: {
    name: 'ELITE P0 · Multimodal Long-Context Hell',
    scenario:
      '4K multi-cam + massive KV Cache + heavy EMI noise. Ultimate full-stack 6-layer warm-up!',
  },
  act3_net_blackout: {
    name: 'High-EMI Weak-Net Fallback',
    scenario:
      'Harsh industrial interference: packet loss, TCP head-of-line blocking, and sensor noise strike together!',
  },
  act3_boss_autonomous: {
    name: 'ACT 3 FINAL BOSS · Fanless Storm VLA Driving',
    scenario:
      'Final mass-production sign-off: 40°C fanless box + storm EMI + 4K long-context + OTA preemption. Hold ≤ 21ms & ≥ 90% Accuracy!',
  },
};

export const EN_CARD_META: Record<string, { name: string; summary: string; orderHint?: string }> = {
  sil_dvfs_turbo: {
    name: 'DVFS Turbo Overclock',
    summary: '0-cost boost: Peak FLOPS ×1.35 this wave, Die Temp +15°C immediately.',
    orderHint: 'Only shines under COMPUTE-BOUND; wastes heat under Memory-Bound!',
  },
  sil_pwm_fan: {
    name: 'PWM Fan Max RPM',
    summary: 'Active cooling blast: Die Temp -14°C immediately.',
  },
  sil_npu_offload: {
    name: 'NPU Heterogeneous Offload',
    summary: 'PATCH: Offload vision backbone to NPU. Peak FLOPS +450 GFLOPs/s, Power -4W.',
  },
  sil_undervolt: {
    name: 'PMIC Dynamic Undervolt',
    summary: 'PATCH: Tune PMIC rail. Power -6W, Temp -5°C, Peak FLOPS -6%.',
  },
  sil_sram_scratchpad: {
    name: 'On-Chip SRAM Scratchpad',
    summary: 'PATCH: Pin hot activations in on-chip SRAM. Bandwidth +24 GB/s, Bytes ×0.88.',
  },
  sil_clock_gating: {
    name: 'Idle Unit Clock Gating',
    summary: '0-cost power save: cut idle peripheral clocks for Temp -8°C & +1 draw next wave.',
  },
  sil_pcie_gen5: {
    name: 'PCIe P2P DMA Direct',
    summary: 'PATCH: Peer-to-peer DMA bypassing host RAM. Copy -2.5ms, Bandwidth +12 GB/s.',
  },
  sil_liquid_metal: {
    name: 'Phase-Change Liquid Metal',
    summary: 'PATCH: Slash package thermal resistance. Cooling ×1.45, Throttle Threshold +5°C (to 90°C).',
  },
  ker_v4l2_dmabuf: {
    name: 'V4L2 DMABUF Zero-Copy',
    summary: 'PATCH: Share physical pages directly from camera to NPU. Copy -4.0ms, Buffers -45MB.',
    orderHint: 'Stage before ARM NEON to trigger Zero-Copy Direct Synergy!',
  },
  ker_preempt_rt: {
    name: 'PREEMPT_RT + isolcpus',
    summary: 'PATCH: Real-time kernel + core pinning. Caps OS Jitter ≤ 0.8ms, immune to Preemption/OTA (Peak FLOPS -6%).',
  },
  ker_threaded_irq: {
    name: 'Threaded IRQ Split',
    summary: 'Split top/bottom IRQ halves: OS Jitter -3.5ms and clears IRQ Storm faults.',
  },
  ker_cgroup_reclaim: {
    name: 'cgroup Memory Reclaim',
    summary: 'Reclaim leaked/fragmented pages (up to -140MB RAM) and draw +1 card next wave.',
  },
  ker_hugepages: {
    name: '2MB HugePages Mapping',
    summary: 'PATCH: Slash TLB misses & page-table walks. Bandwidth +16 GB/s, OS Base -1.0ms.',
  },
  ker_dma_sg: {
    name: 'DMA Scatter-Gather List',
    summary: 'Hardware SG descriptor transfer across fragmented pages: Copy -2.8ms, Bytes ×0.88.',
  },
  ker_rcu_lockless: {
    name: 'RCU Lock-Free Read Path',
    summary: '0-cost kernel RCU: OS Base -1.2ms, OS Jitter -1.5ms this wave.',
  },
  ker_oom_adj: {
    name: 'oom_score_adj -900 Shield',
    summary: 'PATCH: Protect inference process & evict bg caches. RAM Cap +120MB.',
  },
  net_iceoryx_shm: {
    name: 'ROS2 Iceoryx Shared Memory',
    summary: 'PATCH: Bypass TCP/UDP stack via SHM. Net Bus -3.8ms, Buffers +55MB RAM.',
  },
  net_tcp_nodelay: {
    name: 'Disable Nagle (TCP_NODELAY)',
    summary: 'Flush small control packets immediately: Net Bus -3.0ms, clears TCP HOL blocking.',
  },
  net_ethercat_sync: {
    name: 'EtherCAT Distributed Clock',
    summary: 'PATCH: Sub-microsecond servo sync. Net Bus -2.0ms, Accuracy +2.5%.',
  },
  net_xdp_bypass: {
    name: 'eBPF / XDP Kernel Bypass',
    summary: 'PATCH: Process sensor frames at NIC driver RX ring. Net Bus -3.2ms, Copy -2.0ms.',
  },
  net_canfd_arb: {
    name: 'CAN-FD Priority Arbitration',
    summary: '0-cost low-ID joint frames: Net Bus -1.8ms, Accuracy +1.5% this wave.',
  },
  net_tsn_gate: {
    name: 'TSN 802.1Qbv Gate Control',
    summary: 'PATCH: Deterministic Ethernet time slots. Immune to Weak-Net Loss, OS Jitter -1.5ms.',
  },
  net_udp_fec: {
    name: 'UDP + Forward Error Correction',
    summary: 'Drop TCP retransmits for UDP+FEC: Net Bus -2.6ms, Accuracy +2.5%, clears TCP HOL.',
  },
  cpp_neon_tiling: {
    name: 'ARM NEON + Loop Tiling',
    summary: 'SIMD + cache blocking: Bandwidth ×1.28, Peak FLOPS ×1.12 this wave.',
    orderHint: 'With V4L2 DMABUF deployed or staged earlier, saves an extra -1.5ms ingest!',
  },
  cpp_arena_pool: {
    name: 'Arena Static Memory Pool',
    summary: 'PATCH: Clears & prevents Memory Fragmentation forever. Reserves +60MB RAM.',
  },
  cpp_cache_align: {
    name: 'Cache Line Alignment',
    summary: '0-cost alignas(64): kills False Sharing. Bandwidth +16 GB/s, OS Jitter -1.0ms.',
  },
  cpp_lockfree_spsc: {
    name: 'Lock-Free SPSC Ring',
    summary: 'PATCH: Eliminate mutex contention. Sensor Ingest -1.8ms, OS Jitter -1.2ms.',
  },
  cpp_prefetch: {
    name: 'Software Prefetch (__builtin_prefetch)',
    summary: '0-cost hide DDR latency: Bandwidth +14 GB/s (+24 GB/s if currently Memory-Bound!).',
  },
  cpp_branchless: {
    name: 'Branchless CMOV Optimization',
    summary: 'Eliminate branch misprediction flushes: Peak FLOPS ×1.18 & +1 draw next wave.',
  },
  cpp_std_span: {
    name: 'std::span Zero-Copy View',
    summary: '0-cost eliminate vector deep copies: Copy -1.6ms, frees 35MB temp buffers.',
  },
  cpp_soa_layout: {
    name: 'SoA Data-Oriented Layout',
    summary: 'PATCH: AoS → SoA for spatial locality. Bandwidth +20 GB/s, immune to Cache Thrashing.',
  },
  dep_qat_calib: {
    name: 'QAT Calibration Pass',
    summary: 'Accuracy +2.5% this wave. Stage BEFORE quantization to halve accuracy loss!',
    orderHint: 'Must be ordered BEFORE INT4 / INT8 quantization!',
  },
  dep_int4_awq: {
    name: 'INT4 AWQ Quantization',
    summary: 'PATCH: Weights RAM ×0.42, Bytes ×0.48, Accuracy -5.5% (-2.0% if preceded by QAT).',
    orderHint: 'Key Memory-Bound breaker! Pair with leading QAT.',
  },
  dep_flash_fusion: {
    name: 'FlashAttention Fusion',
    summary: 'Keep QKV in on-chip SRAM: Bytes ×0.58. Crossing Memory→Compute refunds +1 CYCLE!',
    orderHint: 'Stage BEFORE DVFS Overclock to breach the Ridge Point!',
  },
  dep_trt_graph: {
    name: 'TensorRT Graph Capture',
    summary: 'PATCH: Eliminate per-op launch overhead. FLOPs ×0.86, OS Base -1.5ms.',
  },
  dep_int2_yolo: {
    name: 'Extreme INT2 Truncation',
    summary: '0-cost gamble: Bytes ×0.35, Weights ×0.60, but Accuracy -13% (egg-crush hazard!).',
  },
  dep_smoothquant_int8: {
    name: 'INT8 SmoothQuant (W8A8)',
    summary: 'PATCH: Migrate activation outliers to weights. RAM ×0.65, Bytes ×0.65, FLOPs ×0.82, Acc -1.5% (-0.5% w/ QAT).',
  },
  dep_spec_decode: {
    name: 'Speculative Decoding',
    summary: 'Draft-model guess + parallel target verify: lossless! Bytes ×0.62, FLOPs ×1.10.',
  },
  dep_static_plan: {
    name: 'TVM Static Memory Planning',
    summary: 'PATCH: Compile-time tensor buffer reuse. Buffers -90MB RAM, Power -2W.',
  },
  dep_lora_merge: {
    name: 'Offline LoRA Weight Merge',
    summary: '0-cost fuse W + BA before deploy: FLOPs ×0.90, Bytes ×0.90 this wave.',
  },
  vla_token_prune: {
    name: 'Visual Token Pruning',
    summary: 'Drop background patches: FLOPs ×0.68, Bytes ×0.82, Accuracy -1.5%.',
  },
  vla_paged_kv: {
    name: 'PagedAttention KV Cache',
    summary: 'PATCH: Paged KV blocks cut KV RAM ×0.50 and Bytes ×0.88.',
  },
  vla_action_chunk: {
    name: 'Action Chunking (K-Step)',
    summary: 'PATCH: Predict K future actions per pass. Relaxes SLA Latency +5.0ms, Accuracy -2.5%.',
  },
  vla_ensemble_verify: {
    name: 'Tactile Force Verification',
    summary: 'Fuse fingertip force feedback: Accuracy +5.0%, FLOPs +2.5G.',
  },
  vla_moe_route: {
    name: 'MoE Sparse Expert Routing',
    summary: 'PATCH: Activate Top-2 experts per token. FLOPs ×0.58, but resident RAM +110MB.',
  },
  vla_gqa_head: {
    name: 'GQA Grouped-Query Attention',
    summary: 'PATCH: Share KV heads across Q groups. KV RAM ×0.55, Bytes ×0.84, Acc -0.8%.',
  },
  vla_sys1_sys2: {
    name: 'Dual-System (Sys1 + Sys2)',
    summary: 'PATCH: Decouple fast 100Hz reflex from slow VLA planning. SLA +4.0ms & Accuracy +2.0%!',
  },
  vla_early_exit: {
    name: 'Dynamic Early-Exit',
    summary: '0-cost shallow exit on easy frames: FLOPs ×0.75, Bytes ×0.80, Accuracy -3.0%.',
  },
  fault_card_memleak: {
    name: 'Zombie Memory Leak',
    summary: 'FAULT: Spend 1 CYCLE to hunt & free 80MB leaked RAM.',
  },
  fault_card_tcp_hol: {
    name: 'TCP Head-of-Line Packet',
    summary: 'FAULT: Spend 1 CYCLE to flush blocked queue (-2.0ms Net Bus).',
  },
  fault_card_irq_storm: {
    name: 'High-Freq IRQ Storm',
    summary: 'FAULT: Spend 1 CYCLE to mask runaway IRQ (-2.5ms Jitter; cleared by Threaded IRQ).',
  },
  fault_card_4k_bloat: {
    name: '4K Redundant Vision Branch (Debt)',
    summary: 'PM Tech Debt: clogs draw. Spend 1 CYCLE to downsample temporarily (Bytes ×0.90) — purge at Bench!',
  },
};

export const EN_RELIC_META: Record<string, { name: string; summary: string }> = {
  relic_orin_agx: {
    name: 'Jetson Orin Module',
    summary: 'Edge flagship: RAM Cap +180MB, Peak FLOPS +250 GFLOPs/s, Power +3W.',
  },
  relic_rk3588_soc: {
    name: 'RK3588 Low-Power SoC',
    summary: 'Unified-mem low power: Power -7W, Throttle +5°C, Copy -1.8ms, Bandwidth -6 GB/s.',
  },
  relic_liquid_cool: {
    name: 'Copper Micro-Liquid Loop',
    summary: 'CoolingFactor ×1.6 for rapid inter-wave thermal dissipation.',
  },
  relic_watchdog: {
    name: 'Hardware Watchdog',
    summary: 'Prevents 1 fatal OOM or Thermal Shutdown per encounter via emergency reset.',
  },
  relic_l2_pinning: {
    name: 'L2 Cache Weight Pinning',
    summary: 'Pin hot kernels in L2: Effective Bandwidth +20 GB/s.',
  },
  relic_ethercat_nic: {
    name: 'Hard-RT EtherCAT NIC',
    summary: 'Industrial servo bus: Base Net Latency -1.8ms, OS Jitter -0.8ms.',
  },
  relic_rdma_nic: {
    name: 'RDMA Zero-Copy SmartNIC',
    summary: 'Hardware stack offload: Copy -2.0ms, Net Bus -1.2ms.',
  },
  relic_3d_sram: {
    name: '3D-Stacked On-Chip SRAM',
    summary: 'Bandwidth monster: Effective Bandwidth +30 GB/s, Power +4W.',
  },
  relic_tvm_autotuner: {
    name: 'TVM AutoTuner Engine',
    summary: 'Target-tuned schedules: FLOPs ×0.90, Bytes ×0.92 at battle start.',
  },
  relic_tactile_skin: {
    name: 'High-Density Tactile Skin',
    summary: 'Base Accuracy +3.0% at battle start — protects fragile payloads.',
  },
  relic_hardware_sync: {
    name: 'Hardware Frame-Sync Trigger',
    summary: 'Eliminates multi-cam timestamp drift: Sensor Ingest -1.5ms, Accuracy +1.5%.',
  },
  relic_ecc_lpddr: {
    name: 'Industrial LPDDR5X ECC',
    summary: 'RAM Cap +200MB and Effective Bandwidth +12 GB/s.',
  },
};

export const EN_FAULT_META: Record<string, { name: string; intentText: string }> = {
  fault_logrotate_preempt: {
    name: 'Background Logrotate Preemption',
    intentText: 'OS Jitter +5.5ms (Blocked by PREEMPT_RT)',
  },
  fault_mem_frag_leak: {
    name: 'C++ Heap Fragmentation & Leak',
    intentText: '+110MB RAM & injects FAULT card (Mitigated by Arena Pool)',
  },
  fault_thermal_wave: {
    name: 'Chassis Thermal Spike',
    intentText: 'Die Temp +12°C — watch the 85°C Thermal Throttle line!',
  },
  fault_tcp_hol: {
    name: 'Sensor Bus TCP HOL Blocking',
    intentText: 'Net Bus +4.5ms & injects FAULT card (Blocked by TCP_NODELAY / Iceoryx)',
  },
  fault_4k_burst: {
    name: 'Multi-Cam 4K Frame Burst',
    intentText: 'Bytes +280MB, FLOPs +6G — heavy Memory-Bound pressure!',
  },
  fault_irq_storm: {
    name: 'High-Freq IMU/LiDAR IRQ Storm',
    intentText: 'OS Jitter +5.0ms & injects IRQ Storm FAULT card',
  },
  fault_kv_bloat: {
    name: 'Long-Context KV Cache Bloat',
    intentText: 'KV RAM +140MB, Bytes +220MB (Halved by PagedAttention)',
  },
  fault_cache_thrash: {
    name: 'L2 Cache Thrashing',
    intentText: 'Bandwidth -22 GB/s (Blocked by SoA Memory Layout)',
  },
  fault_weak_net_loss: {
    name: 'Weak-Net Packet Loss & Jitter',
    intentText: 'Net Bus +3.5ms, Accuracy -3.5% (Blocked by TSN Gate)',
  },
  fault_ota_daemon: {
    name: 'Background OTA Firmware Ambush',
    intentText: 'OS Jitter +4.5ms, RAM +95MB, Temp +8°C (Jitter blocked by PREEMPT_RT)',
  },
  fault_emi_noise: {
    name: 'Storm / Heavy EMI Sensor Noise',
    intentText: 'Visual SNR drops — Model Accuracy -4.0%',
  },
};
