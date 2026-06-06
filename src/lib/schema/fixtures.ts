import type { ScriptForgeDocument } from "@/types/scriptforge";

/** Valid demo document matching yaml-schema.md example. */
export const validDocument: ScriptForgeDocument = {
  script: {
    schema_version: "1.1",
    title: "雨夜档案",
    metadata: {
      language: "zh-CN",
      format: "short_drama",
      genre: "悬疑",
      target_duration_minutes: 12,
      logline: "年轻记者追查父亲失踪真相，却发现旧报社隐藏着更深的秘密。",
      tone: "紧张、克制、现实主义",
    },
    source: {
      type: "novel",
      chapters: [
        {
          id: "ch_001",
          title: "第一章 雨夜",
          summary: "林舟收到父亲留下的匿名信，前往旧报社。",
          key_facts: [
            { id: "fact_001", type: "event", content: "林舟在雨夜收到一封没有署名的信。" },
            { id: "fact_002", type: "character_goal", content: "林舟想查清父亲失踪前留下的线索。" },
            { id: "fact_003", type: "location", content: "信中指向一座已经停用的旧报社地下室。" },
          ],
        },
        {
          id: "ch_002",
          title: "第二章 档案室",
          summary: "林舟在地下档案室发现失踪案卷宗。",
          key_facts: [
            { id: "fact_004", type: "event", content: "林舟进入地下档案室并发现失踪案卷宗。" },
            { id: "fact_005", type: "object", content: "卷宗封皮被潮气泡软，夹着父亲当年的采访卡。" },
            { id: "fact_006", type: "conflict", content: "管理员许曼试图阻止林舟继续翻查档案。" },
          ],
        },
        {
          id: "ch_003",
          title: "第三章 旧照片",
          summary: "一张旧照片揭示管理员与父亲曾经相识。",
          key_facts: [
            { id: "fact_007", type: "information", content: "旧照片显示许曼与林舟父亲曾经同框。" },
            { id: "fact_008", type: "relationship", content: "许曼隐瞒了自己认识林舟父亲的事实。" },
            { id: "fact_009", type: "emotion", content: "林舟意识到许曼的沉默不是冷漠，而是戒备。" },
          ],
        },
      ],
    },
    characters: [
      {
        id: "char_001",
        name: "林舟",
        role: "protagonist",
        description: "年轻记者，执着但冲动。",
        motivation: "查明父亲失踪真相。",
        arc: "从单打独斗到开始信任他人。",
        voice: "短句多，追问直接。",
      },
      {
        id: "char_002",
        name: "许曼",
        role: "supporting",
        description: "旧报社管理员，沉默寡言。",
        motivation: "守护报社秘密。",
        arc: "从拒绝到被迫合作。",
        voice: "言简意赅，带有戒备。",
        relationships: [{ target: "char_001", type: "colleague", description: "工作关系，互不信任。" }],
      },
    ],
    locations: [
      {
        id: "loc_001",
        name: "旧报社地下室",
        description: "昏暗、潮湿，墙上贴满旧报纸。",
        visual_notes: "手电光、低照度、狭窄空间。",
      },
    ],
    scenes: [
      {
        id: "scene_001",
        title: "铁门之后",
        source_chapters: ["ch_001", "ch_002", "ch_003"],
        source_refs: ["fact_001", "fact_002", "fact_004", "fact_006", "fact_007", "fact_008"],
        location: "loc_001",
        time: "night",
        characters: ["char_001", "char_002"],
        scene_card: {
          objective: "林舟想进入档案室确认父亲留下的线索。",
          opposition: "许曼用警告、沉默和反问阻止他继续深入。",
          entry_state: "林舟带着怀疑和急迫推门进入，许曼保持戒备。",
          turning_point: "林舟在卷宗里看见旧照片，确认许曼认识父亲。",
          exit_state: "林舟获得新的追查方向，许曼的隐瞒被迫暴露。",
          visual_atmosphere: "地下室潮湿昏暗，铁门回声、手电光和旧纸气味压住两人的呼吸。",
        },
        dramatic_purpose: "让主角进入核心调查地点。",
        conflict: "主角害怕未知，但必须继续追查；管理员试图阻止他继续深入。",
        beats: [
          { type: "action", function: "establish", source_refs: ["fact_001", "fact_003"], content: "林舟推开地下室铁门，潮气扑面而来，手电光先扫过墙上的旧报纸，才停在档案柜的铜牌上。" },
          { type: "dialogue", character: "char_002", function: "evade", source_refs: ["fact_006"], content: "许曼没有让开，只把钥匙攥进掌心：你父亲如果真想让你来，就不会只留一封没有署名的信。" },
          { type: "dialogue", character: "char_001", function: "pressure", source_refs: ["fact_002", "fact_004"], content: "林舟盯住她攥紧的手：所以你知道这封信，也知道他最后查到了这里。" },
          { type: "action", function: "reveal", source_refs: ["fact_005", "fact_007"], content: "他抽出潮软卷宗，旧照片从夹页里滑落，照片背面父亲的名字被水迹泡开，许曼的脸色终于变了。" },
          { type: "dialogue", character: "char_002", function: "turn", source_refs: ["fact_008", "fact_009"], content: "许曼移开视线，声音压得很低：有些事他没告诉你，是因为知道你一定会追到这里。" },
        ],
        adaptation_notes: ["合并三章线索，把匿名信、档案室和旧照片压成一场有转折的调查对手戏。"],
      },
    ],
    adaptation_report: {
      chapter_count: 3,
      scene_count: 1,
      character_count: 2,
      main_conflicts: ["主角追查真相与未知危险之间的冲突。"],
      omitted_or_compressed: ["压缩了原文中较长的环境描写。"],
      revision_suggestions: ["建议增加与管理员的对手戏。"],
    },
  },
};

/** Document with a missing required field (title). */
export function makeMissingFieldDocument(): ScriptForgeDocument {
  const doc = structuredClone(validDocument) as ScriptForgeDocument;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (doc.script as any).title;
  return doc;
}

/** Document with broken cross-references. */
export function makeBrokenReferenceDocument(): ScriptForgeDocument {
  const doc = structuredClone(validDocument) as ScriptForgeDocument;
  doc.script.scenes[0].location = "loc_999";
  doc.script.scenes[0].characters = ["char_001", "char_999"];
  doc.script.scenes[0].source_chapters = ["ch_999"];
  doc.script.characters[0].relationships = [
    { target: "char_999", type: "family", description: "不存在的关系目标。" },
  ];
  const dialogueBeat = doc.script.scenes[0].beats.find((b) => b.type === "dialogue");
  if (dialogueBeat && dialogueBeat.type === "dialogue") {
    dialogueBeat.character = "char_999";
  }
  return doc;
}

/** Document with empty adaptation report fields (should warn). */
export function makeEmptyAdaptationReportDocument(): ScriptForgeDocument {
  const doc = structuredClone(validDocument) as ScriptForgeDocument;
  doc.script.adaptation_report = {
    chapter_count: 3,
    scene_count: 1,
    character_count: 2,
    main_conflicts: [],
    omitted_or_compressed: [],
    revision_suggestions: [],
  };
  return doc;
}
