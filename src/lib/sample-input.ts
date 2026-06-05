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
        tone: "古典神话、轻快冒险",
      },
    },
  };
}
