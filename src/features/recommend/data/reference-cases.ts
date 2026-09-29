import type { ThemeSlug } from "../themes";
import type { Answers, TypeId } from "../survey";
import data from "./reference-cases.json";

// 테스트 기준: Data-Analytics 저장소의 Python 참조 계산 결과(설문 6.3 score_survey.py · 추천 6.4 recommend_reference.py).
// 명세서 예제 응답 1개 + 무작위 완료 응답 299개. 프론트 계산이 같은 값을 내는지 survey · theme-index · citytour 테스트가 본다

export type ReferenceCase = {
  answers: Answers;
  /** 100점 척도 유형 점수 */
  scores: Record<TypeId, number>;
  /** 최종 후보 E */
  types: TypeId[];
  /** E 안의 혼합 가중치 α */
  alpha: Partial<Record<TypeId, number>>;
  /** 간접 선호 u(역사 · 자연 · 체험 · 음식 · 바다) */
  preference: number[];
  themeTop3: ThemeSlug[];
  themeIndex: Record<ThemeSlug, number>;
  /** 지역별 대표 시티투어 5개(분석 코스 id · 최종 점수 · 범주 적합) */
  tours: { courseId: string; region: string; score: number; fit: number }[];
};

export const REFERENCE_CASES = (data as unknown as { cases: ReferenceCase[] })
  .cases;
