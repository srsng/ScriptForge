import type { PromptMessage } from "./types";

export type ModelClientResult = {
  ok: true;
  model: string;
  content: string;
} | {
  ok: false;
  model?: string;
  message: string;
  status?: number;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";

function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || process.env.SCRIPT_FORGE_OPENAI_API_KEY?.trim() || null;
}

function getEndpoint(): string {
  const configured = process.env.OPENAI_BASE_URL?.trim() || process.env.SCRIPT_FORGE_OPENAI_ENDPOINT?.trim();
  if (!configured) return DEFAULT_ENDPOINT;
  const normalized = configured.replace(/\/$/, "");
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
}

export function configuredModel(): string {
  return process.env.OPENAI_MODEL?.trim() || process.env.SCRIPT_FORGE_MODEL?.trim() || DEFAULT_MODEL;
}

export function hasConfiguredAiProvider(): boolean {
  return getApiKey() !== null;
}

export async function requestJsonFromModel(messages: PromptMessage[]): Promise<ModelClientResult> {
  const apiKey = getApiKey();
  const model = configuredModel();
  if (!apiKey) {
    return {
      ok: false,
      model,
      message: "未配置 OPENAI_API_KEY 或 SCRIPT_FORGE_OPENAI_API_KEY，跳过 AI 调用并启用降级生成。",
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.SCRIPT_FORGE_AI_TIMEOUT_MS ?? 45_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(getEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.35,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const message = payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify((payload as { error: unknown }).error)
        : response.statusText;
      return { ok: false, model, status: response.status, message: `AI 请求失败：${message}` };
    }

    const content = extractChatCompletionContent(payload);
    if (!content) {
      return { ok: false, model, message: "AI 响应中没有可解析的 message.content。" };
    }

    return { ok: true, model, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, model, message: `AI 请求异常：${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

function extractChatCompletionContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown } };
  const content = first.message?.content;
  return typeof content === "string" && content.trim().length > 0 ? content : null;
}
