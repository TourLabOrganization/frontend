import type { ThemeSlug } from "@/features/recommend/themes";

// 여행 정보 탭의 축제 · 행사 상자와 외부 링크 버튼.
// PoC 테마 화면의 여행 정보(channel) 탭에 박혀 있던 값을 그대로 옮겼다. 영어는 PoC에 없어 뜻을 옮겨 썼다.
// 출처 (Tour-Navigator-App):
//   kings-warden        Kings Warden Route.dc.html        축제 664~666행 · 링크 670~673행
//   kpop-demon-hunters  KPop Demon Hunters Route.dc.html  축제 705~707행 · 링크 717~720행
//   jeju-k-drama        Jeju K-Drama Route.dc.html        축제 693~695행 · 링크 709~712행
//   busan-film-trip     Busan Cinema Route.dc.html        축제 705~707행 · 링크 717~720행
//   rescene-route       RESCENE Route.dc.html             팬소통(channel) 탭: 채널 링크 730~735행 · 전체 일정 보기 726행
//                       (축제 상자 없음. 달력은 날짜 칸만 있고 일정 데이터가 없어 옮기지 않았다. 행사 · 축제 목록은 TourAPI라 옮기지 않았다)

type Text = { ko: string; en: string };

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
      label: { ko: "단종문화제", en: "Danjong Cultural Festival" },
      title: {
        ko: "매년 4월 말, 영월읍 일원",
        en: "Late April every year, around Yeongwol-eup",
      },
      body: {
        ko: "유배 행렬 재현과 제향이 청령포·장릉·관풍헌을 잇는다. 촬영지를 도는 여정과 날짜를 맞추면 같은 길을 행렬과 함께 걷게 된다.",
        en: "A re-enacted exile procession and memorial rites link Cheongnyeongpo, Jangneung and Gwanpungheon. Time your trip to the festival and you walk the same route alongside the procession.",
      },
    },
    links: [
      {
        href: "https://www.yw.go.kr/tour/index.do",
        label: { ko: "영월군 관광", en: "Yeongwol Tourism" },
      },
      {
        href: "https://korean.visitkorea.or.kr",
        label: { ko: "대한민국 구석구석", en: "VisitKorea" },
      },
      {
        href: "https://www.youtube.com/results?search_query=%EC%99%95%EA%B3%BC+%EC%82%AC%EB%8A%94+%EB%82%A8%EC%9E%90",
        label: { ko: "예고편", en: "Trailer" },
      },
      {
        href: "https://www.kcdf.kr",
        label: { ko: "문화유산", en: "Cultural Heritage" },
      },
    ],
  },
  "kpop-demon-hunters": {
    festival: {
      label: { ko: "서울 관광 팝업부스", en: "Seoul Tourist Pop-up Booths" },
      title: {
        ko: "명동·홍대·강남 관광안내소",
        en: "Tourist information centres in Myeongdong, Hongdae and Gangnam",
      },
      body: {
        ko: "서울관광재단이 주요 거점에 운영하는 안내 부스에서 지도와 다국어 상담, 교통카드를 받을 수 있다. 배경지 순례 전 명동 안내소에서 시작하면 명동거리 코스와 바로 이어진다.",
        en: "Booths run by the Seoul Tourism Organization at major hubs hand out maps and transit cards and offer help in several languages. Start at the Myeongdong centre and you step straight onto the Myeongdong street route.",
      },
    },
    links: [
      {
        href: "https://korean.visitseoul.net/",
        label: { ko: "비짓서울", en: "Visit Seoul" },
      },
      {
        href: "https://mediahub.seoul.go.kr/",
        label: { ko: "내 손안에 서울", en: "Seoul Media Hub" },
      },
      {
        href: "https://www.youtube.com/results?search_query=KPop+Demon+Hunters",
        label: { ko: "예고편", en: "Trailer" },
      },
      {
        href: "https://www.seoul.go.kr/story/tourGuide/",
        label: { ko: "관광안내소", en: "Tourist Information" },
      },
    ],
  },
  "jeju-k-drama": {
    festival: {
      label: { ko: "두 편의 드라마, 한 섬", en: "Two dramas, one island" },
      title: {
        ko: "폭싹 속았수다 · 우리들의 블루스",
        en: "When Life Gives You Tangerines · Our Blues",
      },
      body: {
        ko: "한쪽은 1950년대부터의 한 생애를, 다른 쪽은 지금 제주에서 살아가는 사람들을 그린다. 같은 해안선이 두 시대에 걸쳐 나온다.",
        en: "One follows a single life from the 1950s; the other, people living on Jeju today. The same coastline appears across both eras.",
      },
    },
    links: [
      {
        href: "https://www.visitjeju.net/kr",
        label: { ko: "비짓제주", en: "Visit Jeju" },
      },
      {
        href: "https://www.jeju.go.kr/tool/tour.htm",
        label: { ko: "제주도 관광", en: "Jeju Tourism" },
      },
      {
        href: "https://www.youtube.com/results?search_query=%ED%8F%AD%EC%8B%B9+%EC%86%8D%EC%95%98%EC%88%98%EB%8B%A4+%EC%98%88%EA%B3%A0%ED%8E%B8",
        label: { ko: "예고편", en: "Trailer" },
      },
      {
        href: "https://www.jejuolle.org/",
        label: { ko: "제주올레", en: "Jeju Olle" },
      },
    ],
  },
  "busan-film-trip": {
    festival: {
      label: { ko: "부산국제영화제", en: "Busan International Film Festival" },
      title: {
        ko: "매년 10월 초, 영화의전당 일원",
        en: "Early October every year, around Busan Cinema Center",
      },
      body: {
        ko: "영화의전당과 센텀시티 극장가에서 열흘간 열린다. 야외극장 상영과 남포동 BIFF광장 행사가 함께 돌아가므로, 이 기간에는 두 권역을 하루씩 나눠 잡는 편이 낫다.",
        en: "Ten days at Busan Cinema Center and the Centum City cinemas. Open-air screenings and events at BIFF Square in Nampo-dong run at the same time, so give each area its own day during the festival.",
      },
    },
    links: [
      {
        href: "https://www.visitbusan.net/",
        label: { ko: "비짓부산", en: "Visit Busan" },
      },
      {
        href: "https://www.biff.kr/",
        label: { ko: "부산국제영화제", en: "BIFF" },
      },
      {
        href: "https://www.youtube.com/results?search_query=%EB%B6%80%EC%82%B0+%EC%98%81%ED%99%94+%EC%B4%AC%EC%98%81%EC%A7%80",
        label: { ko: "예고편", en: "Trailer" },
      },
      {
        href: "https://www.bfc.or.kr/",
        label: { ko: "부산영상위원회", en: "Busan Film Commission" },
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
        label: { ko: "YouTube", en: "YouTube" },
      },
      {
        href: "https://www.instagram.com/rescene_official/",
        label: { ko: "Instagram", en: "Instagram" },
      },
      {
        href: "https://artist.mnetplus.world/main/stg/rescene-official/home",
        label: { ko: "Official", en: "Official" },
      },
      {
        href: "https://www.facebook.com/RESCENE.official",
        label: { ko: "Facebook", en: "Facebook" },
      },
      {
        href: "https://withmuu.com/goods/goods_search.php?keyword=%EB%A6%AC%EC%84%BC%EB%8A%90&recentCount=6",
        label: { ko: "Goods", en: "Goods" },
      },
      {
        href: "https://artist.mnetplus.world/main/stg/rescene-official/schedule/2026/08",
        label: { ko: "Bubble", en: "Bubble" },
      },
    ],
  },
};
