import type { ValidationResult } from "@/lib/schema";
import type { ScriptBeat, ScriptForgeDocument, ScriptScene } from "@/types/scriptforge";
import { validationSummary } from "./utils";

type ScriptPreviewPanelProps = {
  document: ScriptForgeDocument | null;
  validation: ValidationResult | null;
};

const beatTone: Record<ScriptBeat["type"], string> = {
  action: "border-sky-200 bg-sky-50 text-sky-800",
  dialogue: "border-emerald-200 bg-emerald-50 text-emerald-800",
  narration: "border-violet-200 bg-violet-50 text-violet-800",
  transition: "border-amber-200 bg-amber-50 text-amber-800",
  note: "border-zinc-200 bg-zinc-100 text-zinc-700",
};

function beatTypeLabel(type: ScriptBeat["type"]): string {
  switch (type) {
    case "action":
      return "动作";
    case "dialogue":
      return "对白";
    case "narration":
      return "旁白";
    case "transition":
      return "转场";
    case "note":
      return "备注";
  }
}

export function ScriptPreviewPanel({ document, validation }: ScriptPreviewPanelProps) {
  if (!document) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">剧本预览</h2>
        <p className="mt-2 text-sm text-zinc-600">生成或粘贴 ScriptForgeDocument 后，这里会展示人物、地点、场景、来源章节、改编说明和校验状态。</p>
      </section>
    );
  }

  const { script } = document;
  const characters = new Map(script.characters.map((character) => [character.id, character]));
  const locations = new Map(script.locations.map((location) => [location.id, location]));
  const chapters = new Map(script.source.chapters.map((chapter) => [chapter.id, chapter]));
  const facts = new Map(script.source.chapters.flatMap((chapter) => chapter.key_facts.map((fact) => [fact.id, fact] as const)));
  const firstSourceByCharacter = buildFirstSourceByCharacter(script.scenes, chapters);
  const sceneTitlesByLocation = buildSceneTitlesByLocation(script.scenes);

  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">剧本预览</h2>
          <p className="mt-1 text-sm text-zinc-600">{script.title} · {script.metadata.genre} · {script.metadata.target_duration_minutes} 分钟 · {script.metadata.tone}</p>
          <p className="mt-1 text-sm text-zinc-700">{script.metadata.logline}</p>
        </div>
        <ValidationBadge validation={validation} />
      </div>

      <ValidationIssues validation={validation} />

      <div className="rounded-md border border-zinc-200 p-3">
        <h3 className="font-semibold">原文事实板</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {script.source.chapters.map((chapter) => (
            <article className="rounded-md bg-zinc-50 p-3 text-sm" key={chapter.id}>
              <div className="font-medium">{chapter.title}</div>
              <p className="mt-1 text-zinc-600">{chapter.summary}</p>
              <ul className="mt-2 space-y-1 text-zinc-700">
                {chapter.key_facts.map((fact) => (
                  <li key={fact.id}>
                    <code className="rounded bg-white px-1 text-xs">{fact.id}</code>
                    <span className="ml-1 text-xs text-zinc-500">{fact.type}</span>：{fact.content}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-3">
          <h3 className="font-semibold">人物表</h3>
          <div className="mt-3 space-y-3">
            {script.characters.length > 0 ? script.characters.map((character) => (
              <article className="rounded-md bg-zinc-50 p-3 text-sm" key={character.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{character.name}</span>
                  <span className="rounded bg-white px-2 py-0.5 text-xs text-zinc-600">{character.role}</span>
                </div>
                <p className="mt-1 text-zinc-700">{character.description || "缺少人物说明"}</p>
                <p className="mt-1 text-zinc-600">弧光：{character.arc || "缺少弧光"}</p>
                <p className="mt-1 text-zinc-600">首次来源：{firstSourceByCharacter.get(character.id) ?? "缺少来源"}</p>
              </article>
            )) : (
              <p className="text-sm text-zinc-600">暂无人物。</p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 p-3">
          <h3 className="font-semibold">地点表</h3>
          <div className="mt-3 space-y-3">
            {script.locations.length > 0 ? script.locations.map((location) => {
              const relatedSceneTitles = sceneTitlesByLocation.get(location.id) ?? [];
              return (
                <article className="rounded-md bg-zinc-50 p-3 text-sm" key={location.id}>
                  <div className="font-medium">{location.name}</div>
                  <p className="mt-1 text-zinc-700">{location.description || "缺少地点说明"}</p>
                  <p className="mt-1 text-zinc-600">渲染氛围：{location.visual_notes || "缺少渲染氛围"}</p>
                  <p className="mt-1 text-zinc-600">相关场景：{relatedSceneTitles.length > 0 ? relatedSceneTitles.join("、") : "暂无相关场景"}</p>
                </article>
              );
            }) : (
              <p className="text-sm text-zinc-600">暂无地点。</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-zinc-200 p-3">
        <h3 className="font-semibold">场景与来源追踪</h3>
        <div className="mt-3 space-y-4">
          {script.scenes.length > 0 ? script.scenes.map((scene) => {
            const location = locations.get(scene.location);
            return (
              <article className="rounded-md border border-zinc-200 bg-zinc-50 p-3" key={scene.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">{scene.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">{location?.name ?? scene.location} · {scene.time || "缺少时间"}</p>
                  </div>
                  {scene.source_chapters.length === 0 ? (
                    <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">缺少来源</span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <p><span className="font-medium">场景目标：</span>{scene.scene_card.objective}</p>
                  <p><span className="font-medium">阻碍：</span>{scene.scene_card.opposition}</p>
                  <p><span className="font-medium">入场状态：</span>{scene.scene_card.entry_state}</p>
                  <p><span className="font-medium">转折：</span>{scene.scene_card.turning_point}</p>
                  <p><span className="font-medium">离场状态：</span>{scene.scene_card.exit_state}</p>
                  <p><span className="font-medium">场景氛围：</span>{scene.scene_card.visual_atmosphere}</p>
                  <p><span className="font-medium">戏剧目的：</span>{scene.dramatic_purpose || "缺少 dramatic_purpose"}</p>
                  <p><span className="font-medium">冲突：</span>{scene.conflict || "缺少 conflict"}</p>
                  <p>
                    <span className="font-medium">出场人物：</span>
                    {scene.characters.length > 0 ? scene.characters.map((id) => characters.get(id)?.name ?? id).join("、") : "暂无人物"}
                  </p>
                </div>

                <SourceTrace scene={scene} chapters={chapters} facts={facts} />

                <div className="mt-3 rounded-md bg-white p-3 text-sm">
                  <p className="font-medium">改编说明</p>
                  {scene.adaptation_notes && scene.adaptation_notes.length > 0 ? (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-700">
                      {scene.adaptation_notes.map((note, index) => (
                        <li key={`${scene.id}-adaptation_notes-${index}`}>{note}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-zinc-600">缺少说明</p>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {scene.beats.length > 0 ? scene.beats.map((beat, index) => {
                    const speaker = beat.character ? characters.get(beat.character)?.name ?? beat.character : "";
                    return (
                      <div className="rounded-md bg-white px-3 py-2 text-sm" key={`${scene.id}-beat-${index}`}>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className={`rounded border px-2 py-0.5 text-xs ${beatTone[beat.type]}`}>{beatTypeLabel(beat.type)}</span>
                          <span className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700">{beat.function}</span>
                          {beat.type === "dialogue" ? <span className="font-semibold text-zinc-900">speaker：{speaker || "缺少说话人"}</span> : null}
                        </div>
                        <p className={beat.type === "dialogue" ? "text-zinc-950" : "text-zinc-700"}>{beat.content || "缺少 beat 内容"}</p>
                        <p className="mt-1 text-xs text-zinc-500">来源事实：{beat.source_refs.join("、")}</p>
                      </div>
                    );
                  }) : (
                    <p className="rounded-md bg-white px-3 py-2 text-sm text-zinc-600">暂无 beats。</p>
                  )}
                </div>
              </article>
            );
          }) : (
            <p className="text-sm text-zinc-600">暂无场景。</p>
          )}
        </div>
      </div>
    </section>
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

function ValidationIssues({ validation }: { validation: ValidationResult | null }) {
  if (!validation || (validation.errors.length === 0 && validation.warnings.length === 0)) {
    return null;
  }

  const issues = [...validation.errors, ...validation.warnings].slice(0, 5);
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-medium text-amber-900">预览风险摘要</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-amber-800">
        {issues.map((issue, index) => (
          <li key={`${issue.path}-${index}`}>
            <code className="rounded bg-white px-1 text-xs">{issue.path}</code> {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceTrace({
  scene,
  chapters,
  facts,
}: {
  scene: ScriptScene;
  chapters: Map<string, { id: string; title: string; summary: string }>;
  facts: Map<string, { id: string; type: string; content: string }>;
}) {
  return (
    <div className="mt-3 rounded-md bg-white p-3 text-sm">
      <p className="font-medium">来源章节</p>
      {scene.source_chapters.length === 0 ? (
        <p className="mt-2 text-amber-700">缺少来源：这个场景没有 source_chapters。</p>
      ) : (
        <div className="mt-2 space-y-2">
          {scene.source_chapters.map((chapterId, index) => {
            const chapter = chapters.get(chapterId);
            if (!chapter) {
              return (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-red-700" key={`${scene.id}-source_chapters-${chapterId}`}>
                  引用不存在：{chapterId}
                </div>
              );
            }

            return (
              <div className="rounded-md border border-cyan-200 bg-cyan-50 p-2 text-cyan-900" key={`${scene.id}-source_chapters-${chapter.id}`}>
                <div className="font-medium">第 {index + 1} 个来源 · {chapter.title}</div>
                <p className="mt-1">章节摘要：{chapter.summary || "缺少来源摘要"}</p>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3">
        <p className="font-medium">来源事实</p>
        {scene.source_refs.length === 0 ? (
          <p className="mt-2 text-amber-700">缺少来源事实：这个场景没有 source_refs。</p>
        ) : (
          <ul className="mt-2 space-y-1 text-zinc-700">
            {scene.source_refs.map((factId) => {
              const fact = facts.get(factId);
              return (
                <li className={fact ? "" : "text-red-700"} key={`${scene.id}-source_refs-${factId}`}>
                  <code className="rounded bg-zinc-50 px-1 text-xs">{factId}</code>
                  {fact ? ` ${fact.type}：${fact.content}` : " 引用不存在"}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function buildFirstSourceByCharacter(
  scenes: ScriptScene[],
  chapters: Map<string, { title: string }>,
): Map<string, string> {
  const result = new Map<string, string>();

  for (const scene of scenes) {
    const chapterId = scene.source_chapters[0];
    const chapter = chapterId ? chapters.get(chapterId) : null;
    const sourceLabel = chapter ? chapter.title : chapterId || "缺少来源";

    for (const characterId of scene.characters) {
      if (!result.has(characterId)) {
        result.set(characterId, sourceLabel);
      }
    }
  }

  return result;
}

function buildSceneTitlesByLocation(scenes: ScriptScene[]): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const scene of scenes) {
    const titles = result.get(scene.location) ?? [];
    titles.push(scene.title);
    result.set(scene.location, titles);
  }

  return result;
}
