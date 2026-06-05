"use client";

import { useMemo, useState } from "react";
import { loadDemoChapterText, loadDemoGenerationRequest, demoScriptDocument } from "@/lib/fixtures";
import { normalizeRawNovelInput } from "@/lib/input";
import { MIN_CHAPTER_COUNT, type InputIssue } from "@/types/scriptforge";

const EMPTY_TEXT = "";
const SHORT_TEXT = "# 第一章 单章测试\n林雾只收到一段钟声录音，线索尚不足以改编成完整剧本。";
const UNTITLED_TEXT = `雨从旧港的铁皮雨棚上滚下来，林雾推开潮声书店的门，发现父亲留下的录音笔。\n\n# 第二章 停摆的钟楼\n贺燃在钟楼机械间找到磁带，蒋珩带着保安赶到。\n\n# 第三章 午夜排练\n旧剧场里，街坊把签名铺在钢琴盖上，准备在听证会前公开证据。`;

function issueTone(issue: InputIssue) {
  return issue.severity === "error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-amber-200 bg-amber-50 text-amber-900";
}

export default function Home() {
  const [rawInput, setRawInput] = useState(EMPTY_TEXT);
  const normalized = useMemo(() => normalizeRawNovelInput(rawInput), [rawInput]);
  const demoRequest = useMemo(() => loadDemoGenerationRequest(), []);
  const script = demoScriptDocument.script;

  const primaryIssue = normalized.issues[0];

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-zinc-950">
      <section className="border-b border-zinc-200 bg-[#18212b] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-emerald-200">ScriptForge M1</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">小说输入与剧本样例</h1>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-zinc-200">
              <span className="border border-white/20 px-3 py-1">NovelChapter × {MIN_CHAPTER_COUNT}+</span>
              <span className="border border-white/20 px-3 py-1">原创中篇 fixture</span>
              <span className="border border-white/20 px-3 py-1">Schema-ready ScriptForgeScript</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm sm:min-w-[360px]">
            <div className="bg-white/10 px-4 py-3">
              <div className="text-2xl font-semibold">{demoRequest.chapters.length}</div>
              <div className="text-zinc-300">章节</div>
            </div>
            <div className="bg-white/10 px-4 py-3">
              <div className="text-2xl font-semibold">{script.scenes.length}</div>
              <div className="text-zinc-300">场景</div>
            </div>
            <div className="bg-white/10 px-4 py-3">
              <div className="text-2xl font-semibold">{script.characters.length}</div>
              <div className="text-zinc-300">角色</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-6">
          <div className="border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">NovelChapter 输入</h2>
                <p className="mt-1 text-sm text-zinc-600">标题行支持 “# 第一章” / “Chapter 1” / “1. 标题”。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRawInput(loadDemoChapterText())}
                  className="border border-emerald-700 bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  ↳ 载入示例
                </button>
                <button
                  type="button"
                  onClick={() => setRawInput(SHORT_TEXT)}
                  className="border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                >
                  ① 单章
                </button>
                <button
                  type="button"
                  onClick={() => setRawInput(UNTITLED_TEXT)}
                  className="border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                >
                  ？缺标题
                </button>
                <button
                  type="button"
                  onClick={() => setRawInput(EMPTY_TEXT)}
                  className="border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                >
                  × 清空
                </button>
              </div>
            </div>

            <textarea
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              spellCheck={false}
              className="mt-5 min-h-[420px] w-full resize-y border border-zinc-300 bg-[#fbfaf7] p-4 font-mono text-sm leading-6 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              placeholder="粘贴小说正文，或点击“载入示例”。"
            />
          </div>

          <div className="border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">输入验收</h2>
                <p className="mt-1 text-sm text-zinc-600">空输入、章节不足、缺标题均在此处显式反馈。</p>
              </div>
              <div className={normalized.isValid ? "bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900" : "bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900"}>
                {normalized.isValid ? "可生成" : "需补齐"}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="border border-zinc-200 px-4 py-3">
                <div className="text-sm text-zinc-500">有效章节</div>
                <div className="mt-1 text-3xl font-semibold">{normalized.chapters.length}</div>
              </div>
              <div className="border border-zinc-200 px-4 py-3">
                <div className="text-sm text-zinc-500">目标下限</div>
                <div className="mt-1 text-3xl font-semibold">{MIN_CHAPTER_COUNT}</div>
              </div>
              <div className="border border-zinc-200 px-4 py-3">
                <div className="text-sm text-zinc-500">问题</div>
                <div className="mt-1 text-3xl font-semibold">{normalized.issues.length}</div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {normalized.issues.length === 0 ? (
                <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  输入满足 M1 最小契约，可进入后续改编模块。
                </div>
              ) : (
                normalized.issues.map((issue) => (
                  <div key={`${issue.code}-${issue.path}`} className={`border px-4 py-3 text-sm ${issueTone(issue)}`}>
                    <span className="font-semibold">{issue.code}</span>
                    <span className="ml-2 text-xs uppercase tracking-wide">{issue.path}</span>
                    <p className="mt-1">{issue.message}</p>
                  </div>
                ))
              )}
            </div>

            {primaryIssue ? null : (
              <div className="mt-5 grid gap-3">
                {normalized.chapters.map((chapter) => (
                  <div key={chapter.id} className="border-l-4 border-emerald-600 bg-zinc-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">{chapter.title}</h3>
                      <span className="font-mono text-xs text-zinc-500">{chapter.id}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">{chapter.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:sticky lg:top-6 lg:self-start">
          <div className="border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{script.title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{script.metadata.logline}</p>
              </div>
              <span className="bg-[#18212b] px-3 py-2 text-sm font-semibold text-white">{script.metadata.format}</span>
            </div>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="border border-zinc-200 px-3 py-2">
                <dt className="text-zinc-500">类型</dt>
                <dd className="font-semibold">{script.metadata.genre}</dd>
              </div>
              <div className="border border-zinc-200 px-3 py-2">
                <dt className="text-zinc-500">时长</dt>
                <dd className="font-semibold">{script.metadata.target_duration_minutes} 分钟</dd>
              </div>
              <div className="border border-zinc-200 px-3 py-2 sm:col-span-2">
                <dt className="text-zinc-500">调性</dt>
                <dd className="font-semibold">{script.metadata.tone}</dd>
              </div>
            </dl>
          </div>

          <div className="border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-semibold">剧本结构</h2>
            <div className="mt-5 space-y-4">
              {script.scenes.map((scene, index) => (
                <div key={scene.id} className="border border-zinc-200 bg-[#fbfaf7] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Scene {index + 1}</div>
                      <h3 className="mt-1 font-semibold">{scene.title}</h3>
                    </div>
                    <span className="font-mono text-xs text-zinc-500">{scene.id}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-700">{scene.dramatic_purpose}</p>
                  <p className="mt-2 border-l-2 border-amber-500 pl-3 text-sm leading-6 text-zinc-600">{scene.conflict}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-semibold">角色与场景资产</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Characters</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {script.characters.map((character) => (
                    <li key={character.id} className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-2">
                      <span>{character.name}</span>
                      <span className="text-xs text-zinc-500">{character.role}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Locations</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {script.locations.map((location) => (
                    <li key={location.id} className="border-b border-zinc-100 pb-2">
                      <div className="font-medium">{location.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">{location.visual_notes}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
