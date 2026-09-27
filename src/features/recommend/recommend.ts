import { type Answers } from "./questions";
import { classify, type ClusterResult } from "./scoring";
import {
  profileFromAnswers,
  rankThemes,
  type RankedTheme,
  THEMES,
} from "./themes";

// Q10~Q14 필터. 답하지 않은 Q11·Q12는 문서의 기본값(당일·자가용)을 쓴다
export type RecommendFilters = {
  departure: string | null;
  duration: string;
  transport: string;
  walking: string | null;
  conditions: string[];
};

export type Recommendation = {
  clusters: ClusterResult[];
  mixed: boolean;
  themes: RankedTheme[];
  filters: RecommendFilters;
};

// 테마 추천의 입구.
// 나중에 data-server(FastAPI) API 호출로 바꾼다. 반환 모양은 유지한다.
export function getRecommendation(
  answers: Answers,
  locale: string,
): Recommendation {
  const { clusters, mixed } = classify(answers, locale);
  return {
    clusters,
    mixed,
    themes: rankThemes(clusters, mixed, THEMES, profileFromAnswers(answers)),
    filters: {
      departure: answers.q10?.[0] ?? null,
      duration: answers.q11?.[0] ?? "day-trip",
      transport: answers.q12?.[0] ?? "car",
      walking: answers.q13?.[0] ?? null,
      conditions: answers.q14 ?? [],
    },
  };
}
