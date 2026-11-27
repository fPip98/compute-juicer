# 《算力榨汁机 (Compute Juicer)》核心游戏设计与技术架构文档

> **版本**：v0.1 (Design Spec)  
> **定位**：开源、纯前端、硬核技术向卡牌构筑 Roguelike（"机制即知识"，拒绝套壳刷题）  
> **技术栈**：React + TypeScript + Tailwind CSS + Framer Motion + Web Audio API + Vitest

---

## 1. 核心设计支柱

1. **机制即知识（Mechanics = Engineering Truth）**  
   每一条游戏规则都对应真实的计算机体系结构、操作系统、驱动、网络或深度学习部署原理。例如：在 `Memory-Bound` 状态下强行超频（DVFS）不仅几乎不降延迟，还会白白导致温升触发热节流；开启 `QAT` 后再做 `INT4 量化` 可大幅减缓精度崩塌。
2. **逻辑缜密与可计算性（Simplified Physics Engine）**  
   底层采用**简化离散物理公式引擎**：以真实的 Roofline 模型、端到端管线延迟、内存水位、热力学方程驱动，但将参数离散化/归一化，让玩家既能感受到硬核真实性，又能通过心算与实时预览做出精准策略决策。
3. **全栈知识覆盖（6-Layer Full-Stack）**  
   横跨**硅片硬件 → Linux 内核与驱动 → 嵌入式网络与总线 → C++ 微架构 → 端侧推理与编译 → Transformer / VLA 架构** 6 大技术栈，支持跨层协同打出真实工程 Combo。
4. **开源与分工友好（Headless Engine × UI Decoupling）**  
   纯 TypeScript 无头仿真引擎与 React UI 彻底解耦；卡牌、硬件遗物、线上故障与研发事件全部数据驱动（Data-Driven Schema），社区提 PR 即可零门槛扩展内容并自动通过单元测试。

---

## 2. 底层物理仿真引擎与数学模型

### 2.1 系统核心状态向量（`SystemState`）

单场战斗维护以下核心物理量：

| 维度 | 字段 | 单位/范围 | 说明与生死红线 |
| :--- | :--- | :--- | :--- |
| **端到端延迟** | `latencyMs` | `ms` | 需满足关卡 **SLA 延迟上限**（如 `≤ 20.0 ms`） |
| **模型/任务精度** | `accuracy` | `0 ~ 100%` | 需满足关卡 **SLA 精度下限**（如 `≥ 90%`）；过低触发喜剧事故（如捏爆鸡蛋） |
| **显存/内存占用** | `ramUsed / ramCap` | `MB` (`0~100%`) | 达到 `100%` 立即触发 **OOM Killer 宕机**（除非有隔离/降级兜底） |
| **芯片结温** | `tempC` | `25 ~ 105°C` | 超过 `thermalThrottleC`（如 `85°C`）触发**热节流降频**；达到 `100°C` 触发硬件保护关机 |
| **算力调度预算** | `cycles / maxCycles` | 整数（默认 `3`） | 每回合可编排的工程操作预算（类似能量，与物理代价构成双约束） |

### 2.2 端到端延迟方程（End-to-End Pipeline Latency）

本游戏将一次具身智能 / 端侧推理闭环拆解为真实的三段延迟之和：

$$T_{\text{total}} = T_{\text{I/O}} + T_{\text{Roofline}} + T_{\text{OS\_Jitter}}$$

1. **输入/输出与总线延迟（$T_{\text{I/O}}$）**：
   $$T_{\text{I/O}} = T_{\text{sensor\_ingest}} + T_{\text{net\_bus}} + T_{\text{copy\_overhead}}$$
   * 受 **Linux 驱动**（如 `V4L2 零拷贝`、`DMA 异步`、`mmap`）与 **嵌入式网络/总线**（如 `EtherCAT`、`CAN-FD`、`Iceoryx 共享内存`、`TCP_NODELAY`）直接控制。
