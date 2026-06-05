# YAML Schema 说明

## 1. 文档目的

本文定义 ScriptForge 输出剧本 YAML 的结构，并说明每一类字段的设计原因。该 Schema 的目标不是限制作者创作，而是让 AI 生成结果从一段不可控文本变成可编辑、可校验、可导出、可继续进入后续生产流程的结构化资产。

黑客马拉松题目要求输出结构化剧本 YAML，并额外定义 YAML Schema。ScriptForge 采用“JSON Schema 校验 + YAML 展示/导出”的方式实现：模型优先生成结构化 JSON，程序校验后再转换为 YAML。

## 2. 顶层结构

ScriptForge 的 YAML 顶层只有一个 `script` 字段：

```yaml
script:
  schema_version: "1.0"
  title: "示例剧本"
  metadata: {}
  source: {}
  characters: []
  locations: []
  scenes: []
  adaptation_report: {}
```

这样设计有三个原因：

1. 顶层入口明确，便于后续扩展多个文档类型。
2. 所有剧本内容都归属于 `script`，导入导出时边界清晰。
3. 可以在 `schema_version` 中标记版本，方便未来升级 Schema。

## 3. metadata

`metadata` 描述剧本生成目标和整体风格。

核心字段：

```yaml
metadata:
  language: "zh-CN"
  format: "short_drama"
  genre: "悬疑"
  target_duration_minutes: 12
  logline: "一句话故事梗概"
  tone: "紧张、克制、现实主义"
```

设计原因：

- `language` 确保输出语言明确。
- `format` 区分短剧、电影剧本和舞台剧，不同格式会影响场景密度和对白比例。
- `genre` 与 `tone` 用于保持风格一致性。
- `target_duration_minutes` 帮助控制剧本长度和场景数量。
- `logline` 方便评委或作者快速理解故事。

## 4. source

`source` 保存原始章节信息和改编范围。

```yaml
source:
  type: "novel"
  chapters:
    - id: "ch_001"
      title: "第一章 雨夜"
      summary: "主角在雨夜发现父亲留下的线索。"
```

设计原因：

- 题目要求支持 3 个章节以上小说文本，因此章节必须成为一等对象。
- `summary` 让长文本输入被压缩成可读的章节摘要。
- 后续场景通过 `source_chapters` 引用章节，实现改编依据追溯。

## 5. characters

`characters` 定义剧本中的人物表。

```yaml
characters:
  - id: "char_001"
    name: "林舟"
    role: "protagonist"
    description: "年轻记者，执着但冲动。"
    motivation: "查明父亲失踪真相。"
    arc: "从莽撞追查到学会信任他人。"
    voice: "短句多，语气直接。"
```

设计原因：

- 剧本高度依赖人物行动和对白，人物表能降低前后不一致的风险。
- `motivation` 帮助模型生成更合理的冲突和行动。
- `voice` 约束对白风格，避免所有角色说话方式相同。
- `arc` 记录人物变化，便于后续扩展到多集剧本。

## 6. locations

`locations` 定义地点表。

```yaml
locations:
  - id: "loc_001"
    name: "旧报社地下室"
    description: "昏暗、潮湿，墙上贴满旧报纸。"
    visual_notes: "适合低照度、手电筒光源和狭窄构图。"
```

设计原因：

- 剧本是场景驱动的，地点决定了动作、调度和视觉呈现。
- 独立地点表可以避免同一地点多种名称混用。
- `visual_notes` 为后续分镜、拍摄计划或舞台设计留下接口。

## 7. scenes

`scenes` 是 Schema 的核心。每个 scene 对应一场戏。

```yaml
scenes:
  - id: "scene_001"
    title: "地下室的纸袋"
    source_chapters: ["ch_001"]
    location: "loc_001"
    time: "night"
    characters: ["char_001", "char_002"]
    dramatic_purpose: "让主角获得父亲留下的第一条线索。"
    conflict: "主角想进入档案室，管理员试图阻止。"
    beats:
      - type: "action"
        content: "林舟推开铁门，手电筒扫过满墙旧报纸。"
      - type: "dialogue"
        character: "char_002"
        content: "你不该来这里。"
```

设计原因：

- `source_chapters` 保证每场戏都有来源依据。
- `location` 与 `time` 是剧本场景的基本条件。
- `dramatic_purpose` 让每场戏有明确叙事功能，避免流水账。
- `conflict` 强制 AI 提炼戏剧张力。
- `beats` 把剧本拆成动作、对白、转场、旁白和备注，方便编辑和导出。

