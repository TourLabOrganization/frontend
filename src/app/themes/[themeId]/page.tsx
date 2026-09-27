import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/ui/LocaleSwitch";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { getThemePlaces, themePlaceStats } from "@/features/course/places";
import { isPlanId, type PlanId } from "@/features/course/scenarios";
import { findTheme } from "@/features/recommend/themes";
import { CourseTab } from "@/features/theme/CourseTab";
import {
  type FilmCard,
  FilmTab,
  type ScenePlace,
  type VideoCard,
} from "@/features/theme/FilmTab";
import { InfoTab } from "@/features/theme/InfoTab";
import { MapTab, type SceneLink } from "@/features/theme/MapTab";
import { corePlaces, pad2, placeName } from "@/features/theme/place-meta";
import { cityName } from "@/features/planner/regions";
import { StampTab } from "@/features/theme/StampTab";
import { parseTab, themeHref, type ThemeQuery } from "@/features/theme/tabs";
import {
  getFilmScenes,
  getPlaceExtras,
  getThemeCities,
  getVideoScenes,
  sceneNumber,
  VIDEO_THEME,
} from "@/features/theme/theme-data";
import { ThemeTabBar } from "@/features/theme/ThemeTabBar";
import { loadNameTable } from "@/features/names/server";

// 테마 화면. 하단 탭 5개(지도 · 코스 · 영화 · 스탬프 · 여행 정보)를 ?tab=으로 고르고, 고른 탭 하나만 그린다.
// 주소 규칙은 features/theme/tabs.ts 머리 주석에 있다. 코스 탭은 결과 화면이 넘긴 필터(?a=, Q10~Q14)와 ?plan=을 쓴다.
export default async function ThemePage({
  params,
  searchParams,
}: PageProps<"/themes/[themeId]">) {
  const { themeId } = await params;
  const theme = findTheme(themeId);
  if (!theme) notFound();

  const query = await searchParams;
  const tab = parseTab(query.tab);
  const a = typeof query.a === "string" ? query.a : undefined;
  const plan: PlanId = isPlanId(query.plan) ? query.plan : "classic";
  const place = typeof query.place === "string" ? query.place : undefined;
  // 탭을 바꿔도 남길 값. plan은 주소에 있을 때만 남긴다
  const keep: ThemeQuery = {
    a,
    plan: isPlanId(query.plan) ? query.plan : undefined,
  };

  const tt = await getTranslations("Themes");
  const tr = await getTranslations("Regions");
  const t = await getTranslations("Theme");
  const locale = await getLocale();
  const names = await loadNameTable(locale);

  const slug = theme.slug;
  const region = theme.regions.map((r) => tr(r)).join(" · ");
  const stats = themePlaceStats(slug);
  const places = getThemePlaces(slug);
  const extras = getPlaceExtras(slug);
  const mapHref = (id: string) => themeHref(slug, keep, "map", { place: id });
  const scenePlace = (id: string): ScenePlace | null => {
    const p = places.find((x) => x.id === id);
    if (!p) return null;
    const name = placeName(p, locale, names);
    return {
      id,
      label: p.n === null ? name : `${pad2(p.n)} ${name}`,
      href: mapHref(id),
    };
  };
  const placesOfScene = (sceneId: string) =>
    places.filter((p) => extras[p.id]?.scene === sceneId);

  function renderTab() {
    switch (tab) {
      case "course":
        return <CourseTab slug={slug} a={a} plan={plan} />;

      case "film": {
        const film: FilmCard[] = getFilmScenes(slug).map((s) => {
          const ps = placesOfScene(s.id);
          const first = ps[0] ? extras[ps[0].id] : undefined;
          return {
            kind: "film",
            id: s.id,
            number: sceneNumber(s.label),
            title: s.title,
            query: s.query,
            sceneTitle: first?.sceneTitle,
            work: first?.work,
            places: ps.flatMap((p) => scenePlace(p.id) ?? []),
            texts: [
              s.title,
              first?.sceneTitle,
              ...ps.flatMap((p) => [p.ko, p.en, placeName(p, locale, names)]),
            ].filter((x): x is string => !!x),
          };
        });
        const video: VideoCard[] = getVideoScenes(slug).map((s) => {
          const ps = placesOfScene(s.id);
          const extra = ps.map((p) => extras[p.id]);
          const sceneTitle = extra.find((e) => e?.sceneTitle)?.sceneTitle;
          return {
            kind: "video",
            id: s.id,
            date: s.date,
            views: s.views,
            sceneTitle,
            start: extra.find((e) => e?.ytAt)?.ytAt,
            places: ps.flatMap((p) => scenePlace(p.id) ?? []),
            texts: [
              s.date,
              sceneTitle,
              ...ps.flatMap((p) => [p.ko, p.en, placeName(p, locale, names)]),
            ].filter((x): x is string => !!x),
          };
        });
        return (
          <FilmTab cards={[...film, ...video]} video={slug === VIDEO_THEME} />
        );
      }

      case "stamp": {
        const toStamp = (p: (typeof places)[number]) => ({
          id: p.id,
          n: p.n,
          name: placeName(p, locale, names),
          mapHref: mapHref(p.id),
        });
        // 스탬프 북 제목: 테마 장소가 한 도시면 그 도시(「영월 · 스탬프 북」, 목업과 같다), 여러 도시면 지역
        const cities = [...new Set(places.map((p) => p.locKo))];
        return (
          <StampTab
            slug={slug}
            region={
              cities.length === 1 ? cityName(cities[0], locale, names) : region
            }
            core={corePlaces(places).map(toStamp)}
            all={places.map(toStamp)}
          />
        );
      }

      case "info":
        return <InfoTab slug={slug} />;

      case "map": {
        // 장소 시트의 장면 한 줄: 영화 · 드라마는 「장면 01 · 강을 건너 · 작품」, RESCENE는 「게시일 · 영상 제목」
        const film = new Map(getFilmScenes(slug).map((s) => [s.id, s]));
        const video = new Map(getVideoScenes(slug).map((s) => [s.id, s]));
        const sceneLinks: Record<string, SceneLink> = {};
        for (const p of places) {
          const e = extras[p.id];
          if (!e?.scene) continue;
          const f = film.get(e.scene);
          const v = video.get(e.scene);
          const row = f
            ? [t("film.sceneLabel", { number: sceneNumber(f.label) }), f.title]
            : v
              ? [v.date, e.sceneTitle]
              : [];
          if (row.length === 0) continue;
          sceneLinks[p.id] = {
            text: [...row, f ? e.work : undefined].filter(Boolean).join(" · "),
            href: themeHref(slug, keep, "film", { hash: e.scene }),
            row: row.filter(Boolean).join(" · "),
            // 이 장소가 나오는 영상: 뮤직비디오는 그 영상(시작 시각), 영화 · 드라마는 영화 탭과 같은 장면 검색
            video: !p.yt
              ? undefined
              : f
                ? `https://www.youtube.com/results?search_query=${encodeURIComponent(f.query)}`
                : `https://youtu.be/${e.scene}${e.ytAt ? `?t=${e.ytAt}` : ""}`,
          };
        }
        const cityLabels = Object.fromEntries(
          [...new Set(places.map((p) => p.locKo))].map((c) => [
            c,
            cityName(c, locale, names),
          ]),
        );
        return (
          <MapTab
            key={place ?? ""}
            slug={slug}
            places={places}
            extras={extras}
            sceneLinks={sceneLinks}
            cities={getThemeCities(slug)}
            cityLabels={cityLabels}
            video={slug === VIDEO_THEME}
            initialPlace={place}
          />
        );
      }
    }
  }

  return (
    <Screen>
      <TopBar title={tt(`${slug}.name`)} right={<LocaleSwitch />} />
      <p className="bg-fill-weak px-5 py-2 text-label text-fg-muted tabular-nums">
        {t("stats", {
          region,
          places: stats.places,
          videos: stats.videos,
        })}
      </p>
      <main className="flex flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {renderTab()}
      </main>
      <ThemeTabBar slug={slug} query={keep} current={tab} />
    </Screen>
  );
}
