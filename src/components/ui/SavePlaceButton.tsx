"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSavedPlaces } from "@/lib/local-store";
import { Button } from "./Button";

type SavePlaceButtonProps = {
  place: { id: string; ko: string; en: string };
  /** 저장한 곳. 테마 slug 또는 PLANNER_SOURCE */
  source: string;
};

// 장소 시트의 「저장」 ↔ 「저장됨」 토글(북마크). localStorage tn.savedPlaces(lib/local-store.ts)에 둔다.
// 누른 결과는 화면 읽기에 알린다(role="status")
export function SavePlaceButton({ place, source }: SavePlaceButtonProps) {
  const t = useTranslations("PlaceSheet");
  const saved = useSavedPlaces();
  const [status, setStatus] = useState("");
  const on = saved.has(place.id, source);

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        className="flex-auto"
        aria-pressed={on}
        onClick={() => {
          saved.toggle({
            id: place.id,
            source,
            name: { ko: place.ko, en: place.en },
          });
          setStatus(on ? t("unsavedStatus") : t("savedStatus"));
        }}
      >
        {on ? (
          <BookmarkCheck size={20} className="text-primary" aria-hidden />
        ) : (
          <Bookmark size={20} aria-hidden />
        )}
        {on ? t("saved") : t("save")}
      </Button>
      <span role="status" className="sr-only">
        {status}
      </span>
    </>
  );
}