2. **核心计算与访存 Roofline 延迟（$T_{\text{Roofline}}$）**：
   $$T_{\text{compute}} = \frac{\text{FLOPs}_{\text{eff}}}{\text{Peak\_FLOPS}_{\text{eff}}}, \quad T_{\text{memory}} = \frac{\text{Bytes}_{\text{eff}}}{\text{Bandwidth}_{\text{eff}}}$$
   $$T_{\text{Roofline}} = \max(T_{\text{compute}},\; T_{\text{memory}})$$
   * **算术强度（Arithmetic Intensity）**：$I = \text{FLOPs}_{\text{eff}} / \text{Bytes}_{\text{eff}}$
   * **硬件拐点（Ridge Point）**：$I_{\text{ridge}} = \text{Peak\_FLOPS}_{\text{eff}} / \text{Bandwidth}_{\text{eff}}$
   * **瓶颈判定**：
     * 若 $I < I_{\text{ridge}}$（即 $T_{\text{memory}} > T_{\text{compute}}$）→ **`MEMORY_BOUND`**（此时单纯提升算力/超频收益为 0，必须靠量化、算子融合、Cache 优化削减 `Bytes` 或提升有效带宽）。
     * 若 $I \ge I_{\text{ridge}}$（即 $T_{\text{compute}} \ge T_{\text{memory}}$）→ **`COMPUTE_BOUND`**（此时算力吃满，超频、NPU Offload、Token 剪枝、SIMD 向量化收益拉满）。
3. **OS 调度与长尾抖动（$T_{\text{OS\_Jitter}}$）**：
   $$T_{\text{OS\_Jitter}} = T_{\text{base\_os}} + T_{\text{irq\_storm}} + T_{\text{preemption}}$$
   * 受 **Linux 内核与实时性配置**（`PREEMPT_RT`、CPU Affinity 绑核、Threaded IRQ 隔离、cgroups）直接压制。

### 2.3 内存与 OOM 模型（RAM & Fragmentation）

$$\text{RAM}_{\text{used}} = \text{RAM}_{\text{weights}} + \text{RAM}_{\text{kv\_cache}} + \text{RAM}_{\text{buffers}} + \text{RAM}_{\text{fragmentation}} + \text{RAM}_{\text{leaked}}$$

* **真实工程映射**：
  * 量化（FP16 → INT8 → INT4）直接压缩 $\text{RAM}_{\text{weights}}$；
  * PagedAttention / KV 压缩削减 $\text{RAM}_{\text{kv\_cache}}$；
  * C++ 内存池（Arena/Slab）阻止 $\text{RAM}_{\text{fragmentation}}$ 每回合膨胀；
  * 内存泄漏故障（Fault）会每回合递增 $\text{RAM}_{\text{leaked}}$，逼迫玩家清理或重启子进程。

### 2.4 热力学与热节流模型（Thermal Dynamics）

$$\Delta T = \alpha \cdot \text{Power}_{\text{active}} - \beta \cdot (T_{\text{curr}} - T_{\text{ambient}}) \cdot \text{CoolingFactor}$$

* 当 $T_{\text{curr}} \ge T_{\text{throttle}}$（默认 `85°C`）时，自动激活**热节流（Thermal Throttling）**：有效峰值算力 $\text{Peak\_FLOPS}_{\text{eff}}$ 强制下降 `35%`（芯片降频保命），导致 `T_compute` 暴涨。
* 当 $T_{\text{curr}} \ge 100°C$ 时，触发 **Thermal Shutdown**（本关失败）。

---

## 3. 核心战斗循环与流水线编排逻辑

### 3.1 单场战斗胜负规则（SLA 达标 + 多波次故障生存）
* 每一关代表一个真实端侧部署业务场景（如 *“四足机器人盲走楼梯”*、*“机械臂分拣生鸡蛋”*、*“车载多目 VLA 避障”*），包含：
  * **硬性 SLA 目标**：例如 `Latency ≤ 20ms` 且 `Accuracy ≥ 90%`，需在限定压测波次内达成（或连续守住指定波次）。
  * **生存红线**：任一波次结算后若触发 `OOM (RAM ≥ 100%)` 或 `热关机 (Temp ≥ 100°C)`，或连续崩塌耗尽系统稳定性（Stability），则部署失败。
  * **故障预告（Intent）**：每回合开始前，仪表盘清晰预告本波次即将袭来的线上故障（如 *“下波次：摄像头突发 4K 帧率翻倍 +120MB RAM”* 或 *“后台日志压缩抢占 CPU0，OS 抖动 +8ms”*），强化见招拆招的策略感。

