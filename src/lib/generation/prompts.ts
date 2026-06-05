import type { GenerationRequest } from "@/types/scriptforge";
import type { PromptBundle, PromptMessage } from "./types";

function chapterDigest(request: GenerationRequest): string {
  return request.chapters
    .map((chapter, index) => {
      const content = chapter.content.replace(/\s+/g, " ").trim();
      const excerpt = content.length > 900 ? `${content.slice(0, 900)}……` : content;
      return `${index + 1}. id=${chapter.id}\n标题：${chapter.title}\n正文摘录：${excerpt}`;
    })
    .join("\n\n");
}

const jsonOnly = "只输出一个 JSON 对象；不要 Markdown、不要 YAML、不要解释性文字。";

export function buildPromptStages(request: GenerationRequest): PromptBundle[] {
  const sharedContext = `目标格式：${request.target.format}\n类型：${request.target.genre}\n时长：${request.target.target_duration_minutes} 分钟\n气质：${request.target.tone}\n\n小说章节：\n${chapterDigest(request)}`;

  return [
    {
      stage: "analyzer",
      responseContract: "输出 story_analysis：包含 premise、chapter_summaries、characters、locations、conflicts。",
      messages: [
        { role: "system", content: `你是 ScriptForge Analyzer，负责把小说章节拆成可改编事实。${jsonOnly}` },
        { role: "user", content: `${sharedContext}\n\n请分析故事素材，保留章节 id 引用。` },
      ],
    },
    {
      stage: "planner",
      responseContract: "输出 adaptation_plan：包含 logline、scene_plan、character_plan、compression_plan。",
      messages: [
        { role: "system", content: `你是 ScriptForge Planner，负责把分析结果规划成短时长改编方案。${jsonOnly}` },
        { role: "user", content: `${sharedContext}\n\n请规划 3-6 个场景，每场必须列 source_chapters。` },
      ],
    },
    {
      stage: "screenwriter",
      responseContract: "输出 script：必须符合 ScriptForgeDocument.script 字段结构，包含人物、地点、场景、beats。",
      messages: [
        { role: "system", content: `你是 ScriptForge Screenwriter，负责写可校验剧本 JSON。${jsonOnly}` },
        { role: "user", content: `${sharedContext}\n\n请生成完整 script 对象，所有 id 使用 ch_001/char_001/loc_001/scene_001 样式。` },
      ],
    },
    {
      stage: "reporter",
      responseContract: "输出完整 ScriptForgeDocument：{ script: { schema_version, title, metadata, source, characters, locations, scenes, adaptation_report } }。",
      messages: [
        { role: "system", content: `你是 ScriptForge Adaptation Reporter，负责最终合并并只输出可解析 JSON。${jsonOnly}` },
        {
          role: "user",
          content: `${sharedContext}\n\n请直接输出完整 ScriptForgeDocument JSON。要求：\n- script.schema_version 固定为 \"1.0\"。\n- metadata.language 固定为 \"zh-CN\"，format 必须为 ${request.target.format}。\n- source.chapters 至少包含输入的前三章 id、title、summary。\n- 每个 scene.location 必须引用 locations.id。\n- 每个 scene.characters 和 dialogue.character 必须引用 characters.id。\n- 每个 scene.source_chapters 必须引用 source.chapters.id。\n- beats 至少包含 action 或 dialogue。\n- adaptation_report 写明压缩与修改建议。`,
        },
      ],
    },
  ];
}

export function buildCombinedMessages(stages: PromptBundle[]): PromptMessage[] {
  const jsonOnly = "请严格输出 JSON，不要 Markdown 代码块，不要解释性文字。";
  const stageContract = stages
    .map((stage, index) => `${index + 1}. ${stage.stage}: ${stage.responseContract}`)
    .join("\n");
  const finalStage = stages[stages.length - 1];
  return [
    {
      role: "system",
      content: `你是 ScriptForge AI 改编生成管线。内部依次执行 Analyzer / Planner / Screenwriter / Adaptation Reporter，但最终只能输出一个 JSON 对象。${jsonOnly}`,
    },
    {
      role: "user",
      content: `阶段契约：\n${stageContract}\n\n${finalStage.messages.map((message) => message.content).join("\n\n")}`,
    },
  ];
}

export function buildGenerationPrompts(request: GenerationRequest): PromptBundle[] {
  return buildPromptStages(request);
}

export function flattenForSingleRequest(stages: PromptBundle[]): PromptMessage[] {
  return buildCombinedMessages(stages);
}
