# ScriptForge

ScriptForge 是一个面向小说作者的 AI 剧本改编工作台。它把 3 个章节以上的小说文本转换为可编辑、可校验、可导出的结构化剧本 YAML，帮助作者快速获得可以继续打磨的剧本初稿。

本项目用于 48 小时 AI 黑客马拉松，选择课题为：AI 小说转剧本工具。

## 一句话定位

ScriptForge 不只是让 AI 生成一段剧本文本，而是把小说改编过程拆成可追溯、可校验、可编辑的结构化工作流。

## 核心交付

- 支持输入 3 个章节以上的小说文本。
- 自动分析人物、地点、关键事件、冲突和人物动机。
- 自动生成结构化剧本数据。
- 输出符合 YAML Schema 的剧本 YAML。
- 提供 YAML Schema 文档，并说明设计原因。
- 提供剧本预览、Schema 校验、错误提示和导出能力。

## 推荐 MVP 流程

```text
小说章节输入
  ↓
章节摘要与信息抽取
  ↓
故事圣经 Story Bible
  ↓
场景规划 Scene Plan
  ↓
结构化剧本 JSON
  ↓
Schema 校验与自动修复
  ↓
YAML 导出与剧本预览
```

## 技术路线

为了保证 48 小时内稳定交付，第一版采用 Next.js 全栈单体应用：

- 前端：Next.js App Router、TypeScript、Tailwind CSS、shadcn/ui、lucide-react
- 编辑器：Monaco Editor 或 CodeMirror
- YAML：yaml 或 js-yaml
- Schema 校验：JSON Schema + Ajv
- AI 接入：OpenAI-compatible adapter，便于切换不同模型
- 存储：第一版不依赖数据库，优先使用浏览器状态和文件导出
- 导出：YAML、Markdown、JSON

## 产品视图

第一版建议做成单页工作台：

```text
左侧：章节输入与示例文本
中间：AI 改编流程、人物/场景分析、场景卡片
右侧：YAML 编辑器、Schema 校验结果、剧本预览
```

打开应用后直接进入工作台，不做营销型首页。

## 文档索引

- [产品叙事](docs/product-story.md)
- [产品设计](docs/product-design.md)
- [技术设计](docs/technical-design.md)
- [YAML Schema 说明](docs/yaml-schema.md)
- [48 小时执行计划](docs/48-hour-plan.md)
- [演示脚本](docs/demo-script.md)
- [JSON Schema 文件](schema/scriptforge.schema.json)

## Demo 重点

演示时重点证明三件事：

1. ScriptForge 能处理 3 个章节以上的小说输入。
2. 输出不是普通文本，而是符合 Schema 的结构化 YAML。
3. 生成结果可以追溯来源、校验字段、继续编辑和导出。

## 当前阶段

当前阶段是项目启动和文档定稿。下一步建议初始化 Next.js 项目骨架，并实现静态样例版工作台，再接入 AI 生成链路。
