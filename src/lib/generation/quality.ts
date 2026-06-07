import type { GenerationRequest, ScriptBeat, ScriptForgeDocument, ScriptScene } from "@/types/scriptforge";
import type { GenerationDiagnostic } from "./types";

const THIN_BEAT_CHAR_LIMIT = 20;
const THIN_BEAT_RATIO = 0.55;
const MIN_DIALOGUE_RATIO = 0.3;
const WARNING_SUMMARY_LIKE_RATIO = 0.35;
const ERROR_SUMMARY_LIKE_RATIO = 0.45;
const WARNING_RESULT_ONLY_ACTION_RATIO = 0.35;
const ERROR_RESULT_ONLY_ACTION_RATIO = 0.55;
const WARNING_DRY_DIALOGUE_RATIO = 0.35;
const ERROR_DRY_DIALOGUE_RATIO = 0.55;
const ERROR_BEAT_FILL_RATIO = 0.6;
const ERROR_DURATION_FILL_RATIO = 0.6;
const ERROR_DIALOGUE_FILL_RATIO = 0.6;
const ERROR_TEXT_FILL_RATIO = 0.6;
const VERY_SHORT_SCENE_BEATS = 3;
const CORE_BEAT_FUNCTIONS = new Set(["pressure", "reveal", "turn", "reaction"]);

export type ScriptCapacityBudget = {
  targetDurationMinutes: number;
  minTotalBeats: number;
  minDialogueBeats: number;
  minScriptChars: number;
  minMajorSceneChars: number;
  minSceneCount: number;
  recommendedSceneCount: number;
};

export type ScriptCapacitySummary = {
  sceneCount: number;
  totalBeats: number;
  dialogueBeats: number;
  scriptChars: number;
  estimatedCapacityMinutes: number;
  summaryLikeBeats: number;
  resultOnlyActions: number;
  dryDialogues: number;
  possibleArtificialSceneSplits: number;
  underusedFacts: number;
  scenesWithoutTurningPoint: number;
  staticSceneArcs: number;
  scenesWithoutDialogueExchange: number;
  scenesMissingCoreBeatFunction: number;
};

function qualityDiagnostic(message: string, severity: "info" | "warning" | "error"): GenerationDiagnostic {
  return {
    stage: "quality",
    message,
    severity,
    kind: "quality",
  };
}

function fillRatio(actual: number, expected: number): number {
  if (expected <= 0) return 1;
  return actual / expected;
}

function underfilledSeverity(actual: number, expected: number, errorRatio: number): "warning" | "error" | null {
  if (actual >= expected) return null;
  return fillRatio(actual, expected) < errorRatio ? "error" : "warning";
}

export function buildScriptCapacityBudget(request: GenerationRequest): ScriptCapacityBudget {
  const targetDurationMinutes = request.target.target_duration_minutes;

  return {
    targetDurationMinutes,
    minTotalBeats: targetDurationMinutes * 8,
    minDialogueBeats: targetDurationMinutes * 4,
    minScriptChars: targetDurationMinutes * 500,
    minMajorSceneChars: 600,
    minSceneCount: Math.max(1, Math.ceil(targetDurationMinutes / 10)),
    recommendedSceneCount: Math.max(1, Math.ceil(targetDurationMinutes / 6)),
  };
}

function countDialogueBeats(beats: ScriptBeat[]): number {
  return beats.filter((beat) => beat.type === "dialogue").length;
}

function contentLength(beat: ScriptBeat): number {
  return beat.content.replace(/\s+/g, "").length;
}

function isMajorScene(scene: ScriptScene): boolean {
  return scene.beats.length >= 1 || scene.characters.length >= 2 || Boolean(scene.conflict.trim());
}

function sceneContentLength(scene: ScriptScene): number {
  return scene.beats.reduce((sum, beat) => sum + contentLength(beat), 0);
}

