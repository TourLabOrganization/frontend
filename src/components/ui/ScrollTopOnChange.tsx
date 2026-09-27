"use client";

import { useEffect, useRef } from "react";

// value가 바뀌면 페이지를 맨 위로 올린다(처음 그릴 때는 그대로). 하단 탭을 바꾸면 새 탭을 맨 위부터 보이게 한다
export function ScrollTopOnChange({ value }: { value: string }) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [value]);
  return null;
}
