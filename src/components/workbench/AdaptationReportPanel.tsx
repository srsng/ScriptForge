import type { FormEvent } from "react";
import type { ValidationResult } from "@/lib/schema";
import type { ScriptForgeDocument } from "@/types/scriptforge";
import { validationSummary } from "./utils";

type AdaptationReportPanelProps = {
  document: ScriptForgeDocument | null;
  validation: ValidationResult | null;
  revising: boolean;
  onReviseByDirections: (directions: string[]) => void | Promise<void>;
};

type AdaptationDecisionCategory = "保留" | "压缩/省略" | "合并/改写";

const categoryTone: Record<AdaptationDecisionCategory, string> = {
  保留: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "压缩/省略": "border-amber-200 bg-amber-50 text-amber-800",
  "合并/改写": "border-cyan-200 bg-cyan-50 text-cyan-800",
};

export function AdaptationReportPanel({
  document,
  validation,
  revising,
  onReviseByDirections,
}: AdaptationReportPanelProps) {
  const report = document?.script.adaptation_report;
  const sceneAdaptationNotes = document ? buildSceneAdaptationNotes(document) : [];
  const decisionCount = report
    ? report.main_conflicts.length + report.omitted_or_compressed.length + sceneAdaptationNotes.length
    : 0;
  const directions = report?.revision_suggestions ?? [];

  function handleCustomRewriteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (revising) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const instruction = String(formData.get("customRewriteInstruction") ?? "").trim();
    if (!instruction) return;

    void onReviseByDirections([`用户自定义改写要求：${instruction}`]);
    form.reset();
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">改编报告</h2>
          <p className="mt-1 text-sm text-zinc-600">从 adaptation_report 与 scene.adaptation_notes 组织小说到剧本的变化。</p>
        </div>
        <ValidationBadge validation={validation} />
      </div>

      {!report ? (
        <p className="mt-2 text-sm text-zinc-600">暂无改编报告。</p>
      ) : (
        <div className="mt-4 space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="章节" value={report.chapter_count} />
            <Metric label="场景" value={report.scene_count} />
            <Metric label="人物" value={report.character_count} />
          </div>

          <div className="rounded-md border border-zinc-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">改编决策</h3>
              <span className={decisionCount >= 3 ? "text-emerald-700" : "text-amber-700"}>
                {decisionCount} 条
              </span>
            </div>
            {decisionCount < 3 ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
                改编决策不足 3 条：建议补充保留、压缩/省略或合并/改写说明。
              </p>
            ) : null}
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <DecisionGroup
                category="保留"
                emptyText="缺少保留内容说明"
                items={report.main_conflicts}
                title="保留的核心冲突"
              />
              <DecisionGroup
                category="压缩/省略"
                emptyText="缺少压缩或省略说明"
                items={report.omitted_or_compressed}
                title="压缩/省略的内容"
              />
              <DecisionGroup
                category="合并/改写"
                emptyText="缺少场景改写说明"
                items={sceneAdaptationNotes}
                title="合并/改写说明"
              />
            </div>
          </div>

          <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-violet-950">后续改进</h3>
                <p className="mt-1 text-xs text-violet-800">可选择继续执行的后续修改建议。</p>
              </div>
              <button
                className="rounded-md bg-violet-700 px-3 py-2 text-xs font-medium text-white hover:bg-violet-800 disabled:bg-zinc-300"
                disabled={revising || directions.length === 0}
                onClick={() => onReviseByDirections(directions)}
                type="button"
              >
                {revising ? "改写中..." : "全部应用"}
              </button>
            </div>
            {directions.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {directions.map((item, index) => (
                  <li className="flex flex-col gap-2 rounded-md border border-violet-100 bg-white p-3 sm:flex-row sm:items-start sm:justify-between" key={`${index}-${item}`}>
                    <p className="text-zinc-700">{item}</p>
                    <button
                      className="shrink-0 rounded-md border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:border-zinc-200 disabled:text-zinc-400"
                      disabled={revising}
                      onClick={() => onReviseByDirections([item])}
                      type="button"
                    >
                      {revising ? "改写中..." : "应用"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-violet-800">缺少后续改进方向。</p>
            )}

            <form className="mt-3 rounded-md border border-violet-100 bg-white p-3" onSubmit={handleCustomRewriteSubmit}>
              <label className="block text-xs font-semibold text-violet-950" htmlFor="customRewriteInstruction">
                自定义 AI 改写
              </label>
              <p className="mt-1 text-xs text-zinc-600">
                输入你希望 AI 额外执行的改写要求，将复用当前剧本、原文事实与校验流程。
              </p>
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-violet-100 px-3 py-2 text-sm text-zinc-800 outline-none focus:border-violet-400 disabled:bg-zinc-50"
                disabled={revising}
                id="customRewriteInstruction"
                maxLength={800}
                minLength={4}
                name="customRewriteInstruction"
                placeholder="例如：把男女主冲突写得更尖锐，增加一个反转，但不要新增无来源设定。"
                required
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-zinc-500">自定义要求不得覆盖结构、原文事实和来源追溯约束，若有需要，请手动在剧本编辑导出区域删除再应用。</span>
                <button
                  className="rounded-md bg-violet-700 px-3 py-2 text-xs font-medium text-white hover:bg-violet-800 disabled:bg-zinc-300"
                  disabled={revising}
                  type="submit"
                >
                  {revising ? "改写中..." : "按自定义要求改写"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
function buildSceneAdaptationNotes(document: ScriptForgeDocument): string[] {
  return document.script.scenes.flatMap((scene) =>
    (scene.adaptation_notes ?? []).map((note) => `${scene.title}：${note}`),
  );
}

function DecisionGroup({
  title,
  category,
  items,
  emptyText,
}: {
  title: string;
  category: AdaptationDecisionCategory;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="rounded-md bg-zinc-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-2 py-0.5 text-xs ${categoryTone[category]}`}>{category}</span>
        <h4 className="font-medium">{title}</h4>
      </div>
      {items.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-700">
          {items.map((item, index) => (
            <li key={`${category}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-zinc-600">{emptyText}</p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-zinc-600">{label}</div>
    </div>
  );
}

function ValidationBadge({ validation }: { validation: ValidationResult | null }) {
  const tone = validation?.status === "pass"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : validation?.status === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : validation?.status === "error"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${tone}`}>
      <div className="font-medium">校验状态</div>
      <div>{validationSummary(validation)}</div>
    </div>
  );
}
