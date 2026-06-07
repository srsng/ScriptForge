# ScriptForge 技术设计

## 1. 技术目标

ScriptForge 是一个 AI 小说转剧本工作台。当前 MVP 的核心目标是把 3 章以上小说片段改编成 `ScriptForgeDocument 1.1`，并让结果具备可校验的原文事实、场面卡、beat 戏剧功能和来源追溯。

核心链路：

```text
章节输入
  → Analyzer 生成 Source Facts
  → Planner 生成人物 / 地点 / Natural Scene Cards
  → Screenwriter 生成 Dense Beats
  → Reporter 生成标题 / logline / adaptation_report
  → 程序组装 ScriptForgeDocument 1.1 JSON
  → JSON Schema 校验
  → 应用层引用校验
  → 剧本质量门禁
  → YAML / JSON / Markdown 导出
```

当前生成链路采用多轮串行 API 编排。原因是单次请求需要同时读取章节、完成全部中间推理并输出完整剧本，容易触发上游 502 或超时；多轮将 Source Facts、Dramatic Plan、Scene Cards 和 Dense Beats 显性化，程序可以在每轮后做轻量校验，再组装最终 1.1 文档。多轮不是逐轮压缩原文：Analyzer 输出用于追溯和校验，Planner 与 Screenwriter 仍接收完整章节正文，确保场景规划和剧本正文有足量原文信息支撑。

工作台不使用 SSE 或 token streaming。前端按阶段发起独立 HTTP 请求：`/api/generate/analyzer`、`/api/generate/planner`、`/api/generate/screenwriter`、`/api/generate/reporter`。每个阶段请求返回后，UI 立即展示该阶段 JSON 摘要、诊断和耗时指标；四个阶段都完成后，再调用 `/api/generate/assemble` 做程序组装、Schema 校验、引用校验和剧本质量门禁。

## 2. 技术栈

- Next.js App Router + TypeScript。
- Ajv + JSON Schema 2020-12 做结构校验。
- `js-yaml` 做 YAML 解析和导出。
- OpenAI-compatible chat completions adapter，读取显式配置的 API key。
- React 工作台负责输入、生成状态、质量状态、预览、YAML 编辑和导出。

## 3. 数据契约

### 输入

```ts
type NovelChapter = {
  id: string;
  title: string;
  content: string;
};

type GenerationRequest = {
  chapters: NovelChapter[];
  target: {
    format: "short_drama" | "film" | "stage";
    genre: string;
    target_duration_minutes: number;
    tone: string;
  };
};
```

至少需要 3 个有效章节。

### 输出

后端返回：

```ts
type GenerationResult = {
  status: "ai_success" | "degraded" | "needs_revision" | "error";
  document?: ScriptForgeDocument;
  validation?: ValidationResult;
  diagnostics: GenerationDiagnostic[];
  promptStages: PromptBundle[];
  stageOutputs?: GenerationStageOutputs;
  model?: string;
  error?: string;
};
```

`ScriptForgeDocument` 当前只接受 `schema_version: "1.1"`。

### AI 配置

本地生成链路通过环境变量配置：

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_REASONING_EFFORT=
BACKUP_OPENAI_API_KEY=
BACKUP_OPENAI_BASE_URL=
BACKUP_OPENAI_MODEL=
BACKUP_OPENAI_REASONING_EFFORT=
GENERATION_STAGE_TIMEOUT_MS=180000
GENERATION_ANALYZER_TIMEOUT_MS=
GENERATION_PLANNER_TIMEOUT_MS=
GENERATION_SCREENWRITER_TIMEOUT_MS=
GENERATION_REPORTER_TIMEOUT_MS=
```

`OPENAI_API_KEY=` 是主配置；如果没有配置任何可用 key，生成 API 返回配置错误，不创建替代剧本结果。阶段超时默认 180 秒，可以用 `GENERATION_STAGE_TIMEOUT_MS` 全局覆盖，也可以用单阶段变量覆盖。MVP 保持当前多轮串行 API 编排，不增加自适应分章、并行分析、重试或 fallback 生成路径；前端在生成中显示已等待秒数，例如 `生成中...(20s)`。

## 4. 多轮生成工作流

前端阶段编排合同：

```text
POST /api/generate/analyzer
  返回 AnalyzerStageOutput 后立即展示 Analyzer 阶段结果

