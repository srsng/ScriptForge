import type { ValidationResult } from "@/lib/schema";
import type { ScriptForgeDocument } from "@/types/scriptforge";
import { validationSummary } from "./utils";

type AdaptationReportPanelProps = {
  document: ScriptForgeDocument | null;
  validation: ValidationResult | null;
};

type AdaptationDecision = {
  category: "保留" | "压缩/省略" | "合并/改写" | "后续修改建议";
  text: string;
};

const categoryTone: Record<AdaptationDecision["category"], string> = {
  保留: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "压缩/省略": "border-amber-200 bg-amber-50 text-amber-800",
  "合并/改写": "border-cyan-200 bg-cyan-50 text-cyan-800",
  后续修改建议: "border-violet-200 bg-violet-50 text-violet-800",
};

export function AdaptationReportPanel({ document, validation }: AdaptationReportPanelProps) {
  const report = document?.script.adaptation_report;
  const decisions = document ? buildAdaptationDecisions(document) : [];
  const decisionCount = decisions.length;

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
                改编决策不足 3 条：建议补充保留、压缩/省略、合并/改写或后续修改建议。
              </p>
            ) : null}
            {decisions.length > 0 ? (
              <div className="mt-3 space-y-2">
                {decisions.map((decision, index) => (
                  <article className="rounded-md bg-zinc-50 p-3" key={`${decision.category}-${index}`}>
                    <span className={`rounded border px-2 py-0.5 text-xs ${categoryTone[decision.category]}`}>{decision.category}</span>
                    <p className="mt-2 text-zinc-700">{decision.text}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-zinc-600">缺少说明：暂无可展示的保留、压缩、合并/改写或修改建议。</p>
            )}
          </div>

          <ReportList title="保留的核心冲突" items={report.main_conflicts} emptyText="缺少保留内容说明" />
          <ReportList title="压缩/省略的内容" items={report.omitted_or_compressed} emptyText="缺少压缩或省略说明" />
          <ReportList title="后续修改建议" items={report.revision_suggestions} emptyText="缺少后续修改建议" />
        </div>
      )}
    </section>
  );
}

function buildAdaptationDecisions(document: ScriptForgeDocument): AdaptationDecision[] {
  const { adaptation_report: report, scenes } = document.script;
  const decisions: AdaptationDecision[] = [];

  for (const item of report.main_conflicts) {
    decisions.push({ category: "保留", text: item });
  }

  for (const item of report.omitted_or_compressed) {
    decisions.push({ category: "压缩/省略", text: item });
  }

  for (const scene of scenes) {
    for (const note of scene.adaptation_notes ?? []) {
      decisions.push({ category: "合并/改写", text: `${scene.title}：${note}` });
    }
  }

  for (const item of report.revision_suggestions) {
    decisions.push({ category: "后续修改建议", text: item });
  }

  return decisions;
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

function ReportList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-700">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-zinc-600">{emptyText}</p>
      )}
    </div>
  );
}