## 8. beats

`beats` 是场景中的最小剧本单元。

支持类型：

- `action`：动作或场面说明。
- `dialogue`：角色对白。
- `narration`：旁白。
- `transition`：转场。
- `note`：改编备注。

对白 beat 必须包含 `character` 字段，其他类型不强制要求。

设计原因：

- 小说中的心理描写需要转换为动作和对白，`beats` 可以明确转换结果。
- 类型化 beat 方便前端渲染不同样式。
- 后续导出 Markdown、分镜或拍摄表时，可以按类型转换。

## 9. adaptation_report

`adaptation_report` 保存 AI 对本次改编的总结。

```yaml
adaptation_report:
  chapter_count: 3
  scene_count: 8
  character_count: 5
  main_conflicts:
    - "主角追查真相与外部阻碍之间的冲突。"
  omitted_or_compressed:
    - "压缩了第二章中较长的内心独白。"
  revision_suggestions:
    - "建议人工强化第三场中反派的动机。"
```

设计原因：

- 让作者快速知道 AI 做了哪些取舍。
- 帮助评委理解系统不是黑盒生成，而是有改编判断。
- 为后续人工打磨提供入口。

## 10. 校验规则

ScriptForge 使用两层校验。

### JSON Schema 校验

负责：

- 必填字段。
- 字段类型。
- 枚举值。
- 数组最小长度。
- beat 类型与基础结构。

### 应用层校验

负责跨引用关系：

- `scene.location` 必须存在于 `locations`。
- `scene.characters` 中的角色必须存在于 `characters`。
- `dialogue.character` 必须存在于当前 scene 的 characters。
- `scene.source_chapters` 必须存在于 `source.chapters`。

跨引用校验不完全放进 JSON Schema，是因为标准 JSON Schema 对动态集合引用不够直观，应用层实现更清晰，也更容易给用户展示错误信息。

## 11. YAML 示例

```yaml
script:
  schema_version: "1.0"
  title: "雨夜档案"
  metadata:
    language: "zh-CN"
    format: "short_drama"
    genre: "悬疑"
    target_duration_minutes: 12
    logline: "年轻记者追查父亲失踪真相，却发现旧报社隐藏着更深的秘密。"
    tone: "紧张、克制、现实主义"
  source:
    type: "novel"
    chapters:
      - id: "ch_001"
        title: "第一章 雨夜"
        summary: "林舟收到父亲留下的匿名信，前往旧报社。"
      - id: "ch_002"
        title: "第二章 档案室"
        summary: "林舟在地下档案室发现失踪案卷宗。"
      - id: "ch_003"
        title: "第三章 旧照片"
        summary: "一张旧照片揭示管理员与父亲曾经相识。"
  characters:
    - id: "char_001"
      name: "林舟"
      role: "protagonist"
      description: "年轻记者，执着但冲动。"
      motivation: "查明父亲失踪真相。"
      arc: "从单打独斗到开始信任他人。"
      voice: "短句多，追问直接。"
  locations:
    - id: "loc_001"
      name: "旧报社地下室"
      description: "昏暗、潮湿，墙上贴满旧报纸。"
      visual_notes: "手电光、低照度、狭窄空间。"
  scenes:
    - id: "scene_001"
      title: "铁门之后"
      source_chapters: ["ch_001"]
      location: "loc_001"
      time: "night"
      characters: ["char_001"]
      dramatic_purpose: "让主角进入核心调查地点。"
      conflict: "主角害怕未知，但必须继续追查。"
      beats:
        - type: "action"
          content: "林舟推开地下室铁门，潮气扑面而来。"
        - type: "narration"
          content: "他终于来到父亲信中提到的地方。"
  adaptation_report:
    chapter_count: 3
    scene_count: 1
    character_count: 1
    main_conflicts:
      - "主角追查真相与未知危险之间的冲突。"
    omitted_or_compressed:
      - "压缩了原文中较长的环境描写。"
    revision_suggestions:
      - "建议增加与管理员的对手戏。"
```

## 12. 后续扩展

后续版本可以扩展：

- 多集短剧结构。
- 分镜字段。
- 拍摄成本估算。
- 场景时长估计。
- 人物关系图。
- 与专业剧本格式互转。
