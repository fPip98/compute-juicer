# Contributing to Compute Juicer (《算力榨汁机》)

欢迎通过 PR 为《算力榨汁机》贡献新的硬核优化卡牌、真实线上 P0 故障、硬件遗物、幽默研发事件或 GDB 权威词条！

本项目采用 **零美术门槛、数据驱动（Data-Driven）** 架构——你不需要画任何图片，只需编写声明式 TypeScript 对象并通过单元测试即可。

## 本地开发环境

```bash
npm install
npm run dev     # 启动本地开发服务器
npm test        # 运行物理引擎、Run 状态机与知识词条完整性单测
npm run build   # TypeScript 严格类型检查 + 生产构建
```

## 1. 贡献一张新卡牌

1. 打开 `src/data/cards.ts`，在对应知识域（`SILICON` / `KERNEL` / `NETWORK` / `CPP` / `DEPLOY` / `VLA`）中添加一个 `CardDef` 对象：

```ts
{
  id: 'ker_my_new_opt',
  code: 'KER-09',
  name: '你的卡牌名称',
  domain: 'KERNEL',
  type: 'RUNTIME', // 'PATCH' (本关常驻) | 'RUNTIME' (单回合) | 'FAULT' (故障脏卡)
  cost: 1,
  icon: 'Cpu',     // 任意 lucide-react 图标名
  tags: ['OS--', 'JITTER-'],
  summary: '清晰描述该操作对延迟/内存/温度/精度的真实影响。',
  orderHint: '（可选）如果有流水线顺序依赖，请写明前置/后置条件',
  knowledgeId: 'k_my_new_opt', // 必须对应 src/gdb/knowledgeBase.ts 中的词条 ID
  apply: (ctx) => {
    const m = ctx.metrics;
    // 在此修改物理量（保证纯函数，不要产生外部副作用）
    m.osJitterMs = Number(Math.max(0.2, m.osJitterMs - 2.0).toFixed(2));
    return { metrics: m };
  },
}
```

2. 在 `src/gdb/knowledgeBase.ts` 中新增对应的 `KnowledgeEntry`（包含原理、真实 C/C++/Bash/Python 代码片段与工程权衡）。
3. （推荐）在 `src/i18n/index.ts` 的 `EN_CARD_META` 中补充对应的英文翻译。

## 2. 贡献新线上故障 / 硬件遗物 / 随机事件

- **线上故障**：编辑 `src/data/faults.ts`，写明 `intentText`、`apply(metrics)`（支持检查 `m.flags[...]` 被常驻 PATCH 免疫），并绑定 `knowledgeId`。
- **硬件遗物**：编辑 `src/data/relics.ts`，实现 `onBattleStart` 或 `onTurnStart` 钩子。
- **研发随机事件**：编辑 `src/data/events.ts`，提供 2~3 个带真实工程权衡的选项（经费、增删卡、遗物、技术债）。

## 3. 提交前必检（CI 会自动运行）

```bash
npm test && npm run build
```

`src/engine/engine.test.ts` 会自动校验：
- 所有卡牌、遗物、故障的 `knowledgeId` 都在 `KNOWLEDGE_BASE` 中真实存在；
- Roofline 方程、热节流、顺序协同与 3 幕 Run 状态机均无回归。

## 4. 设计原则（PR 评审标准）

- **机制即知识**：数值变动必须符合真实的计算机体系结构、OS 或深度学习部署原理，拒绝无依据的纯数值膨胀。
- **有得必有失（Trade-off）**：强力优化应伴随合理的工程代价（如空间换时间、精度换延迟、功耗换算力、或严格的 Pass 顺序依赖）。
