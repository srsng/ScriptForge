# ScriptForge 剧本 YAML Schema

## 1. 设计思路

这份 Schema 不是从“剧本文档长什么样”开始设计的，而是从改编稿的检查和二次创作流程倒推。

小说改成短剧后，后面还会继续压冲突、拆集点、加钩子、调人物声口。为了让这些工作可控，改编结果不能只有一段正文；它需要保留几个能被继续操作的层级：原文材料、改编规格、人物地点、场景、正文节拍和改编说明。

本项目按这个顺序定义数据：

- `source` 放章节、摘要和关键事实，回答“这场戏从原文哪里来”。
- `metadata` 放语言、格式、时长、题材和语气，回答“这次要改成什么方向”。
- `characters`、`locations` 单独成表，回答“人物和场所有没有前后一致”。
- `scenes` 组织每场戏的来源、地点、人物、冲突和转折，回答“这场戏为什么存在”。
- `beats` 写动作、对白、旁白和转场，回答“这一拍在推进什么”。
- `adaptation_report` 记录合并、压缩、省略情况和修改建议，回答“这版改编做了哪些取舍”。

这样拆开以后，后续 AI 不需要整篇重写。它可以只改某场戏的转折，只增强某组 beat 的冲突，只统一某个人物的台词口吻，或者只根据报告补一处被压掉的信息。Schema 的作用就是把这些可修改的位置提前留出来。

---

## 2. 顶层结构

```yaml
script:
  schema_version: "1.1"
  title: "旧报社之门"
  metadata: {}
  source: {}
  characters: []
  locations: []
  scenes: []
  adaptation_report: {}
```

顶层只保留一个 `script` 对象。`script` 下的字段全部必填，Schema 禁止额外字段。

这样定，是为了让生成结果稳定进入后续流程：

- `metadata` 说明这次要改成什么规格；
- `source` 保存原小说依据；
- `characters` 和 `locations` 是剧本资源表；
- `scenes` 是正文；
- `adaptation_report` 说明改编取舍。

这不是“把剧本文本包一层壳”，而是把一次改编拆成可校验、可追溯、可继续编辑的几个部分。

---

## 3. metadata：改编规格

```yaml
metadata:
  language: "zh-CN"
  format: "short_drama"
  genre: "都市悬疑"
  target_duration_minutes: 12
  logline: "年轻记者追查父亲旧案，在废弃报社发现被隐瞒的证据。"
  tone: "紧张、克制、现实感"
```

字段定义：

| 字段                      | 规则                             | 用途                         |
| ------------------------- | -------------------------------- | ---------------------------- |
| `language`                | 当前固定 `zh-CN`                 | 收敛中文剧本输出。           |
| `format`                  | `short_drama` / `film` / `stage` | 区分短剧、电影、舞台剧。     |
| `genre`                   | 非空                             | 影响冲突、节奏、对白和氛围。 |
| `target_duration_minutes` | 1-180 整数                       | 控制场景和 beat 容量。       |
| `logline`                 | 非空                             | 保存一句话核心卖点。         |
| `tone`                    | 非空                             | 约束整体表达。               |

`metadata` 是生成规格，不是展示信息。后续重新生成、修订、质量检查都要读这里。

---

## 4. source：原文依据层

```yaml
source:
  type: "novel"
  chapters:
    - id: "ch_001"
      title: "第一章 雨夜"
      summary: "林舟收到指向旧报社的匿名信。"
      key_facts:
        - id: "fact_001"
          type: "event"
          content: "林舟收到匿名信。"
        - id: "fact_002"
          type: "character_goal"
          content: "林舟想查清父亲失踪真相。"
        - id: "fact_003"
          type: "location"
          content: "匿名信指向旧报社地下室。"
```

规则：

- `source.type` 固定为 `novel`。
- `chapters` 至少 3 个，对应赛题要求。
- 每章必须有 `id`、`title`、`summary`、`key_facts`。
- 每章 `key_facts` 至少 3 条。
- `fact` 类型限定为：`event`、`character_goal`、`relationship`、`object`、`location`、`information`、`emotion`、`conflict`。

`key_facts` 是整套 Schema 的来源锚点。场景和 beat 不能只写“看起来合理”的内容，必须通过 `source_refs` 指回这些事实。这样用户能看到：这场戏用了哪些原文信息，哪些地方被合并或压缩。

---

## 5. ID 和引用

所有主要对象都有稳定 ID。

