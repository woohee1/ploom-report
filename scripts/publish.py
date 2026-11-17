# -*- coding: utf-8 -*-
"""집계 결과(work/data/out/dash*, *.json)를 공개 페이지용 docs/data/ 로 옮긴다 (rows만, 코드·설명 제외).
사용: py -3 scripts/publish.py "2026-11-18 08:00" "2026-04-13 ~ 2026-11-18"
"""
import os, sys, json, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "work", "data", "out"); DST = os.path.join(ROOT, "docs", "data")
os.makedirs(DST, exist_ok=True)
n = 0
for sub in ["dash", "dash2", "dash3"]:
    d = os.path.join(SRC, sub)
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        if not f.endswith(".json"): continue
        j = json.load(open(os.path.join(d, f), encoding="utf-8"))
        json.dump({"rows": j["rows"]}, open(os.path.join(DST, f), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        n += 1
updated = sys.argv[1] if len(sys.argv) > 1 else datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
rng = sys.argv[2] if len(sys.argv) > 2 else "2026-04-13 ~ " + updated[:10]
json.dump({"updated": updated, "range": rng, "note": "구글 시트 복사본 기준"}, open(os.path.join(DST, "updated.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("공개 데이터", n, "개 갱신, 기준", updated)