POST /api/generate/planner
  输入完整 GenerationRequest + AnalyzerStageOutput
  返回 PlannerStageOutput 后立即展示 Planner 阶段结果

POST /api/generate/screenwriter
  输入完整 GenerationRequest + AnalyzerStageOutput + PlannerStageOutput
  返回 ScreenwriterStageOutput 后立即展示 Screenwriter 阶段结果

POST /api/generate/reporter
  输入 AnalyzerStageOutput + PlannerStageOutput + ScreenwriterStageOutput
  返回 ReporterStageOutput 后立即展示 Reporter 阶段结果

POST /api/generate/assemble
  输入四阶段输出
  不调用模型，只做组装、校验、质量门禁和 YAML 输出
```

阶段接口返回统一包含 `diagnostics`、`prompt`、`metrics` 和 `model`。`GenerationStageMetrics` 记录 `elapsedMs`、`timeoutMs`、`promptChars`、`responseChars`、`provider` 和 `model`，用于诊断 502、超时和提示词体积问题。

### Analyzer

输入完整章节正文，输出：

```ts
type AnalyzerStageOutput = {
  source: ScriptSource;
};
```

阶段校验：

- `source.type` 必须是 `novel`。
- `source.chapters` 必须覆盖全部输入章节。
- 每章至少 3 条 `key_facts`。
- `fact id` 必须全局唯一。

### Planner

输入完整章节正文和 Analyzer 输出，输出：

```ts
type PlannerStageOutput = {
  characters: ScriptCharacter[];
  locations: ScriptLocation[];
  scene_plan: PlannedScene[];
};
```

阶段校验：

- `scene_plan.source_chapters` 必须引用 Analyzer 章节。
- `scene_plan.source_refs` 必须引用 Analyzer facts。
- `scene_plan.location` 必须引用本阶段 locations。
- `scene_plan.characters` 必须引用本阶段 characters。
- 每个 `scene_card` 必须完整。

阶段写作合同：

- Planner 必须读取完整章节正文，再结合 Analyzer facts 判断自然场景边界。
- `key_facts` 是追溯和校验索引，不是替代原文的唯一信息源。
- `beat_budget` 应根据目标时长、自然场面容量和原文可拍素材分配。

### Screenwriter

输入完整章节正文、Analyzer 输出和 Planner 输出，输出：

```ts
type ScreenwriterStageOutput = {
  scenes: ScriptScene[];
};
```

阶段校验：

- `scenes` 必须覆盖全部 `scene_plan`，不能新增未规划场景。
- 每个 beat 必须有 `function` 和 `source_refs`。
- dialogue beat 必须有角色，且角色必须属于该 scene。

阶段写作合同：

- Screenwriter 必须回看完整章节正文，不得只复述 Analyzer 或 Planner 摘要。
- 剧本正文应从原文细节、动作过程、环境压力、潜台词和人物反应扩写。
- 使用未被 Analyzer 单独列出的原文细节时，必须引用最接近的已有 `key_facts`，保证 `source_refs` 可追溯。

### Reporter

输入前三阶段输出，输出：

```ts
type ReporterStageOutput = {
  title: string;
  logline: string;
  adaptation_report: AdaptationReport;
};
```

阶段校验：

- `chapter_count`、`scene_count`、`character_count` 必须与前三阶段输出一致。
- `revision_suggestions` 表示后续可选改进，不表示已经发生的改编决策。

## 5. ScriptForgeDocument 1.1

1.1 的核心结构：

```text
script
  schema_version: "1.1"
  metadata
  source.chapters[].key_facts
  characters
  locations
  scenes[].source_refs
  scenes[].scene_card
  scenes[].beats[].function
  scenes[].beats[].source_refs
  adaptation_report
