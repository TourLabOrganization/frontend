import type { AppLocale } from "@/i18n/locales";
import type { ThemeSlug } from "@/features/recommend/themes";

// 여행 정보 탭의 축제 · 행사 상자와 외부 링크 버튼.
// PoC 테마 화면의 여행 정보(channel) 탭에 박혀 있던 값을 그대로 옮겼다. 영어는 PoC에 없어 뜻을 옮겨 썼다. 중 · 일 · 스페인어는 PoC 테마 화면 TX_DICT 값이다.
// 출처 (Tour-Navigator-App):
//   kings-warden        Kings Warden Route.dc.html        축제 664~666행 · 링크 670~673행
//   kpop-demon-hunters  KPop Demon Hunters Route.dc.html  축제 705~707행 · 링크 717~720행
//   jeju-k-drama        Jeju K-Drama Route.dc.html        축제 693~695행 · 링크 709~712행
//   busan-film-trip     Busan Cinema Route.dc.html        축제 705~707행 · 링크 717~720행
//   rescene-route       RESCENE Route.dc.html             팬소통(channel) 탭: 채널 링크 730~735행 · 전체 일정 보기 726행
//                       (축제 상자 없음. 달력은 날짜 칸만 있고 일정 데이터가 없어 옮기지 않았다. 행사 · 축제 목록은 TourAPI라 옮기지 않았다)

type Text = Record<AppLocale, string>;

export type ThemeFestival = {
  label: Text;
  title: Text;
  body: Text;
};

export type ThemeLink = {
  href: string;
  label: Text;
};

/** RESCENE 팬소통 채널. schedule = 「전체 일정 보기」 주소 */
export type FanChannel = { schedule: string };

export type ThemeInfo = {
  festival?: ThemeFestival;
  /** 있으면 이 탭이 팬소통 채널이다(RESCENE) */
  fanChannel?: FanChannel;
  links: readonly ThemeLink[];
};