### 3.2 回合内：编译器 Pass 式流水线编排（Order Matters!）
每回合玩家经历 4 个阶段：
1. **抽牌与故障注入（Draw & Fault Preview）**：抽取手牌，查看本回合即将触发的线上故障预告。
2. **流水线编排与实时预览（Pipeline Staging & Live Preview）**：
   * 玩家将手牌拖入本回合的 **执行流水线（Execution Pipeline）**，可**自由拖拽调整先后顺序**。
   * 界面实时运行纯函数仿真，以虚线/高亮预演最终的 `Latency / RAM / Accuracy / Temp` 以及 **Roofline 工作点移动轨迹**。
   * **严格因果顺序依赖示例**：
     * `QAT 量化感知校准` 排在 `INT4 量化` **之前** → 量化精度损失减半；排在之后则无法保护已发生的量化截断。
     * `FlashAttention / 算子融合` 将系统从 `MEMORY_BOUND` 推入 `COMPUTE_BOUND` **之后**，再排 `DVFS 超频` → 延迟大幅下降；若顺序反了，超频阶段仍处于 `MEMORY_BOUND`，延迟收益几乎为 0 且白增热量。
     * `V4L2 零拷贝` 排在 `ARM NEON 图像预处理` **之前** → 触发无拷贝流水线直通奖励。
3. **统一压测结算（COMMIT / BENCHMARK）**：
   * 点击 `BENCHMARK` 后，引擎按流水线槽位顺序逐张执行（配合动效加速、Roofline 拐点顿帧与 Web Audio 音高递增），随后结算本回合线上故障冲击与热力学自然散热。
4. **SLA 验收与波次推进（Evaluate & Advance）**：检查是否满足 SLA 达标与红线存活，推进至下一波次或过关结算奖励。

### 3.3 三元卡牌流转与双约束资源
* **卡牌三大类型**：
  1. **系统补丁卡（`PATCH` / 常驻配置）**：如 `PREEMPT_RT 内核`、`INT4 权重量化`、`Iceoryx 共享内存`。打出后进入本关**已部署配置栏（Deployed Patches）**持续生效，通常附带真实工程代价（如永久占用固定 RAM 或永久精度上限 `-3%`）。
  2. **运行时操作卡（`RUNTIME` / 瞬时调度）**：每回合循环抽打，应对动态负载与故障，如 `DMA 异步抢救`、`动态视觉 Token 剪枝`、`PWM 风扇急冷`、`丢弃过期帧`、`释放 Slab 碎片`。
  3. **故障脏卡（`FAULT` / 负面技术债）**：线上事故塞入牌库或系统的负面卡，如 `内存碎片膨胀`、`TCP 队头阻塞`、`僵尸进程`、`传感器噪声飙升`，需耗费预算或特定清理卡消除。
* **双约束资源**：
  * **调度预算（Cycles）**：基础 `3/3`，限制每回合操作体量。
  * **物理指标透支**：许多 0 费/低费卡直接透支物理红线（例如 `0 费 DVFS 极限超频：+40% 峰值算力，但立刻 +18°C`；`0 费 激进 INT2 截断：RAM 减半，但 Accuracy -14%`），真实还原“空间换时间、精度换速度、寿命换算力”。

---

## 4. 全栈 6 层知识域架构与内容蓝图

开局玩家选择**目标硬件平台 / 工程师角色**（决定初始遗物、基础硬件参数及高权重出现的 2~3 个相邻技术栈，防止牌池稀释），局内可通过商店/事件跨栈引入黑科技卡。

### 4.1 六大知识域定义

