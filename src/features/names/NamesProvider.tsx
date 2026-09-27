"use client";

import { createContext, useContext } from "react";
import { EMPTY_NAMES, type NameTable } from "./names";

// 루트 레이아웃이 화면 언어의 이름표를 한 번 내려 준다(app/layout.tsx). 레이아웃은 화면을 옮겨도 다시 받지 않는다
const NamesContext = createContext<NameTable>(EMPTY_NAMES);

export function NamesProvider({
  names,
  children,
}: {
  names: NameTable;
  children: React.ReactNode;
}) {
  return <NamesContext value={names}>{children}</NamesContext>;
}

/** 화면 언어의 이름표. 한국어 · 영어 화면은 빈 표 */
export function useNameTable(): NameTable {
  return useContext(NamesContext);
}
