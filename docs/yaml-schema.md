# YAML Schema 说明

## 1. 文档目的

ScriptForge 1.1 把小说改编过程中的中间资产显性化：原文事实、自然场面卡和 beat 戏剧功能都进入最终 YAML。目标不是只生成一段“像剧本”的文本，而是生成可编辑、可校验、可追溯、可继续生产的结构化剧本初稿。

模型仍优先输出 JSON，程序通过 JSON Schema 与应用层引用校验后再导出 YAML。

## 2. 顶层结构

```yaml
script:
  schema_version: "1.1"
  title: "示例剧本"
  metadata: {}
  source: {}
  characters: []
  locations: []
  scenes: []
  adaptation_report: {}
```

`schema_version` 当前固定为 `"1.1"`。MVP 不兼容 1.0 文档。

## 3. Source Facts

`source.chapters[].key_facts` 是 1.1 的核心新增结构。每章至少 3 条事实，供 scene 和 beat 引用。

```yaml
source:
  type: "novel"
  chapters:
    - id: "ch_001"
      title: "第一章 雨夜"
      summary: "林舟收到父亲留下的匿名信。"
      key_facts:
        - id: "fact_001"
          type: "event"
          content: "林舟在雨夜收到一封没有署名的信。"
        - id: "fact_002"
          type: "character_goal"
          content: "林舟想查清父亲失踪前留下的线索。"
        - id: "fact_003"
          type: "location"
          content: "信中指向旧报社地下室。"
```

`fact id` 必须全局唯一，格式为 `fact_001`。`type` 可为 `event`、`character_goal`、`relationship`、`object`、`location`、`information`、`emotion`、`conflict`。

## 4. Scenes

`scenes` 是剧本主体。1.1 要求每场戏都带 `scene_card` 和 `source_refs`。

```yaml
scenes:
  - id: "scene_001"
    title: "铁门之后"
    source_chapters: ["ch_001", "ch_002"]
    source_refs: ["fact_001", "fact_004", "fact_007"]
    location: "loc_001"
    time: "night"
    characters: ["char_001", "char_002"]
    scene_card:
      objective: "林舟想进入档案室确认父亲留下的线索。"
      opposition: "许曼用警告、沉默和反问阻止他。"
      entry_state: "林舟带着怀疑和急迫推门进入。"
      turning_point: "林舟在卷宗里看见旧照片。"
      exit_state: "林舟获得新的追查方向，许曼的隐瞒被迫暴露。"
      visual_atmosphere: "地下室潮湿昏暗，铁门回声和旧纸气味压住对话。"
    dramatic_purpose: "让主角进入核心调查地点。"
    conflict: "主角追查真相，管理员试图阻止。"
    beats: []
```

`source_chapters` 说明场景来自哪些章节；`source_refs` 说明场景具体使用了哪些原文事实。`scene_card` 用来判断这场戏是否有目标、阻碍、转折和状态变化。

## 5. Beats

每个 beat 必须声明 `function` 和 `source_refs`。

```yaml
beats:
  - type: "action"
    character: "char_001"
    function: "establish"
    source_refs: ["fact_001"]
    content: "林舟推开地下室铁门，手电光先扫过墙上的旧报纸。"
  - type: "dialogue"
    character: "char_002"
    function: "evade"
    source_refs: ["fact_006"]
    content: "许曼没有让开，只把钥匙攥进掌心：你不该来这里。"
```

`function` 可为 `establish`、`probe`、`evade`、`pressure`、`reveal`、`turn`、`reaction`、`pause`、`transition`、`note`。它用于校验场内是否存在试探、回避、施压、揭示、转折和反应，而不只是堆字数。

## 6. 校验规则

JSON Schema 负责：

- 1.1 必填字段。
- 字段类型、枚举值和数组最小长度。
- `key_facts`、`scene_card`、`beat.function/source_refs` 的结构。

应用层引用校验负责：

- `scene.location` 必须存在于 `locations`。
- `scene.characters` 和 `dialogue.character` 必须存在于 `characters`。
- `scene.source_chapters` 必须存在于 `source.chapters`。
- `scene.source_refs` 和 `beats[].source_refs` 必须存在于 `source.chapters[].key_facts`。
- `fact id` 必须全局唯一。

质量门禁额外判断：

- 容量、对白、字数是否支撑目标时长。
- 是否存在摘要式 beat、结果式 action、干对白。
- 是否缺少 `turning_point`、`entry_state → exit_state` 变化、对白攻防轮次。
- 原文 facts 是否没有被 scene 或 beat 使用。

## 7. 完整示例

