const workflowStages = [
  "章节输入",
  "改编偏好",
  "AI 结构化生成",
  "Schema / 来源引用校验",
  "预览 / 编辑",
  "YAML 本地导出",
] as const;

const intakeFields = ["chapter_id", "chapter_number", "title", "body", "summary"] as const;

const preferenceFields = [
  "target_format",
  "tone",
  "length",
  "pace",
  "fidelity",
] as const;

const moduleSlots = [
  {
    module: "M1",
    title: "章节与改编偏好",
    status: "接口预留",
    contract: "NovelChapter[] / GenerationRequest",
  },
  {
    module: "M4",
    title: "AI 结构化生成",
    status: "等待接入",
    contract: "ScriptForgeScript JSON",
  },
  {
    module: "M2 / M5",
    title: "Schema、引用与修复",
    status: "入口就绪",
    contract: "ValidationResult",
  },
  {
    module: "M6 / M7",
    title: "预览、编辑与导出",
    status: "工作区占位",
    contract: "Editable YAML / ExportPayload",
  },
] as const;

const previewSlots = [
  "人物与地点资产",
  "场景、动作与对白节拍",
  "来源章节与改编报告",
] as const;

const validationRows = [
  { label: "Schema", state: "未运行", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  { label: "References", state: "未运行", tone: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  { label: "Repair", state: "未运行", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
] as const;

function FieldPill({ children }: { children: string }) {
  return (
    <div className="min-h-10 break-words rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-600">
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5">
        <header className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-cyan-700">ScriptForge M0</p>
              <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
                Workbench Shell
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                基础页面和工作台布局已经围绕产品路径搭好：章节输入到改编偏好，再到结构化生成、校验、预览编辑和 YAML 本地导出。
              </p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3 lg:w-[32rem]">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="font-medium text-zinc-950">Stack</p>
                <p className="mt-1 text-zinc-600">Next.js / TS / Tailwind</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="font-medium text-zinc-950">Data</p>
                <p className="mt-1 text-zinc-600">无业务样例硬编码</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="font-medium text-zinc-950">Status</p>
                <p className="mt-1 text-emerald-700">Shell ready</p>
              </div>
            </div>
          </div>
        </header>

        <nav className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm" aria-label="ScriptForge product workflow">
          <ol className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {workflowStages.map((stage, index) => (
              <li className="rounded-lg border border-zinc-200 bg-zinc-50 p-3" key={stage}>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-700 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <p className="mt-2 text-sm font-medium text-zinc-900">{stage}</p>
              </li>
            ))}
          </ol>
        </nav>

        <section className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)_22rem]" aria-label="Workbench shell">
          <aside className="space-y-5">
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm" aria-labelledby="input-heading">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-cyan-700">M1 slot</p>
                  <h2 id="input-heading" className="mt-1 text-xl font-semibold text-zinc-950">
                    输入
                  </h2>
                </div>
                <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-sm text-amber-800">
                  待接入
                </span>
              </div>

              <div className="mt-5 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">NovelChapter[]</h3>
                  <div className="mt-3 space-y-2">
                    {intakeFields.map((field) => (
                      <FieldPill key={field}>{field}</FieldPill>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">GenerationRequest</h3>
                  <div className="mt-3 space-y-2">
                    {preferenceFields.map((field) => (
                      <FieldPill key={field}>{field}</FieldPill>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm" aria-labelledby="modules-heading">
              <h2 id="modules-heading" className="text-xl font-semibold text-zinc-950">
                模块入口
              </h2>
              <div className="mt-4 space-y-3">
                {moduleSlots.map((slot) => (
                  <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-3" key={slot.title}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-cyan-700">{slot.module}</span>
                      <span className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600">
                        {slot.status}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-zinc-950">{slot.title}</h3>
                    <p className="mt-1 break-words font-mono text-xs text-zinc-500">{slot.contract}</p>
                  </article>
                ))}
              </div>
            </section>
          </aside>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm" aria-labelledby="generation-heading">
            <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700">M4 pipeline</p>
                <h2 id="generation-heading" className="mt-1 text-xl font-semibold text-zinc-950">
                  AI 结构化生成工作区
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                  中央区域保留请求状态、结构化输出、降级错误和作者预览位置，后续模块可直接接入共享契约。
                </p>
              </div>
              <button
                className="rounded-lg bg-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600"
                disabled
                type="button"
              >
                生成待接入
              </button>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="min-h-[28rem] rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-zinc-950">ScriptForgeScript JSON</h3>
                    <p className="mt-1 text-sm text-zinc-600">等待章节、偏好与生成结果。</p>
                  </div>
                  <span className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-600">
                    Empty state
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {previewSlots.map((slot) => (
                    <div className="min-h-28 rounded-lg border border-zinc-200 bg-white p-3" key={slot}>
                      <p className="text-sm font-semibold text-zinc-900">{slot}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        后续由真实生成结果填充；M0 不预置小说正文、人物、场景或 YAML。
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="space-y-3">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-semibold text-zinc-900">生成状态</p>
                  <div className="mt-3 space-y-2 text-sm text-zinc-600">
                    <p className="rounded-lg bg-white p-2">输入：未就绪</p>
                    <p className="rounded-lg bg-white p-2">请求：未发送</p>
                    <p className="rounded-lg bg-white p-2">降级：未触发</p>
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-semibold text-zinc-900">共享契约</p>
                  <div className="mt-3 space-y-2 text-sm text-zinc-600">
                    <p className="rounded-lg bg-white p-2">source</p>
                    <p className="rounded-lg bg-white p-2">characters / locations</p>
                    <p className="rounded-lg bg-white p-2">scenes.source_chapters</p>
                    <p className="rounded-lg bg-white p-2">adaptation_report</p>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm" aria-labelledby="validation-heading">
              <p className="text-sm font-medium text-cyan-700">M2 / M5</p>
              <h2 id="validation-heading" className="mt-1 text-xl font-semibold text-zinc-950">
                校验
              </h2>
              <div className="mt-4 space-y-3">
                {validationRows.map((row) => (
                  <div className={`rounded-lg border px-3 py-3 ${row.tone}`} key={row.label}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-sm">{row.state}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm" aria-labelledby="export-heading">
              <p className="text-sm font-medium text-cyan-700">M6 / M7</p>
              <h2 id="export-heading" className="mt-1 text-xl font-semibold text-zinc-950">
                YAML 编辑与本地导出
              </h2>
              <div className="mt-4 min-h-56 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 font-mono text-sm leading-6 text-zinc-500">
                Editable YAML placeholder
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <button
                  className="rounded-lg bg-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-600"
                  disabled
                  type="button"
                >
                  重新校验
                </button>
                <button
                  className="rounded-lg bg-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-600"
                  disabled
                  type="button"
                >
                  导出 YAML
                </button>
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
