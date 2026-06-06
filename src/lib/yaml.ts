import { dump as dumpYaml, load as parseYaml } from "js-yaml";
import type { ScriptForgeDocument, ScriptForgeScript } from "@/types/scriptforge";

// ── Structured object with guaranteed insertion order ──────────────────────

/**
 * Build a ScriptForgeScript-like plain object with guaranteed field insertion order.
 * This ensures js-yaml dump (with sortKeys: false) preserves the correct field order.
 */
function buildOrderedScriptObject(script: ScriptForgeScript): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  obj.schema_version = script.schema_version;
  obj.title = script.title;
  obj.metadata = buildOrderedMetadata(script.metadata);
  obj.source = buildOrderedSource(script.source);
  obj.characters = script.characters.map(buildOrderedCharacter);
  obj.locations = script.locations.map(buildOrderedLocation);
  obj.scenes = script.scenes.map(buildOrderedScene);
  obj.adaptation_report = buildOrderedReport(script.adaptation_report);
  return obj;
}

function buildOrderedMetadata(m: ScriptForgeScript["metadata"]): Record<string, unknown> {
  return {
    language: m.language,
    format: m.format,
    genre: m.genre,
    target_duration_minutes: m.target_duration_minutes,
    logline: m.logline,
    tone: m.tone,
  };
}

function buildOrderedSource(s: ScriptForgeScript["source"]): Record<string, unknown> {
  return {
    type: s.type,
    chapters: s.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      summary: ch.summary,
      key_facts: ch.key_facts.map((fact) => ({
        id: fact.id,
        type: fact.type,
        content: fact.content,
      })),
    })),
  };
}

function buildOrderedCharacter(c: ScriptForgeScript["characters"][number]): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    id: c.id,
    name: c.name,
    role: c.role,
    description: c.description,
    motivation: c.motivation,
    arc: c.arc,
    voice: c.voice,
  };
  if (c.relationships && c.relationships.length > 0) {
    obj.relationships = c.relationships.map((r) => ({
      target: r.target,
      type: r.type,
      description: r.description,
    }));
  }
  return obj;
}

function buildOrderedLocation(l: ScriptForgeScript["locations"][number]): Record<string, unknown> {
  return {
    id: l.id,
    name: l.name,
    description: l.description,
    visual_notes: l.visual_notes,
  };
}

function buildOrderedScene(s: ScriptForgeScript["scenes"][number]): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    id: s.id,
    title: s.title,
    source_chapters: s.source_chapters,
    source_refs: s.source_refs,
    location: s.location,
    time: s.time,
    characters: s.characters,
    scene_card: {
      objective: s.scene_card.objective,
      opposition: s.scene_card.opposition,
      entry_state: s.scene_card.entry_state,
      turning_point: s.scene_card.turning_point,
      exit_state: s.scene_card.exit_state,
      visual_atmosphere: s.scene_card.visual_atmosphere,
    },
    dramatic_purpose: s.dramatic_purpose,
    conflict: s.conflict,
    beats: s.beats.map((b) => {
      if (b.type === "dialogue") {
        return { type: b.type, character: b.character, function: b.function, source_refs: b.source_refs, content: b.content };
      }
      const beat: Record<string, unknown> = { type: b.type, function: b.function, source_refs: b.source_refs, content: b.content };
      if (b.character) beat.character = b.character;
      return beat;
    }),
  };
  if (s.adaptation_notes && s.adaptation_notes.length > 0) {
    obj.adaptation_notes = s.adaptation_notes;
  }
  return obj;
}

