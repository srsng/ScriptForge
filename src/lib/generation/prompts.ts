import type { GenerationRequest } from "@/types/scriptforge";
import { buildScriptCapacityBudget } from "./quality";
import type {
  AnalyzerStageOutput,
  PlannerStageOutput,
  PromptBundle,
  PromptMessage,
  ScreenwriterStageOutput,
} from "./types";

function chapterDigest(request: GenerationRequest): string {
  return request.chapters
    .map((chapter, index) => {
      const content = chapter.content.replace(/\s+/g, " ").trim();
      return `${index + 1}. id=${chapter.id}\n标题：${chapter.title}\n正文：${content}`;
    })
    .join("\n\n");
}

const jsonOnly = "只输出一个 JSON 对象；不要 Markdown、不要 YAML、不要解释性文字。";
const schemaIdRules = "ID 必须使用 ch_001、char_001、loc_001、scene_001、fact_001 这种格式；引用字段只能引用已存在 ID。";

const sourceGroundingRules = [
  "只允许使用输入章节提供的人物、地点、事件、关系和冲突；缺名时用功能名，但不得编造与原文无关的设定。",
  "每个 source.chapters[].summary 必须概括对应章节，不得写通用模板。",
  "每个 source.chapters[].key_facts 必须来自对应章节，每章至少 3 条可改编事实。",
  "每个 scene.source_chapters 必须引用实际输入章节 id，scene.source_refs 和 beats[].source_refs 必须引用实际 key_facts id。",
  "人物动机、arc、对白 voice 必须来自章节行为和冲突的合理改编，不得脱离原文。",
].join("\n- ");

