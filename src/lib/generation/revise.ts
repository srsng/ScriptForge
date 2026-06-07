import { validateScriptForgeDocument } from "@/lib/schema";
import type { ScriptForgeDocument } from "@/types/scriptforge";
import { requestJsonFromModel } from "./client";
import { coerceDocument, parseModelJson } from "./document";
import { buildInternalAdaptationWorkflowInstruction, buildScriptDensityInstruction } from "./prompts";
import { evaluateScriptDensity } from "./quality";
import type { GenerationDiagnostic, GenerationResult, PromptBundle, PromptMessage, RevisionRequest } from "./types";

function diagnostic(
  stage: GenerationDiagnostic["stage"],
  message: string,
  severity: GenerationDiagnostic["severity"] = "info",
  kind?: GenerationDiagnostic["kind"],
): GenerationDiagnostic {
  return { stage, message, severity, kind };
}

function normalizeDirections(input: RevisionRequest): string[] {
  const explicit = input.directions?.map((item) => item.trim()).filter(Boolean) ?? [];
  if (explicit.length > 0) return explicit;
  return input.document.script.adaptation_report.revision_suggestions
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildRevisionMessages(input: RevisionRequest, directions: string[]): PromptMessage[] {
  const workflowInstruction = buildInternalAdaptationWorkflowInstruction(input.request);
  const densityInstruction = buildScriptDensityInstruction(input.request);
  const sourceChapters = input.request.chapters
    .map((chapter, index) => {
      const content = chapter.content.replace(/\s+/g, " ").trim();
      return `${index + 1}. ${chapter.id} ${chapter.title}\n${content}`;
    })
    .join("\n\n");

  return [
    {
      role: "system",
      content: "你是 ScriptForge 1.1 后续修改建议改写器。必须复核 Source Facts / Dramatic Plan / Natural Scene Cards / Dense Beats，只输出一个完整 ScriptForgeDocument JSON；不要 Markdown、不要解释性文字。",
    },
    {
      role: "user",
      content: `请基于当前结构化剧本，按“后续修改建议”改写剧本正文。

后续修改建议：
- ${directions.join("\n- ")}

改写前先在内部执行：
${workflowInstruction}

必须落实到 scenes / beats / dialogue / action：
- 按所选建议调整剧情重心：加重核心冲突、人物关系、场景篇幅、对白攻防或信息释放节奏；如果只收到一条建议，只改写与该建议相关的场景和报告内容。
- 重新检查自然场景边界：连续地点、时间、人物组合和目标一致的攻防应合并或留在同一 scene 内扩写，不要为了应用建议硬拆 scene。
- 必须保留 schema_version = "1.1"，维护 source.chapters[].key_facts、scenes[].source_refs、scenes[].scene_card、beats[].function、beats[].source_refs。
- 改写 scenes[].beats 时同步修正 scene_card 的 entry_state、turning_point、exit_state 和 visual_atmosphere。
- 直接改写 scenes[].beats，不允许只修改 adaptation_report 或 revision_suggestions。
- dialogue 要体现关系、情绪、潜台词和攻防变化；action 要有可拍摄动作、对象、反应和环境变化。
- 保留现有 1.1 Schema 主结构、id 风格和引用关系；不要输出 Schema 外字段。
- revision_suggestions 字段在产品中表示“后续修改建议”，改写后只保留仍需后续处理的后续修改建议。
- 所有新增内容必须能从原始章节合理改编，不能编造与原文无关的新设定。

${densityInstruction}

原始章节：
${sourceChapters}

当前 ScriptForgeDocument：
${JSON.stringify(input.document)}`,
    },
  ];
}

function buildPromptBundle(messages: PromptMessage[]): PromptBundle[] {
  return [
    {
      stage: "screenwriter",
      responseContract: "按后续修改建议落实到 scenes、beats、dialogue、action，并输出完整 ScriptForgeDocument。",
      messages,
    },
  ];
}

export async function reviseScriptForgeDocument(input: RevisionRequest): Promise<GenerationResult> {
  const directions = normalizeDirections(input);
  if (directions.length === 0) {
    return {
      status: "error",
      error: "缺少后续修改建议，无法执行改写。",
      diagnostics: [
        diagnostic("planner", "后续修改建议为空。", "error", "validation"),
      ],
      promptStages: [],
    };
  }

  const messages = buildRevisionMessages(input, directions);
  const promptStages = buildPromptBundle(messages);
  const diagnostics: GenerationDiagnostic[] = [
    diagnostic("planner", `接收 ${directions.length} 条后续修改建议。`),
  ];

  const modelResponse = await requestJsonFromModel(messages);
  if (!modelResponse.ok) {
    const message = modelResponse.message || "AI 后续修改建议改写失败。";
    return {
      status: "error",
      error: message,
      diagnostics: [
        ...diagnostics,
        diagnostic("screenwriter", message, "error", modelResponse.status ? "network" : "configuration"),
      ],
      promptStages,
      model: modelResponse.model,
    };
  }

  const parsed = parseModelJson(modelResponse.content);
  if (!parsed.ok) {
    return {
      status: "error",
      error: parsed.message,
      diagnostics: [
        ...diagnostics,
        diagnostic("reporter", parsed.message, "error", "parse"),
      ],
      promptStages,
      model: modelResponse.model,
    };
  }

  const document: ScriptForgeDocument = coerceDocument(parsed.value);
  const validation = validateScriptForgeDocument(document);
  if (!validation.valid) {
    const error = `后续修改建议改写结果未通过 Schema 或引用校验：${validation.errors.map((item) => item.message).slice(0, 3).join("；")}`;
    return {
      status: "error",
      error,
      validation,
      diagnostics: [
        ...diagnostics,
        diagnostic("validation", `改写文档校验失败：${validation.errors.length} 个错误。`, "error", "schema"),
      ],
      promptStages,
      model: modelResponse.model,
    };
  }

  const qualityDiagnostics = evaluateScriptDensity(document, input.request);
  const hasQualityError = qualityDiagnostics.some((item) => item.severity === "error");
  const hasWarning = validation.status === "warn" || qualityDiagnostics.some((item) => item.severity === "warning");

  return {
    status: hasQualityError ? "needs_revision" : hasWarning ? "degraded" : "ai_success",
    document,
    validation,
    diagnostics: [
      ...diagnostics,
      diagnostic("screenwriter", "AI 已按后续修改建议返回改写后的 ScriptForgeDocument JSON。"),
      diagnostic("validation", `改写文档校验状态：${validation.status}。`, validation.status === "warn" ? "warning" : "info"),
      ...qualityDiagnostics,
    ],
    promptStages,
    model: modelResponse.model,
  };
}
