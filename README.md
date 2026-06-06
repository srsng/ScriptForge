# ScriptForge

ScriptForge 是一个面向小说作者的 AI 剧本改编工作台。它把 3 个章节以上的小说文本转换为可编辑、可校验、可导出的结构化剧本 YAML，帮助作者快速获得可以继续打磨的剧本初稿。

## 一句话定位

ScriptForge 不只是让 AI 生成一段剧本文本，而是把小说改编过程拆成可追溯、可校验、可编辑的结构化工作流。

## 主要功能

- 支持输入 3 个章节以上的小说文本。
- 自动抽取原文事实、人物、地点、关键事件、冲突和人物动机。
- 自动生成 `ScriptForgeDocument 1.1`：包含来源事实、自然场面卡和密集动作/对白 beats。
- 输出符合 YAML Schema 的剧本 YAML。
- 提供 YAML Schema 文档，并说明来源追踪、场面卡和质量门禁的设计原因。
- 提供剧本预览、Schema 校验、引用校验、质量诊断、错误提示和导出能力。

## 工作流程

```text
小说章节输入
  ↓
Source Facts 原文事实抽取
  ↓
Dramatic Plan 戏剧计划与自然分场
  ↓
Scene Cards 场面卡
  ↓
Dense Beats 动作/对白节拍
  ↓
ScriptForgeDocument 1.1 JSON
  ↓
Schema 校验、引用校验与质量门禁
  ↓
YAML 导出、剧本预览与可编辑重校验
```

## 技术路线

ScriptForge 采用面向结构化生成的全栈 Web 应用架构：

- 应用框架：Next.js App Router、TypeScript
- 界面组件：Tailwind CSS、shadcn/ui、lucide-react
- 编辑器：Monaco Editor 或 CodeMirror
- YAML 处理：yaml 或 js-yaml
- Schema 校验：JSON Schema + Ajv
- AI 接入：OpenAI-compatible adapter，便于切换不同模型
- 导出格式：YAML、Markdown、JSON

## 产品界面

应用界面以工作台为主，围绕“输入、生成、校验、预览、导出”组织：

```text
左侧：章节输入与示例文本
中间：AI 改编流程、人物/场景分析、场景卡片
右侧：YAML 编辑器、Schema 校验结果、剧本预览
```

打开应用后直接进入工作台，减少从小说输入到剧本输出的操作路径。

## 文档索引

- [产品叙事](docs/product-story.md)
- [产品设计](docs/product-design.md)
- [技术设计](docs/technical-design.md)
- [YAML Schema 说明](docs/yaml-schema.md)
- [JSON Schema 文件](schema/scriptforge.schema.json)

## 输出特点

1. 支持处理 3 个章节以上的小说输入。
2. 输出不是普通文本，而是符合 Schema 的结构化 YAML。
3. 生成结果可以追溯来源、校验字段、继续编辑和导出。
