import type {
  AdaptationReport,
  BeatFunction,
  BeatType,
  CharacterRole,
  GenerationRequest,
  ScriptBeat,
  ScriptCharacter,
  ScriptForgeDocument,
  ScriptLocation,
  ScriptRelationship,
  ScriptScene,
  ScriptSceneCard,
  ScriptSource,
  ScriptSourceFact,
  SourceFactType,
} from "@/types/scriptforge";
import { MIN_CHAPTER_COUNT } from "@/types/scriptforge";
import { validateScriptForgeDocument } from "@/lib/schema";
import { requestJsonFromModel } from "./client";
import { parseModelJson } from "./document";
import {
  buildAnalyzerPrompt,
  buildPlannerPrompt,
  buildReporterPrompt,
  buildScreenwriterPrompt,
} from "./prompts";
import { evaluateScriptDensity } from "./quality";
import type {
  AnalyzerStageOutput,
  GenerationDiagnostic,
  GenerationResult,
  GenerationStage,
  GenerationStageMetrics,
  GenerationStageOutputs,
  GenerationStageResult,
  PlannedScene,
  PlannerStageOutput,
  PromptBundle,
  ReporterStageOutput,
  ScreenwriterStageOutput,
} from "./types";

type StageName = Exclude<GenerationStage, "validation" | "quality">;
type StageParseResult<T> = { ok: true; output: T } | { ok: false; message: string };

const DEFAULT_STAGE_TIMEOUT_MS = 180_000;
const ID_PATTERN = /^[a-z]+_[0-9]{3}$/;
const FACT_ID_PATTERN = /^fact_[0-9]{3}$/;
const SOURCE_FACT_TYPES = new Set<SourceFactType>([
  "event",
  "character_goal",
  "relationship",
  "object",
  "location",
  "information",
  "emotion",
  "conflict",
]);
const CHARACTER_ROLES = new Set<CharacterRole>([
  "protagonist",
  "antagonist",
  "supporting",
  "minor",
  "narrator",
  "unknown",
]);
const BEAT_TYPES = new Set<BeatType>(["action", "dialogue", "narration", "transition", "note"]);
const BEAT_FUNCTIONS = new Set<BeatFunction>([
  "establish",
  "probe",
  "evade",
  "pressure",
  "reveal",
  "turn",
  "reaction",
  "pause",
  "transition",
  "note",
]);

function diagnostic(
  stage: GenerationDiagnostic["stage"],
  message: string,
  severity: GenerationDiagnostic["severity"] = "info",
  kind?: GenerationDiagnostic["kind"],
  details?: string,
): GenerationDiagnostic {
  return { stage, message, severity, kind, ...(details ? { details } : {}) };
}

