import type {
  AdaptationReport,
  GenerationRequest,
  ScriptCharacter,
  ScriptLocation,
  ScriptScene,
  ScriptSceneCard,
  ScriptSource,
  ScriptForgeDocument,
} from "@/types/scriptforge";
import type { ValidationError, ValidationResult } from "@/lib/schema";

export type GenerationStage = "analyzer" | "planner" | "screenwriter" | "reporter" | "validation" | "quality";

export type GenerationStatus = "ai_success" | "needs_revision" | "degraded" | "error";

export type GenerationErrorKind =
  | "configuration"
  | "network"
  | "parse"
  | "schema"
  | "reference"
  | "validation"
  | "quality"
  | "unknown";

export type GenerationDiagnostic = {
  stage: GenerationStage;
  message: string;
  severity?: "info" | "warning" | "error";
  kind?: GenerationErrorKind;
  details?: string;
};

export type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type PromptBundle = {
  stage: Exclude<GenerationStage, "validation" | "quality">;
  messages: PromptMessage[];
  responseContract: string;
};

export type AnalyzerStageOutput = {
  source: ScriptSource;
};

export type PlannedScene = {
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
  beat_budget?: number;
  adaptation_notes?: string[];
};

export type PlannerStageOutput = {
  characters: ScriptCharacter[];
  locations: ScriptLocation[];
  scene_plan: PlannedScene[];
};

export type ScreenwriterStageOutput = {
  scenes: ScriptScene[];
};

export type ReporterStageOutput = {
  title: string;
  logline: string;
  adaptation_report: AdaptationReport;
};

export type GenerationStageOutputs = {
  analyzer?: AnalyzerStageOutput;
  planner?: PlannerStageOutput;
  screenwriter?: ScreenwriterStageOutput;
  reporter?: ReporterStageOutput;
};

export type OpenAiCompatibleConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export type AiClient = {
  completeJson(messages: PromptMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<unknown>;
};

export type GenerateAdaptationOptions = {
  aiClient?: AiClient;
};

export type GenerateAdaptationResult = {
  status: GenerationStatus;
  document?: ScriptForgeDocument;
  validation?: ValidationResult;
  diagnostics: GenerationDiagnostic[];
  promptStages: PromptBundle[];
  stageOutputs?: GenerationStageOutputs;
  model?: string;
  error?: string;
};

export type GenerationResult = GenerateAdaptationResult;

export type BadCandidateReport = {
  diagnostics: GenerationDiagnostic[];
  validationErrors?: ValidationError[];
};

export type GenerationApiRequest = {
  request?: GenerationRequest;
  chapters?: GenerationRequest["chapters"];
  target?: Partial<GenerationRequest["target"]>;
};

export type RevisionRequest = {
  request: GenerationRequest;
  document: ScriptForgeDocument;
  directions?: string[];
};
