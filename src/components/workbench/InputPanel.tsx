import type { InputNormalizationResult } from "@/types/scriptforge";

type SampleMeta = {
  title: string;
  author: string;
  source: string;
  license_note: string;
};

type InputPanelProps = {
  rawInput: string;
  normalization: InputNormalizationResult;
  sampleMeta: SampleMeta | null;
  saveDisabled: boolean;
  saving: boolean;
  onRawInputChange: (value: string) => void;
  onLoadSample: () => void;
  onSaveWorkspace: () => void;
};

export function InputPanel({
  rawInput,
  normalization,
  sampleMeta,
  saveDisabled,
  saving,
  onRawInputChange,
  onLoadSample,
  onSaveWorkspace,
}: InputPanelProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold">章节输入</h2>
            <p className="text-sm text-zinc-600">至少 3 章；支持 第一章、第一回、Chapter 1、1. 标题。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-cyan-700 px-3 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-50" onClick={onLoadSample} type="button">
              载入公开样本
            </button>
            <button className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:bg-zinc-300" disabled={saveDisabled} onClick={onSaveWorkspace} type="button">
              {saving ? "保存中..." : "保存工作区"}
            </button>
          </div>
        </div>
        <textarea
          className="min-h-[460px] w-full resize-y bg-white p-4 font-mono text-sm leading-6 outline-none"
          onChange={(event) => onRawInputChange(event.target.value)}
          placeholder="粘贴至少 3 个章节。章节标题可用：第一章、第一回、Chapter 1、1. 标题。"
          spellCheck={false}
          value={rawInput}
        />
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">输入状态</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-zinc-200 p-3">
              <div className="text-2xl font-semibold">{normalization.chapters.length}</div>
              <div className="text-zinc-600">章节</div>
            </div>
            <div className="rounded-md border border-zinc-200 p-3">
              <div className="text-2xl font-semibold">{normalization.isValid ? "OK" : "NO"}</div>
              <div className="text-zinc-600">可生成</div>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {normalization.issues.length === 0 ? <p className="text-emerald-700">未发现输入问题</p> : null}
            {normalization.issues.map((issue) => (
              <p className={issue.severity === "error" ? "text-red-700" : "text-amber-700"} key={`${issue.path}-${issue.code}`}>
                {issue.message}
              </p>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">章节列表</h2>
          <div className="mt-3 max-h-[300px] space-y-2 overflow-auto text-sm">
            {normalization.chapters.map((chapter) => (
              <div className="rounded-md border border-zinc-200 p-2" key={chapter.id}>
                <div className="font-medium">{chapter.title}</div>
                <div className="text-zinc-600">{chapter.id} · {chapter.content.length} 字符</div>
              </div>
            ))}
          </div>
        </div>

        {sampleMeta ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm">
            <h2 className="text-lg font-semibold">样本来源</h2>
            <p className="mt-2">{sampleMeta.title}</p>
            <p className="text-zinc-600">{sampleMeta.author}</p>
            <p className="mt-2 text-zinc-600">{sampleMeta.license_note}</p>
            <a className="mt-2 block break-all text-cyan-700 underline" href={sampleMeta.source} rel="noreferrer" target="_blank">
              {sampleMeta.source}
            </a>
          </div>
        ) : null}
      </aside>
    </section>
  );
}
