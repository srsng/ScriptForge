import type { GenerationRequest } from "@/types/scriptforge";
import { buildScriptCapacityBudget } from "./quality";
import type { PromptBundle, PromptMessage } from "./types";

function chapterDigest(request: GenerationRequest): string {
  return request.chapters
    .map((chapter, index) => {
      const content = chapter.content.replace(/\s+/g, " ").trim();
      return `${index + 1}. id=${chapter.id}\n标题：${chapter.title}\n正文：${content}`;
    })
    .join("\n\n");
}

const jsonOnly = "只输出一个 JSON 对象；不要 Markdown、不要 YAML、不要解释性文字。";

const sourceGroundingRules = [
  "只允许使用输入章节提供的人物、地点、事件、关系和冲突；缺名时用功能名，但不得编造与原文无关的设定。",
  "每个 source.chapters[].summary 必须概括对应章节，不得写通用模板。",
  "每个 scene.source_chapters 必须引用实际输入章节 id，且场景内容必须能从这些章节追溯。",
  "人物动机、arc、对白 voice 必须来自章节行为和冲突的合理改编，不得脱离原文。",
].join("\n- ");

export function buildScriptDensityInstruction(request: GenerationRequest): string {
  const budget = buildScriptCapacityBudget(request);

  return `剧本改写质量要求：
- target_duration_minutes 是真实成片/演出目标时长，本次目标是 ${budget.targetDurationMinutes} 分钟；容量参考约 ${budget.minTotalBeats} 个 beats、${budget.minDialogueBeats} 条 dialogue beats、${budget.minScriptChars} 个中文字符，但不要为了数字拆分自然连续的场景。
- 场景数量由故事素材自行决定。先判断自然场景边界：地点变化、时间跳转、人物组合变化、人物目标变化、冲突进入新阶段或关键信息状态改变，才新开 scene。
- 不要为了凑场景数量拆分连续场景；同一地点、同一时间、同一组人物、同一目标下的连续对话、追问、沉默、动作推进，应留在同一 scene 内扩写。
- 每个 scene 必须是可直接拍摄、排练、继续编辑的完整场面，而不是章节总结；要包含场景进入、行动目标、阻碍、推进、反应、转折和收束。
- locations[].visual_notes 要写“渲染氛围”：光线、声音、空间压迫、物件状态，以及人物如何被环境影响。
- action 要写动作过程，不写结果句：起手、迟疑或阻碍、对象变化、人物反应、停顿或转折都要落到可拍细节。
- dialogue 要写潜台词 + 动作配合：台词体现试探、回避、压迫、反击或未说出口的目的，并结合表情、手部动作、沉默、视线或对方反应。
- action 与 dialogue 交错推进，不能连续用说明性 action 跳过人物反应，也不能用干巴巴的台词解释信息。
- 每个 beat.content 应包含具体动作、对象、环境、反应或对白攻防；不要输出剧情摘要，不要只列事件梗概，不允许每章只压缩成一场几句话。
- 如果内容仍像摘要、动作只有结果、对白缺少潜台词或主体文本明显过短，将被判定为 needs_revision。`;
}

const schemaInstructions = `输出必须是完整 ScriptForgeDocument，且只包含 Schema 允许字段：
{
  "script": {
    "schema_version": "1.0",
    "title": "基于原文的剧本标题",
    "metadata": {
      "language": "zh-CN",
      "format": "short_drama|film|stage",
      "genre": "类型",
      "target_duration_minutes": 12,
      "logline": "一句话核心冲突",
      "tone": "整体气质"
    },
    "source": {
      "type": "novel",
      "chapters": [
        { "id": "ch_001", "title": "原章节标题", "summary": "原章节摘要" }
      ]
    },
    "characters": [
      {
        "id": "char_001",
        "name": "人物名或功能名",
        "role": "protagonist|antagonist|supporting|minor|narrator|unknown",
        "description": "人物在原文中的可见事实",
        "motivation": "人物目标",
        "arc": "本轮改编中的变化",
        "voice": "对白风格",
        "relationships": [{ "target": "char_002", "type": "关系", "description": "关系说明" }]
      }
    ],
    "locations": [
      { "id": "loc_001", "name": "地点名", "description": "地点叙事功能", "visual_notes": "渲染氛围：光线、声音、空间压迫、物件状态和人物受环境影响的反应" }
    ],
    "scenes": [
      {
        "id": "scene_001",
        "title": "场景标题",
        "source_chapters": ["ch_001"],
        "location": "loc_001",
        "time": "时间",
        "characters": ["char_001"],
        "dramatic_purpose": "场景叙事目的",
        "conflict": "场景冲突",
        "beats": [
          { "type": "action", "character": "char_001", "content": "动作过程：人物起手、迟疑、对象变化、对方反应和停顿" },
          { "type": "dialogue", "character": "char_001", "content": "带潜台词和动作配合的对白" }
        ],
        "adaptation_notes": ["说明如何从原章节改编"]
      }
    ],
    "adaptation_report": {
      "chapter_count": 3,
      "scene_count": 3,
      "character_count": 3,
      "main_conflicts": ["核心冲突"],
      "omitted_or_compressed": ["压缩内容"],
      "revision_suggestions": ["后续修改建议"]
    }
  }
}`;

