import { MIN_CHAPTER_COUNT, type GenerationRequest, type ScriptForgeDocument } from "@/types/scriptforge";

function clean(value: string | undefined, fallback: string): string {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

function excerpt(text: string, max = 90): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "本章保留为改编素材，等待进一步细化。";
  return oneLine.length > max ? `${oneLine.slice(0, max)}……` : oneLine;
}

function shortTitle(title: string, index: number): string {
  const cleaned = clean(title, `第${index + 1}章`);
  return cleaned.length > 22 ? `${cleaned.slice(0, 22)}…` : cleaned;
}

export function buildFallbackDocument(request: GenerationRequest, reason = "AI 结果不可用，使用运行时降级生成。") : ScriptForgeDocument {
  if (request.chapters.length < MIN_CHAPTER_COUNT) {
    throw new Error(`Fallback document requires at least ${MIN_CHAPTER_COUNT} chapters.`);
  }

  const chapters = request.chapters.slice(0, Math.max(3, request.chapters.length));
  const sourceChapters = chapters.map((chapter, index) => ({
    id: chapter.id,
    title: clean(chapter.title, `第${index + 1}章`),
    summary: excerpt(chapter.content, 120),
  }));

  const protagonistName = "主角";
  const witnessName = "见证者";
  const guideName = "旁白";

  const genre = clean(request.target.genre, "未指定类型");
  const tone = clean(request.target.tone, "稳健可演示");
  const title = `${shortTitle(sourceChapters[0]?.title ?? "小说", 0)}：${genre}改编示例`;

  return {
    script: {
      schema_version: "1.0",
      title,
      metadata: {
        language: "zh-CN",
        format: request.target.format,
        genre,
        target_duration_minutes: request.target.target_duration_minutes,
        logline: `${protagonistName}在${sourceChapters.length}章线索中追索关键真相，并在最后一场做出选择。`,
        tone,
      },
      source: {
        type: "novel",
        chapters: sourceChapters,
      },
      characters: [
        {
          id: "char_001",
          name: protagonistName,
          role: "protagonist",
          description: "承接原文主要行动线的人物，负责推动调查、抉择与情绪转折。",
          motivation: "尽快厘清章节中的核心矛盾，保护重要关系并完成自我证明。",
          arc: "从被动接收线索，到主动整合信息并承担改编高潮的选择。",
          voice: "短句、直接，情绪升高时带有追问。",
          relationships: [
            { target: "char_002", type: "互相试探", description: "通过对白暴露背景信息和隐藏动机。" },
          ],
        },
        {
          id: "char_002",
          name: witnessName,
          role: "supporting",
          description: "把原文叙述中的关键信息转化为可表演的见证与阻力。",
          motivation: "确认主角是否可信，同时保留自身秘密。",
          arc: "从回避到提供关键线索。",
          voice: "谨慎、含蓄，常用反问。",
          relationships: [
            { target: "char_001", type: "线索提供者", description: "既帮助主角推进，也制造新的不确定性。" },
          ],
        },
        {
          id: "char_003",
          name: guideName,
          role: "narrator",
          description: "用于把章节跨度较大的信息压缩成场景转场与必要旁白。",
          motivation: "保证观众快速理解章节因果。",
          arc: "保持稳定说明功能。",
          voice: "简洁、画面化。",
        },
      ],
      locations: [
        {
          id: "loc_001",
          name: "主要场景",
          description: "由前三章共同抽取的核心空间，可根据实际文本替换为宅院、街巷、办公室或旅途节点。",
          visual_notes: "保留一个醒目的道具或光影变化，用于承载悬念。",
        },
        {
          id: "loc_002",
          name: "转折场景",
          description: "用于呈现第二幕冲突升级和最终选择的可拍摄空间。",
          visual_notes: "构图从封闭转向开放，暗示主角掌握主动权。",
        },
      ],
      scenes: [
        {
          id: "scene_001",
          title: `线索进入：${shortTitle(sourceChapters[0]?.title ?? "第一章", 0)}`,
          source_chapters: [sourceChapters[0]?.id ?? "ch_001"],
          location: "loc_001",
          time: "开场 / 日内",
          characters: ["char_001", "char_003"],
          dramatic_purpose: "建立主角目标、世界状态与第一条可表演线索。",
          conflict: "主角需要行动，但掌握的信息不足。",
          beats: [
            { type: "narration", character: "char_003", content: `旁白压缩原文开端：${sourceChapters[0]?.summary ?? "故事开始。"}` },
            { type: "action", character: "char_001", content: "主角发现异常线索，决定追问到底。" },
            { type: "dialogue", character: "char_001", content: "如果这不是巧合，那就一定有人希望我停下。" },
          ],
          adaptation_notes: ["将章节说明改为可拍摄动作，减少纯背景介绍。", reason],
        },
        {
          id: "scene_002",
          title: `冲突升级：${shortTitle(sourceChapters[1]?.title ?? "第二章", 1)}`,
          source_chapters: [sourceChapters[1]?.id ?? "ch_002"],
          location: "loc_001",
          time: "中段 / 傍晚",
          characters: ["char_001", "char_002"],
          dramatic_purpose: "通过对手戏暴露阻力，推进人物关系。",
          conflict: "见证者隐瞒真相，主角必须用有限证据迫使其开口。",
          beats: [
            { type: "action", character: "char_002", content: "见证者回避主角视线，试图结束谈话。" },
            { type: "dialogue", character: "char_001", content: "你知道答案，只是不敢说。" },
            { type: "dialogue", character: "char_002", content: "我说出来，你就没有回头路了。" },
            { type: "note", content: `可从原文补入细节：${sourceChapters[1]?.summary ?? "第二条线索。"}` },
          ],
          adaptation_notes: ["把内心独白转换为攻防对白。"],
        },
        {
          id: "scene_003",
          title: `选择与钩子：${shortTitle(sourceChapters[2]?.title ?? "第三章", 2)}`,
          source_chapters: sourceChapters.slice(2).map((chapter) => chapter.id),
          location: "loc_002",
          time: "结尾 / 夜内",
          characters: ["char_001", "char_002", "char_003"],
          dramatic_purpose: "收束本轮改编的主要信息，并留下下一集或下一幕钩子。",
          conflict: "真相即将揭开，主角必须在安全与继续追查之间选择。",
          beats: [
            { type: "transition", content: "关键物件或信息从前一场带入转折场景。" },
            { type: "dialogue", character: "char_001", content: "我可以害怕，但不能假装没看见。" },
            { type: "action", character: "char_002", content: "见证者交出最后一条线索，门外传来新的动静。" },
            { type: "narration", character: "char_003", content: "本集以新的危险信号结束，保留续写空间。" },
          ],
          adaptation_notes: ["合并后续章节信息，优先保证短时长闭环。"],
        },
      ],
      adaptation_report: {
        chapter_count: sourceChapters.length,
        scene_count: 3,
        character_count: 3,
        main_conflicts: [
          "主角追索真相与外部阻力之间的冲突。",
          "见证者自保与说出事实之间的冲突。",
        ],
        omitted_or_compressed: [
          "压缩大段背景、心理描写与重复线索。",
          "未命名配角合并为见证者或旁白功能。",
        ],
        revision_suggestions: [
          "接入可用 AI 后补充更贴合原文的人名、地点和对白。",
          "人工检查每场 source_chapters 是否覆盖期望章节。",
        ],
      },
    },
  };
}
