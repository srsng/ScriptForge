import { MIN_CHAPTER_COUNT, type InputIssue, type InputNormalizationResult, type NovelChapter, type NovelChapterDraft } from "@/types/scriptforge";

const CHAPTER_HEADING_PATTERN = /^(?:#{1,6}\s*)?(?:第[\d一二三四五六七八九十百千万零〇两]+[章节回幕][^\n]*|Chapter\s+\d+[^\n]*|\d+[.、]\s*[^\n]+)$/i;

export function createChapterId(index: number): string {
  return `ch_${String(index + 1).padStart(3, "0")}`;
}

export function createDefaultChapterTitle(index: number): string {
  return `第${index + 1}章 未命名章节`;
}

export function chaptersToPlainText(chapters: NovelChapter[]): string {
  return chapters.map((chapter) => `# ${chapter.title}\n${chapter.content.trim()}`).join("\n\n");
}

export function parseNovelChaptersFromText(rawText: string): NovelChapterDraft[] {
  const text = rawText.replace(/\r\n?/g, "\n").trim();

  if (!text) {
    return [];
  }

  const chapters: NovelChapterDraft[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const isHeading = trimmed.length > 0 && CHAPTER_HEADING_PATTERN.test(trimmed);

    if (isHeading) {
      if (currentTitle || currentLines.some((contentLine) => contentLine.trim())) {
        chapters.push({ title: currentTitle, content: currentLines.join("\n").trim() });
      }

      currentTitle = trimmed.replace(/^#{1,6}\s*/, "").trim();
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  chapters.push({ title: currentTitle, content: currentLines.join("\n").trim() });

  return chapters.filter((chapter) => chapter.title?.trim() || chapter.content?.trim());
}

export function normalizeNovelChapters(drafts: NovelChapterDraft[]): InputNormalizationResult {
  const issues: InputIssue[] = [];
  const chapters: NovelChapter[] = [];

  if (drafts.length === 0) {
    issues.push({
      code: "empty_input",
      severity: "error",
      path: "chapters",
      message: "请输入至少 3 个小说章节。",
    });
  }

  drafts.forEach((draft, index) => {
    const rawTitle = draft.title?.trim() ?? "";
    const content = draft.content?.trim() ?? "";

    if (!content) {
      issues.push({
        code: "empty_chapter",
        severity: "error",
        path: `chapters.${index}.content`,
        message: `第 ${index + 1} 个章节缺少正文。`,
      });
      return;
    }

    if (!rawTitle) {
      issues.push({
        code: "missing_title",
        severity: "warning",
        path: `chapters.${index}.title`,
        message: `第 ${index + 1} 个章节缺少标题，已使用默认标题。`,
      });
    }

    chapters.push({
      id: createChapterId(chapters.length),
      title: rawTitle || createDefaultChapterTitle(index),
      content,
    });
  });

  if (chapters.length > 0 && chapters.length < MIN_CHAPTER_COUNT) {
    issues.push({
      code: "insufficient_chapters",
      severity: "error",
      path: "chapters",
      message: `至少需要 ${MIN_CHAPTER_COUNT} 个有效章节，当前为 ${chapters.length} 个。`,
    });
  }

  return {
    chapters,
    issues,
    isValid: issues.every((issue) => issue.severity !== "error"),
  };
}

export function normalizeRawNovelInput(rawText: string): InputNormalizationResult {
  return normalizeNovelChapters(parseNovelChaptersFromText(rawText));
}