function hasConcreteDetail(content: string): boolean {
  return /[：:“”"、，。！？；,.!?]/.test(content) && content.replace(/\s+/g, "").length >= THIN_BEAT_CHAR_LIMIT;
}

function isSummaryLikeBeat(beat: ScriptBeat): boolean {
  const content = beat.content.replace(/\s+/g, "");
  if (content.length < THIN_BEAT_CHAR_LIMIT) return true;
  if (beat.type === "dialogue") return !hasConcreteDetail(content);

  const abstractEventPattern = /(意识到|发现|决定|开始|继续|完成|讲述|说明|解释|回忆|得知|处理|解决|面对|推进|展开|发生|产生|变化|安排|交代|确认|获得|离开|进入|结束)/;
  const performableDetailPattern = /(看|盯|拿|放|推|拉|走|停|转身|沉默|按|翻|递|退|避开|靠近|打开|关上|屏幕|手机|门|桌|窗|灯|声音|脚步|呼吸|停顿|眼神|手|照片|文件|血|雨|风)/;

  return abstractEventPattern.test(content) && !performableDetailPattern.test(content);
}

function isResultOnlyAction(beat: ScriptBeat): boolean {
  if (beat.type !== "action") return false;
  const content = beat.content.replace(/\s+/g, "");
  const resultPattern = /(意识到|发现|决定|开始|继续|完成|讲述|说明|解释|回忆|得知|处理|解决|面对|推进|展开|发生|产生|变化|安排|交代|确认|获得|离开|进入|结束)/;
  const processPattern = /(先|又|却|但|只是|迟疑|停|顿|沉默|看|盯|手|眼神|呼吸|声音|灯|门|桌|窗|手机|屏幕|文件|杯|照片|转身|靠近|退后|避开|按|推|拉|放|拿起|递|翻|抬头|低头|关上|打开)/;
  return content.length < THIN_BEAT_CHAR_LIMIT || (resultPattern.test(content) && !processPattern.test(content));
}

function isDryDialogue(beat: ScriptBeat): boolean {
  if (beat.type !== "dialogue") return false;
  const content = beat.content.replace(/\s+/g, "");
  const subtextOrActionPattern = /(停|顿|沉默|看|盯|眼神|手|笑|压低|轻声|冷|避开|回避|试探|反问|逼|压|僵|却|但|只是|难道|你以为|偏偏|不敢|不肯|何必)/;
  const punctuationPattern = /[：:“”"、，。！？；,.!?]/;
  return content.length < 18 || (content.length < 35 && !subtextOrActionPattern.test(content)) || !punctuationPattern.test(content);
}

function overlapRatio(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const overlap = left.filter((item) => rightSet.has(item)).length;
  return overlap / Math.min(left.length, right.length);
}

function normalizeSceneTime(value: string): string {
  return value.replace(/\s+/g, "").replace(/[，。,.]/g, "");
}

function isPossiblyArtificialSplit(current: ScriptScene, next: ScriptScene): boolean {
  const sameLocation = current.location === next.location;
  const sameTime = normalizeSceneTime(current.time) === normalizeSceneTime(next.time);
  const sharedCharacters = overlapRatio(current.characters, next.characters) >= 0.5;
  const sharedSources = overlapRatio(current.source_chapters, next.source_chapters) > 0;
  const sameObjective = current.scene_card.objective.trim() === next.scene_card.objective.trim();
  const sameOpposition = current.scene_card.opposition.trim() === next.scene_card.opposition.trim();
  return sameLocation && sameTime && sharedCharacters && sharedSources && (sameObjective || sameOpposition);
}

function collectFactIds(document: ScriptForgeDocument): Set<string> {
  return new Set(document.script.source.chapters.flatMap((chapter) => chapter.key_facts.map((fact) => fact.id)));
}

function collectUsedFactIds(document: ScriptForgeDocument): Set<string> {
  const used = new Set<string>();
  for (const scene of document.script.scenes) {
    for (const ref of scene.source_refs) used.add(ref);
    for (const beat of scene.beats) {
      for (const ref of beat.source_refs) used.add(ref);
    }
  }
  return used;
}

function hasTurningPoint(scene: ScriptScene): boolean {
  return scene.scene_card.turning_point.replace(/\s+/g, "").length >= 12;
}

function hasStaticSceneArc(scene: ScriptScene): boolean {
  const entry = scene.scene_card.entry_state.replace(/\s+/g, "");
  const exit = scene.scene_card.exit_state.replace(/\s+/g, "");
  return entry.length < 10 || exit.length < 10 || entry === exit;
}

function hasDialogueExchange(scene: ScriptScene): boolean {
  const speakers = scene.beats
    .filter((beat) => beat.type === "dialogue")
    .map((beat) => beat.character);
  if (new Set(speakers).size < 2) return false;

  let speakerSwitches = 0;
  for (let index = 1; index < speakers.length; index += 1) {
    if (speakers[index] !== speakers[index - 1]) speakerSwitches += 1;
  }
  return speakerSwitches >= 2;
}

function hasCoreBeatFunction(scene: ScriptScene): boolean {
  return scene.beats.some((beat) => CORE_BEAT_FUNCTIONS.has(beat.function));
}

export function summarizeScriptCapacity(document: ScriptForgeDocument): ScriptCapacitySummary {
  const scenes = document.script.scenes;
  const allBeats = scenes.flatMap((scene) => scene.beats);
  const totalBeats = allBeats.length;
  const dialogueBeats = countDialogueBeats(allBeats);
  const scriptChars = allBeats.reduce((sum, beat) => sum + contentLength(beat), 0);
  const summaryLikeBeats = allBeats.filter(isSummaryLikeBeat).length;
  const resultOnlyActions = allBeats.filter(isResultOnlyAction).length;
  const dryDialogues = allBeats.filter(isDryDialogue).length;
  const possibleArtificialSceneSplits = scenes
    .slice(0, -1)
    .filter((scene, index) => isPossiblyArtificialSplit(scene, scenes[index + 1]))
    .length;
  const allFactIds = collectFactIds(document);
  const usedFactIds = collectUsedFactIds(document);
  const underusedFacts = [...allFactIds].filter((factId) => !usedFactIds.has(factId)).length;
  const scenesWithoutTurningPoint = scenes.filter((scene) => !hasTurningPoint(scene)).length;
  const staticSceneArcs = scenes.filter(hasStaticSceneArc).length;
  const scenesWithoutDialogueExchange = scenes.filter((scene) => !hasDialogueExchange(scene)).length;
  const scenesMissingCoreBeatFunction = scenes.filter((scene) => !hasCoreBeatFunction(scene)).length;

  return {
    sceneCount: scenes.length,
    totalBeats,
    dialogueBeats,
    scriptChars,
    estimatedCapacityMinutes: totalBeats / 8,
    summaryLikeBeats,
    resultOnlyActions,
    dryDialogues,
    possibleArtificialSceneSplits,
    underusedFacts,
    scenesWithoutTurningPoint,
    staticSceneArcs,
    scenesWithoutDialogueExchange,
    scenesMissingCoreBeatFunction,
  };
}

export function evaluateScriptDensity(
  document: ScriptForgeDocument,
  request: GenerationRequest,
): GenerationDiagnostic[] {
  const diagnostics: GenerationDiagnostic[] = [];
  const scenes = document.script.scenes;
  const budget = buildScriptCapacityBudget(request);
  const summary = summarizeScriptCapacity(document);
  const allBeats = scenes.flatMap((scene) => scene.beats);
  const dialogueFill = fillRatio(summary.dialogueBeats, budget.minDialogueBeats);
  const textFill = fillRatio(summary.scriptChars, budget.minScriptChars);
  const totalFacts = collectFactIds(document).size;
  const majorScenes = scenes
    .map((scene, index) => ({
      scene,
      index,
      chars: sceneContentLength(scene),
    }))
    .filter(({ scene }) => isMajorScene(scene));
  const shortTextScenes = majorScenes.filter(({ scene, chars }) => (
    scene.beats.length > VERY_SHORT_SCENE_BEATS && chars < budget.minMajorSceneChars
  ));

  diagnostics.push(qualityDiagnostic(
    `容量概览：已划分成 ${majorScenes.length} 个场景；现有内容：内容段 ${summary.totalBeats} 个、对白段 ${summary.dialogueBeats} 个、主体文本 ${summary.scriptChars} 字；预计可支撑 ${summary.estimatedCapacityMinutes.toFixed(1)} 分钟。`,
    "info",
  ));

  const totalBeatSeverity = underfilledSeverity(summary.totalBeats, budget.minTotalBeats, ERROR_BEAT_FILL_RATIO);
  if (totalBeatSeverity) {
    diagnostics.push(qualityDiagnostic(
      `篇幅不足：现有内容段 ${summary.totalBeats} 个，主体文本 ${summary.scriptChars} 字，预计可支撑 ${summary.estimatedCapacityMinutes.toFixed(1)} 分钟；建议扩写关键场景。`,
      totalBeatSeverity,
    ));
  }

  for (const [index, scene] of scenes.entries()) {
    if (!isMajorScene(scene)) continue;
    if (scene.beats.length <= VERY_SHORT_SCENE_BEATS) {
      diagnostics.push(qualityDiagnostic(
        `场景过碎：第 ${index + 1} 场 "${scene.title}" 只有 ${scene.beats.length} 个内容段，像场景碎片，建议按自然场景边界扩写为完整场面。`,
        "warning",
      ));
    }
  }

  if (shortTextScenes.length > 0) {
    const examples = shortTextScenes
      .slice(0, 3)
      .map(({ scene, index, chars }) => `第 ${index + 1} 场 "${scene.title}" 约 ${chars} 字`)
      .join("；");
    const severity = textFill < ERROR_TEXT_FILL_RATIO && shortTextScenes.length > majorScenes.length / 2 ? "error" : "warning";
    diagnostics.push(qualityDiagnostic(
      `场景篇幅偏短：有 ${shortTextScenes.length} 个主要场景还偏薄；代表场景：${examples}。建议补足可拍摄动作、对白攻防和人物反应。`,
      severity,
    ));
  }

  const dialogueRatio = summary.totalBeats === 0 ? 0 : summary.dialogueBeats / summary.totalBeats;
  if (dialogueRatio < MIN_DIALOGUE_RATIO) {
    diagnostics.push(qualityDiagnostic(
      `对白偏少：现有 ${summary.dialogueBeats} 个对白段、${summary.totalBeats} 个内容段；建议增加人物之间的回应和交锋。`,
      dialogueFill < ERROR_DIALOGUE_FILL_RATIO ? "error" : "warning",
    ));
  }

  const dialogueSeverity = underfilledSeverity(
    summary.dialogueBeats,
    budget.minDialogueBeats,
    ERROR_DIALOGUE_FILL_RATIO,
  );
  if (dialogueSeverity) {
    diagnostics.push(qualityDiagnostic(
      `对白篇幅不足：现有 ${summary.dialogueBeats} 个对白段；建议补足关系推进、情绪变化、潜台词和攻防往返。`,
      dialogueSeverity,
    ));
    diagnostics.push(qualityDiagnostic(
      `对白轮次不足：现有 ${summary.dialogueBeats} 个对白段，关系、情绪、潜台词和攻防变化还不够充分。`,
      dialogueSeverity,
    ));
  }

  if (summary.totalBeats > 0) {
    const thinBeatCount = allBeats.filter((beat) => contentLength(beat) < THIN_BEAT_CHAR_LIMIT).length;
    if (thinBeatCount / summary.totalBeats >= THIN_BEAT_RATIO) {
      diagnostics.push(qualityDiagnostic(
        `内容段过短：${thinBeatCount}/${summary.totalBeats} 个内容段少于 ${THIN_BEAT_CHAR_LIMIT} 个中文字符，多数内容像剧情梗概。`,
        "warning",
      ));
    }

    const summaryLikeRatio = summary.summaryLikeBeats / summary.totalBeats;
    if (summaryLikeRatio >= WARNING_SUMMARY_LIKE_RATIO) {
      diagnostics.push(qualityDiagnostic(
        `内容偏概要：${summary.summaryLikeBeats}/${summary.totalBeats} 个内容段更像剧情摘要，缺少可拍摄动作、对象、反应或对白攻防。`,
        summaryLikeRatio >= ERROR_SUMMARY_LIKE_RATIO ? "error" : "warning",
      ));
    }

    const actionBeats = allBeats.filter((beat) => beat.type === "action").length;
    const resultOnlyActionRatio = actionBeats === 0 ? 0 : summary.resultOnlyActions / actionBeats;
    if (resultOnlyActionRatio >= WARNING_RESULT_ONLY_ACTION_RATIO) {
      diagnostics.push(qualityDiagnostic(
        `动作描写偏结果：${summary.resultOnlyActions}/${actionBeats} 个动作段只写结果，缺少起手、阻碍、对象变化、人物反应或停顿。`,
        resultOnlyActionRatio >= ERROR_RESULT_ONLY_ACTION_RATIO ? "error" : "warning",
      ));
    }

    const dryDialogueRatio = summary.dialogueBeats === 0 ? 0 : summary.dryDialogues / summary.dialogueBeats;
    if (dryDialogueRatio >= WARNING_DRY_DIALOGUE_RATIO) {
      diagnostics.push(qualityDiagnostic(
        `对白偏干：${summary.dryDialogues}/${summary.dialogueBeats} 个对白段缺少潜台词、动作配合或攻防压力。`,
        dryDialogueRatio >= ERROR_DRY_DIALOGUE_RATIO ? "error" : "warning",
      ));
    }
  }

  if (summary.possibleArtificialSceneSplits > 0) {
    diagnostics.push(qualityDiagnostic(
      `场景切分可能过细：${summary.possibleArtificialSceneSplits} 组相邻场景地点、时间、人物和原文来源高度连续；建议按自然场景边界合并或重组。`,
      "warning",
    ));
  }

  if (totalFacts > 0 && summary.underusedFacts > 0) {
    const ratio = summary.underusedFacts / totalFacts;
    diagnostics.push(qualityDiagnostic(
      `原文线索使用不足：${summary.underusedFacts}/${totalFacts} 条关键事实没有进入场景或内容段，原文事实没有充分进入剧本。`,
      ratio >= 0.35 ? "error" : "warning",
    ));
  }

  const unusedChapterIds = document.script.source.chapters
    .filter((chapter) => !scenes.some((scene) => scene.source_chapters.includes(chapter.id)))
    .map((chapter) => chapter.id);
  if (unusedChapterIds.length > 0) {
    diagnostics.push(qualityDiagnostic(
      `原文章节未覆盖：${unusedChapterIds.join("、")} 还没有进入任何场景。`,
      "error",
    ));
  }

  if (summary.scenesWithoutTurningPoint > 0) {
    diagnostics.push(qualityDiagnostic(
      `场景缺少转折：${summary.scenesWithoutTurningPoint}/${summary.sceneCount} 个场景缺少明确转折，整体更像情节说明。`,
      summary.scenesWithoutTurningPoint > summary.sceneCount / 2 ? "error" : "warning",
    ));
  }

  if (summary.staticSceneArcs > 0) {
    diagnostics.push(qualityDiagnostic(
      `场景前后变化不足：${summary.staticSceneArcs}/${summary.sceneCount} 个场景的开场状态与收场状态没有明显变化。`,
      summary.staticSceneArcs > summary.sceneCount / 2 ? "error" : "warning",
    ));
  }

  if (summary.scenesWithoutDialogueExchange > 0) {
    diagnostics.push(qualityDiagnostic(
      `对白攻防不足：${summary.scenesWithoutDialogueExchange}/${summary.sceneCount} 个场景缺少至少两个角色的对白攻防轮次。`,
      summary.scenesWithoutDialogueExchange > summary.sceneCount / 2 ? "error" : "warning",
    ));
  }

  if (summary.scenesMissingCoreBeatFunction > 0) {
    diagnostics.push(qualityDiagnostic(
      `场景推进功能不足：${summary.scenesMissingCoreBeatFunction}/${summary.sceneCount} 个场景缺少压力、揭示、转折或反应等推进内容。`,
      summary.scenesMissingCoreBeatFunction > summary.sceneCount / 2 ? "error" : "warning",
    ));
  }

  const textSeverity = underfilledSeverity(summary.scriptChars, budget.minScriptChars, ERROR_TEXT_FILL_RATIO);
  if (textSeverity) {
    diagnostics.push(qualityDiagnostic(
      `主体篇幅不足：现有主体剧本文本约 ${summary.scriptChars} 字；建议扩写场景动作、对白和人物反应。`,
      textSeverity,
    ));
  }

  const durationSeverity = underfilledSeverity(
    summary.estimatedCapacityMinutes,
    budget.targetDurationMinutes,
    ERROR_DURATION_FILL_RATIO,
  );
  if (durationSeverity) {
    diagnostics.push(qualityDiagnostic(
      `预计时长不足：按每分钟约 8 个内容段估算，当前容量约 ${summary.estimatedCapacityMinutes.toFixed(1)} 分钟；建议继续扩写关键场景。`,
      durationSeverity,
    ));
  }

  return diagnostics;
}
