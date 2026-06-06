import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeRawNovelInput } from "@/lib/input";
import type { GenerationRequest, InputNormalizationResult } from "@/types/scriptforge";

const GUTENBERG_FILE = path.join(
  process.cwd(),
  "samples",
  "novels",
  "journey_to_the_west_gutenberg_23962.txt",
);
const QUAN_ZHI_GAO_SHOU_FILE = path.join(
  process.cwd(),
  "samples",
  "novels",
  "全职高手.txt",
);

const MIN_SAMPLE_CHAPTERS = 3;

export type PublicDomainNovelSample = {
  id: "journey-to-the-west-gutenberg-23962";
  title: string;
  author: string;
  source: string;
  license_note: string;
  chapterText: string;
  normalization: InputNormalizationResult;
  request: GenerationRequest;
};

export type InternalNovelSampleSelection = {
  requestedCount: number;
  chapterCount: number;
  startTitle: string;
  endTitle: string;
};

export type QuanZhiGaoShouSample = {
  id: "quan-zhi-gao-shou-internal";
  title: string;
  author: string;
  source: string;
  license_note: string;
  chapterText: string;
  normalization: InputNormalizationResult;
  request: GenerationRequest;
  selection: InternalNovelSampleSelection;
};

function trimGutenbergBoilerplate(rawText: string): string {
  const startMarker = "第一回";
  const endMarker = "*** END OF THE PROJECT GUTENBERG EBOOK";
  const start = rawText.indexOf(startMarker);
  const end = rawText.indexOf(endMarker);
  return rawText.slice(start === -1 ? 0 : start, end === -1 ? rawText.length : end).trim();
}

function firstNChaptersFromRawNovel(rawText: string, count: number): string {
  const novelText = trimGutenbergBoilerplate(rawText).replace(/\r\n/g, "\n");
  const headingMatches = [...novelText.matchAll(/^第[\d一二三四五六七八九十百千万零〇两]+回[^\n]*$/gm)];

  if (headingMatches.length < count + 1) {
    return novelText.trim();
  }

  const start = headingMatches[0].index ?? 0;
  const end = headingMatches[count].index ?? novelText.length;
  return novelText.slice(start, end).trim();
}

function clampSampleChapterCount(value: number, availableCount: number): number {
  const integerValue = Number.isFinite(value) ? Math.floor(value) : MIN_SAMPLE_CHAPTERS;
  return Math.min(Math.max(integerValue, MIN_SAMPLE_CHAPTERS), availableCount);
}

function splitQuanZhiGaoShouChapters(rawText: string): { title: string; text: string }[] {
  const novelText = rawText.replace(/\r\n?/g, "\n");
  const headingMatches = [...novelText.matchAll(/^第[0-9０-９一二三四五六七八九十百千万零〇两]+章[^\n]*$/gm)];

  return headingMatches.map((match, index) => {
    const start = match.index ?? 0;
    const end = headingMatches[index + 1]?.index ?? novelText.length;
    const text = novelText.slice(start, end).trim();
    return {
      title: match[0].trim(),
      text,
    };
  }).filter((chapter) => chapter.text.length > 0);
}

function randomContinuousChapters<T>(items: T[], count: number): { items: T[]; startIndex: number } {
  if (items.length === 0) return { items: [], startIndex: 0 };

  const chapterCount = clampSampleChapterCount(count, items.length);
  const maxStart = Math.max(0, items.length - chapterCount);
  const startIndex = maxStart === 0 ? 0 : Math.floor(Math.random() * (maxStart + 1));

  return {
    items: items.slice(startIndex, startIndex + chapterCount),
    startIndex,
  };
}

export async function loadPublicDomainNovelSample(): Promise<PublicDomainNovelSample> {
  const rawText = await readFile(GUTENBERG_FILE, "utf8");
  const chapterText = firstNChaptersFromRawNovel(rawText, 3);
  const normalization = normalizeRawNovelInput(chapterText);

  return {
    id: "journey-to-the-west-gutenberg-23962",
    title: "西游记（Project Gutenberg #23962）前三回",
    author: "吴承恩",
    source: "https://www.gutenberg.org/ebooks/23962",
    license_note: "Public-domain text loaded from Project Gutenberg. Used only as source input, not as a generated screenplay result.",
    chapterText,
    normalization,
    request: {
      chapters: normalization.chapters,
      target: {
        format: "short_drama",
        genre: "奇幻冒险",
        target_duration_minutes: 12,
        tone: "史诗奇想、明快冒险",
      },
    },
  };
}

export async function loadQuanZhiGaoShouSample(chapterCount = MIN_SAMPLE_CHAPTERS): Promise<QuanZhiGaoShouSample> {
  const rawText = new TextDecoder("gb18030").decode(await readFile(QUAN_ZHI_GAO_SHOU_FILE));
  const chapters = splitQuanZhiGaoShouChapters(rawText);
  if (chapters.length < MIN_SAMPLE_CHAPTERS) {
    throw new Error("全职高手样本章节不足，无法载入至少 3 章。");
  }

  const selection = randomContinuousChapters(chapters, chapterCount);
  const selectedChapters = selection.items;
  const chapterText = selectedChapters.map((chapter) => chapter.text).join("\n\n");
  const normalization = normalizeRawNovelInput(chapterText);
  const startTitle = selectedChapters[0]?.title ?? "";
  const endTitle = selectedChapters.at(-1)?.title ?? startTitle;

  return {
    id: "quan-zhi-gao-shou-internal",
    title: `全职高手（内置测试样本）${startTitle} 至 ${endTitle}`,
    author: "蝴蝶蓝",
    source: "samples/novels/全职高手.txt",
    license_note: "内部测试样本，仅用于本地工作台功能验证；不是公开版权样本，请勿用于公开分发。",
    chapterText,
    normalization,
    request: {
      chapters: normalization.chapters,
      target: {
        format: "short_drama",
        genre: "电竞热血",
        target_duration_minutes: 12,
        tone: "冷静克制、热血逆袭",
      },
    },
    selection: {
      requestedCount: chapterCount,
      chapterCount: normalization.chapters.length,
      startTitle,
      endTitle,
    },
  };
}
