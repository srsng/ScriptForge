import demoScriptDocumentJson from "../../samples/scriptforge-demo.json";
import { chaptersToPlainText, normalizeNovelChapters } from "@/lib/input";
import type { GenerationRequest, NovelChapter, ScriptForgeDocument } from "@/types/scriptforge";

export const demoNovelChapters: NovelChapter[] = [
  {
    id: "ch_001",
    title: "第一章 雨棚下的遗嘱",
    content:
      "雨从旧港的铁皮雨棚上滚下来，像一排没有停顿的脚步声。林雾推开潮声书店的玻璃门，柜台后的挂钟仍停在两点十七分。她原本只想在拆迁队进场前清点父亲留下的书，却在账本夹层里摸到一枚生锈钥匙和一支录音笔。录音里先是电流杂音，随后响起三下钟声，父亲低声说：如果你听见这个时间，就去找周阿婆。门外，周阿婆撑着黑伞站在雨里，把一只封好的牛皮纸袋递给她。纸袋上写着：别让他们把火灾改成意外。",
  },
  {
    id: "ch_002",
    title: "第二章 停摆的钟楼",
    content:
      "贺燃听完录音后没有立刻说话，只把波形拉到最大，指着背景里一段几乎听不见的回声。那不是书店里的声音，是钟楼机械间的回响。午夜过后，他们穿过拆迁围挡，进入已经封闭的旧钟楼。齿轮锈住，钟面裂开，主轴旁却接着一段崭新的临时电缆。蒋珩带着保安赶到，笑着提醒林雾，危楼封控是为了公共安全。林雾看见他手里的拆除排期，时间正好写在明早听证会之前。贺燃趁争执时打开检修门，里面露出一盘被塑封的磁带，标签上只有五个字：两点十七分。",
  },
  {
    id: "ch_003",
    title: "第三章 午夜排练",
    content:
      "海风旧剧场的舞台灯多年没有全亮过。周阿婆把街坊签名摊在钢琴盖上，每个名字旁都有当年火灾后的临时住址。贺燃把磁带接进剧场的老扩声系统，火警总线的录音在空观众席里回荡，里面有人喊出被锁住的东门，也有人提到被提前撤走的巡检记录。林雾终于明白，父亲守着书店不是舍不得旧房子，而是在等一个能让所有人同时听见真相的地方。天亮前，蒋珩试图以版权和来源不明为由阻止直播。林雾打开父亲的账本，里面每一页都夹着一份复印件，足够发给明早到场的每个人。",
  },
];

export const demoGenerationTarget = {
  format: "short_drama",
  genre: "都市悬疑",
  target_duration_minutes: 12,
  tone: "克制、紧张、带有旧港城市质感",
} as const;

export const demoScriptDocument = demoScriptDocumentJson as ScriptForgeDocument;

export function loadDemoChapters(): NovelChapter[] {
  return demoNovelChapters.map((chapter) => ({ ...chapter }));
}

export function loadDemoChapterText(): string {
  return chaptersToPlainText(demoNovelChapters);
}

export function loadDemoGenerationRequest(): GenerationRequest {
  const normalized = normalizeNovelChapters(loadDemoChapters());

  return {
    chapters: normalized.chapters,
    target: { ...demoGenerationTarget },
  };
}

export function loadDemoScriptDocument(): ScriptForgeDocument {
  return JSON.parse(JSON.stringify(demoScriptDocument)) as ScriptForgeDocument;
}
