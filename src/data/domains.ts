import { Domain, DomainMeta } from '../engine/types';

export const DOMAINS: Record<Domain, DomainMeta> = {
  SILICON: {
    id: 'SILICON',
    name: '硅片与嵌入式硬件',
    shortName: 'SILICON',
    accentHex: '#FF4F00',
    description: 'DVFS 调频、NPU 异构卸载、PMIC 功耗墙与主动散热控制',
  },
  KERNEL: {
    id: 'KERNEL',
    name: 'Linux 内核与驱动',
    shortName: 'KERNEL',
    accentHex: '#0EA5E9',
    description: 'DMA 零拷贝、V4L2 驱动、PREEMPT_RT、中断隔离与 cgroups',
  },
  NETWORK: {
    id: 'NETWORK',
    name: '嵌入式网络与总线',
    shortName: 'NET/BUS',
    accentHex: '#10B981',
    description: 'EtherCAT/CAN-FD 闭环、ROS2 共享内存、TCP_NODELAY 与防丢包',
  },
  CPP: {
    id: 'CPP',
    name: 'C++ 与微架构',
    shortName: 'C++/ARCH',
    accentHex: '#F59E0B',
    description: 'ARM NEON SIMD、Loop Tiling、Cache 对齐与 Arena 静态内存池',
  },
  DEPLOY: {
    id: 'DEPLOY',
    name: '端侧推理与编译',
    shortName: 'DEPLOY',
    accentHex: '#EC4899',
    description: 'INT4/INT8 量化、QAT 校准、FlashAttention 融合与计算图捕获',
  },
  VLA: {
    id: 'VLA',
    name: '模型架构与具身',
    shortName: 'VLA/ARCH',
    accentHex: '#8B5CF6',
    description: 'KV Cache 压缩、视觉 Token 剪枝、Action Chunking 与快慢双系统',
  },
};
