import type { ScriptForgeDocument } from "@/types/scriptforge";

export function parseModelJson(content: string): { ok: true; value: unknown } | { ok: false; message: string } {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch {
    return { ok: false, message: "生成内容格式异常，请重新生成一次。" };
  }
}

export function coerceDocument(value: unknown): ScriptForgeDocument {
  if (value && typeof value === "object") {
    const objectValue = value as { document?: unknown; script?: unknown };
    if (objectValue.document && typeof objectValue.document === "object") {
      return objectValue.document as ScriptForgeDocument;
    }
    if (objectValue.script && typeof objectValue.script === "object") {
      return value as ScriptForgeDocument;
    }
  }
  return { script: value as ScriptForgeDocument["script"] };
}
