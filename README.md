# ScriptForge

ScriptForge 是一个面向小说作者、编剧工作室和内容团队的 AI 剧本改编工作台。它把 3 个章节以上的小说文本转成可编辑、可校验、可追溯、可导出的结构化剧本资产，目标不是生成一段一次性的文本，而是把“小说改编成剧本”这件事产品化、流程化、可交付化。

## 产品定位

一句话：ScriptForge 把小说改编拆成“原文事实抽取 -> 戏剧规划 -> 场景与对白撰写 -> 质量校验 -> 导出交付”的结构化工作流。

很多 AI 写作工具只返回一段看起来像剧本的长文本，用户很难判断它保留了哪些原文信息、压缩了哪些情节、人物动机是否一致，也很难把结果交给团队继续修改。ScriptForge 的核心设计是让 AI 输出一个 `ScriptForgeDocument 1.1`，其中包含来源事实、人物、地点、场面卡、动作/对白 beats 和改编报告。这样，结果可以被审阅、被修复、被导出，也可以作为后续团队协作和付费服务的基础。

## 设计目标

- 降低小说改编的试错成本：先把长文本拆成事实、冲突、人物动机和场景结构，再生成剧本。
- 提供可追溯的改编资产：每个场景和 beat 都引用原文事实，便于检查“AI 是否乱编”。
- 把质量控制前置：通过 JSON Schema、引用校验、诊断面板和自动修复，减少交付前的人肉排错。
- 支持真实工作流：用户可以编辑 YAML、重新校验、应用修复、查看改编报告、下载 YAML/JSON/Markdown，并保存工作区。

## 当前能做到什么

- 输入 3 个章节以上的小说内容，或载入内置测试样本。
- 自动抽取章节摘要和关键原文事实，覆盖事件、人物目标、关系、地点、信息、情绪和冲突。
- 自动生成人物表、地点表、场景列表、场面卡和密集动作/对白 beats。
- 生成 `ScriptForgeDocument 1.1`，并导出为 YAML、JSON 或 Markdown。
- 在工作台中查看章节列表、阶段预览、诊断信息、剧本预览和改编报告。
- 对 YAML 文本进行重新校验，并把合法 YAML 应用回 JSON 状态。
- 通过质量面板调用自动修复，应用可自动处理的 Schema 或引用问题。
- 按修改方向发起修订，让已有剧本在通过校验后继续重写。
- 将工作区保存到本地 `data/workspaces`，并支持加载历史工作区。

## 工作流

```text
小说章节输入
  -> Source Facts 原文事实抽取
  -> Dramatic Plan 戏剧规划与自然分场
  -> Scene Cards 场面卡
  -> Dense Beats 动作/对白节拍
  -> ScriptForgeDocument 1.1
  -> Schema 校验、引用校验与质量诊断
  -> YAML 编辑、自动修复、改编报告、导出与工作区保存
```

这条链路的重点是“可控生成”。用户不是把小说丢给模型后等待一段不可解释的文本，而是在工作台里看到 AI 如何理解原文、如何拆分场景、如何处理人物关系，以及哪些内容被保留、合并、压缩或需要继续修订。

## 技术栈

- 应用框架：Next.js App Router、React 19、TypeScript
- 样式：Tailwind CSS
- Schema 校验：JSON Schema 2020-12、Ajv、ajv-formats
- YAML 处理：js-yaml
- AI 接入：OpenAI-compatible Chat Completions API
- 数据存储：本地文件工作区，位于 `data/workspaces`
- 核心 Schema：`schema/scriptforge.schema.json`

## 配置

复制环境变量模板：

```bash
cp .env.example .env
```

填写主模型通道：

```dotenv
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_REASONING_EFFORT=high
```

可选填写备份通道：

```dotenv
BACKUP_OPENAI_API_KEY=your_backup_api_key
BACKUP_OPENAI_BASE_URL=https://api.openai.com/v1
BACKUP_OPENAI_MODEL=gpt-4o-mini
BACKUP_OPENAI_REASONING_EFFORT=high
```

说明：

- `OPENAI_BASE_URL` 不填时默认使用 `https://api.openai.com/v1`。
- `OPENAI_MODEL` 不填时默认使用 `gpt-4o-mini`。
- 请求路径使用 OpenAI-compatible `/chat/completions`。
- `OPENAI_REASONING_EFFORT` 和备份通道的 reasoning effort 支持 `minimal`、`low`、`medium`、`high`、`xhigh`。
- 真实密钥只放在本地 `.env`，不要提交到仓库。

## 启动

安装依赖：

```bash
pnpm install
```

启动开发服务：

```bash
pnpm dev
```

然后打开浏览器访问 Next.js 输出的本地地址，通常是：

```text
http://localhost:3000
```

构建与生产启动：

```bash
pnpm build
pnpm start
```

## 使用方式

1. 打开工作台后，输入至少 3 章小说文本，或加载内置样本。
2. 点击生成，等待 Analyzer、Planner、Screenwriter、Reporter 阶段完成。
3. 查看章节列表、阶段预览和诊断信息，确认 AI 是否正确理解原文。
4. 在剧本预览中检查场景、人物、冲突、对白和动作节拍。
5. 在 YAML 编辑区调整内容，点击重新校验；校验通过后可以应用回 JSON 状态。
6. 如果出现可自动修复的问题，在质量面板中应用修复。
7. 查看改编报告，确认保留内容、压缩/省略内容、合并/改写策略和修订建议。
8. 下载 YAML 或 Markdown，或保存工作区以便后续继续修改。

## 验证脚本

项目提供按里程碑组织的验证脚本：

```bash
pnpm lint
pnpm typecheck
pnpm validate:m1
pnpm validate:m2
pnpm validate:m3
pnpm validate:m4
pnpm validate:m5
pnpm validate:m6
pnpm validate:m7
pnpm validate:generation-quality
pnpm validate:workspace-state
```

其中 `validate:m1` 到 `validate:m7` 对应不同阶段能力，`validate:generation-quality` 用于检查生成质量，`validate:workspace-state` 用于检查工作区状态结构。

## 文档索引

- [YAML Schema 说明](YAML-Schema.md)
- [JSON Schema 文件](schema/scriptforge.schema.json)
- [产品叙事](docs/product-story.md)
- [产品设计](docs/product-design.md)
- [技术设计](docs/technical-design.md)

## 输出特点

1. 处理 3 个章节以上的小说输入。
2. 输出符合 `ScriptForgeDocument 1.1` 的结构化 YAML，而不是普通剧本文本。
3. 每个关键场景和 beat 可以追溯到原文事实。
4. 支持校验、修复、编辑、导出和工作区保存。
5. 面向真实内容生产链路设计，能够继续沉淀为付费产品能力。
