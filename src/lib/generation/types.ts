import type { GenerationRequest, ScriptForgeDocument } from "@/types/scriptforge";
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
