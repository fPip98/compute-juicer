import { RandomEventDef } from '../engine/types';

export const EVENT_LIST: RandomEventDef[] = [
  {
    id: 'evt_pm_4k',
    code: 'EVT-01',
    title: '产品经理的深夜需求',
    titleEn: "PM's Midnight Feature Request",
    domain: 'VLA',
    story:
      '凌晨 1:30，产品经理冲进实验室：“老板明天要给投资人 Demo，必须立刻把 720p 相机换成双目 4K，预算批给你！”',
    storyEn:
      'At 1:30 AM, the PM bursts into the lab: "Investor demo tomorrow! Upgrade to dual 4K cameras right now — extra budget approved!"',
    choices: [
      {
        id: 'accept_4k',
        label: '硬着头皮接单',
        labelEn: 'Accept the Scope Creep',
        hint: '获得 +130 经费与「高密电子触觉皮肤」，但牌库塞入 1 张技术债「4K 冗余视觉分支」',
        hintEn: '+130 Credits & Tactile Skin Relic, but adds a 4K Tech Debt FAULT card',
        outcome: {
          creditsDelta: 130,
          addRelicId: 'relic_tactile_skin',
          addCardIds: ['fault_card_4k_bloat'],
          resultText: '经费到账，硬件加装完毕，但 4K 冗余分支像幽灵一样留在了你的代码库里。',
          resultTextEn: 'Budget secured and sensor mounted, though the 4K tech debt now haunts your deck.',
        },
      },
      {
        id: 'roofline_pushback',
        label: '甩出 Roofline 图据理力争',
        labelEn: 'Push Back with Roofline Data',
        hint: '免费获得 1 张「视觉 Token 动态剪枝」卡，保住代码库洁净',
        hintEn: 'Gain 1 Visual Token Pruning card and keep your deck clean',
        outcome: {
          addCardIds: ['vla_token_prune'],
          resultText: '你指着带宽天花板讲了二十分钟架构原理，PM 默默撤回了需求，还顺手给你点了个赞。',
          resultTextEn: 'After a 20-minute Roofline lecture, the PM quietly closed the Jira ticket.',
        },
      },
    ],
  },
  {
    id: 'evt_intern_malloc',
    code: 'EVT-02',
    title: '实习生在硬中断里写了 malloc()',
    titleEn: 'Intern Called malloc() in an ISR',
    domain: 'KERNEL',
    story:
      '代码评审时，你惊恐地发现实习生在相机驱动的硬中断处理函数里写了动态内存分配与 printf，系统随时可能死锁！',
    storyEn:
      'During PR review, you spot malloc() and printf() inside the camera hard-IRQ handler. A kernel deadlock is imminent!',
    choices: [
      {
        id: 'refactor_arena',
        label: '手把手带他重写成 Arena 静态池',
        labelEn: 'Pair-Refactor to Arena Pool',
        hint: '花费 40 经费，获得「Arena 静态内存池」并清除牌库中 1 张故障脏卡',
        hintEn: 'Spend 40 Credits: gain Arena Static Pool & purge 1 FAULT card',
        outcome: {
          creditsDelta: -40,
          addCardIds: ['cpp_arena_pool'],
          removeRandomFault: true,
          resultText: '通宵改完驱动后，实习生悟了，系统也彻底告别了中断死锁。',
          resultTextEn: 'After an all-nighter pair session, the driver is lock-free and rock solid.',
        },
      },
      {
        id: 'quick_patch',
        label: '先拆分中断底半部救火',
        labelEn: 'Quick-Fix with Threaded IRQ',
        hint: '免费获得 1 张「中断底半部线程化」+ 45 经费加班补贴',
        hintEn: 'Gain 1 Threaded IRQ Split card + 45 Credits',
        outcome: {
          creditsDelta: 45,
          addCardIds: ['ker_threaded_irq'],
          resultText: '你迅速把耗时逻辑挪进了 Threaded IRQ，线上先稳住了。',
          resultTextEn: 'Heavy work moved to Threaded IRQ — production stabilized for now.',
        },
      },
    ],
  },
  {
    id: 'evt_legacy_asm',
    code: 'EVT-03',
    title: '老架构师留下的祖传 NEON 汇编',
    titleEn: 'Ancient Hand-Tuned NEON Assembly',
    domain: 'CPP',
    story:
      '你在仓库深处翻出一份十年前的 `fast_gemm.S`，注释只有一行：`// DO NOT TOUCH, MAGIC NUMBERS`。',
    storyEn:
      'Deep in the repo you uncover a 10-year-old fast_gemm.S with one comment: "// DO NOT TOUCH, MAGIC NUMBERS".',
    choices: [
      {
        id: 'adopt_asm',
        label: '直接编译链接进项目',
        labelEn: 'Link It Directly',
        hint: '免费获得「ARM NEON + Loop Tiling」与「软件预取」两张神卡',
        hintEn: 'Gain ARM NEON + Loop Tiling and Software Prefetch',
        outcome: {
          addCardIds: ['cpp_neon_tiling', 'cpp_prefetch'],
          resultText: '虽然没人看得懂寄存器调度顺序，但 Benchmark 直接快了 35%！',
          resultTextEn: 'Nobody understands the register schedule, yet the benchmark just jumped 35%!',
        },
      },
      {
        id: 'autotune_tvm',
        label: '用现代 TVM 编译器重写',
        labelEn: 'Rewrite via TVM AutoTuner',
        hint: '花费 50 经费，获得遗物「TVM 自动算子调优器」',
        hintEn: 'Spend 50 Credits: gain TVM AutoTuner Relic',
        outcome: {
          creditsDelta: -50,
          addRelicId: 'relic_tvm_autotuner',
          resultText: '你跑了一整晚 AutoTVM 搜索，换来了可维护且同样极致的高效算子。',
          resultTextEn: 'An overnight AutoTVM search produced clean, blazing-fast schedules.',
        },
      },
    ],
  },
  {
    id: 'evt_supply_chip',
    code: 'EVT-04',
    title: '供应链紧急硬件替换',
    titleEn: 'Supply Chain Hardware Swap',
    domain: 'SILICON',
    story:
      '采购通知原定散热模组缺货，仓库里只剩一批工业级液冷头和一堆高端 LPDDR5X 颗粒可供紧急换装。',
    storyEn:
      'Procurement reports a heatsink shortage. Warehouse offers either micro-liquid loops or industrial LPDDR5X ECC modules.',
    choices: [
      {
        id: 'pick_liquid',
        label: '换装铜管微液冷散热',
        labelEn: 'Install Micro-Liquid Loop',
        hint: '获得遗物「铜管微液冷散热」',
        hintEn: 'Gain Copper Micro-Liquid Loop Relic',
        outcome: {
          addRelicId: 'relic_liquid_cool',
          resultText: '液冷泵启动发出令人安心的嗡鸣，机箱温度曲线肉眼可见地平缓了。',
          resultTextEn: 'The liquid loop hums smoothly; thermal headroom expanded massively.',
        },
      },
      {
        id: 'pick_lpddr',
        label: '加装 LPDDR5X ECC 颗粒',
        labelEn: 'Install LPDDR5X ECC',
        hint: '获得遗物「工业级 LPDDR5X ECC 颗粒」',
        hintEn: 'Gain Industrial LPDDR5X ECC Relic',
        outcome: {
          addRelicId: 'relic_ecc_lpddr',
          resultText: '显存墙直接拔高 200MB，OOM 警报终于离你远了一步。',
          resultTextEn: '+200MB RAM ceiling and extra bandwidth — OOM anxiety subsides.',
        },
      },
    ],
  },
  {
    id: 'evt_kernel_panic_prod',
    code: 'EVT-05',
    title: '量产前夜的幽灵 Kernel Panic',
    titleEn: 'Midnight Kernel Panic Before Launch',
    domain: 'KERNEL',
    story:
      '距离最终量产验收只剩 6 小时，测试车每隔 40 分钟随机宕机一次，dmesg 指向网络协议栈与 OOM。',
    storyEn:
      '6 hours before final sign-off, the test rig panics every 40 minutes. dmesg points to the network stack and OOM.',
    choices: [
      {
        id: 'deploy_xdp',
        label: '重构为 eBPF/XDP + OOM 护盾',
        labelEn: 'Deploy eBPF/XDP + OOM Shield',
        hint: '获得「eBPF / XDP 内核旁路」和「oom_score_adj -900」',
        hintEn: 'Gain eBPF/XDP Bypass & oom_score_adj -900',
        outcome: {
          addCardIds: ['net_xdp_bypass', 'ker_oom_adj'],
          resultText: '绕过脆弱协议栈并锁定 OOM 权重后，拷机连续 12 小时零报错！',
          resultTextEn: 'Bypassing the stack and locking oom_score_adj gave 12 hours of zero-crash soak.',
        },
      },
      {
        id: 'buy_rdma',
        label: '直接上钞能力换 RDMA 网卡',
        labelEn: 'Throw Budget at an RDMA NIC',
        hint: '花费 60 经费，获得遗物「RDMA 零拷贝智能网卡」',
        hintEn: 'Spend 60 Credits: gain RDMA Zero-Copy NIC Relic',
        outcome: {
          creditsDelta: -60,
          addRelicId: 'relic_rdma_nic',
          resultText: '硬件卸载直接抹平了协议栈抖动，钞能力有时确实是最快的架构方案。',
          resultTextEn: 'Hardware offload flattened the jitter curve instantly.',
        },
      },
    ],
  },
  {
    id: 'evt_investor_demo',
    code: 'EVT-06',
    title: '学术大牛来访实验室',
    titleEn: 'Distinguished Architect Lab Visit',
    domain: 'VLA',
    story:
      '一位具身智能顶会大牛参观你们的端侧 VLA 平台，看完 Roofline 监控后随手在白板上写了两套前沿加速架构。',
    storyEn:
      'A renowned Embodied AI architect inspects your Roofline scope and sketches two cutting-edge acceleration designs on the whiteboard.',
    choices: [
      {
        id: 'pick_dual_sys',
        label: '落地「快慢双系统解耦」',
        labelEn: 'Adopt Dual-System (Sys1+Sys2)',
        hint: '获得稀有卡「快慢双系统解耦 (Sys1+Sys2)」',
        hintEn: 'Gain Dual-System (Sys1+Sys2) PATCH card',
        outcome: {
          addCardIds: ['vla_sys1_sys2'],
          resultText: '大小脑解耦后，高频伺服再也不用干等大模型吐 Token 了！',
          resultTextEn: 'With fast/slow decoupling, high-rate servo loops never stall on slow planning!',
        },
      },
      {
        id: 'pick_spec_moe',
        label: '落地「投机解码 + 3D SRAM」思路',
        labelEn: 'Adopt Speculative Decoding',
        hint: '获得「Speculative Decoding 投机解码」+ 70 研发经费',
        hintEn: 'Gain Speculative Decoding + 70 Credits',
        outcome: {
          creditsDelta: 70,
          addCardIds: ['dep_spec_decode'],
          resultText: '无损精度的投机解码让端侧吞吐直接起飞！',
          resultTextEn: 'Lossless speculative decoding sent edge throughput soaring!',
        },
      },
    ],
  },
];

export const EVENT_REGISTRY: Record<string, RandomEventDef> = Object.fromEntries(
  EVENT_LIST.map((e) => [e.id, e]),
);
