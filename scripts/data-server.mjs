// data-server(팀 데이터 정본) 장소 필드를 빌드에 합친다. scripts/build-planner.mjs · scripts/build-places.mjs가 함께 쓴다.
//
// 원천: data-server 리포의 data/derived/places.json ({count, places}, 3,118곳). 필드 뜻은 data-server docs/contract.md.
// 경로: 스크립트 인자 → 환경변수 DATA_SERVER_DIR → 기본값 ../data-server (이 리포 옆 클론). 없으면 멈춘다.
//
// id로 합치는 필드 (나머지 필드와 순서는 Tour-Navigator-App 원천 그대로):
//   - cat    ← catFinal  TourAPI 공식 분류로 교정한 값. 계약 문서가 「catApp 말고 catFinal을 쓴다」고 정했다
//   - en     ← nameEn    다를 때만. data-server 값에 JS 이스케이프(\' · \u2019)가 글자 그대로 남은 것이 있어 풀고 비교한다
//   - vz     ← zone      관광특구 · 관광단지 · 지정관광지 문구. 값이 있을 때만 넣는다(210곳)
//   - popRank ← popRank  한국관광 데이터랩 인기관광지 순위(1~100). 값이 있을 때만 넣는다(173곳)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** data-server 폴더. 인자 → DATA_SERVER_DIR → root/../data-server */
export function resolveDataServerDir(root, arg) {
  const dir = resolve(
    arg || process.env.DATA_SERVER_DIR || resolve(root, "../data-server"),
  );
  const file = resolve(dir, "data/derived/places.json");
  if (!existsSync(file))
    throw new Error(
      `data-server 장소 파일이 없습니다: ${file}\n` +
        "data-server 클론 경로를 스크립트 마지막 인자나 DATA_SERVER_DIR 환경변수로 주세요",
    );
  return dir;
}

/** data-server 장소를 id로 찾는 Map과 만든 커밋(재현용) */
export function loadDataServer(dir) {
  const json = JSON.parse(
    readFileSync(resolve(dir, "data/derived/places.json"), "utf8"),
  );
  let commit = "unknown";
  try {
    commit = execFileSync("git", ["-C", dir, "log", "-1", "--format=%h %cs"], {
      encoding: "utf8",
    }).trim();
  } catch {
    // git 리포가 아니면 커밋을 모른다
  }
  return {
    byId: new Map(json.places.map((p) => [p.id, p])),
    count: json.count,
    commit,
  };
}

/** data-server nameEn에 글자 그대로 남은 JS 이스케이프(\' · \" · \\uXXXX)를 푼다 */
export function unescapeJs(text) {
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\(['"\\])/g, "$1");
}

/**
 * 장소 하나에 data-server 값을 합친다. 원래 객체는 바꾸지 않는다.
 * 돌려주는 changed는 대조 출력용(분류 · 영어 이름이 바뀌었는가)
 */
export function mergeDataServer(place, ds) {
  if (!ds) throw new Error(`data-server에 장소 ${place.id}가 없습니다`);
  const out = { ...place };
  const changed = { cat: false, en: false };
  if (ds.catFinal && ds.catFinal !== place.cat) {
    out.cat = ds.catFinal;
    changed.cat = true;
  }
  if (ds.nameEn) {
    const en = unescapeJs(ds.nameEn);
    if (en !== place.en) {
      out.en = en;
      changed.en = true;
    }
  }
  // 새 필드는 뒤에 붙인다. 값이 없으면 넣지 않는다
  delete out.vz;
  delete out.popRank;
  if (ds.zone) out.vz = ds.zone;
  if (Number.isInteger(ds.popRank)) out.popRank = ds.popRank;
  return { place: out, changed };
}