| 对象 | 示例        | 常见引用位置                                                         |
| ---- | ----------- | -------------------------------------------------------------------- |
| 章节 | `ch_001`    | `scenes[].source_chapters`                                           |
| 事实 | `fact_001`  | `scenes[].source_refs`、`beats[].source_refs`                        |
| 人物 | `char_001`  | `scenes[].characters`、`beats[].character`、`relationships[].target` |
| 地点 | `loc_001`   | `scenes[].location`                                                  |
| 场景 | `scene_001` | 场景自身标识                                                         |

JSON Schema 检查 ID 格式；应用层再检查引用是否真的存在：

- 场景地点必须在 `locations` 里；
- 场景人物必须在 `characters` 里；
- 场景来源章节必须在 `source.chapters` 里；
- 场景和 beat 的 `source_refs` 必须指向真实且唯一的 `fact`；
- 对白 beat 的 `character` 必须是已定义人物；
- 人物关系的 `target` 必须是已定义人物。

这一步很关键。没有引用检查，AI 很容易写出“看着完整、实际断链”的文档。

---

## 6. characters：人物表

```yaml
characters:
  - id: "char_001"
    name: "林舟"
    role: "protagonist"
    description: "年轻记者，执着但冲动。"
    motivation: "查明父亲失踪真相。"
    arc: "从单打独斗到开始信任他人。"
    voice: "短句多，追问直接。"
    relationships:
      - target: "char_002"
        type: "colleague"
        description: "工作关系，互不信任。"
```

角色字段不只为展示服务：

- `role` 定义戏剧位置：主角、反派、配角、次要人物、旁白或未知；
- `motivation` 决定人物为什么行动；
- `arc` 记录变化方向；
- `voice` 约束对白口吻；
- `relationships` 保存人物关系，并参与引用校验。

小说人物进入剧本后，要能支撑行动、冲突和对白。只保留姓名不够。

---

## 7. locations：地点表

```yaml
locations:
  - id: "loc_001"
    name: "旧报社地下室"
    description: "昏暗、潮湿，墙上贴满旧报纸。"
    visual_notes: "手电光、低照度、狭窄空间。"
```

地点必须单独建表，因为场景要引用它。`description` 说明空间是什么，`visual_notes` 说明它怎么被看见、被拍出来或被舞台化。

这样做可以避免每场戏重复描述地点，也方便后续做场景预览和制作提示。

---

## 8. scenes：剧本主体

```yaml
scenes:
  - id: "scene_001"
    title: "铁门之后"
    source_chapters: ["ch_001", "ch_002", "ch_003"]
    source_refs: ["fact_001", "fact_004", "fact_006", "fact_007"]
    location: "loc_001"
    time: "night"
    characters: ["char_001", "char_002"]
    scene_card: {}
    dramatic_purpose: "让主角进入核心调查地点，并暴露知情人的隐瞒。"
    conflict: "主角必须继续追查；管理员试图阻止他深入。"
    beats: []
    adaptation_notes:
      - "合并三章中的调查信息，压缩为一个高压场景。"
```

一场戏必须回答这些问题：

- 来自哪些章节：`source_chapters`；
- 使用哪些原文事实：`source_refs`；
- 发生在哪里、什么时候：`location`、`time`；
- 谁在场：`characters`；
- 这场戏有什么目标、阻碍、转折：`scene_card`；
- 在整部剧本里干什么：`dramatic_purpose`；
- 冲突是什么：`conflict`；
- 具体怎么演出来：`beats`；
- 做了哪些合并压缩：`adaptation_notes`。

这样定义后，场景不是剧情摘要，而是可检查的剧本单元。

---

## 9. scene_card：场面卡

```yaml
scene_card:
  objective: "林舟想进入档案室确认父亲留下的线索。"
  opposition: "许曼用警告、沉默和反问阻止他。"
  entry_state: "林舟带着怀疑和急迫推门进入。"
  turning_point: "林舟在卷宗里看见旧照片。"
  exit_state: "林舟确认许曼认识父亲。"
  visual_atmosphere: "地下室潮湿昏暗，铁门回声和旧纸气味压住对话。"
```

`scene_card` 用来卡住一场戏的骨架：

- `objective`：人物想要什么；
- `opposition`：什么在阻止他；
- `entry_state`：进场前的状态；
- `turning_point`：本场发生的关键变化；
- `exit_state`：离场后的状态；
- `visual_atmosphere`：画面和氛围。

保留这个结构，是为了防止模型只写信息说明。没有目标、阻碍和转折的场景，即使对白顺，也不是一场有效的戏。

---

## 10. beats：动作和对白节拍

```yaml
beats:
  - type: "action"
    function: "establish"
    source_refs: ["fact_003"]
    character: "char_001"
    content: "林舟推开地下室铁门，手电光先扫过墙上的旧报纸。"
  - type: "dialogue"
    function: "evade"
    source_refs: ["fact_006"]
    character: "char_002"
    content: "你现在回头，还来得及。"
```