function readPositiveIntegerEnv(name: string): number | null {
  const value = process.env[name]?.trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function stageTimeoutMs(stage: StageName): number {
  const stageEnvName = `GENERATION_${stage.toUpperCase()}_TIMEOUT_MS`;
  return readPositiveIntegerEnv(stageEnvName)
    ?? readPositiveIntegerEnv("GENERATION_STAGE_TIMEOUT_MS")
    ?? DEFAULT_STAGE_TIMEOUT_MS;
}

function promptCharCount(prompt: PromptBundle): number {
  return prompt.messages.reduce((sum, message) => sum + message.content.length, 0);
}

function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function metricsDetails(metrics: GenerationStageMetrics): string {
  return [
    `elapsed=${formatElapsed(metrics.elapsedMs)}`,
    `timeout=${formatElapsed(metrics.timeoutMs)}`,
    `promptChars=${metrics.promptChars}`,
    `responseChars=${metrics.responseChars}`,
    metrics.provider ? `provider=${metrics.provider}` : null,
    metrics.model ? `model=${metrics.model}` : null,
  ].filter((item): item is string => item !== null).join("；");
}

function emptyMetrics(prompt: PromptBundle, timeoutMs: number, startedAt: number): GenerationStageMetrics {
  return {
    elapsedMs: Date.now() - startedAt,
    timeoutMs,
    promptChars: promptCharCount(prompt),
    responseChars: 0,
  };
}

export function normalizeTargetDuration(value: unknown, defaultDuration = 12): number | null {
  if (value === undefined || value === null) return defaultDuration;
  if (typeof value === "string" && value.trim().length === 0) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;

  const duration = Number(value);
  return Number.isInteger(duration) && duration >= 1 && duration <= 180 ? duration : null;
}

export function normalizeGenerationRequest(input: unknown): GenerationRequest | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<GenerationRequest>;
  if (!Array.isArray(candidate.chapters) || !candidate.target || typeof candidate.target !== "object") return null;

  const chapters = candidate.chapters
    .map((chapter, index) => {
      if (!chapter || typeof chapter !== "object") return null;
      const value = chapter as { id?: unknown; title?: unknown; content?: unknown };
      const content = typeof value.content === "string" ? value.content.trim() : "";
      if (!content) return null;
      return {
        id: typeof value.id === "string" && value.id.trim() ? value.id.trim() : `ch_${String(index + 1).padStart(3, "0")}`,
        title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : `第 ${index + 1} 章`,
        content,
      };
    })
    .filter((chapter): chapter is GenerationRequest["chapters"][number] => chapter !== null);

  const target = candidate.target as Partial<GenerationRequest["target"]>;
  const duration = normalizeTargetDuration(target.target_duration_minutes);
  if (duration === null) return null;

  return {
    chapters,
    target: {
      format: target.format === "film" || target.format === "stage" ? target.format : "short_drama",
      genre: typeof target.genre === "string" && target.genre.trim() ? target.genre.trim() : "悬疑剧情",
      target_duration_minutes: duration,
      tone: typeof target.tone === "string" && target.tone.trim() ? target.tone.trim() : "紧凑、可拍摄",
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function firstObject(value: unknown, keys: string[]): Record<string, unknown> | null {
  if (!isObject(value)) return null;
  for (const key of keys) {
    const nested = value[key];
    if (isObject(nested)) return nested;
  }
  return value;
}

function collectChapterIds(source: ScriptSource): Set<string> {
  return new Set(source.chapters.map((chapter) => chapter.id));
}

function collectFactIds(source: ScriptSource): Set<string> {
  return new Set(source.chapters.flatMap((chapter) => chapter.key_facts.map((fact) => fact.id)));
}

function collectCharacterIds(characters: ScriptCharacter[]): Set<string> {
  return new Set(characters.map((character) => character.id));
}

function collectLocationIds(locations: ScriptLocation[]): Set<string> {
  return new Set(locations.map((location) => location.id));
}

function parseSourceFact(value: unknown): ScriptSourceFact | null {
  if (!isObject(value)) return null;
  const id = asString(value.id);
  const type = asString(value.type) as SourceFactType;
  const content = asString(value.content);
  if (!FACT_ID_PATTERN.test(id) || !SOURCE_FACT_TYPES.has(type) || !content) return null;
  return { id, type, content };
}

function parseAnalyzerOutput(value: unknown, request: GenerationRequest): StageParseResult<AnalyzerStageOutput> {
  const root = firstObject(value, ["analyzer", "analysis", "result"]);
  const sourceValue = root?.source;
  if (!isObject(sourceValue) || sourceValue.type !== "novel" || !Array.isArray(sourceValue.chapters)) {
    return { ok: false, message: "Analyzer 输出缺少 source.type=novel 或 source.chapters。" };
  }

  const inputChapterIds = new Set(request.chapters.map((chapter) => chapter.id));
  const seenChapterIds = new Set<string>();
  const seenFactIds = new Set<string>();
  const chapters = sourceValue.chapters.map((chapterValue) => {
    if (!isObject(chapterValue)) return null;
    const id = asString(chapterValue.id);
    const title = asString(chapterValue.title);
    const summary = asString(chapterValue.summary);
    const facts = Array.isArray(chapterValue.key_facts)
      ? chapterValue.key_facts.map(parseSourceFact).filter((fact): fact is ScriptSourceFact => fact !== null)
      : [];

    if (!ID_PATTERN.test(id) || !inputChapterIds.has(id) || !title || !summary || facts.length < 3) return null;
    if (seenChapterIds.has(id)) return null;
    seenChapterIds.add(id);
    for (const fact of facts) {
      if (seenFactIds.has(fact.id)) return null;
      seenFactIds.add(fact.id);
    }
    return { id, title, summary, key_facts: facts };
  });

  if (chapters.some((chapter) => chapter === null)) {
    return { ok: false, message: "Analyzer 输出章节、摘要或 key_facts 不完整，或 fact id 重复。" };
  }

  if (request.chapters.some((chapter) => !seenChapterIds.has(chapter.id))) {
    return { ok: false, message: "Analyzer 输出未覆盖全部输入章节。" };
  }

  return {
    ok: true,
    output: { source: { type: "novel", chapters: chapters as AnalyzerStageOutput["source"]["chapters"] } },
  };
}

function parseRelationship(value: unknown): ScriptRelationship | null {
  if (!isObject(value)) return null;
  const target = asString(value.target);
  const type = asString(value.type, "关系");
  const description = asString(value.description, "需补充关系说明。");
  if (!ID_PATTERN.test(target)) return null;
  return { target, type, description };
}

function parseCharacter(value: unknown): ScriptCharacter | null {
  if (!isObject(value)) return null;
  const id = asString(value.id);
  const name = asString(value.name);
  const role = asString(value.role, "unknown") as CharacterRole;
  if (!ID_PATTERN.test(id) || !name || !CHARACTER_ROLES.has(role)) return null;
  const relationships = Array.isArray(value.relationships)
    ? value.relationships.map(parseRelationship).filter((item): item is ScriptRelationship => item !== null)
    : undefined;
  return {
    id,
    name,
    role,
    description: asString(value.description, "需补充人物描述。"),
    motivation: asString(value.motivation, "需补充人物目标。"),
    arc: asString(value.arc, "需补充人物变化。"),
    voice: asString(value.voice, "需补充对白风格。"),
    ...(relationships && relationships.length > 0 ? { relationships } : {}),
  };
}

function parseLocation(value: unknown): ScriptLocation | null {
  if (!isObject(value)) return null;
  const id = asString(value.id);
  const name = asString(value.name);
  if (!ID_PATTERN.test(id) || !name) return null;
  return {
    id,
    name,
    description: asString(value.description, "需补充地点叙事功能。"),
    visual_notes: asString(value.visual_notes, "需补充场景氛围。"),
  };
}

function parseSceneCard(value: unknown): ScriptSceneCard | null {
  if (!isObject(value)) return null;
  const card: ScriptSceneCard = {
    objective: asString(value.objective),
    opposition: asString(value.opposition),
    entry_state: asString(value.entry_state),
    turning_point: asString(value.turning_point),
    exit_state: asString(value.exit_state),
    visual_atmosphere: asString(value.visual_atmosphere),
  };
  return Object.values(card).every((item) => item.length > 0) ? card : null;
}

function parsePlannedScene(value: unknown): PlannedScene | null {
  if (!isObject(value)) return null;
  const id = asString(value.id);
  const title = asString(value.title);
  const sceneCard = parseSceneCard(value.scene_card);
  if (!ID_PATTERN.test(id) || !title || !sceneCard) return null;
  const beatBudget = typeof value.beat_budget === "number" && Number.isFinite(value.beat_budget)
    ? Math.max(1, Math.round(value.beat_budget))
    : undefined;
  return {
    id,
    title,
    source_chapters: asStringArray(value.source_chapters),
    source_refs: asStringArray(value.source_refs),
    location: asString(value.location),
    time: asString(value.time, "未知"),
    characters: asStringArray(value.characters),
    scene_card: sceneCard,
    dramatic_purpose: asString(value.dramatic_purpose, "需补充戏剧目的。"),
    conflict: asString(value.conflict, "需补充冲突。"),
    ...(beatBudget ? { beat_budget: beatBudget } : {}),
    adaptation_notes: asStringArray(value.adaptation_notes),
  };
}

function validateReferenceSet(ids: string[], available: Set<string>): boolean {
  return ids.length > 0 && ids.every((id) => available.has(id));
}

function parsePlannerOutput(value: unknown, analyzer: AnalyzerStageOutput): StageParseResult<PlannerStageOutput> {
  const root = firstObject(value, ["planner", "plan", "result"]);
  if (!root) return { ok: false, message: "Planner 输出不是对象。" };

  const characters = Array.isArray(root.characters)
    ? root.characters.map(parseCharacter).filter((item): item is ScriptCharacter => item !== null)
    : [];
  const locations = Array.isArray(root.locations)
    ? root.locations.map(parseLocation).filter((item): item is ScriptLocation => item !== null)
    : [];
  const scenePlanValue = root.scene_plan ?? root.scenes;
  const scenePlan = Array.isArray(scenePlanValue)
    ? scenePlanValue.map(parsePlannedScene).filter((item): item is PlannedScene => item !== null)
    : [];

  if (characters.length === 0 || locations.length === 0 || scenePlan.length === 0) {
    return { ok: false, message: "Planner 输出缺少 characters、locations 或 scene_plan。" };
  }

  const characterIds = collectCharacterIds(characters);
  const locationIds = collectLocationIds(locations);
  const chapterIds = collectChapterIds(analyzer.source);
  const factIds = collectFactIds(analyzer.source);
  for (const character of characters) {
    for (const relationship of character.relationships ?? []) {
      if (!characterIds.has(relationship.target)) {
        return { ok: false, message: `Planner 关系目标 ${relationship.target} 不在 characters 中。` };
      }
    }
  }
  for (const scene of scenePlan) {
    if (!locationIds.has(scene.location)) return { ok: false, message: `Planner 场景 ${scene.id} 引用不存在地点 ${scene.location}。` };
    if (!validateReferenceSet(scene.characters, characterIds)) return { ok: false, message: `Planner 场景 ${scene.id} 角色引用无效。` };
    if (!validateReferenceSet(scene.source_chapters, chapterIds)) return { ok: false, message: `Planner 场景 ${scene.id} 来源章节引用无效。` };
    if (!validateReferenceSet(scene.source_refs, factIds)) return { ok: false, message: `Planner 场景 ${scene.id} source_refs 引用无效。` };
  }

  return { ok: true, output: { characters, locations, scene_plan: scenePlan } };
}

function parseBeat(value: unknown, scene: PlannedScene, factIds: Set<string>): ScriptBeat | null {
  if (!isObject(value)) return null;
  const type = asString(value.type) as BeatType;
  const beatFunction = asString(value.function) as BeatFunction;
  const sourceRefs = asStringArray(value.source_refs);
  const content = asString(value.content);
  if (!BEAT_TYPES.has(type) || !BEAT_FUNCTIONS.has(beatFunction) || !validateReferenceSet(sourceRefs, factIds) || !content) return null;
  const character = asString(value.character);

  if (type === "dialogue") {
    if (!character || !scene.characters.includes(character)) return null;
    return { type, character, function: beatFunction, source_refs: sourceRefs, content };
  }

  return {
    type: type as Exclude<BeatType, "dialogue">,
    ...(character && scene.characters.includes(character) ? { character } : {}),
    function: beatFunction,
    source_refs: sourceRefs,
    content,
  };
}

function parseScreenwriterOutput(
  value: unknown,
  analyzer: AnalyzerStageOutput,
  planner: PlannerStageOutput,
): StageParseResult<ScreenwriterStageOutput> {
  const root = firstObject(value, ["screenwriter", "draft", "result"]);
  const scenesValue = root?.scenes;
  if (!Array.isArray(scenesValue)) return { ok: false, message: "Screenwriter 输出缺少 scenes。" };

  const planById = new Map(planner.scene_plan.map((scene) => [scene.id, scene]));
  const factIds = collectFactIds(analyzer.source);
  const scenes: ScriptScene[] = [];

  for (const sceneValue of scenesValue) {
    if (!isObject(sceneValue)) return { ok: false, message: "Screenwriter scene 不是对象。" };
    const id = asString(sceneValue.id);
    const planned = planById.get(id);
    if (!planned) return { ok: false, message: `Screenwriter 输出了未规划 scene ${id}。` };
    const beats = Array.isArray(sceneValue.beats)
      ? sceneValue.beats.map((beat) => parseBeat(beat, planned, factIds)).filter((beat): beat is ScriptBeat => beat !== null)
      : [];
    if (beats.length === 0) return { ok: false, message: `Screenwriter 场景 ${id} 缺少有效 beats。` };

    scenes.push({
      id: planned.id,
      title: asString(sceneValue.title, planned.title),
      source_chapters: planned.source_chapters,
      source_refs: planned.source_refs,
      location: planned.location,
      time: planned.time,
      characters: planned.characters,
      scene_card: planned.scene_card,
      dramatic_purpose: planned.dramatic_purpose,
      conflict: planned.conflict,
      beats,
      adaptation_notes: asStringArray(sceneValue.adaptation_notes).length > 0
        ? asStringArray(sceneValue.adaptation_notes)
        : planned.adaptation_notes,
    });
  }

  const sceneIds = new Set(scenes.map((scene) => scene.id));
  if (planner.scene_plan.some((scene) => !sceneIds.has(scene.id))) {
    return { ok: false, message: "Screenwriter 未覆盖全部 planner.scene_plan。" };
  }

  return { ok: true, output: { scenes } };
}

function parseReporterOutput(
  value: unknown,
  analyzer: AnalyzerStageOutput,
  planner: PlannerStageOutput,
  screenwriter: ScreenwriterStageOutput,
): StageParseResult<ReporterStageOutput> {
  const root = firstObject(value, ["reporter", "report", "result"]);
  if (!root) return { ok: false, message: "Reporter 输出不是对象。" };
  const reportValue = root.adaptation_report;
  if (!isObject(reportValue)) return { ok: false, message: "Reporter 输出缺少 adaptation_report。" };

  const report: AdaptationReport = {
    chapter_count: Number(reportValue.chapter_count),
    scene_count: Number(reportValue.scene_count),
    character_count: Number(reportValue.character_count),
    main_conflicts: asStringArray(reportValue.main_conflicts),
    omitted_or_compressed: asStringArray(reportValue.omitted_or_compressed),
    revision_suggestions: asStringArray(reportValue.revision_suggestions),
  };

  if (
    report.chapter_count !== analyzer.source.chapters.length ||
    report.scene_count !== screenwriter.scenes.length ||
    report.character_count !== planner.characters.length
  ) {
    return { ok: false, message: "Reporter count 与阶段输出不一致。" };
  }

  if (!Array.isArray(report.main_conflicts) || report.main_conflicts.length === 0) report.main_conflicts = ["需补充核心冲突。"];
  if (!Array.isArray(report.omitted_or_compressed)) report.omitted_or_compressed = [];
  if (!Array.isArray(report.revision_suggestions)) report.revision_suggestions = [];

  return {
    ok: true,
    output: {
      title: asString(root.title, "未命名剧本"),
      logline: asString(root.logline, "需补充一句话核心冲突。"),
      adaptation_report: report,
    },
  };
}

function assembleDocument(
  request: GenerationRequest,
  analyzer: AnalyzerStageOutput,
  planner: PlannerStageOutput,
  screenwriter: ScreenwriterStageOutput,
  reporter: ReporterStageOutput,
): ScriptForgeDocument {
  return {
    script: {
      schema_version: "1.1",
      title: reporter.title,
      metadata: {
        language: "zh-CN",
        format: request.target.format,
        genre: request.target.genre,
        target_duration_minutes: request.target.target_duration_minutes,
        logline: reporter.logline,
        tone: request.target.tone,
      },
      source: analyzer.source,
      characters: planner.characters,
      locations: planner.locations,
      scenes: screenwriter.scenes,
      adaptation_report: reporter.adaptation_report,
    },
  };
}

function errorResult(params: {
  stage: GenerationStage;
  message: string;
  diagnostics: GenerationDiagnostic[];
  promptStages: PromptBundle[];
  stageOutputs: GenerationStageOutputs;
  model?: string;
  kind?: GenerationDiagnostic["kind"];
}): GenerationResult {
  const hasStageError = params.diagnostics.some((item) => (
    item.stage === params.stage &&
    item.severity === "error" &&
    item.message === params.message
  ));
  return {
    status: "error",
    error: params.message,
    diagnostics: hasStageError
      ? params.diagnostics
      : [
        ...params.diagnostics,
        diagnostic(params.stage, params.message, "error", params.kind ?? "validation"),
      ],
    promptStages: params.promptStages,
    stageOutputs: params.stageOutputs,
    model: params.model,
  };
}

async function runStage<T>(
  prompt: PromptBundle,
  parser: (value: unknown) => StageParseResult<T>,
  successMessage: (output: T) => string,
): Promise<GenerationStageResult<T>> {
  const timeoutMs = stageTimeoutMs(prompt.stage);
  const startedAt = Date.now();
  const modelResponse = await requestJsonFromModel(prompt.messages, { timeoutMs });
  const baseMetrics = emptyMetrics(prompt, timeoutMs, startedAt);
  if (!modelResponse.ok) {
    const metrics = {
      ...baseMetrics,
      model: modelResponse.model,
      provider: modelResponse.provider,
    };
    const message = modelResponse.message || `${prompt.stage} AI 请求失败。`;
    return {
      status: "error",
      error: message,
      prompt,
      metrics,
      model: modelResponse.model,
      kind: modelResponse.status ? "network" : "configuration",
      diagnostics: [
        diagnostic(prompt.stage, message, "error", modelResponse.status ? "network" : "configuration", metricsDetails(metrics)),
      ],
    };
  }

  const metrics: GenerationStageMetrics = {
    ...baseMetrics,
    elapsedMs: Date.now() - startedAt,
    responseChars: modelResponse.content.length,
    provider: modelResponse.provider,
    model: modelResponse.model,
  };
  const parsed = parseModelJson(modelResponse.content);
  if (!parsed.ok) {
    return {
      status: "error",
      error: parsed.message,
      prompt,
      metrics,
      model: modelResponse.model,
      kind: "parse",
      diagnostics: [
        diagnostic(prompt.stage, parsed.message, "error", "parse", metricsDetails(metrics)),
      ],
    };
  }

  const output = parser(parsed.value);
  if (!output.ok) {
    return {
      status: "error",
      error: output.message,
      prompt,
      metrics,
      model: modelResponse.model,
      kind: "validation",
      diagnostics: [
        diagnostic(prompt.stage, output.message, "error", "validation", metricsDetails(metrics)),
      ],
    };
  }

  return {
    status: "ok",
    output: output.output,
    prompt,
    metrics,
    model: modelResponse.model,
    diagnostics: [
      diagnostic(prompt.stage, successMessage(output.output), "info", undefined, metricsDetails(metrics)),
    ],
  };
}

export async function runAnalyzerStage(request: GenerationRequest): Promise<GenerationStageResult<AnalyzerStageOutput>> {
  const prompt = buildAnalyzerPrompt(request);
  return runStage(
    prompt,
    (value) => parseAnalyzerOutput(value, request),
    (output) => `Source Facts 已生成：${output.source.chapters.length} 章，${collectFactIds(output.source).size} 条 key_facts。`,
  );
}

export async function runPlannerStage(
  request: GenerationRequest,
  analyzer: AnalyzerStageOutput,
): Promise<GenerationStageResult<PlannerStageOutput>> {
  const prompt = buildPlannerPrompt(request, analyzer);
  return runStage(
    prompt,
    (value) => parsePlannerOutput(value, analyzer),
    (output) => `Dramatic Plan 已生成：${output.characters.length} 个角色、${output.locations.length} 个地点、${output.scene_plan.length} 个自然场面卡。`,
  );
}

export async function runScreenwriterStage(
  request: GenerationRequest,
  analyzer: AnalyzerStageOutput,
  planner: PlannerStageOutput,
): Promise<GenerationStageResult<ScreenwriterStageOutput>> {
  const prompt = buildScreenwriterPrompt(request, analyzer, planner);
  return runStage(
    prompt,
    (value) => parseScreenwriterOutput(value, analyzer, planner),
    (output) => `Dense Beats 已生成：${output.scenes.length} 场、${output.scenes.reduce((sum, scene) => sum + scene.beats.length, 0)} 个 beats。`,
  );
}

export async function runReporterStage(
  request: GenerationRequest,
  analyzer: AnalyzerStageOutput,
  planner: PlannerStageOutput,
  screenwriter: ScreenwriterStageOutput,
): Promise<GenerationStageResult<ReporterStageOutput>> {
  const prompt = buildReporterPrompt(request, analyzer, planner, screenwriter);
  return runStage(
    prompt,
    (value) => parseReporterOutput(value, analyzer, planner, screenwriter),
    () => "Adaptation Report 已生成。",
  );
}

export function assembleGenerationResult(
  request: GenerationRequest,
  stageOutputs: Required<GenerationStageOutputs>,
  diagnostics: GenerationDiagnostic[],
  promptStages: PromptBundle[],
  model?: string,
): GenerationResult {
  const document = assembleDocument(request, stageOutputs.analyzer, stageOutputs.planner, stageOutputs.screenwriter, stageOutputs.reporter);
  const validation = validateScriptForgeDocument(document);
  if (!validation.valid) {
    const error = `AI 文档未通过 Schema 或引用校验：${validation.errors.map((item) => item.message).slice(0, 3).join("；")}`;
    return {
      status: "error",
      error,
      validation,
      diagnostics: [
        ...diagnostics,
        diagnostic("validation", `AI 文档校验失败：${validation.errors.length} 个错误。`, "error", "schema"),
      ],
      promptStages,
      stageOutputs,
      model,
    };
  }

  const qualityDiagnostics = evaluateScriptDensity(document, request);
  const hasQualityError = qualityDiagnostics.some((item) => item.severity === "error");
  const hasWarning = validation.status === "warn" || qualityDiagnostics.some((item) => item.severity === "warning");
  return {
    status: hasQualityError ? "needs_revision" : hasWarning ? "degraded" : "ai_success",
    document,
    validation,
    diagnostics: [
      ...diagnostics,
      diagnostic("validation", `AI 文档校验状态：${validation.status}。`, validation.status === "warn" ? "warning" : "info"),
      ...qualityDiagnostics,
    ],
    promptStages,
    stageOutputs,
    model,
  };
}

export async function generateScriptForgeDocument(request: GenerationRequest): Promise<GenerationResult> {
  if (request.chapters.length < MIN_CHAPTER_COUNT) {
    throw new Error(`至少需要 ${MIN_CHAPTER_COUNT} 章有效输入。`);
  }

  const promptStages: PromptBundle[] = [];
  const stageOutputs: GenerationStageOutputs = {};
  const diagnostics: GenerationDiagnostic[] = [
    diagnostic("analyzer", `接收 ${request.chapters.length} 章小说输入。`),
    diagnostic("planner", `目标：${request.target.format} / ${request.target.genre} / ${request.target.target_duration_minutes} 分钟。`),
  ];
  let model: string | undefined;

  const analyzerResult = await runAnalyzerStage(request);
  promptStages.push(analyzerResult.prompt);
  diagnostics.push(...analyzerResult.diagnostics);
  if (analyzerResult.status === "error") {
    return errorResult({ stage: "analyzer", message: analyzerResult.error, diagnostics, promptStages, stageOutputs, model: analyzerResult.model, kind: analyzerResult.kind });
  }
  model = analyzerResult.model;
  stageOutputs.analyzer = analyzerResult.output;

  const plannerResult = await runPlannerStage(request, analyzerResult.output);
  promptStages.push(plannerResult.prompt);
  diagnostics.push(...plannerResult.diagnostics);
  if (plannerResult.status === "error") {
    return errorResult({ stage: "planner", message: plannerResult.error, diagnostics, promptStages, stageOutputs, model: plannerResult.model ?? model, kind: plannerResult.kind });
  }
  model = plannerResult.model ?? model;
  stageOutputs.planner = plannerResult.output;

  const screenwriterResult = await runScreenwriterStage(request, analyzerResult.output, plannerResult.output);
  promptStages.push(screenwriterResult.prompt);
  diagnostics.push(...screenwriterResult.diagnostics);
  if (screenwriterResult.status === "error") {
    return errorResult({ stage: "screenwriter", message: screenwriterResult.error, diagnostics, promptStages, stageOutputs, model: screenwriterResult.model ?? model, kind: screenwriterResult.kind });
  }
  model = screenwriterResult.model ?? model;
  stageOutputs.screenwriter = screenwriterResult.output;

  const reporterResult = await runReporterStage(request, analyzerResult.output, plannerResult.output, screenwriterResult.output);
  promptStages.push(reporterResult.prompt);
  diagnostics.push(...reporterResult.diagnostics);
  if (reporterResult.status === "error") {
    return errorResult({ stage: "reporter", message: reporterResult.error, diagnostics, promptStages, stageOutputs, model: reporterResult.model ?? model, kind: reporterResult.kind });
  }
  model = reporterResult.model ?? model;
  stageOutputs.reporter = reporterResult.output;

  return assembleGenerationResult(request, stageOutputs as Required<GenerationStageOutputs>, diagnostics, promptStages, model);
}
