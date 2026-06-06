import type { GenerationRequest, ScriptBeat, ScriptForgeDocument, ScriptScene } from "@/types/scriptforge";
import type { GenerationDiagnostic } from "./types";

const THIN_BEAT_CHAR_LIMIT = 20;
const THIN_BEAT_RATIO = 0.55;
const MIN_MAJOR_SCENE_BEATS = 8;
const MIN_DIALOGUE_RATIO = 0.3;

function qualityDiagnostic(message: string, severity: "warning" | "error"): GenerationDiagnostic {
  return {
    stage: "quality",
    message,
    severity,
    kind: "quality",
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

export function evaluateScriptDensity(
  document: ScriptForgeDocument,
  request: GenerationRequest,
): GenerationDiagnostic[] {
  const diagnostics: GenerationDiagnostic[] = [];
  const scenes = document.script.scenes;
  const targetDuration = request.target.target_duration_minutes;
  const allBeats = scenes.flatMap((scene) => scene.beats);
  const totalBeats = allBeats.length;
  const dialogueBeats = countDialogueBeats(allBeats);
  const minTotalBeats = Math.max(18, targetDuration * 3);
  const minDialogueBeats = Math.max(4, Math.ceil(minTotalBeats * MIN_DIALOGUE_RATIO));

  if (totalBeats < minTotalBeats) {
    diagnostics.push(qualityDiagnostic(
      `LOW_TOTAL_BEATS: 目标时长 ${targetDuration} 分钟，但总 beats 只有 ${totalBeats}，低于最低要求 ${minTotalBeats}，内容密度不足。`,
      "error",
    ));
  }

  for (const [index, scene] of scenes.entries()) {
    if (!isMajorScene(scene)) continue;
    if (scene.beats.length < 5) {
      diagnostics.push(qualityDiagnostic(
        `SCENE_TOO_SHORT: 第 ${index + 1} 场 "${scene.title}" 只有 ${scene.beats.length} 个 beats，不像完整可演场面。`,
        "error",
      ));
    } else if (scene.beats.length < MIN_MAJOR_SCENE_BEATS) {
      diagnostics.push(qualityDiagnostic(
        `SCENE_TOO_SHORT: 第 ${index + 1} 场 "${scene.title}" 只有 ${scene.beats.length} 个 beats，建议主要 scene 至少 ${MIN_MAJOR_SCENE_BEATS} 个 beats。`,
        "warning",
      ));
    }
  }

  const dialogueRatio = totalBeats === 0 ? 0 : dialogueBeats / totalBeats;
  if (dialogueRatio < MIN_DIALOGUE_RATIO) {
    diagnostics.push(qualityDiagnostic(
      `LOW_DIALOGUE_RATIO: dialogue beats 占比 ${Math.round(dialogueRatio * 100)}%，低于最低要求 ${Math.round(MIN_DIALOGUE_RATIO * 100)}%。`,
      totalBeats < minTotalBeats ? "error" : "warning",
    ));
  }

  if (dialogueBeats < minDialogueBeats) {
    diagnostics.push(qualityDiagnostic(
      `LOW_DIALOGUE_COUNT: 目标时长 ${targetDuration} 分钟至少需要约 ${minDialogueBeats} 条 dialogue beats，当前只有 ${dialogueBeats} 条。`,
      "error",
    ));
  }

  if (totalBeats > 0) {
    const thinBeatCount = allBeats.filter((beat) => contentLength(beat) < THIN_BEAT_CHAR_LIMIT).length;
    if (thinBeatCount / totalBeats >= THIN_BEAT_RATIO) {
      diagnostics.push(qualityDiagnostic(
        `BEAT_TOO_THIN: ${thinBeatCount}/${totalBeats} 个 beats 少于 ${THIN_BEAT_CHAR_LIMIT} 个中文字符，多数内容像剧情梗概。`,
        "warning",
      ));
    }
  }

  const estimatedCapacityMinutes = totalBeats / 3;
  if (estimatedCapacityMinutes < targetDuration * 0.8) {
    diagnostics.push(qualityDiagnostic(
      `DURATION_UNDERFILLED: 按每分钟约 3 个 beats 估算，当前容量约 ${estimatedCapacityMinutes.toFixed(1)} 分钟，无法支撑 ${targetDuration} 分钟目标时长。`,
      "error",
    ));
  }

  return diagnostics;
}