规则：

- `type`：`action`、`dialogue`、`narration`、`transition`、`note`；
- `function`：`establish`、`probe`、`evade`、`pressure`、`reveal`、`turn`、`reaction`、`pause`、`transition`、`note`；
- `source_refs`：至少 1 个 fact；
- `dialogue` 必须有 `character`；
- `content` 是实际文本。

`type` 说明它是什么，`function` 说明它在场景里干什么。这个设计让质量检查能看出：场景是否只有铺垫、有没有施压、有没有揭示、有没有转折。

---

## 11. adaptation_report：改编说明

```yaml
adaptation_report:
  chapter_count: 3
  scene_count: 1
  character_count: 2
  main_conflicts:
    - "林舟追查旧案与许曼阻止之间的冲突。"
  omitted_or_compressed:
    - "压缩原文中重复的寻找路线，集中到档案室场景。"
  revision_suggestions:
    - "后续版本可以增加许曼选择协助林舟的心理转折。"
```

报告字段用来交代整体结果：

- 改了多少章；
- 生成多少场戏；
- 使用多少人物；
- 主冲突是什么；
- 哪些内容被省略或压缩；
- 后续怎么修。

小说改编一定会有取舍。这个字段要求模型把取舍写清楚，用户不用从正文里反推。

---

## 12. 校验方式

当前校验分两层。

第一层是 JSON Schema：

- 检查必填字段；
- 检查类型和枚举；
- 检查数组最小数量；
- 检查 ID 格式；
- 禁止额外字段；
- 检查 `dialogue` beat 必须有 `character`。

第二层是引用校验：

- 检查人物、地点、章节、事实是否被正确引用；
- 检查 fact id 是否全局唯一；
- 把断链问题定位到具体路径。

结构校验保证文档像不像；引用校验保证文档能不能用。

---

## 13. 完整示例

```yaml
script:
  schema_version: "1.1"
  title: "旧报社之门"
  metadata:
    language: "zh-CN"
    format: "short_drama"
    genre: "都市悬疑"
    target_duration_minutes: 12
    logline: "年轻记者追查父亲旧案，在废弃报社发现被隐瞒的证据。"
    tone: "紧张、克制、现实感"
  source:
    type: "novel"
    chapters:
      - id: "ch_001"
        title: "第一章 雨夜"
        summary: "林舟在雨夜收到指向旧报社的匿名信。"
        key_facts:
          - id: "fact_001"
            type: "event"
            content: "林舟收到匿名信。"
          - id: "fact_002"
            type: "character_goal"
            content: "林舟想查清父亲失踪真相。"
          - id: "fact_003"
            type: "location"
            content: "匿名信指向旧报社地下室。"
      - id: "ch_002"
        title: "第二章 档案室"
        summary: "林舟进入地下档案室并发现旧案卷宗。"
        key_facts:
          - id: "fact_004"
            type: "event"
            content: "林舟进入地下档案室。"
          - id: "fact_005"
            type: "object"
            content: "卷宗夹着父亲当年的采访卡。"
          - id: "fact_006"
            type: "conflict"
            content: "许曼试图阻止林舟继续翻查档案。"
      - id: "ch_003"
        title: "第三章 旧照片"
        summary: "旧照片揭示许曼与林舟父亲曾经相识。"
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
      dramatic_purpose: "让主角进入核心调查地点，并暴露关键知情人的隐瞒。"
      conflict: "主角必须继续追查；管理员试图阻止他深入。"
      beats:
        - type: "action"
          character: "char_001"
          function: "establish"
          source_refs: ["fact_001", "fact_003"]
          content: "林舟推开地下室铁门，手电光先扫过墙上的旧报纸。"
        - type: "dialogue"
          character: "char_002"
          function: "evade"
          source_refs: ["fact_006"]
          content: "你现在回头，还来得及。"
        - type: "action"
          character: "char_001"
          function: "reveal"
          source_refs: ["fact_007"]
          content: "林舟从卷宗夹层里抽出旧照片，照片背面写着父亲的名字。"
      adaptation_notes:
        - "合并三章中的调查信息，压缩为一个高压场景。"
  adaptation_report:
    chapter_count: 3
    scene_count: 1
    character_count: 2
    main_conflicts:
      - "林舟追查旧案与许曼阻止之间的冲突。"
    omitted_or_compressed:
      - "压缩原文中重复的寻找路线，集中到档案室场景。"
    revision_suggestions:
      - "后续版本可以增加许曼选择协助林舟的心理转折。"
```