function buildOrderedReport(r: ScriptForgeScript["adaptation_report"]): Record<string, unknown> {
  return {
    chapter_count: r.chapter_count,
    scene_count: r.scene_count,
    character_count: r.character_count,
    main_conflicts: r.main_conflicts,
    omitted_or_compressed: r.omitted_or_compressed,
    revision_suggestions: r.revision_suggestions,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Top-level YAML comment describing the export. */
const YAML_HEADER = "# ScriptForge 剧本导出\n# 字段顺序：source → characters → locations → scenes → adaptation_report\n\n";

/**
 * Convert a ScriptForgeDocument to stable-order YAML.
 * Field order: source → characters → locations → scenes → adaptation_report.
 */
export function documentToYaml(doc: ScriptForgeDocument): string {
  const ordered = { script: buildOrderedScriptObject(doc.script) };
  const body = dumpYaml(ordered, {
    sortKeys: false,
    noRefs: true,
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
  });
  return YAML_HEADER + body;
}

/**
 * Convert a ScriptForgeDocument to formatted JSON string.
 */
export function documentToJson(doc: ScriptForgeDocument): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * Convert a ScriptForgeDocument to Markdown for quick reading.
 * Includes characters, locations, scenes with dialogue, and adaptation report.
 */
export function documentToMarkdown(doc: ScriptForgeDocument): string {
  const s = doc.script;
  const lines: string[] = [];

  lines.push(`# ${s.title}`);
  lines.push("");
  lines.push(`> ${s.metadata.logline}`);
  lines.push("");
  lines.push(`**格式**：${s.metadata.format} | **类型**：${s.metadata.genre} | **时长**：${s.metadata.target_duration_minutes} 分钟 | **语气**：${s.metadata.tone}`);
  lines.push("");

  // Source
  lines.push("## 来源");
  lines.push("");
  lines.push(`类型：${s.source.type}，共 ${s.source.chapters.length} 章`);
  lines.push("");
  for (const ch of s.source.chapters) {
    lines.push(`- **${ch.title}**（${ch.id}）：${ch.summary}`);
    for (const fact of ch.key_facts) {
      lines.push(`  - ${fact.id} / ${fact.type}：${fact.content}`);
    }
  }
  lines.push("");

  // Characters
  lines.push("## 人物表");
  lines.push("");
  for (const c of s.characters) {
    lines.push(`### ${c.name}（${c.role}）`);
    lines.push("");
    lines.push(`- **描述**：${c.description}`);
    lines.push(`- **动机**：${c.motivation}`);
    lines.push(`- **弧光**：${c.arc}`);
    lines.push(`- **对白风格**：${c.voice}`);
    if (c.relationships && c.relationships.length > 0) {
      lines.push("- **关系**：");
      for (const r of c.relationships) {
        const target = s.characters.find((ch) => ch.id === r.target);
        lines.push(`  - ${r.type} → ${target?.name ?? r.target}：${r.description}`);
      }
    }
    lines.push("");
  }

  // Locations
  lines.push("## 地点表");
  lines.push("");
  for (const l of s.locations) {
    lines.push(`### ${l.name}`);
    lines.push("");
    lines.push(`- **描述**：${l.description}`);
    lines.push(`- **渲染氛围**：${l.visual_notes}`);
    lines.push("");
  }

  // Scenes
  lines.push("## 场景");
  lines.push("");
  for (const scene of s.scenes) {
    const loc = s.locations.find((l) => l.id === scene.location);
    lines.push(`### ${scene.title}`);
    lines.push("");
    lines.push(`- **地点**：${loc?.name ?? scene.location}`);
    lines.push(`- **时间**：${scene.time}`);
    lines.push(`- **出场人物**：${scene.characters.map((cid) => s.characters.find((c) => c.id === cid)?.name ?? cid).join("、")}`);
    lines.push(`- **场景目标**：${scene.scene_card.objective}`);
    lines.push(`- **阻碍**：${scene.scene_card.opposition}`);
    lines.push(`- **入场状态**：${scene.scene_card.entry_state}`);
    lines.push(`- **转折**：${scene.scene_card.turning_point}`);
    lines.push(`- **离场状态**：${scene.scene_card.exit_state}`);
    lines.push(`- **场景氛围**：${scene.scene_card.visual_atmosphere}`);
    lines.push(`- **戏剧目的**：${scene.dramatic_purpose}`);
    lines.push(`- **冲突**：${scene.conflict}`);
    lines.push(`- **来源章节**：${scene.source_chapters.join("、")}`);
    lines.push(`- **来源事实**：${scene.source_refs.join("、")}`);
    if (scene.adaptation_notes && scene.adaptation_notes.length > 0) {
      lines.push(`- **改编说明**：${scene.adaptation_notes.join("；")}`);
    }
    lines.push("");
    lines.push("**节拍**：");
    lines.push("");
    for (const beat of scene.beats) {
      if (beat.type === "dialogue") {
        const charName = s.characters.find((c) => c.id === beat.character)?.name ?? beat.character;
        lines.push(`> **${charName}**（${beat.function} / ${beat.source_refs.join("、")}）：${beat.content}`);
      } else {
        const prefix = beat.character
          ? `[${s.characters.find((c) => c.id === beat.character)?.name ?? beat.character}] `
          : "";
        lines.push(`> *${prefix}${beat.function} / ${beat.source_refs.join("、")}：${beat.content}*`);
      }
      lines.push("");
    }
  }

  // Adaptation report
  lines.push("## 改编报告");
  lines.push("");
  lines.push(`- 章节数：${s.adaptation_report.chapter_count}`);
  lines.push(`- 场景数：${s.adaptation_report.scene_count}`);
  lines.push(`- 人物数：${s.adaptation_report.character_count}`);
  lines.push("");
  lines.push("### 核心冲突");
  for (const c of s.adaptation_report.main_conflicts) {
    lines.push(`- ${c}`);
  }
  lines.push("");
  lines.push("### 省略或压缩的内容");
  for (const o of s.adaptation_report.omitted_or_compressed) {
    lines.push(`- ${o}`);
  }
  lines.push("");
  lines.push("### 后续修改建议");
  for (const r of s.adaptation_report.revision_suggestions) {
    lines.push(`- ${r}`);
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Parse a YAML string back into a ScriptForgeDocument or null on parse failure.
 */
export function yamlToDocument(yamlText: string): ScriptForgeDocument | null {
  try {
    const parsed = parseYaml(yamlText) as unknown;
    if (parsed === null || parsed === undefined) return null;
    // Accept both {script:{...}} and top-level script objects
    const doc = parsed as Record<string, unknown>;
    if (doc.script && typeof doc.script === "object") {
      return doc as unknown as ScriptForgeDocument;
    }
    // Maybe it's just the script object without wrapper
    if (doc.schema_version === "1.1") {
      return { script: doc as unknown as ScriptForgeDocument["script"] };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a download filename: project-name_YYYY-MM-DD_HH-mm.yaml
 */
export function generateYamlFilename(title?: string): string {
  const now = new Date();
  const dateStr = now.toISOString().replace(/:/g, "-").replace("T", "_").slice(0, 19);
  const safeTitle = (title ?? "scriptforge")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
  return `${safeTitle}_${dateStr}.yaml`;
}

/**
 * Generate a download filename for JSON.
 */
export function generateJsonFilename(title?: string): string {
  const now = new Date();
  const dateStr = now.toISOString().replace(/:/g, "-").replace("T", "_").slice(0, 19);
  const safeTitle = (title ?? "scriptforge")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
  return `${safeTitle}_${dateStr}.json`;
}

/**
 * Generate a download filename for Markdown.
 */
export function generateMarkdownFilename(title?: string): string {
  const now = new Date();
  const dateStr = now.toISOString().replace(/:/g, "-").replace("T", "_").slice(0, 19);
  const safeTitle = (title ?? "scriptforge")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
  return `${safeTitle}_${dateStr}.md`;
}