```

关键设计：

- `key_facts`：逐章保存可改编事实，避免 AI 只写概括性段落。
- `scene_card`：显式保存目标、阻碍、入场状态、转折、离场状态和场景氛围。
- `beat.function`：声明 beat 的戏剧功能，如 `probe`、`evade`、`pressure`、`reveal`、`turn`。
- `source_refs`：scene 和 beat 都必须引用 `key_facts`，让改编可追溯到原文事实。

## 6. 校验策略

### JSON Schema

负责：

- 必填字段、字段类型、枚举值。
- `schema_version === "1.1"`。
- 每章 `key_facts` 至少 3 条。
- 每个 scene 必须有 `source_refs` 和完整 `scene_card`。
- 每个 beat 必须有 `function` 和 `source_refs`。

### 应用层引用校验

负责：

- `scene.location` 必须存在于 `locations`。
- `scene.characters` 和 `dialogue.character` 必须存在于 `characters`。
- `scene.source_chapters` 必须存在于 `source.chapters`。
- `scene.source_refs` 和 `beats[].source_refs` 必须存在于 `source.chapters[].key_facts`。
- `fact id` 必须全局唯一。

### 质量门禁

结构合法不代表成品可用。质量门禁继续判断：

- 容量、字数、对白数量和估算时长。
- 摘要化 beat、结果式 action、干对白。
- 缺少 `turning_point`。
- `entry_state` 与 `exit_state` 无变化。
- 缺少对白攻防轮次。
- 缺少 `pressure/reveal/turn/reaction` 等推进功能。
- 原文 facts 未被 scene 或 beat 使用。

质量状态：

- `ai_success`：Schema、引用和质量门禁通过。
- `degraded`：可用但存在警告。
- `needs_revision`：结构合法，但剧本容量或戏剧结构不足。
- `error`：AI 请求、解析、Schema 或引用校验失败。

## 7. API

### POST /api/generate

兼容完整生成接口。输入：`GenerationRequest`、`sourceText` 或 `workspaceId`。

输出：`ScriptForgeDocument 1.1`、YAML、校验结果、质量诊断、阶段诊断和可选 `stageOutputs`。

工作台默认不走该接口等待完整结果；它改用分阶段 HTTP 接口，以便每个阶段完成后立即展示结果。该接口保留给脚本、调试或需要一次性完整响应的调用方。

### POST /api/generate/analyzer

输入：`GenerationRequest`。

输出：`AnalyzerStageOutput`、阶段诊断、提示词和 `GenerationStageMetrics`。

### POST /api/generate/planner

输入：完整 `GenerationRequest` 和 `AnalyzerStageOutput`。阶段 prompt 会同时包含完整章节正文和 Analyzer 输出。

输出：`PlannerStageOutput`、阶段诊断、提示词和 `GenerationStageMetrics`。

### POST /api/generate/screenwriter

输入：完整 `GenerationRequest`、`AnalyzerStageOutput` 和 `PlannerStageOutput`。阶段 prompt 会同时包含完整章节正文、Analyzer 输出和 Planner 输出。

输出：`ScreenwriterStageOutput`、阶段诊断、提示词和 `GenerationStageMetrics`。

### POST /api/generate/reporter

输入：`GenerationRequest`、`AnalyzerStageOutput`、`PlannerStageOutput` 和 `ScreenwriterStageOutput`。

输出：`ReporterStageOutput`、阶段诊断、提示词和 `GenerationStageMetrics`。Reporter 仍然由 AI 生成，避免 Screenwriter 同时承担正文写作和报告归纳。

### POST /api/generate/assemble

输入：四个阶段输出、阶段诊断、提示词列表和模型名。

输出：最终 `ScriptForgeDocument 1.1`、YAML、校验结果、质量诊断和 `stageOutputs`。该接口不调用 AI。

### POST /api/revise

输入：当前 1.1 文档、原始请求、后续修改建议。

要求：改写时必须维护 `key_facts`、`source_refs`、`scene_card`、`beat.function`，不能只改正文。

### POST /api/validate

输入：YAML 或 JSON。

输出：Schema 错误、引用错误、警告和最近有效候选。

### POST /api/repair

输入：当前结构化对象或 YAML。

输出：修复后的 1.1 文档、YAML、修复项和剩余诊断。Repair 只修结构、类型和引用，不做 1.0 迁移。

## 8. 容错

- 未配置 AI provider 时返回明确配置错误，不生成替代剧本。
- 任一阶段模型输出不是 JSON 时返回该阶段解析错误。
- 任一阶段引用或结构校验失败时进入 `error`。
- 最终 Schema 或引用失败时进入 `error`。
- 质量不足但结构合法时进入 `needs_revision`，允许预览和继续改写。

MVP 不再保留 fallback 生成结果路径。
