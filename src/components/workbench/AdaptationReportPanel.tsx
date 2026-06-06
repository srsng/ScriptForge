import type { ScriptForgeDocument } from "@/types/scriptforge";

type AdaptationReportPanelProps = {
  document: ScriptForgeDocument | null;
};

export function AdaptationReportPanel({ document }: AdaptationReportPanelProps) {
  const report = document?.script.adaptation_report;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">改编报告</h2>
      {!report ? (
        <p className="mt-2 text-sm text-zinc-600">生成结果后展示 adaptation_report，包括 main_conflicts、omitted_or_compressed、revision_suggestions。</p>
      ) : (
        <div className="mt-4 space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-zinc-200 p-3">
              <div className="text-2xl font-semibold">{report.chapter_count}</div>
              <div className="text-zinc-600">章节</div>
            </div>
            <div className="rounded-md border border-zinc-200 p-3">
              <div className="text-2xl font-semibold">{report.scene_count}</div>
              <div className="text-zinc-600">场景</div>
            </div>
            <div className="rounded-md border border-zinc-200 p-3">
              <div className="text-2xl font-semibold">{report.character_count}</div>
              <div className="text-zinc-600">人物</div>
            </div>
          </div>

          <ReportList title="main_conflicts 核心冲突" items={report.main_conflicts} />
          <ReportList title="omitted_or_compressed 压缩/省略" items={report.omitted_or_compressed} />
          <ReportList title="revision_suggestions 修改建议" items={report.revision_suggestions} />
        </div>
      )}
    </section>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-700">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