```yaml
script:
  schema_version: "1.1"
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
        key_facts:
          - id: "fact_001"
            type: "event"
            content: "林舟在雨夜收到一封没有署名的信。"
          - id: "fact_002"
            type: "character_goal"
            content: "林舟想查清父亲失踪前留下的线索。"
          - id: "fact_003"
            type: "location"
            content: "信中指向旧报社地下室。"
      - id: "ch_002"
        title: "第二章 档案室"
        summary: "林舟在地下档案室发现失踪案卷宗。"
        key_facts:
          - id: "fact_004"
            type: "event"
            content: "林舟进入地下档案室并发现卷宗。"
          - id: "fact_005"
            type: "object"
            content: "卷宗夹着父亲当年的采访卡。"
          - id: "fact_006"
            type: "conflict"
            content: "许曼试图阻止林舟继续翻查档案。"
      - id: "ch_003"
        title: "第三章 旧照片"
        summary: "旧照片揭示管理员与父亲曾经相识。"
        key_facts:
          - id: "fact_007"
            type: "information"
            content: "旧照片显示许曼与林舟父亲曾经同框。"
          - id: "fact_008"
            type: "relationship"
            content: "许曼隐瞒了自己认识林舟父亲的事实。"
          - id: "fact_009"
            type: "emotion"
            content: "林舟意识到许曼的沉默是戒备。"
  characters:
    - id: "char_001"
      name: "林舟"
      role: "protagonist"
      description: "年轻记者，执着但冲动。"
      motivation: "查明父亲失踪真相。"
      arc: "从单打独斗到开始信任他人。"
      voice: "短句多，追问直接。"
    - id: "char_002"
      name: "许曼"
      role: "supporting"
      description: "旧报社管理员，沉默寡言。"
      motivation: "守护报社秘密。"
      arc: "从拒绝到被迫合作。"
      voice: "言简意赅，带有戒备。"
      relationships:
        - target: "char_001"
          type: "colleague"
          description: "工作关系，互不信任。"
  locations:
    - id: "loc_001"
      name: "旧报社地下室"
      description: "昏暗、潮湿，墙上贴满旧报纸。"
      visual_notes: "手电光、低照度、狭窄空间。"
  scenes:
    - id: "scene_001"
      title: "铁门之后"
      source_chapters: ["ch_001", "ch_002", "ch_003"]
      source_refs: ["fact_001", "fact_004", "fact_006", "fact_007", "fact_008"]
      location: "loc_001"
      time: "night"
      characters: ["char_001", "char_002"]
      scene_card:
        objective: "林舟想进入档案室确认父亲留下的线索。"
        opposition: "许曼用警告、沉默和反问阻止他继续深入。"
        entry_state: "林舟带着怀疑和急迫推门进入，许曼保持戒备。"
        turning_point: "林舟在卷宗里看见旧照片，确认许曼认识父亲。"
        exit_state: "林舟获得新的追查方向，许曼的隐瞒被迫暴露。"
        visual_atmosphere: "地下室潮湿昏暗，铁门回声、手电光和旧纸气味压住两人的呼吸。"
      dramatic_purpose: "让主角进入核心调查地点。"
      conflict: "主角必须继续追查；管理员试图阻止他深入。"
      beats:
        - type: "action"
          character: "char_001"
          function: "establish"
          source_refs: ["fact_001", "fact_003"]
          content: "林舟推开地下室铁门，潮气扑面而来，手电光先扫过墙上的旧报纸。"
        - type: "dialogue"
          character: "char_002"
          function: "evade"
          source_refs: ["fact_006"]
          content: "许曼没有让开，只把钥匙攥进掌心：你不该来这里。"
        - type: "dialogue"
          character: "char_001"
          function: "pressure"
          source_refs: ["fact_002", "fact_004"]
          content: "林舟盯住她攥紧的手：那你为什么知道这封信？"
        - type: "action"
          character: "char_001"
          function: "reveal"
          source_refs: ["fact_005", "fact_007"]
          content: "旧照片从卷宗里滑落，照片背面父亲的名字被水迹泡开。"
        - type: "dialogue"
          character: "char_002"
          function: "turn"
          source_refs: ["fact_008", "fact_009"]
          content: "许曼移开视线，声音压低：有些事他没告诉你，是因为知道你一定会追到这里。"
      adaptation_notes:
        - "合并三章线索，把匿名信、档案室和旧照片压成一场有转折的调查对手戏。"
  adaptation_report:
    chapter_count: 3
    scene_count: 1
    character_count: 2
    main_conflicts:
      - "主角追查真相与管理员隐瞒之间的冲突。"
    omitted_or_compressed:
      - "压缩重复背景说明。"
    revision_suggestions:
      - "继续强化第二轮对白攻防。"
```
