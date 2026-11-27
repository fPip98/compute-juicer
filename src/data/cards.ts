import { CardDef } from '../engine/types';

export const CARD_LIST: CardDef[] = [
  // ==================== 1. SILICON (硅片与嵌入式硬件) ====================
  {
    id: 'sil_dvfs_turbo',
    code: 'SIL-01',
    name: 'DVFS 涡轮超频',
    domain: 'SILICON',
    type: 'RUNTIME',
    cost: 0,
    icon: 'Zap',
    tags: ['0-COST', 'FLOPS++', 'TEMP++'],
    summary: '0 费超频：本回合峰值算力 ×1.35，但结温立刻 +15°C。',
    orderHint: '需在 COMPUTE-BOUND 下打出才有高收益；Memory-Bound 下超频几乎白发热！',
    knowledgeId: 'k_dvfs_roofline',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.peakFlopsG = Math.round(m.peakFlopsG * 1.35);
      m.tempC = Number((m.tempC + 15).toFixed(1));
      const isMemBound = ctx.telemetryBefore.bottleneck === 'MEMORY_BOUND';
      return {
        metrics: m,
        warningNotice: isMemBound
          ? '反模式警告：当前处于 MEMORY-BOUND（访存受限），强行超频算力无法降低延迟，徒增 15°C 热量！'
          : undefined,
        synergyNotice: !isMemBound
          ? '精准超频：处于 COMPUTE-BOUND 区间，算力提升直接转化为端到端延迟骤降！'
          : undefined,
      };
    },
  },
  {
    id: 'sil_pwm_fan',
    code: 'SIL-02',
    name: 'PWM 散热风扇满转',
    domain: 'SILICON',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Wind',
    tags: ['TEMP--', 'COOL+'],
    summary: '强力排热：芯片结温立刻 -14°C，解除热节流预警。',
    knowledgeId: 'k_thermal_throttling',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.tempC = Number(Math.max(m.ambientTempC, m.tempC - 14).toFixed(1));
      return {
        metrics: m,
        synergyNotice: ctx.telemetryBefore.isThermalThrottled
          ? '解除热节流预警：结温回落，芯片算力恢复正常频率！'
          : undefined,
      };
    },
  },
  {
    id: 'sil_npu_offload',
    code: 'SIL-03',
    name: 'NPU 异构算子卸载',
    domain: 'SILICON',
    type: 'PATCH',
    cost: 2,
    icon: 'Cpu',
    tags: ['PATCH', 'FLOPS++', 'PWR-'],
    summary: '常驻补丁：将视觉主干卸载至专用 NPU，峰值算力 +450 GFLOPs/s，功耗 -4W。',
    knowledgeId: 'k_npu_offload',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.peakFlopsG += 450;
      m.powerW = Math.max(8, m.powerW - 4);
      m.flags['npu_offload'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'sil_undervolt',
    code: 'SIL-04',
    name: 'PMIC 动态降压',
    domain: 'SILICON',
    type: 'PATCH',
    cost: 1,
    icon: 'BatteryCharging',
    tags: ['PATCH', 'PWR--', 'TEMP-'],
    summary: '常驻补丁：优化 PMIC 供电曲线，功耗 -6W、结温 -5°C，峰值算力微降 6%。',
    knowledgeId: 'k_dvfs_roofline',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.powerW = Math.max(6, m.powerW - 6);
      m.peakFlopsG = Math.round(m.peakFlopsG * 0.94);
      m.tempC = Number(Math.max(m.ambientTempC, m.tempC - 5).toFixed(1));
      return { metrics: m };
    },
  },
  {
    id: 'sil_sram_scratchpad',
    code: 'SIL-05',
    name: '片上 SRAM 暂存区锁定',
    domain: 'SILICON',
    type: 'PATCH',
    cost: 2,
    icon: 'HardDrive',
    tags: ['PATCH', 'BW++', 'BYTES-'],
    summary: '常驻补丁：将高频激活张量锁进片上 SRAM，有效带宽 +24 GB/s，访存量 ×0.88。',
    knowledgeId: 'k_sram_scratchpad',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.bandwidthGBs = Number((m.bandwidthGBs + 24).toFixed(1));
      m.bytesMB = Math.round(m.bytesMB * 0.88);
      m.flags['sram_scratchpad'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'sil_clock_gating',
    code: 'SIL-06',
    name: '空闲单元时钟门控',
    domain: 'SILICON',
    type: 'RUNTIME',
    cost: 0,
    icon: 'Power',
    tags: ['0-COST', 'TEMP-', 'DRAW+1'],
    summary: '0 费关断闲置外设时钟：结温 -8°C，下波次多抽 1 张牌。',
    knowledgeId: 'k_clock_gating',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.tempC = Number(Math.max(m.ambientTempC, m.tempC - 8).toFixed(1));
      return { metrics: m, extraDraw: 1 };
    },
  },
  {
    id: 'sil_pcie_gen5',
    code: 'SIL-07',
    name: 'PCIe P2P DMA 直通',
    domain: 'SILICON',
    type: 'PATCH',
    cost: 1,
    icon: 'ArrowLeftRight',
    tags: ['PATCH', 'COPY--', 'BW+'],
    summary: '常驻补丁：外设与加速卡 PCIe Peer-to-Peer 直连，拷贝延迟 -2.5ms、带宽 +12 GB/s。',
    knowledgeId: 'k_pcie_p2p',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioCopyMs = Number(Math.max(0, m.ioCopyMs - 2.5).toFixed(2));
      m.bandwidthGBs = Number((m.bandwidthGBs + 12).toFixed(1));
      return { metrics: m };
    },
  },
  {
    id: 'sil_liquid_metal',
    code: 'SIL-08',
    name: '相变液金导热改装',
    domain: 'SILICON',
    type: 'PATCH',
    cost: 1,
    icon: 'Thermometer',
    tags: ['PATCH', 'COOL++', 'TEMP-'],
    summary: '常驻补丁：大幅降低封装热阻，散热系数 ×1.45，热节流阈值提升 +5°C（至 90°C）。',
    knowledgeId: 'k_thermal_throttling',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.coolingFactor = Number((m.coolingFactor * 1.45).toFixed(2));
      m.throttleTempC += 5;
      return { metrics: m };
    },
  },

  // ==================== 2. KERNEL (Linux 内核与驱动) ====================
  {
    id: 'ker_v4l2_dmabuf',
    code: 'KER-01',
    name: 'V4L2 DMABUF 零拷贝',
    domain: 'KERNEL',
    type: 'PATCH',
    cost: 1,
    icon: 'Layers',
    tags: ['PATCH', 'COPY--', 'RAM-'],
    summary: '常驻补丁：相机驱动直接共享物理页给 NPU/GPU，拷贝延迟 -4.0ms，缓冲内存 -45MB。',
    orderHint: '部署后再运行 ARM NEON 预处理可触发零拷贝直通协同！',
    knowledgeId: 'k_v4l2_dmabuf',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioCopyMs = Number(Math.max(0, m.ioCopyMs - 4.0).toFixed(2));
      m.ramBuffersMB = Math.max(10, m.ramBuffersMB - 45);
      m.flags['v4l2_zero_copy'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'ker_preempt_rt',
    code: 'KER-02',
    name: 'PREEMPT_RT + 绑核隔离',
    domain: 'KERNEL',
    type: 'PATCH',
    cost: 2,
    icon: 'ShieldCheck',
    tags: ['PATCH', 'JITTER--', 'IMMUNE'],
    summary: '常驻补丁：实时抢占内核 + isolcpus 绑核，OS 抖动压至 ≤0.8ms，永久免疫「进程抢占/OTA」故障（算力 -6%）。',
    knowledgeId: 'k_preempt_rt',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.osJitterMs = Math.min(m.osJitterMs, 0.8);
      m.osBaseMs = Number(Math.max(0.5, m.osBaseMs - 0.8).toFixed(2));
      m.peakFlopsG = Math.round(m.peakFlopsG * 0.94);
      m.flags['preempt_rt'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'ker_threaded_irq',
    code: 'KER-03',
    name: '中断底半部线程化',
    domain: 'KERNEL',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Activity',
    tags: ['JITTER--', 'CLEAR-IRQ'],
    summary: '拆分硬中断顶/底半部：本回合 OS 抖动 -3.5ms，并清除手牌中的「中断风暴」脏卡。',
    knowledgeId: 'k_irq_split',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.osJitterMs = Number(Math.max(0.4, m.osJitterMs - 3.5).toFixed(2));
      return {
        metrics: m,
        clearFaultTag: 'irq_storm',
      };
    },
  },
  {
    id: 'ker_cgroup_reclaim',
    code: 'KER-04',
    name: 'cgroup 内存回收',
    domain: 'KERNEL',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Trash2',
    tags: ['RAM--', 'LEAK--', 'DRAW+1'],
    summary: '强杀后台非关键容器并回收页缓存：清空已泄漏内存（最高 -140MB）并下波次多抽 1 张牌。',
    knowledgeId: 'k_oom_cgroup',
    apply: (ctx) => {
      const m = ctx.metrics;
      const freed = Math.min(140, m.ramLeakedMB + m.ramFragMB);
      const leakCut = Math.min(140, m.ramLeakedMB);
      m.ramLeakedMB = Math.max(0, m.ramLeakedMB - leakCut);
      m.ramFragMB = Math.max(0, m.ramFragMB - (freed - leakCut));
      return {
        metrics: m,
        extraDraw: 1,
        clearFaultTag: 'mem_leak',
      };
    },
  },
  {
    id: 'ker_hugepages',
    code: 'KER-05',
    name: '2MB HugePages 大页映射',
    domain: 'KERNEL',
    type: 'PATCH',
    cost: 1,
    icon: 'Box',
    tags: ['PATCH', 'BW+', 'OS-'],
    summary: '常驻补丁：大幅降低 TLB Miss 与页表遍历开销，有效带宽 +16 GB/s、OS 调度延迟 -1.0ms。',
    knowledgeId: 'k_hugepages',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.bandwidthGBs = Number((m.bandwidthGBs + 16).toFixed(1));
      m.osBaseMs = Number(Math.max(0.3, m.osBaseMs - 1.0).toFixed(2));
      m.flags['hugepages'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'ker_dma_sg',
    code: 'KER-06',
    name: 'DMA Scatter-Gather 链表',
    domain: 'KERNEL',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Link',
    tags: ['COPY--', 'BYTES-'],
    summary: '离散物理页硬件链表直传：本回合拷贝延迟 -2.8ms、访存搬运量 ×0.88。',
    knowledgeId: 'k_dma_sg',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioCopyMs = Number(Math.max(0, m.ioCopyMs - 2.8).toFixed(2));
      m.bytesMB = Math.round(m.bytesMB * 0.88);
      return { metrics: m };
    },
  },
  {
    id: 'ker_rcu_lockless',
    code: 'KER-07',
    name: 'RCU 无锁读路径',
    domain: 'KERNEL',
    type: 'RUNTIME',
    cost: 0,
    icon: 'Unlock',
    tags: ['0-COST', 'OS-', 'JITTER-'],
    summary: '0 费内核读写分离：本回合 OS 基础延迟 -1.2ms、OS 抖动 -1.5ms。',
    knowledgeId: 'k_rcu_lockless',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.osBaseMs = Number(Math.max(0.2, m.osBaseMs - 1.2).toFixed(2));
      m.osJitterMs = Number(Math.max(0.2, m.osJitterMs - 1.5).toFixed(2));
      return { metrics: m };
    },
  },
  {
    id: 'ker_oom_adj',
    code: 'KER-08',
    name: 'oom_score_adj -900 护盾',
    domain: 'KERNEL',
    type: 'PATCH',
    cost: 1,
    icon: 'Shield',
    tags: ['PATCH', 'RAM-CAP+'],
    summary: '常驻补丁：调低核心进程 OOM 查杀权重并清退后台缓存，可用 RAM 上限 +120MB。',
    knowledgeId: 'k_oom_cgroup',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ramCapMB += 120;
      m.flags['oom_protected'] = true;
      return { metrics: m };
    },
  },

  // ==================== 3. NETWORK (嵌入式网络与总线) ====================
  {
    id: 'net_iceoryx_shm',
    code: 'NET-01',
    name: 'ROS2 Iceoryx 共享内存',
    domain: 'NETWORK',
    type: 'PATCH',
    cost: 1,
    icon: 'Share2',
    tags: ['PATCH', 'NET--', 'RAM+'],
    summary: '常驻补丁：DDS 节点间改走零拷贝共享内存，总线延迟 -3.8ms，预分配共享池占用 +55MB RAM。',
    knowledgeId: 'k_dds_shm',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioNetBusMs = Number(Math.max(0.5, m.ioNetBusMs - 3.8).toFixed(2));
      m.ramBuffersMB += 55;
      m.flags['dds_shm'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'net_tcp_nodelay',
    code: 'NET-02',
    name: '禁用 Nagle (TCP_NODELAY)',
    domain: 'NETWORK',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Radio',
    tags: ['NET--', 'CLEAR-TCP'],
    summary: '关闭小包合并延迟：本回合网络总线延迟 -3.0ms，并清除「TCP 队头阻塞」故障影响。',
    knowledgeId: 'k_tcp_nodelay',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioNetBusMs = Number(Math.max(0.4, m.ioNetBusMs - 3.0).toFixed(2));
      m.flags['tcp_nodelay_active'] = true;
      return {
        metrics: m,
        clearFaultTag: 'tcp_hol',
      };
    },
  },
  {
    id: 'net_ethercat_sync',
    code: 'NET-03',
    name: 'EtherCAT 分布式时钟',
    domain: 'NETWORK',
    type: 'PATCH',
    cost: 1,
    icon: 'Clock',
    tags: ['PATCH', 'NET--', 'ACC+'],
    summary: '常驻补丁：纳秒级伺服总线同步，总线延迟 -2.0ms，末端控制精度 +2.5%。',
    knowledgeId: 'k_ethercat_dc',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioNetBusMs = Number(Math.max(0.3, m.ioNetBusMs - 2.0).toFixed(2));
      m.accuracy = Number(Math.min(m.accuracyCap, m.accuracy + 2.5).toFixed(1));
      m.flags['ethercat_dc'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'net_xdp_bypass',
    code: 'NET-04',
    name: 'eBPF / XDP 内核旁路',
    domain: 'NETWORK',
    type: 'PATCH',
    cost: 2,
    icon: 'Zap',
    tags: ['PATCH', 'NET--', 'COPY--'],
    summary: '常驻补丁：网卡驱动层直接处理传感器帧，绕过内核协议栈：网络延迟 -3.2ms、拷贝延迟 -2.0ms。',
    knowledgeId: 'k_xdp_bypass',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioNetBusMs = Number(Math.max(0.3, m.ioNetBusMs - 3.2).toFixed(2));
      m.ioCopyMs = Number(Math.max(0, m.ioCopyMs - 2.0).toFixed(2));
      m.flags['xdp_bypass'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'net_canfd_arb',
    code: 'NET-05',
    name: 'CAN-FD 高优帧仲裁',
    domain: 'NETWORK',
    type: 'RUNTIME',
    cost: 0,
    icon: 'Send',
    tags: ['0-COST', 'NET-', 'ACC+'],
    summary: '0 费置顶关节控制帧 ID：本回合总线延迟 -1.8ms、控制精度 +1.5%。',
    knowledgeId: 'k_canfd_arb',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioNetBusMs = Number(Math.max(0.3, m.ioNetBusMs - 1.8).toFixed(2));
      m.accuracy = Number(Math.min(m.accuracyCap, m.accuracy + 1.5).toFixed(1));
      return { metrics: m };
    },
  },
  {
    id: 'net_tsn_gate',
    code: 'NET-06',
    name: 'TSN 时间敏感门控调度',
    domain: 'NETWORK',
    type: 'PATCH',
    cost: 1,
    icon: 'CalendarClock',
    tags: ['PATCH', 'IMMUNE-NET', 'JITTER-'],
    summary: '常驻补丁：IEEE 802.1Qbv 时隙保护，免疫「弱网丢包」故障，OS 抖动 -1.5ms。',
    knowledgeId: 'k_tsn_gate',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.osJitterMs = Number(Math.max(0.3, m.osJitterMs - 1.5).toFixed(2));
      m.flags['tsn_gate'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'net_udp_fec',
    code: 'NET-07',
    name: 'UDP + 前向纠错降级',
    domain: 'NETWORK',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Wifi',
    tags: ['NET--', 'ACC+'],
    summary: '放弃 TCP 重传改走 UDP+FEC：本回合网络延迟 -2.6ms、弱网丢包精度补偿 +2.5%。',
    knowledgeId: 'k_udp_fec',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioNetBusMs = Number(Math.max(0.4, m.ioNetBusMs - 2.6).toFixed(2));
      m.accuracy = Number(Math.min(m.accuracyCap, m.accuracy + 2.5).toFixed(1));
      return { metrics: m, clearFaultTag: 'tcp_hol' };
    },
  },

  // ==================== 4. CPP (C++ 与微架构) ====================
  {
    id: 'cpp_neon_tiling',
    code: 'CPP-01',
    name: 'ARM NEON + Loop Tiling',
    domain: 'CPP',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Grid',
    tags: ['BW++', 'FLOPS+'],
    summary: '向量化 + 缓存分块：本回合有效带宽 ×1.28、有效算力 ×1.12。',
    orderHint: '若已部署 V4L2 零拷贝（或在它之后打出），额外减少 1.5ms 预处理延迟！',
    knowledgeId: 'k_simd_tiling',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.bandwidthGBs = Number((m.bandwidthGBs * 1.28).toFixed(1));
      m.peakFlopsG = Math.round(m.peakFlopsG * 1.12);
      const hasZeroCopy =
        m.flags['v4l2_zero_copy'] || ctx.priorCardIds.includes('ker_v4l2_dmabuf');
      if (hasZeroCopy) {
        m.ioSensorMs = Number(Math.max(0.5, m.ioSensorMs - 1.5).toFixed(2));
      }
      return {
        metrics: m,
        synergyNotice: hasZeroCopy
          ? '零拷贝直通协同：V4L2 DMABUF + NEON 就地预处理，采集延迟额外 -1.5ms！'
          : undefined,
      };
    },
  },
  {
    id: 'cpp_arena_pool',
    code: 'CPP-02',
    name: 'Arena 静态内存池',
    domain: 'CPP',
    type: 'PATCH',
    cost: 1,
    icon: 'Database',
    tags: ['PATCH', 'NO-FRAG', 'RAM+'],
    summary: '常驻补丁：接管高频 malloc/free，清空并永久免疫「内存碎片膨胀」，启动静态预留 +60MB RAM。',
    knowledgeId: 'k_arena_allocator',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ramFragMB = 0;
      m.ramBuffersMB += 60;
      m.flags['arena_pool'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'cpp_cache_align',
    code: 'CPP-03',
    name: 'Cache Line 对齐防伪共享',
    domain: 'CPP',
    type: 'RUNTIME',
    cost: 0,
    icon: 'AlignJustify',
    tags: ['0-COST', 'BW+', 'JITTER-'],
    summary: '0 费微架构优化：alignas(64) 消除多核伪共享，本回合有效带宽 +16 GB/s，OS 抖动 -1.0ms。',
    knowledgeId: 'k_false_sharing',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.bandwidthGBs = Number((m.bandwidthGBs + 16).toFixed(1));
      m.osJitterMs = Number(Math.max(0.3, m.osJitterMs - 1.0).toFixed(2));
      return { metrics: m };
    },
  },
  {
    id: 'cpp_lockfree_spsc',
    code: 'CPP-04',
    name: '无锁环形队列 (SPSC)',
    domain: 'CPP',
    type: 'PATCH',
    cost: 1,
    icon: 'Repeat',
    tags: ['PATCH', 'COPY-', 'JITTER-'],
    summary: '常驻补丁：消除多线程互斥锁竞争，采集延迟 -1.8ms、OS 抖动 -1.2ms。',
    knowledgeId: 'k_lockfree_ring',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioSensorMs = Number(Math.max(0.5, m.ioSensorMs - 1.8).toFixed(2));
      m.osJitterMs = Number(Math.max(0.4, m.osJitterMs - 1.2).toFixed(2));
      m.flags['lockfree_spsc'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'cpp_prefetch',
    code: 'CPP-05',
    name: '软件预取 (__builtin_prefetch)',
    domain: 'CPP',
    type: 'RUNTIME',
    cost: 0,
    icon: 'FastForward',
    tags: ['0-COST', 'BW+', 'BYTES-'],
    summary: '0 费掩盖 DDR 访存延迟：本回合有效带宽 +14 GB/s，若处于 Memory-Bound 则额外 +10 GB/s！',
    knowledgeId: 'k_cpp_prefetch',
    apply: (ctx) => {
      const m = ctx.metrics;
      const isMem = ctx.telemetryBefore.bottleneck === 'MEMORY_BOUND';
      m.bandwidthGBs = Number((m.bandwidthGBs + (isMem ? 24 : 14)).toFixed(1));
      return {
        metrics: m,
        synergyNotice: isMem
          ? '命中 Memory-Bound 痛点！软件预取掩盖 DDR 延迟，带宽额外 +10 GB/s！'
          : undefined,
      };
    },
  },
  {
    id: 'cpp_branchless',
    code: 'CPP-06',
    name: 'Branchless 无分支优化',
    domain: 'CPP',
    type: 'RUNTIME',
    cost: 1,
    icon: 'GitCommit',
    tags: ['FLOPS++', 'DRAW+1'],
    summary: '用 CMOV/位运算消除分支预测失败冲刷：本回合峰值算力 ×1.18，下波次多抽 1 张牌。',
    knowledgeId: 'k_branchless',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.peakFlopsG = Math.round(m.peakFlopsG * 1.18);
      return { metrics: m, extraDraw: 1 };
    },
  },
  {
    id: 'cpp_std_span',
    code: 'CPP-07',
    name: 'std::span 零拷贝视图',
    domain: 'CPP',
    type: 'RUNTIME',
    cost: 0,
    icon: 'Eye',
    tags: ['0-COST', 'COPY-', 'RAM-'],
    summary: '0 费消除 std::vector 深拷贝：本回合拷贝延迟 -1.6ms、释放临时缓冲 35MB。',
    knowledgeId: 'k_std_span',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioCopyMs = Number(Math.max(0, m.ioCopyMs - 1.6).toFixed(2));
      m.ramBuffersMB = Math.max(10, m.ramBuffersMB - 35);
      return { metrics: m };
    },
  },
  {
    id: 'cpp_soa_layout',
    code: 'CPP-08',
    name: 'SoA 面向数据内存重排',
    domain: 'CPP',
    type: 'PATCH',
    cost: 1,
    icon: 'Columns',
    tags: ['PATCH', 'BW++', 'NO-THRASH'],
    summary: '常驻补丁：AoS 改 SoA 提升空间局部性，有效带宽 +20 GB/s，免疫「Cache 颠簸」故障。',
    knowledgeId: 'k_soa_layout',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.bandwidthGBs = Number((m.bandwidthGBs + 20).toFixed(1));
      m.flags['soa_layout'] = true;
      return { metrics: m };
    },
  },

  // ==================== 5. DEPLOY (端侧推理与编译) ====================
  {
    id: 'dep_qat_calib',
    code: 'DEP-01',
    name: 'QAT 量化感知校准',
    domain: 'DEPLOY',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Sliders',
    tags: ['ACC+', 'SYNERGY'],
    summary: '校准激活分布：本回合精度 +2.5%；若排在「量化卡」之前，可令后续量化精度损失减半！',
    orderHint: '务必排在 INT8 / INT4 量化卡之前！',
    knowledgeId: 'k_qat_quant',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.accuracy = Number(Math.min(m.accuracyCap, m.accuracy + 2.5).toFixed(1));
      const quantAlreadyRan =
        ctx.priorCardIds.includes('dep_int4_awq') ||
        ctx.priorCardIds.includes('dep_smoothquant_int8');
      return {
        metrics: m,
        warningNotice: quantAlreadyRan
          ? '顺序警告：QAT 校准排在了量化卡之后，无法挽回已经截断的权重精度！请将其拖到量化卡之前。'
          : undefined,
      };
    },
  },
  {
    id: 'dep_int4_awq',
    code: 'DEP-02',
    name: 'INT4 AWQ 权重量化',
    domain: 'DEPLOY',
    type: 'PATCH',
    cost: 1,
    icon: 'Minimize2',
    tags: ['PATCH', 'RAM--', 'BYTES--', 'ACC-'],
    summary: '常驻补丁：权重显存 ×0.42、访存搬运量 ×0.48，但精度 -5.5%（前置 QAT 校准时仅 -2.0%）。',
    orderHint: '极强的访存解压神卡！配合前置 QAT 可几乎无损突破 Memory-Bound。',
    knowledgeId: 'k_int4_awq',
    apply: (ctx) => {
      const m = ctx.metrics;
      const hasQat = ctx.priorCardIds.includes('dep_qat_calib');
      const accLoss = hasQat ? 2.0 : 5.5;
      m.ramWeightsMB = Math.round(m.ramWeightsMB * 0.42);
      m.bytesMB = Math.round(m.bytesMB * 0.48);
      m.accuracy = Number(Math.max(0, m.accuracy - accLoss).toFixed(1));
      m.flags['quant_int4'] = true;
      return {
        metrics: m,
        synergyNotice: hasQat
          ? 'QAT 保护生效！INT4 量化精度损耗从 -5.5% 大幅降低至 -2.0%！'
          : undefined,
      };
    },
  },
  {
    id: 'dep_flash_fusion',
    code: 'DEP-03',
    name: 'FlashAttention 算子融合',
    domain: 'DEPLOY',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Flame',
    tags: ['BYTES--', 'ROOFLINE'],
    summary: '将 QKV 留在片上 SRAM 计算，访存搬运量 ×0.58；若因此从 Memory-Bound 跃迁至 Compute-Bound，返还 1 点预算！',
    orderHint: '用来撬动 Roofline 拐点的核心卡，排在超频卡之前效果炸裂！',
    knowledgeId: 'k_flash_attention',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.bytesMB = Math.round(m.bytesMB * 0.58);
      const wasMem = ctx.telemetryBefore.bottleneck === 'MEMORY_BOUND';
      const newMemMs = m.bytesMB / Math.max(5, m.bandwidthGBs);
      const effPeak =
        m.peakFlopsG * (m.tempC >= m.throttleTempC ? 0.65 : 1.0);
      const newCompMs = (m.flopsG / Math.max(50, effPeak)) * 1000;
      const shiftedToCompute = wasMem && newCompMs >= newMemMs;
      return {
        metrics: m,
        cyclesRefund: shiftedToCompute ? 1 : 0,
        synergyNotice: shiftedToCompute
          ? 'Roofline 拐点突破！从 Memory-Bound 跃迁至 Compute-Bound，返还 1 点调度预算！'
          : undefined,
      };
    },
  },
  {
    id: 'dep_trt_graph',
    code: 'DEP-04',
    name: 'TensorRT Graph Capture',
    domain: 'DEPLOY',
    type: 'PATCH',
    cost: 1,
    icon: 'GitMerge',
    tags: ['PATCH', 'FLOPS-', 'OS-'],
    summary: '常驻补丁：静态图捕获消除逐算子 Kernel Launch 开销，FLOPs ×0.86、OS 调度延迟 -1.5ms。',
    knowledgeId: 'k_cuda_graph',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.flopsG = Number((m.flopsG * 0.86).toFixed(2));
      m.osBaseMs = Number(Math.max(0.4, m.osBaseMs - 1.5).toFixed(2));
      m.flags['trt_graph'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'dep_int2_yolo',
    code: 'DEP-05',
    name: '极限 INT2 暴力截断',
    domain: 'DEPLOY',
    type: 'RUNTIME',
    cost: 0,
    icon: 'AlertTriangle',
    tags: ['0-COST', 'BYTES---', 'ACC---'],
    summary: '0 费豪赌：访存搬运量 ×0.35、权重内存临时压缩，但精度暴跌 -13%（极易导致机械臂捏爆鸡蛋！）。',
    knowledgeId: 'k_int4_awq',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.bytesMB = Math.round(m.bytesMB * 0.35);
      m.ramWeightsMB = Math.round(m.ramWeightsMB * 0.6);
      m.accuracy = Number(Math.max(0, m.accuracy - 13).toFixed(1));
      return {
        metrics: m,
        warningNotice: '高危精度截断：模型已出现严重量化噪声，注意检查 Accuracy 是否跌破 SLA！',
      };
    },
  },
  {
    id: 'dep_smoothquant_int8',
    code: 'DEP-06',
    name: 'INT8 SmoothQuant 量化',
    domain: 'DEPLOY',
    type: 'PATCH',
    cost: 1,
    icon: 'Gauge',
    tags: ['PATCH', 'RAM-', 'BYTES-', 'FLOPS-'],
    summary: '常驻补丁：平衡激活离群点做 W8A8 量化，RAM ×0.65、Bytes ×0.65、FLOPs ×0.82，精度仅 -1.5%（前置 QAT 仅 -0.5%）。',
    knowledgeId: 'k_smoothquant',
    apply: (ctx) => {
      const m = ctx.metrics;
      const hasQat = ctx.priorCardIds.includes('dep_qat_calib');
      m.ramWeightsMB = Math.round(m.ramWeightsMB * 0.65);
      m.bytesMB = Math.round(m.bytesMB * 0.65);
      m.flopsG = Number((m.flopsG * 0.82).toFixed(2));
      m.accuracy = Number(Math.max(0, m.accuracy - (hasQat ? 0.5 : 1.5)).toFixed(1));
      return {
        metrics: m,
        synergyNotice: hasQat ? 'SmoothQuant + QAT 协同：几乎无损实现 W8A8 全栈提速！' : undefined,
      };
    },
  },
  {
    id: 'dep_spec_decode',
    code: 'DEP-07',
    name: 'Speculative Decoding 投机解码',
    domain: 'DEPLOY',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Sparkles',
    tags: ['BYTES--', 'FLOPS+', 'ACC=0'],
    summary: '小模型草拟 + 大模型并行校验：无损精度！本回合 Bytes ×0.62，但 FLOPs ×1.10。',
    knowledgeId: 'k_spec_decode',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.bytesMB = Math.round(m.bytesMB * 0.62);
      m.flopsG = Number((m.flopsG * 1.1).toFixed(2));
      return { metrics: m };
    },
  },
  {
    id: 'dep_static_plan',
    code: 'DEP-08',
    name: 'TVM 静态内存复用规划',
    domain: 'DEPLOY',
    type: 'PATCH',
    cost: 1,
    icon: 'Package',
    tags: ['PATCH', 'RAM--', 'TEMP-'],
    summary: '常驻补丁：编译期分析张量生命周期复用缓冲，缓冲内存 -90MB、减少动态分配功耗 -2W。',
    knowledgeId: 'k_tvm_static_plan',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ramBuffersMB = Math.max(10, m.ramBuffersMB - 90);
      m.powerW = Math.max(8, m.powerW - 2);
      return { metrics: m };
    },
  },
  {
    id: 'dep_lora_merge',
    code: 'DEP-09',
    name: 'LoRA 旁路权重合并',
    domain: 'DEPLOY',
    type: 'RUNTIME',
    cost: 0,
    icon: 'Combine',
    tags: ['0-COST', 'FLOPS-', 'BYTES-'],
    summary: '0 费离线融合 W + BA：消除推理期双分支开销，本回合 FLOPs ×0.90、Bytes ×0.90。',
    knowledgeId: 'k_lora_merge',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.flopsG = Number((m.flopsG * 0.9).toFixed(2));
      m.bytesMB = Math.round(m.bytesMB * 0.9);
      return { metrics: m };
    },
  },

  // ==================== 6. VLA (模型架构与具身) ====================
  {
    id: 'vla_token_prune',
    code: 'VLA-01',
    name: '视觉 Token 动态剪枝',
    domain: 'VLA',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Scissors',
    tags: ['FLOPS--', 'BYTES-', 'ACC-'],
    summary: '丢弃背景冗余图像 Patch：本回合 FLOPs ×0.68、Bytes ×0.82，精度微降 -1.5%。',
    knowledgeId: 'k_token_pruning',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.flopsG = Number((m.flopsG * 0.68).toFixed(2));
      m.bytesMB = Math.round(m.bytesMB * 0.82);
      m.accuracy = Number(Math.max(0, m.accuracy - 1.5).toFixed(1));
      return { metrics: m };
    },
  },
  {
    id: 'vla_paged_kv',
    code: 'VLA-02',
    name: 'PagedAttention KV 管理',
    domain: 'VLA',
    type: 'PATCH',
    cost: 1,
    icon: 'BookOpen',
    tags: ['PATCH', 'KV-RAM--', 'BYTES-'],
    summary: '常驻补丁：分页管理长上下文 KV Cache，KV 显存 ×0.50、访存搬运量 ×0.88。',
    knowledgeId: 'k_paged_attention',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ramKvCacheMB = Math.round(m.ramKvCacheMB * 0.5);
      m.bytesMB = Math.round(m.bytesMB * 0.88);
      m.flags['paged_kv'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'vla_action_chunk',
    code: 'VLA-03',
    name: 'Action Chunking 动作分块',
    domain: 'VLA',
    type: 'PATCH',
    cost: 2,
    icon: 'FastForward',
    tags: ['PATCH', 'SLA+5ms', 'ACC-'],
    summary: '常驻补丁：单次推理预测未来 K 步动作，本关 SLA 延迟上限放宽 +5.0ms，精度 -2.5%。',
    knowledgeId: 'k_action_chunking',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.accuracy = Number(Math.max(0, m.accuracy - 2.5).toFixed(1));
      m.flags['action_chunking'] = true;
      return {
        metrics: m,
        slaLatencyBonusMs: 5.0,
      };
    },
  },
  {
    id: 'vla_ensemble_verify',
    code: 'VLA-04',
    name: '触觉力反馈闭环校验',
    domain: 'VLA',
    type: 'RUNTIME',
    cost: 1,
    icon: 'Hand',
    tags: ['ACC++', 'FLOPS+'],
    summary: '融合指尖力觉传感器二次校验：本回合精度 +5.0%，但增加计算量 +2.5 GFLOPs。',
    knowledgeId: 'k_vla_tactile',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.accuracy = Number(Math.min(m.accuracyCap, m.accuracy + 5.0).toFixed(1));
      m.flopsG = Number((m.flopsG + 2.5).toFixed(2));
      return { metrics: m };
    },
  },
  {
    id: 'vla_moe_route',
    code: 'VLA-05',
    name: 'MoE 稀疏专家路由',
    domain: 'VLA',
    type: 'PATCH',
    cost: 2,
    icon: 'GitBranch',
    tags: ['PATCH', 'FLOPS--', 'RAM+'],
    summary: '常驻补丁：每 Token 仅激活 Top-2 专家，FLOPs ×0.58，但总专家权重常驻 RAM +110MB。',
    knowledgeId: 'k_moe_routing',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.flopsG = Number((m.flopsG * 0.58).toFixed(2));
      m.ramWeightsMB += 110;
      m.flags['moe_routing'] = true;
      return { metrics: m };
    },
  },
  {
    id: 'vla_gqa_head',
    code: 'VLA-06',
    name: 'GQA 分组查询注意力',
    domain: 'VLA',
    type: 'PATCH',
    cost: 1,
    icon: 'Network',
    tags: ['PATCH', 'KV-RAM--', 'BYTES-'],
    summary: '常驻补丁：共享 KV 头数，KV Cache 显存 ×0.55、访存搬运量 ×0.84，精度仅 -0.8%。',
    knowledgeId: 'k_gqa_head',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ramKvCacheMB = Math.round(m.ramKvCacheMB * 0.55);
      m.bytesMB = Math.round(m.bytesMB * 0.84);
      m.accuracy = Number(Math.max(0, m.accuracy - 0.8).toFixed(1));
      return { metrics: m };
    },
  },
  {
    id: 'vla_sys1_sys2',
    code: 'VLA-07',
    name: '快慢双系统解耦 (Sys1+Sys2)',
    domain: 'VLA',
    type: 'PATCH',
    cost: 2,
    icon: 'Brain',
    tags: ['PATCH', 'SLA+4ms', 'ACC+'],
    summary: '常驻补丁：高频小脑控姿态 + 低频大脑做规划，SLA 放宽 +4.0ms 且精度 +2.0%！',
    knowledgeId: 'k_dual_system',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.accuracy = Number(Math.min(m.accuracyCap, m.accuracy + 2.0).toFixed(1));
      m.flags['dual_system'] = true;
      return { metrics: m, slaLatencyBonusMs: 4.0 };
    },
  },
  {
    id: 'vla_early_exit',
    code: 'VLA-08',
    name: '动态 Early-Exit 浅层早退',
    domain: 'VLA',
    type: 'RUNTIME',
    cost: 0,
    icon: 'LogOut',
    tags: ['0-COST', 'FLOPS-', 'ACC-'],
    summary: '0 费跳过深层 Transformer：简单帧提前退出，本回合 FLOPs ×0.75、Bytes ×0.80，精度 -3.0%。',
    knowledgeId: 'k_early_exit',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.flopsG = Number((m.flopsG * 0.75).toFixed(2));
      m.bytesMB = Math.round(m.bytesMB * 0.8);
      m.accuracy = Number(Math.max(0, m.accuracy - 3.0).toFixed(1));
      return { metrics: m };
    },
  },

  // ==================== FAULT 脏卡 (线上故障与技术债) ====================
  {
    id: 'fault_card_memleak',
    code: 'ERR-01',
    name: '僵尸内存泄漏',
    domain: 'KERNEL',
    type: 'FAULT',
    cost: 1,
    icon: 'Bug',
    tags: ['FAULT', 'LEAK--'],
    faultTag: 'mem_leak',
    summary: '故障脏卡：占用抽牌位；耗费 1 点预算手动排查并释放 80MB 泄漏内存。',
    knowledgeId: 'k_oom_cgroup',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ramLeakedMB = Math.max(0, m.ramLeakedMB - 80);
      return { metrics: m };
    },
  },
  {
    id: 'fault_card_tcp_hol',
    code: 'ERR-02',
    name: 'TCP 队头阻塞包',
    domain: 'NETWORK',
    type: 'FAULT',
    cost: 1,
    icon: 'WifiOff',
    tags: ['FAULT', 'NET-'],
    faultTag: 'tcp_hol',
    summary: '故障脏卡：耗费 1 点预算重传清队列，降低 2.0ms 阻塞延迟（可用 TCP_NODELAY 顺带清除）。',
    knowledgeId: 'k_tcp_nodelay',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.ioNetBusMs = Number(Math.max(0.5, m.ioNetBusMs - 2.0).toFixed(2));
      return { metrics: m };
    },
  },
  {
    id: 'fault_card_irq_storm',
    code: 'ERR-03',
    name: '高频中断风暴',
    domain: 'KERNEL',
    type: 'FAULT',
    cost: 1,
    icon: 'ZapOff',
    tags: ['FAULT', 'JITTER-'],
    faultTag: 'irq_storm',
    summary: '故障脏卡：耗费 1 点预算屏蔽异常外设 IRQ，降低 2.5ms 抖动（可用中断底半部线程化顺带清除）。',
    knowledgeId: 'k_irq_split',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.osJitterMs = Number(Math.max(0.4, m.osJitterMs - 2.5).toFixed(2));
      return { metrics: m };
    },
  },
  {
    id: 'fault_card_4k_bloat',
    code: 'ERR-04',
    name: '4K 冗余视觉分支（技术债）',
    domain: 'VLA',
    type: 'FAULT',
    cost: 1,
    icon: 'Camera',
    tags: ['FAULT', 'DEBT'],
    faultTag: 'pm_debt',
    summary: 'PM 强塞的技术债：白占抽牌位；花 1 点预算本回合临时下采样至 1080p（Bytes ×0.90），建议去营地重构删掉！',
    knowledgeId: 'k_token_pruning',
    apply: (ctx) => {
      const m = ctx.metrics;
      m.bytesMB = Math.round(m.bytesMB * 0.9);
      return { metrics: m };
    },
  },
];

export const CARD_REGISTRY: Record<string, CardDef> = Object.fromEntries(
  CARD_LIST.map((c) => [c.id, c]),
);