| ID | 知识域（流派） | 核心硬核知识点 | 主要影响的引擎物理量 |
| :--- | :--- | :--- | :--- |
| `SILICON` | **1. 硅片与嵌入式硬件** | DVFS 调频、NPU/DSP 异构卸载、PMIC 功耗墙、PWM 散热、Watchdog、硬件流控 | `Peak_FLOPS`、发热斜率、热节流阈值 |
| `KERNEL` | **2. Linux 内核与驱动** | DMA 异步、`mmap`/V4L2 零拷贝、中断顶/底半部（Threaded IRQ）、`PREEMPT_RT`、绑核、HugePages、cgroups/OOM 隔离 | `T_copy`、`T_OS_Jitter`、OOM 兜底 |
| `NETWORK` | **3. 嵌入式网络与总线** | CAN-FD / EtherCAT 伺服闭环、TSN、ROS2 DDS 共享内存（Iceoryx）、`TCP_NODELAY`、RingBuffer、弱网边缘降级 | `T_sensor_ingest`、`T_net_bus`、丢包精度惩罚 |
| `CPP` | **4. C++ 与微架构** | ARM NEON/SIMD、Loop Tiling、Cache Line 对齐（防伪共享）、Arena 内存池、无锁队列、`std::span` 零拷贝、分支预测 | `Bandwidth_eff`、Cache 命中率、`RAM_fragmentation` |
| `DEPLOY` | **5. 端侧推理与编译** | PTQ/QAT（FP16/INT8/INT4/AWQ）、算子融合、TensorRT/TVM 图优化、CUDA/NPU Graph、NHWC 排布、投机解码 | `FLOPs`、`Bytes`、`RAM_weights`、`Accuracy` |
| `VLA` | **6. 模型架构与具身** | KV Cache / PagedAttention、GQA/MQA、MoE 稀疏激活、视觉 Token 剪枝、Action Chunking、快慢双系统（Sys1+Sys2） | `Base FLOPs`、`RAM_kv_cache`、SLA 频次压力 |

### 4.2 首批典型卡牌示例（体现逻辑严密性）

* **`[DEPLOY | PATCH | 1费]` INT4 AWQ 权重量化**：`RAM_weights × 0.35`，`Bytes × 0.40`，`Accuracy -4%`（若本回合流水线中前置了 `QAT/校准集` 卡，精度惩罚降为 `-1%`）。
* **`[DEPLOY | RUNTIME | 1费]` FlashAttention 算子融合**：消除中间激活写回 HBM，`Bytes × 0.55`；若执行后系统从 `MEMORY_BOUND` 跃迁至 `COMPUTE_BOUND`，返还 `1` 点调度预算。
* **`[SILICON | RUNTIME | 0费]` DVFS 涡轮超频**：本回合 `Peak_FLOPS × 1.35`，但 `Temp +16°C`。（*若在 `MEMORY_BOUND` 下打出，几乎不降延迟，系统提示 `Warning: Compute idle under Memory-Bound!`*）
* **`[KERNEL | PATCH | 2费]` V4L2 DMABUF 零拷贝**：永久移除相机采集的内核→用户态拷贝，`T_copy -4.5ms`，`RAM_buffers -40MB`。
* **`[KERNEL | PATCH | 2费]` PREEMPT_RT + CPU Affinity 绑核**：永久免疫 `进程抢占` 类故障，`T_OS_Jitter` 上限锁定 `≤ 1.5ms`，但可用总线程峰值算力 `-8%`。
* **`[NETWORK | PATCH | 1费]` ROS2 Iceoryx 共享内存**：节点间通信绕过 TCP/UDP 协议栈，`T_net_bus -5.0ms`，但永久增加 `RAM_buffers +60MB`。
* **`[NETWORK | RUNTIME | 1费]` 禁用 Nagle (`TCP_NODELAY`)**：立即清除当前 `TCP 队头阻塞` 故障，本回合控制下发延迟 `-3.5ms`。
* **`[CPP | PATCH | 1费]` Arena 静态内存池**：免疫所有回合的 `内存碎片膨胀`，但启动时静态预占 `RAM +80MB`。
* **`[CPP | RUNTIME | 1费]` ARM NEON + Loop Tiling**：提升 L1/L2 命中率，`Bandwidth_eff × 1.25`，`Peak_FLOPS_eff × 1.15`。
* **`[VLA | PATCH | 2费]` Action Chunking（动作分块）**：单次推理输出未来 K 步动作，本关 SLA 延迟要求放宽 `+6ms`，但环境突发扰动时 `Accuracy -3%`。

