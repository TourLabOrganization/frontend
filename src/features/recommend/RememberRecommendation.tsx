"use client";

import { useEffect } from "react";
import { LAST_RECOMMENDATION_KEY, writeLocal } from "@/lib/local-store";

// 결과 화면에 넣어 마지막 추천 결과(?a=)를 기억한다. ME 화면의 「추천받은 나의 테마」가 읽는다. 그리는 것은 없다
export function RememberRecommendation({ a }: { a: string }) {
  useEffect(() => {
    writeLocal(LAST_RECOMMENDATION_KEY, a);
  }, [a]);
  return null;
}
