import type { ScriptForgeDocument } from "@/types/scriptforge";

type ScriptPreviewPanelProps = {
  document: ScriptForgeDocument | null;
};

export function ScriptPreviewPanel({ document }: ScriptPreviewPanelProps) {
  if (!document) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">剧本预览</h2>
        <p className="mt-2 text-sm text-zinc-600">生成或粘贴 ScriptForgeDocument 后，这里会展示人物、地点、scenes、beats、source_chapters、dramatic_purpose 和 conflict。</p>
      </section>
    );
  }

  const { script } = document;
  const characters = new Map(script.characters.map((character) => [character.id, character]));
  const locations = new Map(script.locations.map((location) => [location.id, location]));
  const chapters = new Map(script.source.chapters.map((chapter) => [chapter.id, chapter]));

  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">剧本预览</h2>
        <p className="mt-1 text-sm text-zinc-600">{script.title} · {script.metadata.genre} · {script.metadata.target_duration_minutes} 分钟 · {script.metadata.tone}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-3">
          <h3 className="font-semibold">characters 人物表</h3>
          <div className="mt-3 space-y-3">
            {script.characters.map((character) => (
              <article className="rounded-md bg-zinc-50 p-3 text-sm" key={character.id}>
                <div className="font-medium">{character.name} <span className="text-xs text-zinc-500">({character.role})</span></div>
                <p className="mt-1 text-zinc-700">{character.description}</p>
                <p className="mt-1 text-zinc-600">动机：{character.motivation}</p>
                <p className="mt-1 text-zinc-600">弧光：{character.arc}</p>
                <p className="mt-1 text-zinc-600">对白风格：{character.voice}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 p-3">
          <h3 className="font-semibold">locations 地点表</h3>
          <div className="mt-3 space-y-3">
            {script.locations.map((location) => (
              <article className="rounded-md bg-zinc-50 p-3 text-sm" key={location.id}>
                <div className="font-medium">{location.name}</div>
                <p className="mt-1 text-zinc-700">{location.description}</p>
                <p className="mt-1 text-zinc-600">视觉提示：{location.visual_notes}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-zinc-200 p-3">
        <h3 className="font-semibold">scenes 场景与来源</h3>
        <div className="mt-3 space-y-4">
          {script.scenes.map((scene) => {
            const location = locations.get(scene.location);
            return (
              <article className="rounded-md border border-zinc-200 bg-zinc-50 p-3" key={scene.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold">{scene.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">{location?.name ?? scene.location} · {scene.time}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 text-xs">
                    {scene.source_chapters.map((chapterId) => {
                      const chapter = chapters.get(chapterId);
                      return (
                        <span className={`rounded border px-2 py-1 ${chapter ? "border-cyan-200 bg-cyan-50 text-cyan-800" : "border-red-200 bg-red-50 text-red-700"}`} key={chapterId}>
                          {chapter?.title ?? chapterId}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <p><span className="font-medium">dramatic_purpose：</span>{scene.dramatic_purpose}</p>
                  <p><span className="font-medium">conflict：</span>{scene.conflict}</p>
                  <p className="md:col-span-2">
                    <span className="font-medium">出场人物：</span>
                    {scene.characters.map((id) => characters.get(id)?.name ?? id).join("、")}
                  </p>
                </div>

                {scene.adaptation_notes && scene.adaptation_notes.length > 0 ? (
                  <div className="mt-3 rounded-md bg-white p-2 text-sm text-zinc-700">
                    改编说明：{scene.adaptation_notes.join("；")}
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  {scene.beats.map((beat, index) => {
                    const speaker = beat.character ? characters.get(beat.character)?.name ?? beat.character : "";
                    return (
                      <div className="rounded-md bg-white px-3 py-2 text-sm" key={`${scene.id}-beat-${index}`}>
                        <span className="mr-2 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600">{beat.type}</span>
                        {speaker ? <span className="font-medium">{speaker}：</span> : null}
                        <span>{beat.content}</span>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