### 4.3 典型硬件遗物（Hardware Modules）
* **Jetson Orin AGX (64GB)**：高内存天花板 + Tensor Core，但基础发热量高。
* **RK3588 端侧板卡**：极低功耗散热好，但访存带宽极窄（开局强 `MEMORY_BOUND`，极度考验量化与 C++ Cache 优化）。
* **铜管液冷套件**：每回合自然散热系数 `CoolingFactor × 1.8`。
* **硬实时 EtherCAT 主站卡**：总线抖动惩罚减半，每回合首次打出 `NETWORK` 卡抽 1 张牌。
* **硬件 Watchdog 看门狗**：每场战斗免除一次 `OOM` 或 `热关机` 致命宕机（强制回滚至安全状态并塞入 2 张 `重启恢复延迟` 脏卡）。

---

## 5. 宏观 3 幕进程设计（Run Progression）

采用类似《杀戮尖塔》的分支节点地图（普通工况 / 精英故障 / 架构采购商店 / 代码重构营地 / 研发随机事件 / 验收 Boss）：

* **第 1 幕：单板 Bring-up（实验室原型验证）**
  * 教学友好，聚焦基础 Roofline 认知、OOM 红线、基础量化与散热控制。
  * **Act 1 Boss：「生鸡蛋分拣机械臂验收」**——要求 `Latency ≤ 22ms` 且 `Accuracy ≥ 90%`；若精度跌破 `85%` 机械臂当场捏爆鸡蛋，若延迟超标则鸡蛋滚落摔碎。
* **第 2 幕：多传感器联调（产线动态压测）**
  * 引入高并发驱动争抢、V4L2 拷贝瓶颈、EtherCAT/DDS 总线丢包、C++ 内存碎片持续泄漏。
  * **Act 2 Boss：「四足机器人盲走湿滑楼梯」**——双阶段工况（高频控制周期 + 突发 IMU/雷达丢包风暴）。
* **第 3 幕：极端端侧量产（严苛工业现场）**
  * 复合灾难：高温机箱（环境温度 `45°C` 导致散热大幅变慢）+ 长上下文多模态 VLA 推理 + 后台 OTA 升级抢占。
  * **Act 3 Boss：「无散热风扇的暴雨夜端侧 VLA 自动驾驶」**——全栈 6 层综合大考。

**幽默研发随机事件示例**：
* *《产品经理的深夜需求》*：“老板明天要给投资人 Demo，临时要求把视觉输入从 720p 升级到 4K！”
  * `[硬着头皮上]`：获得 `150` 算力经费 + 1 个稀有硬件遗物，但牌库塞入 1 张永久诅咒 `4K 冗余分辨率 (+80MB RAM)`。
  * `[拿 Roofline 图拍桌子据理力争]`：获得 1 张 `视觉 Token 剪枝` 卡，但失去本次经费。

---

## 6. GDB / JTAG 实时知识终端架构

1. **交互定位**：随时按 `F5` 或拨动 `HALT / JTAG` 开关冻结战场，切入硬核调试器手册界面。
2. **双层知识保障（零幻觉保底 + 深度互动）**：
   * **L1 离线权威手册（内置静态数据）**：每张卡牌、硬件遗物、线上故障和物理公式节点都绑定结构化 `KnowledgeEntry`（包含：一句话直觉、底层原理、真实 C++/Linux/CUDA 代码片段、工程 Trade-off 踩坑点）。纯静态离线秒开，100% 技术严谨。
   * **L2 可选 AI 架构师答疑（BYOK / 本地 Ollama）**：用户可在设置中填入自己的 OpenAI 兼容 API Key 或本地 Ollama 地址。提问时，前端自动将 **当前 `EngineState` 快照 + 本回合流水线执行日志 + 相关 L1 权威词条** 拼装为 System Prompt，确保大模型能结合当前战局精准回答（如：*“为什么我刚才先打超频延迟没降？”*）。

---

## 7. 工程架构与协作契约（Engine × UI 解耦）

为了支持 **底层逻辑/引擎/内容开发** 与 **UI/动效/视觉开发（Claude 协作）** 高效并行且互不阻塞，项目采用严格的 **Headless Architecture（无头架构）**：

