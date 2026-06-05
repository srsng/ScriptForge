import type { ScriptForgeDocument } from "@/types/scriptforge";

/** Valid demo document matching yaml-schema.md example. */
export const validDocument: ScriptForgeDocument = {
  script: {
    schema_version: "1.0",
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
        { id: "ch_001", title: "第一章 雨夜", summary: "林舟收到父亲留下的匿名信，前往旧报社。" },
        { id: "ch_002", title: "第二章 档案室", summary: "林舟在地下档案室发现失踪案卷宗。" },
        { id: "ch_003", title: "第三章 旧照片", summary: "一张旧照片揭示管理员与父亲曾经相识。" },
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
        source_chapters: ["ch_001"],
        location: "loc_001",
        time: "night",
        characters: ["char_001", "char_002"],
        dramatic_purpose: "让主角进入核心调查地点。",
        conflict: "主角害怕未知，但必须继续追查；管理员试图阻止他继续深入。",
        beats: [
          { type: "action", content: "林舟推开地下室铁门，潮气扑面而来。" },
          { type: "dialogue", character: "char_002", content: "你父亲如果真想让你来，就不会只留一封没有署名的信。" },
          { type: "narration", content: "他终于来到父亲信中提到的地方。" },
        ],
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
