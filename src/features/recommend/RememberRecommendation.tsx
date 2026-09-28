"use client";

import { useEffect } from "react";
import {
  LAST_RECOMMENDATION_KEY,
  LAST_TOP_THEME_KEY,
  type LastTopTheme,
  writeLocal,
} from "@/lib/local-store";

// 결과 화면에 넣어 마지막 추천 결과(?a=)와 1위 테마(적합도 지수 1위)를 기억한다.
// ME 화면의 「추천받은 나의 테마」가 읽는다. 1위 테마가 없으면(topTheme = null) 적지 않는다. 그리는 것은 없다
export function RememberRecommendation({
  a,
  topTheme,
}: {
  a: string;
  topTheme: string | null;
}) {
  useEffect(() => {
    writeLocal(LAST_RECOMMENDATION_KEY, a);
    if (topTheme) {
      const value: LastTopTheme = { a, slug: topTheme };
      writeLocal(LAST_TOP_THEME_KEY, JSON.stringify(value));
    }
  }, [a, topTheme]);
  return null;
}