export function buildScriptDensityInstruction(request: GenerationRequest): string {
  const budget = buildScriptCapacityBudget(request);

  return `剧本改写质量要求（剧本正文写作要求）：
- target_duration_minutes 是真实成片/演出目标时长，本次目标是 ${budget.targetDurationMinutes} 分钟；容量参考约 ${budget.minTotalBeats} 个 beats、${budget.minDialogueBeats} 条 dialogue beats、${budget.minScriptChars} 个中文字符。先让场面成立，再让容量从动作过程、关系攻防和环境压力中自然长出来，不要为了数字拆分自然连续的场景。
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

export function buildInternalAdaptationWorkflowInstruction(request: GenerationRequest): string {
  const budget = buildScriptCapacityBudget(request);

  return `结构化改编工作流（所有中间资产都必须进入 1.1 文档）：
1. Source Facts 原文事实板：逐章锁定人物、地点、可见事件、人物目标、阻碍、情绪变化、信息变化和可转成动作/对白/停顿/道具的素材；写入 source.chapters[].key_facts，并使用 fact_001 这类全局唯一 id。
2. Dramatic Plan 戏剧路线：确定本片段主线欲望、外部阻碍、关系张力、信息释放顺序，以及保留、压缩、扩写策略；不要逐章摘要。
3. Natural Scene Cards 自然场面卡：先按自然场景边界决定几个 scene；每个 scenes[].scene_card 必须有 objective、opposition、entry_state、turning_point、exit_state、visual_atmosphere。
4. Dense Beats 剧本正文：根据 scene_card 把场内目标、阻碍、试探、回避、反击、动作过程、环境反应和转折写成可拍摄 beats；每个 beat 必须有 function 和 source_refs。
5. Source Refs 追溯：scene.source_refs 表示本场使用的事实，beat.source_refs 表示该 beat 直接改编自哪些事实；引用必须存在于 key_facts。

容量只作验收参考：本次 ${budget.targetDurationMinutes} 分钟约需要 ${budget.minTotalBeats} 个 beats、${budget.minDialogueBeats} 条 dialogue beats、${budget.minScriptChars} 个中文字符，分场必须服从自然场景边界。`;
}

function targetContext(request: GenerationRequest): string {
  return [
    `目标格式：${request.target.format}`,
    `类型：${request.target.genre}`,
    `时长：${request.target.target_duration_minutes} 分钟`,
    `气质：${request.target.tone}`,
  ].join("\n");
}

function jsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildAnalyzerPrompt(request: GenerationRequest): PromptBundle {
  const messages: PromptMessage[] = [
    { role: "system", content: `你是 ScriptForge Analyzer，负责把小说章节拆成可改编事实，不写剧本。${jsonOnly}` },
    {
      role: "user",
      content: `${targetContext(request)}

小说章节：
${chapterDigest(request)}

请输出：
{
  "source": {
    "type": "novel",
    "chapters": [
      {
        "id": "ch_001",
        "title": "原章节标题",
        "summary": "本章摘要",
        "key_facts": [
          { "id": "fact_001", "type": "event|character_goal|relationship|object|location|information|emotion|conflict", "content": "来自原文、可改编成动作/对白/停顿/道具/环境反应的事实" }
        ]
      }
    ]
  }
}

要求：
- source.chapters 必须覆盖全部输入章节，章节 id 与输入 id 一致。
- 每章 key_facts 至少 3 条，事实必须来自对应章节。
- fact id 必须在整份输出中全局唯一。
- ${sourceGroundingRules}
- ${schemaIdRules}`,
    },
  ];

  return {
    stage: "analyzer",
    responseContract: "输出 AnalyzerStageOutput：{ source }，source.chapters[].key_facts 用于后续追溯和校验；规划与正文写作仍必须参考完整原文。",
    messages,
  };
}

export function buildPlannerPrompt(request: GenerationRequest, analyzer: AnalyzerStageOutput): PromptBundle {
  const densityInstruction = buildScriptDensityInstruction(request);
  const messages: PromptMessage[] = [
    { role: "system", content: `你是 ScriptForge Planner，负责把原文事实规划成自然场面卡，不写最终 beats。${jsonOnly}` },
    {
      role: "user",
      content: `${targetContext(request)}

小说章节（完整原文，必须用于判断自然场景边界和戏剧规划）：
${chapterDigest(request)}

Analyzer 输出：
${jsonBlock(analyzer)}

请输出：
{
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
  "scene_plan": [
    {
      "id": "scene_001",
      "title": "场景标题",
      "source_chapters": ["ch_001"],
      "source_refs": ["fact_001"],
      "location": "loc_001",
      "time": "时间",
      "characters": ["char_001"],
      "scene_card": {
        "objective": "这一场里谁想达成什么",
        "opposition": "谁或什么阻碍目标",
        "entry_state": "入场时人物/关系/信息状态",
        "turning_point": "场内真正改变局面的时刻",
        "exit_state": "离场时人物/关系/信息变化",
        "visual_atmosphere": "光线、声音、空间、物件和人物受环境影响"
      },
      "dramatic_purpose": "场景叙事目的",
      "conflict": "场景冲突",
      "beat_budget": 12,
      "adaptation_notes": ["说明如何从原章节事实改编"]
    }
  ]
}

要求：
- 先读完整章节正文，再结合 Analyzer facts 规划；不要只根据 Analyzer 摘要或 facts 做二次压缩。
- 先判断自然场景边界；不要为了凑场景数量拆分连续场景。
- 每张场面卡必须包含 scene objective、opposition、entry state、turning point、exit state、visual atmosphere、beat budget、adaptation notes。
- beat_budget 必须根据目标时长、自然场面容量和原文可拍素材分配，不要使用模板值。
- scene_plan[].source_refs 只能引用 Analyzer 的 key_facts。
- scene_plan[].source_chapters 只能引用 Analyzer 的章节 id。
- scene_plan[].location 必须引用 locations.id。
- scene_plan[].characters 必须引用 characters.id。
- 每个 scene_card 必须明确 objective、opposition、entry_state、turning_point、exit_state、visual_atmosphere。
- ${schemaIdRules}

${densityInstruction}`,
    },
  ];

  return {
    stage: "planner",
    responseContract: "输出 PlannerStageOutput：{ characters, locations, scene_plan }，不写最终剧本文本。",
    messages,
  };
}

export function buildScreenwriterPrompt(
  request: GenerationRequest,
  analyzer: AnalyzerStageOutput,
  planner: PlannerStageOutput,
): PromptBundle {
  const densityInstruction = buildScriptDensityInstruction(request);
  const messages: PromptMessage[] = [
    { role: "system", content: `你是 ScriptForge Screenwriter，负责根据 scene_plan 写完整可拍摄 scenes。${jsonOnly}` },
    {
      role: "user",
      content: `${targetContext(request)}

小说章节（完整原文，必须用于支撑剧本正文扩写）：
${chapterDigest(request)}

Analyzer 输出：
${jsonBlock(analyzer)}

Planner 输出：
${jsonBlock(planner)}

请只输出：
{
  "scenes": [
    {
      "id": "scene_001",
      "title": "场景标题",
      "source_chapters": ["ch_001"],
      "source_refs": ["fact_001"],
      "location": "loc_001",
      "time": "时间",
      "characters": ["char_001"],
      "scene_card": {
        "objective": "与 scene_plan 一致",
        "opposition": "与 scene_plan 一致",
        "entry_state": "与 scene_plan 一致",
        "turning_point": "与 scene_plan 一致",
        "exit_state": "与 scene_plan 一致",
        "visual_atmosphere": "与 scene_plan 一致"
      },
      "dramatic_purpose": "与 scene_plan 一致",
      "conflict": "与 scene_plan 一致",
      "beats": [
        { "type": "action", "character": "char_001", "function": "establish|probe|evade|pressure|reveal|turn|reaction|pause|transition|note", "source_refs": ["fact_001"], "content": "动作过程：人物起手、迟疑、对象变化、对方反应和停顿" },
        { "type": "dialogue", "character": "char_001", "function": "probe|evade|pressure|reveal|turn|reaction|pause", "source_refs": ["fact_001"], "content": "带潜台词和动作配合的对白" }
      ],
      "adaptation_notes": ["说明如何从原章节事实改编"]
    }
  ]
}

要求：
- scenes 必须逐一对应 planner.scene_plan 的 scene id，不要新增或删除 scene。
- 每个 scene 的 location、characters、source_chapters、source_refs、scene_card、dramatic_purpose、conflict 必须保持 planner 规划。
- 每个 beat 必须有 function 和 source_refs；source_refs 只能引用 Analyzer 的 key_facts。
- 写正文时必须回看完整原文，不得只复述 Analyzer 或 Planner 摘要；从原文细节、动作过程、环境压力、潜台词和人物反应扩写。
- 如果使用了未被 Analyzer 单独列出的原文细节，必须引用最接近的已有 key_facts，保证 source_refs 可追溯。
- dialogue beat 必须有 character，且 character 必须在该 scene.characters 中。
- action 写过程，不写结果句；dialogue 写潜台词和动作配合。
- action 与 dialogue 交错推进，容量从目标、阻碍、试探、回避、反击、信息释放和环境压力中自然长出来。
- ${schemaIdRules}

${densityInstruction}`,
    },
  ];

  return {
    stage: "screenwriter",
    responseContract: "输出 ScreenwriterStageOutput：{ scenes }，scenes 必须对应 scene_plan 且包含 Dense Beats。",
    messages,
  };
}

export function buildReporterPrompt(
  request: GenerationRequest,
  analyzer: AnalyzerStageOutput,
  planner: PlannerStageOutput,
  screenwriter: ScreenwriterStageOutput,
): PromptBundle {
  const messages: PromptMessage[] = [
    { role: "system", content: `你是 ScriptForge Adaptation Reporter，负责生成标题、logline 和改编报告。${jsonOnly}` },
    {
      role: "user",
      content: `${targetContext(request)}

Analyzer 输出：
${jsonBlock(analyzer)}

Planner 输出：
${jsonBlock(planner)}

Screenwriter 输出：
${jsonBlock(screenwriter)}

请只输出：
{
  "title": "剧本标题",
  "logline": "一句话核心冲突",
  "adaptation_report": {
    "chapter_count": ${request.chapters.length},
    "scene_count": ${planner.scene_plan.length},
    "character_count": ${planner.characters.length},
    "main_conflicts": ["核心冲突"],
    "omitted_or_compressed": ["压缩或省略内容"],
    "revision_suggestions": ["后续修改建议"]
  }
}

要求：
- chapter_count 必须等于 Analyzer source.chapters 数量。
- scene_count 必须等于 Screenwriter scenes 数量。
- character_count 必须等于 Planner characters 数量。
- revision_suggestions 是可选后续改进方向，不是已经发生的改编决策。`,
    },
  ];

  return {
    stage: "reporter",
    responseContract: "输出 ReporterStageOutput：{ title, logline, adaptation_report }。",
    messages,
  };
}

export function buildPromptStages(request: GenerationRequest): PromptBundle[] {
  return [buildAnalyzerPrompt(request)];
}

export function buildGenerationPrompts(request: GenerationRequest): PromptBundle[] {
  return [buildAnalyzerPrompt(request)];
}
