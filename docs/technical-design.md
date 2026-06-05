# ScriptForge 技术设计

## 1. 技术目标

ScriptForge 的技术目标是在 48 小时内实现一个稳定可演示的 AI 小说转剧本工作台。第一版优先保证端到端闭环和结构化输出质量，不追求复杂后端架构。

核心链路：

```text
章节输入 → AI 分阶段分析 → 结构化 JSON → JSON Schema 校验 → YAML 转换 → 预览与导出
```

## 2. 推荐技术栈

### 应用框架

使用 Next.js App Router + TypeScript 构建全栈单体应用。

原因：

- 前端、API Route、部署可以放在一个项目中。
- 减少跨域、服务联调和多仓库管理成本。
- 适合 48 小时快速交付。

### UI 与交互

- Tailwind CSS：快速构建稳定布局。
- shadcn/ui：提供基础控件。
- lucide-react：按钮图标。
- Monaco Editor 或 CodeMirror：YAML 编辑器。

### 数据处理

- yaml 或 js-yaml：JSON 与 YAML 转换。
- Ajv：执行 JSON Schema 校验。
- Zod 可选：校验前端表单和 API 输入。

### AI 接入

采用 OpenAI-compatible adapter，避免绑定单一模型供应商。

建议环境变量：

```text
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
```

后续可以切换 OpenAI、DeepSeek、Qwen、Moonshot、Gemini 兼容网关等模型。

## 3. 第一版目录建议

```text
ScriptForge/
  app/
    page.tsx
    api/
      generate/route.ts
      validate/route.ts
      repair/route.ts
  components/
    workspace/
    editor/
    preview/
  lib/
    ai/
      client.ts
      prompts.ts
      pipeline.ts
    schema/
      validate.ts
    yaml/
      convert.ts
    samples/
      demo-novel.ts
  schema/
    scriptforge.schema.json
  docs/
```

## 4. 数据流设计

### 输入数据

前端输入章节数组：

```ts
type NovelChapter = {
  id: string;
  title: string;
  content: string;
};
```

至少需要 3 个章节。前端和后端都应校验章节数量。

### 中间数据

AI 管线建议拆成三个阶段。

#### 阶段一：章节分析

输出每章摘要、人物、地点、事件、冲突、伏笔和可改编素材。

#### 阶段二：故事圣经

合并多个章节的信息，形成全局人物表、地点表、时间线、主线冲突和改编风格。

#### 阶段三：剧本生成

基于故事圣经生成结构化剧本 JSON。此阶段必须严格贴合 Schema。

### 输出数据

后端返回：

```ts
type GenerateResult = {
  script: ScriptForgeDocument;
  yaml: string;
  validation: ValidationResult;
  report: AdaptationReport;
};
```

## 5. 为什么先生成 JSON 再转 YAML

不要让模型直接输出 YAML。YAML 对人类友好，但对模型生成和程序校验来说更容易出现缩进、列表和引号问题。

更稳的方式是：

1. 让模型输出严格 JSON。
2. 使用 JSON Schema 校验。
3. 修复不符合 Schema 的字段。
4. 程序将 JSON 转成 YAML。

这样可以显著降低 Demo 翻车概率。

## 6. AI 管线设计

### Prompt 角色

建议使用三个系统角色，而不是一个超长 Prompt。

#### Analyzer

负责从章节中抽取事实，不写剧本。

输出：人物、地点、事件、冲突、叙事功能、可改编点。

#### Planner

负责把章节事实整合为故事圣经和场景规划。

输出：人物表、地点表、场景列表、每场戏的戏剧目的。

#### Screenwriter

负责生成符合 Schema 的剧本 JSON。

输出：metadata、source、characters、locations、scenes、adaptation_report。

### 修复器

如果 Schema 校验失败，调用 Repair Prompt，只允许修改结构错误，不允许改写故事内容。

## 7. API 设计

### POST /api/generate

输入：章节、目标剧本类型、语言、目标时长。

输出：剧本对象、YAML、校验结果、改编报告。

### POST /api/validate

输入：YAML 或 JSON。

输出：解析结果、Schema 错误、应用层引用错误。

### POST /api/repair

输入：当前结构化对象、校验错误。

输出：修复后的对象、YAML、校验结果。

## 8. 校验策略

校验分两层。

### JSON Schema 校验

负责字段类型、必填字段、枚举值和基本结构。

例如：

- script.title 必填。
- characters 必须是数组。
- scene.beats 至少有一项。
- dialogue beat 必须包含 character。

### 应用层校验

负责跨引用关系，JSON Schema 不适合完整处理这些规则。

例如：

- scene.characters 中的角色 ID 必须存在于 characters。
- dialogue.character 必须存在于当前 scene.characters。
- scene.location 必须存在于 locations。
- scene.source_chapters 必须存在于 source.chapters。

## 9. 前端状态

第一版可以使用 React state 或 Zustand。

建议状态：

```ts
type WorkspaceState = {
  chapters: NovelChapter[];
  mode: "short_drama" | "film" | "stage";
  generating: boolean;
  scriptJson: unknown | null;
  yamlText: string;
  validation: ValidationResult | null;
  activeView: "preview" | "yaml" | "report";
};
```

## 10. 容错设计

### API 调用失败

展示错误信息，并允许用户使用内置示例结果继续演示。

### 模型输出不是 JSON

先尝试提取 JSON 代码块，再进行解析；失败则提示重新生成。

### Schema 校验失败

展示错误路径和错误说明，提供自动修复按钮。

### 现场网络异常

准备一份内置 demo 输出，确保演示可以继续。

## 11. Demo 优先级

技术实现应按以下顺序推进：

1. 静态样例数据跑通工作台。
2. Schema 校验和 YAML 导出跑通。
3. AI generate API 接入。
4. 自动修复接入。
5. UI 打磨和演示脚本。

先做可演示闭环，再补真实 AI 能力。这是 48 小时内最稳的路线。