```text
edge-game/
├── docs/
│   └── DESIGN.md              # 本设计文档
├── src/
│   ├── engine/                # 【纯 TS 无头引擎：零 React/DOM 依赖，100% Vitest 单元测试】
│   │   ├── types.ts           # 核心状态、卡牌、遗物、故障、知识词条类型定义
│   │   ├── physics.ts         # Roofline、端到端延迟、RAM、热力学纯函数方程
│   │   ├── pipeline.ts        # 流水线顺序编排、实时 Preview 与逐步 Tick 结算器
│   │   ├── battle.ts          # 回合状态机、故障注入、SLA 判定、胜负逻辑
│   │   └── run.ts             # 3幕地图生成、商店、事件、存档状态机
│   ├── data/                  # 【声明式内容库：开源社区 PR 主战场】
│   │   ├── cards/             # 按 6 大知识域分文件存放卡牌与关联 L1 知识词条
│   │   ├── relics.ts          # 硬件平台与模块遗物
│   │   ├── faults.ts          # 线上故障与 Boss 机制定义
│   │   ├── encounters.ts      # 3 幕关卡与 SLA 配置
│   │   └── events.ts          # 随机研发事件
│   ├── gdb/                   # 【GDB 知识终端内核】
│   │   ├── knowledgeBase.ts   # 离线词条检索与上下文关联
│   │   └── llmClient.ts       # 纯前端 BYOK / Ollama 流式客户端 + 战局快照注入
│   ├── audio/                 # 【Web Audio API 合成器引擎（无音频文件依赖）】
│   │   └── synth.ts           # 连击递增音效、Roofline 扫频、OOM 掉电、GDB 低通滤波
│   └── ui/                    # 【React + Tailwind + Framer Motion 视图层（UI 协作区）】
│       ├── components/        # SLA 仪表盘、Roofline SVG、机器人剧场、流水线槽、卡牌、GDB 抽屉
│       └── hooks/             # 将 Headless Engine 桥接到 React State
```

### 7.1 引擎向 UI 暴露的核心契约（Contract）
UI 层无需编写任何业务公式，只需消费引擎输出的纯数据：
* `previewPipeline(state, stagedCards): PipelinePreviewResult`  
  返回每张卡执行后的中间快照数组 `steps[]`（供动效逐帧播放）、最终预测值 `finalMetrics`、以及顺序警告/协同高亮 `synergyHints[]`（如 `"⚠️ Memory-Bound 下超频收益极低"` 或 `"✨ QAT 保护已激活：精度损耗减半"`）。
* `commitPipeline(state, stagedCards): { nextState, traceLog[] }`  
  执行真实结算，并产出可供动效/音效播放器逐条消费的 `traceLog` 事件流（如 `ROOFLINE_SHIFT`, `OOM_TRIGGERED`, `THERMAL_THROTTLE`, `SYNERGY_PROC`）。

---

## 8. 推荐开发里程碑（Vertical Slice First）

1. **Milestone 1 — 可玩垂直切片（Act 1 试玩版）**
   * 完整实现 `src/engine/` 物理公式引擎、流水线顺序结算与单元测试。
   * 实装覆盖 6 大知识域的首批 **24~30 张精选卡牌**、**6 个硬件遗物**、**6 种典型线上故障** 与 **Act 1 Boss 关「机械臂抓鸡蛋」**。
   * 实装 L1 离线 GDB 手册 + BYOK LLM 接口。
   * 与 Claude 协作完成高质感 UI 界面与 Web Audio 合成音效。
   * **目标**：可直接在浏览器完整试玩、验证 Roofline 切换手感、验证数值平衡与知识密度。
2. **Milestone 2 — 内容爆发与 3 幕完整化**
   * 扩充至 **90+ 全栈卡牌**、**20+ 硬件遗物**、**3 大章节分支地图与 3 个差异化 Boss**、**20+ 幽默研发事件**。
3. **Milestone 3 — 开源社区化**
   * 编写 `CONTRIBUTING.md` 卡牌/故障 PR 模板、自动化 Schema 校验与数值平衡 CI 脚本，发布 GitHub Pages。
