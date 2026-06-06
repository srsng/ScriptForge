import type { ScriptFormat } from "@/types/scriptforge";

type PreferencePanelProps = {
  title: string;
  format: ScriptFormat;
  genre: string;
  tone: string;
  duration: number;
  onTitleChange: (value: string) => void;
  onFormatChange: (value: ScriptFormat) => void;
  onGenreChange: (value: string) => void;
  onToneChange: (value: string) => void;
  onDurationChange: (value: number) => void;
};

export function PreferencePanel({
  title,
  format,
  genre,
  tone,
  duration,
  onTitleChange,
  onFormatChange,
  onGenreChange,
  onToneChange,
  onDurationChange,
}: PreferencePanelProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">改编偏好</h2>
        <p className="text-sm text-zinc-600">这些字段会随当前编辑态一起发送给 /api/generate。</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <label className="grid gap-1 text-sm font-medium">
          工作区标题
          <input className="rounded-md border border-zinc-300 px-3 py-2 font-normal outline-none focus:border-cyan-700" value={title} onChange={(event) => onTitleChange(event.target.value)} />
        </label>

        <label className="grid gap-1 text-sm font-medium">
          目标形态
          <select className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-normal outline-none focus:border-cyan-700" value={format} onChange={(event) => onFormatChange(event.target.value as ScriptFormat)}>
            <option value="short_drama">短剧</option>
            <option value="film">电影</option>
            <option value="stage">舞台剧</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium">
          时长（分钟）
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 font-normal outline-none focus:border-cyan-700"
            max={180}
            min={1}
            step={1}
            type="number"
            value={duration}
            onChange={(event) => {
              const nextDuration = Number(event.target.value);
              if (Number.isInteger(nextDuration) && nextDuration >= 1 && nextDuration <= 180) {
                onDurationChange(nextDuration);
              }
            }}
          />
        </label>

        <label className="grid gap-1 text-sm font-medium">
          类型
          <input className="rounded-md border border-zinc-300 px-3 py-2 font-normal outline-none focus:border-cyan-700" value={genre} onChange={(event) => onGenreChange(event.target.value)} />
        </label>

        <label className="grid gap-1 text-sm font-medium md:col-span-2">
          语气
          <input className="rounded-md border border-zinc-300 px-3 py-2 font-normal outline-none focus:border-cyan-700" value={tone} onChange={(event) => onToneChange(event.target.value)} />
        </label>
      </div>
    </section>
  );
}
