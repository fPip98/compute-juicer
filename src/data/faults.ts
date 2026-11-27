import { FaultDef } from '../engine/types';

export const FAULT_LIST: FaultDef[] = [
  {
    id: 'fault_logrotate_preempt',
    name: '后台日志压缩抢占 CPU',
    domain: 'KERNEL',
    severity: 'WARNING',
    icon: 'Terminal',
    intentText: 'OS 调度抖动 +5.5ms（PREEMPT_RT 可免疫）',
    knowledgeId: 'k_preempt_rt',
    apply: (m) => {
      if (m.flags['preempt_rt']) {
        return {
          metrics: m,
          logDetail: '实时内核隔离生效，后台进程抢占被拦截',
          blockedBy: 'PREEMPT_RT + 绑核隔离',
        };
      }
      m.osJitterMs = Number((m.osJitterMs + 5.5).toFixed(2));
      return {
        metrics: m,
        logDetail: 'systemd-journald 抢占核心，P99 调度抖动暴涨 +5.5ms！',
      };
    },
  },
  {
    id: 'fault_mem_frag_leak',
    name: 'C++ 动态分配内存泄漏',
    domain: 'CPP',
    severity: 'CRITICAL',
    icon: 'AlertOctagon',
    intentText: '泄漏 +110MB RAM 并塞入脏卡（Arena 池可减半）',
    knowledgeId: 'k_arena_allocator',
    injectFaultCardId: 'fault_card_memleak',
    apply: (m) => {
      if (m.flags['arena_pool']) {
        m.ramLeakedMB += 40;
        return {
          metrics: m,
          logDetail: 'Arena 内存池拦截了碎片膨胀，仅产生 40MB 轻微残留',
        };
      }
      m.ramFragMB += 60;
      m.ramLeakedMB += 50;
      return {
        metrics: m,
        logDetail: '频繁 new/delete 导致内存碎片 +60MB、泄漏 +50MB！',
      };
    },
  },
  {
    id: 'fault_thermal_wave',
    name: '产线机箱高温热浪',
    domain: 'SILICON',
    severity: 'WARNING',
    icon: 'Thermometer',
    intentText: '芯片结温飙升 +12°C，警惕 85°C 热节流降频！',
    knowledgeId: 'k_thermal_throttling',
    apply: (m) => {
      m.tempC = Number((m.tempC + 12).toFixed(1));
      return {
        metrics: m,
        logDetail: '机箱风道受阻，芯片结温骤升 +12°C！',
      };
    },
  },
  {
    id: 'fault_tcp_hol',
    name: '传感器总线 TCP 队头阻塞',
    domain: 'NETWORK',
    severity: 'WARNING',
    icon: 'WifiOff',
    intentText: '网络延迟 +4.5ms 并塞入脏卡（TCP_NODELAY / 共享内存可挡）',
    knowledgeId: 'k_tcp_nodelay',
    injectFaultCardId: 'fault_card_tcp_hol',
    apply: (m) => {
      if (m.flags['dds_shm'] || m.flags['tcp_nodelay_active']) {
        return {
          metrics: m,
          logDetail: '零拷贝共享内存/TCP_NODELAY 规避了协议栈队头阻塞',
          blockedBy: m.flags['dds_shm'] ? 'ROS2 Iceoryx 共享内存' : 'TCP_NODELAY',
        };
      }
      m.ioNetBusMs = Number((m.ioNetBusMs + 4.5).toFixed(2));
      return {
        metrics: m,
        logDetail: 'Nagle 算法与弱网重传触发队头阻塞，通信延迟 +4.5ms！',
      };
    },
  },
  {
    id: 'fault_4k_burst',
    name: '多目相机突发高分辨率帧',
    domain: 'VLA',
    severity: 'CRITICAL',
    icon: 'Camera',
    intentText: '访存搬运 +280MB、算力负载 +6 GFLOPs，极易触发 Memory-Bound！',
    knowledgeId: 'k_token_pruning',
    apply: (m) => {
      m.bytesMB += 280;
      m.flopsG = Number((m.flopsG + 6).toFixed(2));
      return {
        metrics: m,
        logDetail: '双目 4K 图像涌入，视觉 Token 激增，访存与计算双承压！',
      };
    },
  },
  {
    id: 'fault_irq_storm',
    name: '高频 IMU/雷达中断风暴',
    domain: 'KERNEL',
    severity: 'CRITICAL',
    icon: 'ZapOff',
    intentText: 'OS 抖动 +5.0ms 并塞入「中断风暴」脏卡',
    knowledgeId: 'k_irq_split',
    injectFaultCardId: 'fault_card_irq_storm',
    apply: (m) => {
      m.osJitterMs = Number((m.osJitterMs + 5.0).toFixed(2));
      return {
        metrics: m,
        logDetail: '千兆激光雷达硬中断疯狂抢占 CPU0，抖动 +5.0ms！',
      };
    },
  },
  {
    id: 'fault_kv_bloat',
    name: '长上下文 KV Cache 急剧膨胀',
    domain: 'VLA',
    severity: 'CRITICAL',
    icon: 'Database',
    intentText: 'KV 显存 +140MB、访存 +220MB（PagedAttention 可减半）',
    knowledgeId: 'k_paged_attention',
    apply: (m) => {
      const factor = m.flags['paged_kv'] ? 0.5 : 1.0;
      m.ramKvCacheMB += Math.round(140 * factor);
      m.bytesMB += Math.round(220 * factor);
      return {
        metrics: m,
        logDetail: m.flags['paged_kv']
          ? 'PagedAttention 分页机制将长上下文显存膨胀压低了一半！'
          : '长时序历史帧累积，KV Cache 激增 +140MB、访存 +220MB！',
      };
    },
  },
  {
    id: 'fault_cache_thrash',
    name: 'L2 Cache 颠簸 (Thrashing)',
    domain: 'CPP',
    severity: 'WARNING',
    icon: 'Grid',
    intentText: '有效带宽暴降 -22 GB/s（SoA 内存布局可免疫）',
    knowledgeId: 'k_simd_tiling',
    apply: (m) => {
      if (m.flags['soa_layout']) {
        return {
          metrics: m,
          logDetail: 'SoA 面向数据布局保持高空间局部性，免疫了 Cache 颠簸',
          blockedBy: 'SoA 面向数据内存重排',
        };
      }
      m.bandwidthGBs = Math.max(25, Number((m.bandwidthGBs - 22).toFixed(1)));
      return {
        metrics: m,
        logDetail: '跨步随机访存引发严重 Cache Thrashing，有效带宽骤降 -22 GB/s！',
      };
    },
  },
  {
    id: 'fault_weak_net_loss',
    name: '弱网丢包与乱序抖动',
    domain: 'NETWORK',
    severity: 'WARNING',
    icon: 'Wifi',
    intentText: '总线延迟 +3.5ms、控制精度 -3.5%（TSN 门控可免疫）',
    knowledgeId: 'k_tcp_nodelay',
    apply: (m) => {
      if (m.flags['tsn_gate']) {
        return {
          metrics: m,
          logDetail: 'TSN 时间敏感门控保障确定性传输，免疫弱网丢包',
          blockedBy: 'TSN 时间敏感门控调度',
        };
      }
      m.ioNetBusMs = Number((m.ioNetBusMs + 3.5).toFixed(2));
      m.accuracy = Number(Math.max(0, m.accuracy - 3.5).toFixed(1));
      return {
        metrics: m,
        logDetail: '强电磁干扰导致总线丢包，延迟 +3.5ms、精度 -3.5%！',
      };
    },
  },
  {
    id: 'fault_ota_daemon',
    name: '后台 OTA 固件升级抢占',
    domain: 'KERNEL',
    severity: 'CRITICAL',
    icon: 'Download',
    intentText: 'OS 抖动 +4.5ms、RAM +95MB、结温 +8°C（PREEMPT_RT 免疫抖动）',
    knowledgeId: 'k_preempt_rt',
    apply: (m) => {
      m.ramLeakedMB += 95;
      m.tempC = Number((m.tempC + 8).toFixed(1));
      if (!m.flags['preempt_rt']) {
        m.osJitterMs = Number((m.osJitterMs + 4.5).toFixed(2));
      }
      return {
        metrics: m,
        logDetail: m.flags['preempt_rt']
          ? 'OTA 后台解压吃掉 95MB RAM 并升温 +8°C（调度抖动已被 PREEMPT_RT 隔离）'
          : '谁在量产现场推 OTA？！CPU 抖动 +4.5ms、RAM +95MB、结温 +8°C！',
      };
    },
  },
  {
    id: 'fault_emi_noise',
    name: '暴雨/强电磁传感器噪声',
    domain: 'VLA',
    severity: 'WARNING',
    icon: 'CloudRain',
    intentText: '视觉信噪比下降，模型精度 -4.0%',
    knowledgeId: 'k_vla_tactile',
    apply: (m) => {
      m.accuracy = Number(Math.max(0, m.accuracy - 4.0).toFixed(1));
      return {
        metrics: m,
        logDetail: '暴雨反光与电机电磁噪声干扰感知，模型精度 -4.0%！',
      };
    },
  },
];

export const FAULT_REGISTRY: Record<string, FaultDef> = Object.fromEntries(
  FAULT_LIST.map((f) => [f.id, f]),
);
