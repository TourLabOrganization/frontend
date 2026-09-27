// 작품 · 채널 이름(테마 장소 데이터의 work, 한국어)의 외국어 표기.
// PoC TX_DICT_TITLES(테마 파일 5개 · Tour Navigator Home · Tour Planner에 있는 표를 합친 것, 값이 겹치는 키는 모두 같다)를 옮겼다.
// PoC txPost처럼 문구 안의 작품명만 바꾸고 나머지(연도 「(2026)」 등)는 그대로 둔다. 그 언어 값이 없으면 영어.
// PoC와 다른 점: 긴 이름부터 바꾼다. PoC RESCENE 표는 「공식 유튜브」가 먼저라 「국가유산청 공식 유튜브」가
// 「국가유산청 official YouTube」로 반쯤만 바뀐다

type TitleNames = { en: string; zh?: string; ja?: string; es?: string };

/** [한국어 이름, 외국어 이름]. 긴 이름부터 */
const TITLES: readonly (readonly [string, TitleNames])[] = [
  [
    "영화 촬영지 · 다수 작품",
    {
      en: "Film locations · multiple titles",
      zh: "电影拍摄地 · 多部作品",
      ja: "映画ロケ地 · 複数作品",
      es: "Lugares de rodaje · varias obras",
    },
  ],
  [
    "국가유산청 공식 유튜브",
    {
      en: "Korea Heritage Service official YouTube",
      zh: "国家遗产厅官方YouTube",
      ja: "国家遺産庁公式YouTube",
      es: "YouTube oficial del Servicio de Patrimonio",
    },
  ],
  [
    "케이팝 데몬 헌터스",
    {
      en: "KPop Demon Hunters",
      zh: "K-POP猎魔女团",
      ja: "KPOPガールズ！デーモン・ハンターズ",
      es: "KPop Demon Hunters",
    },
  ],
  [
    "KBS 마이데이트립",
    {
      en: "KBS My Day Trip",
      zh: "KBS 我的一日游",
      ja: "KBS マイデイトリップ",
      es: "KBS My Day Trip",
    },
  ],
  [
    "왕과 사는 남자",
    {
      en: "The King's Warden",
      zh: "与王同住的男人",
      ja: "王と生きる男",
      es: "The King's Warden",
    },
  ],
  [
    "우리들의 블루스",
    {
      en: "Our Blues",
      zh: "我们的蓝调",
      ja: "私たちのブルース",
      es: "Our Blues",
    },
  ],
  [
    "부산 영화 기행",
    {
      en: "Busan film trail",
      zh: "釜山电影之旅",
      ja: "釜山映画紀行",
      es: "Ruta de cine en Busan",
    },
  ],
  [
    "부산국제영화제",
    {
      en: "Busan International Film Festival",
      zh: "釜山国际电影节",
      ja: "釜山国際映画祭",
      es: "Festival de Cine de Busan",
    },
  ],
  [
    "폭싹 속았수다",
    {
      en: "When Life Gives You Tangerines",
      zh: "苦尽柑来遇见你",
      ja: "おつかれさま",
      es: "When Life Gives You Tangerines",
    },
  ],
  [
    "범죄와의 전쟁",
    {
      en: "Nameless Gangster",
      zh: "与犯罪的战争",
      ja: "悪いやつら",
      es: "Nameless Gangster",
    },
  ],
  [
    "벨리곰 콜라보",
    {
      en: "Bellygom collab",
      zh: "Bellygom联名",
      ja: "ベリーゴム コラボ",
      es: "Colab. con Bellygom",
    },
  ],
  [
    "공식 유튜브",
    {
      en: "official YouTube",
      zh: "官方YouTube",
      ja: "公式YouTube",
      es: "YouTube oficial",
    },
  ],
  [
    "국제시장",
    {
      en: "Ode to My Father",
      zh: "国际市场",
      ja: "国際市場で逢いましょう",
      es: "Ode to My Father",
    },
  ],
  ["해운대", { en: "Haeundae", zh: "海云台", ja: "TSUNAMI", es: "Haeundae" }],
  [
    "변호인",
    { en: "The Attorney", zh: "辩护人", ja: "弁護人", es: "The Attorney" },
  ],
];

/** 작품명 옮기기. 한국어 화면이나 표에 없는 이름은 그대로 */
export function workTitle(text: string, locale: string): string {
  if (locale === "ko") return text;
  let out = text;
  for (const [ko, names] of TITLES) {
    if (out.includes(ko))
      out = out.split(ko).join(names[locale as keyof TitleNames] ?? names.en);
  }
  return out;
}
