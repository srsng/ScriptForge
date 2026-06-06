import type { PromptMessage } from "./types";

export type ModelClientResult = {
  ok: true;
  model: string;
  content: string;
  provider: "main" | "backup";
} | {
  ok: false;
  model?: string;
  message: string;
  status?: number;
};

export type ModelRequestOptions = {
  timeoutMs?: number;
};

type ProviderName = "main" | "backup";

type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

type ProviderConfig = {
  name: ProviderName;
  apiKey: string;
  baseURL: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS = 60_000;

type EnvName =
  | "OPENAI_API_KEY"
  | "OPENAI_BASE_URL"
  | "OPENAI_MODEL"
  | "OPENAI_REASONING_EFFORT"
  | "BACKUP_OPENAI_API_KEY"
  | "BACKUP_OPENAI_BASE_URL"
  | "BACKUP_OPENAI_MODEL"
  | "BACKUP_OPENAI_REASONING_EFFORT";

function readEnv(name: EnvName): string | null {
  const value = process.env[name]?.trim();
  return value && !value.startsWith("#") ? value : null;
}

function readReasoningEffort(name: "OPENAI_REASONING_EFFORT" | "BACKUP_OPENAI_REASONING_EFFORT"): ReasoningEffort | undefined {
  const value = readEnv(name);
  return value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh"
    ? value
    : undefined;
}

function normalizeBaseUrl(value: string | null): string {
  const configured = value || DEFAULT_BASE_URL;
  const normalized = configured.replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized.slice(0, -"/chat/completions".length)
    : normalized;
}

function getConfiguredProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  const mainApiKey = readEnv("OPENAI_API_KEY");
  if (mainApiKey) {
    providers.push({
      name: "main",
      apiKey: mainApiKey,
      baseURL: normalizeBaseUrl(readEnv("OPENAI_BASE_URL")),
      model: readEnv("OPENAI_MODEL") || DEFAULT_MODEL,
      reasoningEffort: readReasoningEffort("OPENAI_REASONING_EFFORT"),
    });
  }

  const backupApiKey = readEnv("BACKUP_OPENAI_API_KEY");
  if (backupApiKey) {
    providers.push({
      name: "backup",
      apiKey: backupApiKey,
      baseURL: normalizeBaseUrl(readEnv("BACKUP_OPENAI_BASE_URL")),
      model: readEnv("BACKUP_OPENAI_MODEL") || DEFAULT_MODEL,
      reasoningEffort: readReasoningEffort("BACKUP_OPENAI_REASONING_EFFORT"),
    });
  }

  return providers;
}

export function configuredModel(): string {
  return getConfiguredProviders()[0]?.model || DEFAULT_MODEL;
}

export function hasConfiguredAiProvider(): boolean {
  return getConfiguredProviders().length > 0;
}

function statusFromError(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildChatCompletionRequest(provider: ProviderConfig, messages: PromptMessage[]) {
  return {
    model: provider.model,
    messages,
    temperature: 0.35,
    response_format: { type: "json_object" as const },
    ...(provider.reasoningEffort ? { reasoning_effort: provider.reasoningEffort } : {}),
  };
}

function extractContentFromChatCompletion(response: unknown): string | null {
  if (typeof response !== "object" || response === null || !("choices" in response)) return null;

  const choices = (response as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const firstChoice = choices[0];
  if (typeof firstChoice !== "object" || firstChoice === null || !("message" in firstChoice)) return null;

  const message = (firstChoice as { message?: unknown }).message;
  if (typeof message !== "object" || message === null || !("content" in message)) return null;

  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part === "object" && part !== null && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return null;
}

function parsePotentialEventStreamBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("data:")) return JSON.parse(trimmed);

  const chunks = trimmed
    .split(/\r?\n\r?\n/)
    .map((chunk) => chunk
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("\n"))
    .filter((chunk) => chunk && chunk !== "[DONE]");

  const lastJsonChunk = chunks.at(-1);
  return lastJsonChunk ? JSON.parse(lastJsonChunk) : null;
}

async function requestViaRawFetch(
  provider: ProviderConfig,
  messages: PromptMessage[],
  options: ModelRequestOptions = {},
): Promise<ModelClientResult> {
  const requestedTimeoutMs = options.timeoutMs;
  const timeoutMs = typeof requestedTimeoutMs === "number" && Number.isInteger(requestedTimeoutMs) && requestedTimeoutMs > 0
    ? requestedTimeoutMs
    : DEFAULT_TIMEOUT_MS;
  const response = await fetch(`${provider.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildChatCompletionRequest(provider, messages)),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      model: provider.model,
      status: response.status,
      message: `${provider.name} AI HTTP ${response.status}：${text.slice(0, 500)}`,
    };
  }

  const parsed = parsePotentialEventStreamBody(text);
  const content = extractContentFromChatCompletion(parsed);
  if (!content || content.trim().length === 0) {
    return { ok: false, model: provider.model, message: `${provider.name} AI 兼容请求没有可解析的 message.content。` };
  }
  return { ok: true, model: provider.model, provider: provider.name, content };
}

async function requestFromProvider(
  provider: ProviderConfig,
  messages: PromptMessage[],
  options: ModelRequestOptions = {},
): Promise<ModelClientResult> {
  try {
    return await requestViaRawFetch(provider, messages, options);
  } catch (error) {
    return {
      ok: false,
      model: provider.model,
      status: statusFromError(error),
      message: `${provider.name} AI 兼容请求异常：${messageFromError(error)}`,
    };
  }
}

export async function requestJsonFromModel(
  messages: PromptMessage[],
  options: ModelRequestOptions = {},
): Promise<ModelClientResult> {
  const providers = getConfiguredProviders();
  if (providers.length === 0) {
    return {
      ok: false,
      model: DEFAULT_MODEL,
      message: "未配置 OPENAI_API_KEY 或 BACKUP_OPENAI_API_KEY，无法执行 AI 生成。",
    };
  }

  const failures: ModelClientResult[] = [];
  for (const provider of providers) {
    const result = await requestFromProvider(provider, messages, options);
    if (result.ok) return result;
    failures.push(result);
  }

  const lastFailure = failures.at(-1);
  return {
    ok: false,
    model: lastFailure?.model || configuredModel(),
    status: lastFailure?.ok === false ? lastFailure.status : undefined,
    message: failures.map((failure) => failure.ok ? "" : failure.message).filter(Boolean).join("；"),
  };
}