export const THEME_INFO: Record<ThemeSlug, ThemeInfo> = {
  "kings-warden": {
    festival: {
      label: {
        ko: "단종문화제",
        en: "Danjong Cultural Festival",
        zh: "端宗文化节",
        ja: "端宗文化祭",
        es: "Festival Cultural de Danjong",
      },
      title: {
        ko: "매년 4월 말, 영월읍 일원",
        en: "Late April every year, around Yeongwol-eup",
        zh: "每年4月末，宁越邑一带",
        ja: "毎年4月末、寧越邑一帯",
        es: "Finales de abril, en Yeongwol-eup",
      },
      body: {
        ko: "유배 행렬 재현과 제향이 청령포·장릉·관풍헌을 잇는다. 촬영지를 도는 여정과 날짜를 맞추면 같은 길을 행렬과 함께 걷게 된다.",
        en: "A re-enacted exile procession and memorial rites link Cheongnyeongpo, Jangneung and Gwanpungheon. Time your trip to the festival and you walk the same route alongside the procession.",
        zh: "重现流放行列与祭享仪式，串联清泠浦、庄陵与观风轩。配合日期游览拍摄地，便能与行列同行。",
        ja: "流配行列の再現と祭享が清泠浦・荘陵・観風軒を結ぶ。日程を合わせればロケ地の道を行列と一緒に歩ける。",
        es: "La recreación del cortejo del exilio une Cheongnyeongpo, Jangneung y Gwanpungheon. Si coincides en fecha, caminarás con el cortejo.",
      },
    },
    links: [
      {
        href: "https://www.yw.go.kr/tour/index.do",
        label: {
          ko: "영월군 관광",
          en: "Yeongwol Tourism",
          zh: "宁越郡旅游",
          ja: "寧越郡観光",
          es: "Turismo de Yeongwol",
        },
      },
      {
        href: "https://korean.visitkorea.or.kr",
        label: {
          ko: "대한민국 구석구석",
          en: "VisitKorea",
          zh: "韩国旅游(韩文)",
          ja: "大韓民国くまなく(韓国語)",
          es: "Visit Korea (coreano)",
        },
      },
      {
        href: "https://www.youtube.com/results?search_query=%EC%99%95%EA%B3%BC+%EC%82%AC%EB%8A%94+%EB%82%A8%EC%9E%90",
        label: {
          ko: "예고편",
          en: "Trailer",
          zh: "预告片",
          ja: "予告編",
          es: "Tráiler",
        },
      },
      {
        href: "https://www.kcdf.kr",
        label: {
          ko: "문화유산",
          en: "Cultural Heritage",
          zh: "文化遗产",
          ja: "文化遺産",
          es: "Patrimonio",
        },
      },
    ],
  },
  "kpop-demon-hunters": {
    festival: {
      label: {
        ko: "서울 관광 팝업부스",
        en: "Seoul Tourist Pop-up Booths",
        zh: "首尔旅游咨询亭",
        ja: "ソウル観光ポップアップブース",
        es: "Puestos turísticos de Seúl",
      },
      title: {
        ko: "명동·홍대·강남 관광안내소",
        en: "Tourist information centres in Myeongdong, Hongdae and Gangnam",
        zh: "明洞·弘大·江南旅游咨询处",
        ja: "明洞・弘大・江南観光案内所",
        es: "Oficinas en Myeongdong, Hongdae y Gangnam",
      },
      body: {
        ko: "서울관광재단이 주요 거점에 운영하는 안내 부스에서 지도와 다국어 상담, 교통카드를 받을 수 있다. 배경지 순례 전 명동 안내소에서 시작하면 명동거리 코스와 바로 이어진다.",
        en: "Booths run by the Seoul Tourism Organization at major hubs hand out maps and transit cards and offer help in several languages. Start at the Myeongdong centre and you step straight onto the Myeongdong street route.",
        zh: "首尔观光财团在主要地点设有咨询亭，可领取地图、多语言咨询和交通卡。从明洞咨询处出发，可直接衔接明洞街路线。",
        ja: "ソウル観光財団の案内ブースで地図・多言語相談・交通カードが手に入る。明洞案内所から始めると明洞通りコースにそのままつながる。",
        es: "Los puestos de la Seoul Tourism Organization ofrecen mapas, ayuda multilingüe y tarjetas de transporte. Empieza en Myeongdong para enlazar con su ruta.",
      },
    },
    links: [
      {
        href: "https://korean.visitseoul.net/",
        label: {
          ko: "비짓서울",
          en: "Visit Seoul",
          zh: "Visit Seoul",
          ja: "Visit Seoul",
          es: "Visit Seoul",
        },
      },
      {
        href: "https://mediahub.seoul.go.kr/",
        label: {
          ko: "내 손안에 서울",
          en: "Seoul Media Hub",
          zh: "掌上首尔",
          ja: "手の中のソウル",
          es: "Seoul in My Hand",
        },
      },
      {
        href: "https://www.youtube.com/results?search_query=KPop+Demon+Hunters",
        label: {
          ko: "예고편",
          en: "Trailer",
          zh: "预告片",
          ja: "予告編",
          es: "Tráiler",
        },
      },
      {
        href: "https://www.seoul.go.kr/story/tourGuide/",
        label: {
          ko: "관광안내소",
          en: "Tourist Information",
          zh: "旅游咨询处",
          ja: "観光案内所",
          es: "Oficinas de turismo",
        },
      },
    ],
  },
  "jeju-k-drama": {
    festival: {
      label: {
        ko: "두 편의 드라마, 한 섬",
        en: "Two dramas, one island",
        zh: "两部剧，一座岛",
        ja: "二つのドラマ、一つの島",
        es: "Dos dramas, una isla",
      },
      title: {
        ko: "폭싹 속았수다 · 우리들의 블루스",
        en: "When Life Gives You Tangerines · Our Blues",
        zh: "苦尽柑来遇见你 · 我们的蓝调",
        ja: "おつかれさま · 私たちのブルース",
        es: "When Life Gives You Tangerines · Our Blues",
      },
      body: {
        ko: "한쪽은 1950년대부터의 한 생애를, 다른 쪽은 지금 제주에서 살아가는 사람들을 그린다. 같은 해안선이 두 시대에 걸쳐 나온다.",
        en: "One follows a single life from the 1950s; the other, people living on Jeju today. The same coastline appears across both eras.",
        zh: "一部讲述从1950年代开始的一生，另一部描绘如今生活在济州的人们。同一条海岸线跨越两个时代出现。",
        ja: "一方は1950年代からの一生を、もう一方は今の済州で暮らす人々を描く。同じ海岸線が二つの時代に登場する。",
        es: "Uno sigue una vida desde los años 50; el otro, a quienes viven hoy en Jeju. La misma costa aparece en ambas épocas.",
      },
    },
    links: [
      {
        href: "https://www.visitjeju.net/kr",
        label: {
          ko: "비짓제주",
          en: "Visit Jeju",
          zh: "Visit Jeju",
          ja: "Visit Jeju",
          es: "Visit Jeju",
        },
      },
      {
        href: "https://www.jeju.go.kr/tool/tour.htm",
        label: {
          ko: "제주도 관광",
          en: "Jeju Tourism",
          zh: "济州道旅游",
          ja: "済州道観光",
          es: "Turismo de Jeju",
        },
      },
      {
        href: "https://www.youtube.com/results?search_query=%ED%8F%AD%EC%8B%B9+%EC%86%8D%EC%95%98%EC%88%98%EB%8B%A4+%EC%98%88%EA%B3%A0%ED%8E%B8",
        label: {
          ko: "예고편",
          en: "Trailer",
          zh: "预告片",
          ja: "予告編",
          es: "Tráiler",
        },
      },
      {
        href: "https://www.jejuolle.org/",
        label: {
          ko: "제주올레",
          en: "Jeju Olle",
          zh: "济州偶来",
          ja: "済州オルレ",
          es: "Jeju Olle",
        },
      },
    ],
  },
  "busan-film-trip": {
    festival: {
      label: {
        ko: "부산국제영화제",
        en: "Busan International Film Festival",
        zh: "釜山国际电影节",
        ja: "釜山国際映画祭",
        es: "Festival de Cine de Busan",
      },
      title: {
        ko: "매년 10월 초, 영화의전당 일원",
        en: "Early October every year, around Busan Cinema Center",
        zh: "每年10月初，电影殿堂一带",
        ja: "毎年10月初め、映画の殿堂一帯",
        es: "Principios de octubre, en el Busan Cinema Center",
      },
      body: {
        ko: "영화의전당과 센텀시티 극장가에서 열흘간 열린다. 야외극장 상영과 남포동 BIFF광장 행사가 함께 돌아가므로, 이 기간에는 두 권역을 하루씩 나눠 잡는 편이 낫다.",
        en: "Ten days at Busan Cinema Center and the Centum City cinemas. Open-air screenings and events at BIFF Square in Nampo-dong run at the same time, so give each area its own day during the festival.",
        zh: "在电影殿堂与Centum City影院区举办十天，露天放映与南浦洞BIFF广场活动同时进行，此期间建议两个区域各安排一天。",
        ja: "映画の殿堂とセンタムシティの劇場街で10日間開催。野外上映と南浦洞BIFF広場のイベントが同時に行われるので、期間中は二つのエリアを一日ずつ分けるとよい。",
        es: "Diez días en el Busan Cinema Center y Centum City, con proyecciones al aire libre y actos en la plaza BIFF de Nampo-dong. Reparte ambas zonas en días distintos.",
      },
    },
    links: [
      {
        href: "https://www.visitbusan.net/",
        label: {
          ko: "비짓부산",
          en: "Visit Busan",
          zh: "Visit Busan",
          ja: "Visit Busan",
          es: "Visit Busan",
        },
      },
      {
        href: "https://www.biff.kr/",
        label: {
          ko: "부산국제영화제",
          en: "BIFF",
          zh: "釜山国际电影节",
          ja: "釜山国際映画祭",
          es: "Festival de Cine de Busan",
        },
      },
      {
        href: "https://www.youtube.com/results?search_query=%EB%B6%80%EC%82%B0+%EC%98%81%ED%99%94+%EC%B4%AC%EC%98%81%EC%A7%80",
        label: {
          ko: "예고편",
          en: "Trailer",
          zh: "预告片",
          ja: "予告編",
          es: "Tráiler",
        },
      },
      {
        href: "https://www.bfc.or.kr/",
        label: {
          ko: "부산영상위원회",
          en: "Busan Film Commission",
          zh: "釜山影像委员会",
          ja: "釜山フィルムコミッション",
          es: "Busan Film Commission",
        },
      },
    ],
  },
  "rescene-route": {
    fanChannel: {
      schedule:
        "https://artist.mnetplus.world/main/stg/rescene-official/schedule/2026/08",
    },
    links: [
      {
        href: "https://www.youtube.com/channel/UCtKtCiaWRz-d3EZn2xd1mdA",
        label: {
          ko: "YouTube",
          en: "YouTube",
          zh: "YouTube",
          ja: "YouTube",
          es: "YouTube",
        },
      },
      {
        href: "https://www.instagram.com/rescene_official/",
        label: {
          ko: "Instagram",
          en: "Instagram",
          zh: "Instagram",
          ja: "Instagram",
          es: "Instagram",
        },
      },
      {
        href: "https://artist.mnetplus.world/main/stg/rescene-official/home",
        label: {
          ko: "Official",
          en: "Official",
          zh: "Official",
          ja: "Official",
          es: "Official",
        },
      },
      {
        href: "https://www.facebook.com/RESCENE.official",
        label: {
          ko: "Facebook",
          en: "Facebook",
          zh: "Facebook",
          ja: "Facebook",
          es: "Facebook",
        },
      },
      {
        href: "https://withmuu.com/goods/goods_search.php?keyword=%EB%A6%AC%EC%84%BC%EB%8A%90&recentCount=6",
        label: {
          ko: "Goods",
          en: "Goods",
          zh: "Goods",
          ja: "Goods",
          es: "Goods",
        },
      },
      {
        href: "https://artist.mnetplus.world/main/stg/rescene-official/schedule/2026/08",
        label: {
          ko: "Bubble",
          en: "Bubble",
          zh: "Bubble",
          ja: "Bubble",
          es: "Bubble",
        },
      },
    ],
  },
};
