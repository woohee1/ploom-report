# -*- coding: utf-8 -*-
"""앱스 스크립트 웹 앱(scripts/sheet_api.gs)에서 시트 자료를 받아 work/data/ JSON 네 개로 저장한다.
환경 변수: PLOOM_SHEET_URL (…/exec), PLOOM_SHEET_KEY, 선택 PLOOM_SALES_TAB (기본 '11월 세일즈 제출')
"""
import os, sys, json, urllib.request, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "work", "data"); os.makedirs(D, exist_ok=True)
url, key = os.environ.get("PLOOM_SHEET_URL", "").strip(), os.environ.get("PLOOM_SHEET_KEY", "").strip()
if not url or not key:
    sys.exit("환경 변수 PLOOM_SHEET_URL / PLOOM_SHEET_KEY 가 없습니다. 시트를 내려받을 수 없어 중단합니다.")
q = {"key": key}
if os.environ.get("PLOOM_SALES_TAB"): q["sales"] = os.environ["PLOOM_SALES_TAB"]
req = urllib.request.Request(url + "?" + urllib.parse.urlencode(q), headers={"User-Agent": "ploom-report-refresh"})
raw = urllib.request.urlopen(req, timeout=120).read().decode("utf-8")
if raw.strip() == "forbidden": sys.exit("웹 앱이 거부했습니다(키 불일치). 중단합니다.")
j = json.loads(raw)
for name, cols in [("sales", 20), ("activity", 22), ("sv", 13)]:
    b = j.get(name)
    if not b or not b.get("rows"): sys.exit(f"{name} 자료가 비어 있습니다(탭 '{j.get('sales_tab') if name=='sales' else name}' 확인). 중단합니다.")
    if len(b["header"]) != cols: sys.exit(f"{name} 열 수가 {len(b['header'])}칸입니다(기대 {cols}). 시트 구조가 바뀌었으니 중단합니다.")
    json.dump({"header": b["header"], "rows": b["rows"]}, open(os.path.join(D, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(name, len(b["rows"]), "행")
tm = j.get("team_map")
if not tm: sys.exit("팀배정 자료가 비어 있습니다. 중단합니다.")
json.dump(tm, open(os.path.join(D, "team_map.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("team_map", len(tm), "행 / 시트 읽은 시각", j.get("fetched_at"))
open(os.path.join(D, "fetched_at.txt"), "w", encoding="utf-8").write(str(j.get("fetched_at", "")))
