import { getLocale, getTranslations } from "next-intl/server";
import { type TfiBar } from "@/lib/api/datalab";

// 한국관광 데이터랩 지역×테마 강도(TFI) 막대. 값은 0~1이고 소수 둘째 자리까지 보인다.
// 추천 결과 화면과 테마 화면(여행 정보 탭)이 함께 쓴다.
// 테마 이름은 messages의 Datalab.themes에 있으면 그 문구, 없으면 API의 themeLabels 이름
export async function TfiBars({ bars }: { bars: readonly TfiBar[] }) {
  const t = await getTranslations("Datalab");
  const locale = await getLocale();
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const label = (bar: TfiBar) => {
    const key = `themes.${bar.key}` as "themes.herit";
    return t.has(key) ? t(key) : bar.label;
  };

  return (
    <div>
      <p className="text-caption text-fg-subtle">{t("tfiLabel")}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {bars.map((bar) => {
          const value = Math.min(1, Math.max(0, bar.value));
          return (
            <li
              key={bar.key}
              className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3"
            >
              <span className="text-caption leading-tight text-fg-muted">
                {label(bar)}
              </span>
              <span
                aria-hidden
                className="h-2 overflow-hidden rounded-full bg-line"
              >
                <span
                  className="block h-full rounded-full bg-primary-bright"
                  style={{ width: `${value * 100}%` }}
                />
              </span>
              <span className="text-right text-caption font-semibold tabular-nums">
                {format.format(bar.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
