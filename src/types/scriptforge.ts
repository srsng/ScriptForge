export const MIN_CHAPTER_COUNT = 3;

export type ScriptFormat = "short_drama" | "film" | "stage";

export type CharacterRole =
  | "protagonist"
  | "antagonist"
  | "supporting"
  | "minor"
  | "narrator"
  | "unknown";

export type BeatType = "action" | "dialogue" | "narration" | "transition" | "note";

export type SourceFactType =
  | "event"
  | "character_goal"
  | "relationship"
  | "object"
  | "location"
  | "information"
  | "emotion"
  | "conflict";

export type BeatFunction =
  | "establish"
  | "probe"
  | "evade"
  | "pressure"
  | "reveal"
  | "turn"
  | "reaction"
  | "pause"
  | "transition"
  | "note";

export type NovelChapter = {
  id: string;
  title: string;
  content: string;
};

export type NovelChapterDraft = {
  title?: string;
  content?: string;
};

export type GenerationTarget = {
  format: ScriptFormat;
  genre: string;
  target_duration_minutes: number;
  tone: string;
};

export type GenerationRequest = {
  chapters: NovelChapter[];
  target: GenerationTarget;
};

export type InputIssueSeverity = "error" | "warning";

export type InputIssueCode =
  | "empty_input"
  | "empty_chapter"
  | "insufficient_chapters"
  | "missing_title";

export type InputIssue = {
  code: InputIssueCode;
  severity: InputIssueSeverity;
  path: string;
  message: string;
};

export type InputNormalizationResult = {
  chapters: NovelChapter[];
  issues: InputIssue[];
  isValid: boolean;
};

export type ScriptMetadata = {
  language: "zh-CN";
  format: ScriptFormat;
  genre: string;
  target_duration_minutes: number;
  logline: string;
  tone: string;
};

export type ScriptSourceChapter = {
  id: string;
  title: string;
  summary: string;
  key_facts: ScriptSourceFact[];
};

export type ScriptSourceFact = {
  id: string;
  type: SourceFactType;
  content: string;
};

export type ScriptSource = {
  type: "novel";
  chapters: ScriptSourceChapter[];
};

export type ScriptRelationship = {
  target: string;
  type: string;
  description: string;
};

export type ScriptCharacter = {
  id: string;
  name: string;
  role: CharacterRole;
  description: string;
  motivation: string;
  arc: string;
  voice: string;
  relationships?: ScriptRelationship[];
};

export type ScriptLocation = {
  id: string;
  name: string;
  description: string;
  visual_notes: string;
};

export type ScriptBeat =
  | {
      type: "dialogue";
      character: string;
      function: BeatFunction;
      source_refs: string[];
      content: string;
    }
  | {
      type: Exclude<BeatType, "dialogue">;
      character?: string;
      function: BeatFunction;
      source_refs: string[];
      content: string;
    };

export type ScriptSceneCard = {
  objective: string;
  opposition: string;
  entry_state: string;
  turning_point: string;
  exit_state: string;
  visual_atmosphere: string;
};

export type ScriptScene = {
  id: string;
  title: string;
  source_chapters: string[];
  source_refs: string[];
  location: string;
  time: string;
  characters: string[];
  scene_card: ScriptSceneCard;
  dramatic_purpose: string;
  conflict: string;
  beats: ScriptBeat[];
  adaptation_notes?: string[];
};

export type AdaptationReport = {
  chapter_count: number;
  scene_count: number;
  character_count: number;
  main_conflicts: string[];
  omitted_or_compressed: string[];
  revision_suggestions: string[];
};

export type ScriptForgeScript = {
  schema_version: "1.1";
  title: string;
  metadata: ScriptMetadata;
  source: ScriptSource;
  characters: ScriptCharacter[];
  locations: ScriptLocation[];
  scenes: ScriptScene[];
  adaptation_report: AdaptationReport;
};

export type ScriptForgeDocument = {
  script: ScriptForgeScript;
};

export type WorkspaceResultSource = "none" | "ai" | "ai_draft" | "repair" | "manual";

export type WorkspaceState = {
  schema_version: "1.1";
  title: string;
  rawText: string;
  request: GenerationRequest;
  result: ScriptForgeDocument | null;
  resultSource: WorkspaceResultSource;
  yamlText: string;
  lastAppliedYamlText?: string;
  yamlValidation: unknown | null;
  repairResult: unknown | null;
  generationDiagnostics: unknown[];
  generationError: string;
  message: string;
  updated_at: string;
};