function finalGenerationInstruction(request: GenerationRequest, sharedContext: string): string {
  const densityInstruction = buildScriptDensityInstruction(request);

  return `${sharedContext}

请在内部严格按四阶段工作，但最终只输出最后的 JSON：
1. Analyzer：逐章提取人物、地点、事件、情绪转折、冲突、可改编动作，并记录章节 id。
2. Planner：根据自然场景边界规划分场；不要为了数量拆分连续场景，每场必须有 source_chapters、地点、出场人物、戏剧目的和冲突。
3. Screenwriter：把计划扩写成可拍摄、可排练的剧本 beats；重点写渲染氛围、动作过程、潜台词和动作配合，不要写与原文无关的通用桥段。
4. Reporter：按 Schema 汇总完整 ScriptForgeDocument，并保证所有引用存在。

来源约束：
- ${sourceGroundingRules}

${densityInstruction}

结构约束：
- ID 必须使用 ch_001、char_001、loc_001、scene_001 这种格式。
- source.chapters 至少包含输入前三章，chapter_count 必须等于 source.chapters 数量。
- location 必须引用 locations.id。
- scene.characters 和 dialogue.character 必须引用 characters.id。
- scene.source_chapters 必须引用 source.chapters.id。
- beats 至少包含 action 或 dialogue；dialogue 必须有 character。
- metadata.format 必须是 ${request.target.format}，target_duration_minutes 必须是 ${request.target.target_duration_minutes}。
- 不要输出 additionalProperties，不要输出 episode_count、author、original_title、total_scenes 等 Schema 外字段。

${schemaInstructions}`;
}

export function buildPromptStages(request: GenerationRequest): PromptBundle[] {
  const sharedContext = `目标格式：${request.target.format}\n类型：${request.target.genre}\n时长：${request.target.target_duration_minutes} 分钟\n气质：${request.target.tone}\n\n小说章节：\n${chapterDigest(request)}`;
  const densityInstruction = buildScriptDensityInstruction(request);

  return [
    {
      stage: "analyzer",
      responseContract: "Analyzer 提取 premise、chapter_summaries、characters、locations、conflicts，并保留章节 id。",
      messages: [
        { role: "system", content: `你是 ScriptForge Analyzer，负责把小说章节拆成可改编事实。${jsonOnly}` },
        { role: "user", content: `${sharedContext}\n\n请分析故事素材，保留章节 id 引用。\n\n来源约束：\n- ${sourceGroundingRules}` },
      ],
    },
    {
      stage: "planner",
      responseContract: "Planner 根据 Analyzer 结果和自然场景边界规划 scene_plan、character_plan、location_plan、compression_plan。",
      messages: [
        { role: "system", content: `你是 ScriptForge Planner，负责把分析结果规划成足量、可演、可拍的改编方案。${jsonOnly}` },
        { role: "user", content: `${sharedContext}\n\n请先判断自然场景边界，再规划场景结构。场景数量由素材决定，不要为了凑数量拆分同一地点、同一时间、同一目标下的连续攻防；每个 scene 必须列 source_chapters、地点、人物、冲突和戏剧目的。\n\n来源约束：\n- ${sourceGroundingRules}\n\n${densityInstruction}` },
      ],
    },
    {
      stage: "screenwriter",
      responseContract: "Screenwriter 输出贴源文本且具备剧本质量的 scenes、beats、dialogue、adaptation_notes。",
      messages: [
        { role: "system", content: `你是 ScriptForge Screenwriter，负责写可校验剧本 JSON。${jsonOnly}` },
        { role: "user", content: `${sharedContext}\n\n请生成完整 script 对象，所有 id 使用 ch_001/char_001/loc_001/scene_001 样式。对白和动作必须贴合输入章节，并把小说改写成自然分场、氛围充分、动作有过程、对白有潜台词和动作配合的剧本。\n\n${densityInstruction}\n\n${schemaInstructions}` },
      ],
    },
    {
      stage: "reporter",
      responseContract: "输出完整 ScriptForgeDocument：{ script: { schema_version, title, metadata, source, characters, locations, scenes, adaptation_report } }。",
      messages: [
        { role: "system", content: `你是 ScriptForge Adaptation Reporter，负责最终合并并只输出可解析 JSON。${jsonOnly}` },
        {
          role: "user",
          content: finalGenerationInstruction(request, sharedContext),
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
  const stageMessages = stages
    .map((stage) => `【${stage.stage} 指令】\n${stage.messages.map((message) => message.content).join("\n\n")}`)
    .join("\n\n");
  const finalStage = stages[stages.length - 1];
  return [
    {
      role: "system",
      content: `你是 ScriptForge AI 改编生成管线。必须内部执行 Analyzer / Planner / Screenwriter / Reporter 四阶段，最终只能输出 Reporter 的完整 ScriptForgeDocument JSON。${jsonOnly}`,
    },
    {
      role: "user",
      content: `阶段契约：\n${stageContract}\n\n请按以下阶段指令内部执行，不要输出中间结果：\n\n${stageMessages}\n\n最终输出要求：\n${finalStage.messages.map((message) => message.content).join("\n\n")}`,
    },
  ];
}

export function buildGenerationPrompts(request: GenerationRequest): PromptBundle[] {
  return buildPromptStages(request);
}

export function flattenForSingleRequest(stages: PromptBundle[]): PromptMessage[] {
  return buildCombinedMessages(stages);
}
