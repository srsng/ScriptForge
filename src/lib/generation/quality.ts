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

export type ScriptCapacityBudget = {
  targetDurationMinutes: number;
  minTotalBeats: number;
  minDialogueBeats: number;
  minScriptChars: number;
  minMajorSceneChars: number;
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
};

function qualityDiagnostic(message: string, severity: "info" | "warning" | "error"): GenerationDiagnostic {
  return {
    stage: "quality",
    message,
    severity,
    kind: "quality",
  };
}

function percent(value: number): number {
  return Math.round(value * 100);
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
  return sameLocation && sameTime && sharedCharacters && sharedSources;
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
  const beatFill = fillRatio(summary.totalBeats, budget.minTotalBeats);
  const dialogueFill = fillRatio(summary.dialogueBeats, budget.minDialogueBeats);
  const textFill = fillRatio(summary.scriptChars, budget.minScriptChars);
  const durationFill = fillRatio(summary.estimatedCapacityMinutes, budget.targetDurationMinutes);

  diagnostics.push(qualityDiagnostic(
    `CAPACITY_SUMMARY: 目标 ${budget.targetDurationMinutes} 分钟；当前 ${summary.sceneCount} 场、${summary.totalBeats}/${budget.minTotalBeats} beats（${percent(beatFill)}%）、${summary.dialogueBeats}/${budget.minDialogueBeats} 条 dialogue beats（${percent(dialogueFill)}%）、${summary.scriptChars}/${budget.minScriptChars} 字（${percent(textFill)}%），估算容量 ${summary.estimatedCapacityMinutes.toFixed(1)}/${budget.targetDurationMinutes} 分钟（${percent(durationFill)}%）。场景数仅供参考，按自然场景边界判断。`,
    "info",
  ));

  const totalBeatSeverity = underfilledSeverity(summary.totalBeats, budget.minTotalBeats, ERROR_BEAT_FILL_RATIO);
  if (totalBeatSeverity) {
    diagnostics.push(qualityDiagnostic(
      `LOW_TOTAL_BEATS: 目标时长 ${budget.targetDurationMinutes} 分钟，总 beats ${summary.totalBeats}/${budget.minTotalBeats}（${percent(beatFill)}%）。`,
      totalBeatSeverity,
    ));
  }

  const majorScenes = scenes
    .map((scene, index) => ({
      scene,
      index,
      chars: sceneContentLength(scene),
    }))
    .filter(({ scene }) => isMajorScene(scene));
  const shortTextScenes = majorScenes.filter(({ chars }) => chars < budget.minMajorSceneChars);

  for (const [index, scene] of scenes.entries()) {
    if (!isMajorScene(scene)) continue;
    if (scene.beats.length <= VERY_SHORT_SCENE_BEATS) {
      diagnostics.push(qualityDiagnostic(
        `SCENE_TOO_SHORT: 第 ${index + 1} 场 "${scene.title}" 只有 ${scene.beats.length} 个 beats，像场景碎片，建议按自然场景边界扩写为完整场面。`,
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
      `SCENE_TEXT_TOO_SHORT: ${shortTextScenes.length}/${majorScenes.length} 个主要 scene 文本低于 ${budget.minMajorSceneChars} 字；代表场景：${examples}。`,
      severity,
    ));
  }

  const dialogueRatio = summary.totalBeats === 0 ? 0 : summary.dialogueBeats / summary.totalBeats;
  if (dialogueRatio < MIN_DIALOGUE_RATIO) {
    diagnostics.push(qualityDiagnostic(
      `LOW_DIALOGUE_RATIO: dialogue beats 占比 ${Math.round(dialogueRatio * 100)}%，低于最低要求 ${Math.round(MIN_DIALOGUE_RATIO * 100)}%。`,
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
      `LOW_DIALOGUE_COUNT: 目标时长 ${budget.targetDurationMinutes} 分钟至少需要约 ${budget.minDialogueBeats} 条 dialogue beats，当前 ${summary.dialogueBeats}/${budget.minDialogueBeats}（${percent(dialogueFill)}%）。`,
      dialogueSeverity,
    ));
    diagnostics.push(qualityDiagnostic(
      `LOW_DIALOGUE_ROUNDS: 对白轮次不足，当前 ${summary.dialogueBeats} 条 dialogue beats 无法支撑 ${budget.targetDurationMinutes} 分钟的关系、情绪、潜台词和攻防变化。`,
      dialogueSeverity,
    ));
  }

  if (summary.totalBeats > 0) {
    const thinBeatCount = allBeats.filter((beat) => contentLength(beat) < THIN_BEAT_CHAR_LIMIT).length;
    if (thinBeatCount / summary.totalBeats >= THIN_BEAT_RATIO) {
      diagnostics.push(qualityDiagnostic(
        `BEAT_TOO_THIN: ${thinBeatCount}/${summary.totalBeats} 个 beats 少于 ${THIN_BEAT_CHAR_LIMIT} 个中文字符，多数内容像剧情梗概。`,
        "warning",
      ));
    }

    const summaryLikeRatio = summary.summaryLikeBeats / summary.totalBeats;
    if (summaryLikeRatio >= WARNING_SUMMARY_LIKE_RATIO) {
      diagnostics.push(qualityDiagnostic(
        `SUMMARY_LIKE_BEATS: ${summary.summaryLikeBeats}/${summary.totalBeats} 个 beats 像剧情摘要，缺少可拍摄动作、对象、反应或对白攻防。`,
        summaryLikeRatio >= ERROR_SUMMARY_LIKE_RATIO ? "error" : "warning",
      ));
    }

    const actionBeats = allBeats.filter((beat) => beat.type === "action").length;
    const resultOnlyActionRatio = actionBeats === 0 ? 0 : summary.resultOnlyActions / actionBeats;
    if (resultOnlyActionRatio >= WARNING_RESULT_ONLY_ACTION_RATIO) {
      diagnostics.push(qualityDiagnostic(
        `RESULT_ONLY_ACTION: ${summary.resultOnlyActions}/${actionBeats} 条 action beats 只写结果，缺少起手、阻碍、对象变化、人物反应或停顿。`,
        resultOnlyActionRatio >= ERROR_RESULT_ONLY_ACTION_RATIO ? "error" : "warning",
      ));
    }

    const dryDialogueRatio = summary.dialogueBeats === 0 ? 0 : summary.dryDialogues / summary.dialogueBeats;
    if (dryDialogueRatio >= WARNING_DRY_DIALOGUE_RATIO) {
      diagnostics.push(qualityDiagnostic(
        `DRY_DIALOGUE: ${summary.dryDialogues}/${summary.dialogueBeats} 条 dialogue beats 偏干，缺少潜台词、动作配合或攻防压力。`,
        dryDialogueRatio >= ERROR_DRY_DIALOGUE_RATIO ? "error" : "warning",
      ));
    }
  }

  if (summary.possibleArtificialSceneSplits > 0) {
    diagnostics.push(qualityDiagnostic(
      `POSSIBLE_ARTIFICIAL_SCENE_SPLIT: ${summary.possibleArtificialSceneSplits} 组相邻场景地点、时间、人物和来源高度连续，疑似为了凑数量拆分；建议按自然场景边界合并或重组。`,
      "warning",
    ));
  }

  const textSeverity = underfilledSeverity(summary.scriptChars, budget.minScriptChars, ERROR_TEXT_FILL_RATIO);
  if (textSeverity) {
    diagnostics.push(qualityDiagnostic(
      `DURATION_TEXT_UNDERFILLED: 目标时长 ${budget.targetDurationMinutes} 分钟至少需要约 ${budget.minScriptChars} 字主体剧本文本，当前 ${summary.scriptChars}/${budget.minScriptChars}（${percent(textFill)}%）。`,
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
      `DURATION_UNDERFILLED: 按每分钟约 8 个 beats 估算，当前容量约 ${summary.estimatedCapacityMinutes.toFixed(1)}/${budget.targetDurationMinutes} 分钟（${percent(durationFill)}%）。`,
      durationSeverity,
    ));
  }

  return diagnostics;
}
