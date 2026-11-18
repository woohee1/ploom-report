# -*- coding: utf-8 -*-
"""지난달 운영 시트(개편본 복사본)의 활동이동로그·SV개입_기록·팀배정을 ref/ops_YYYY-MM/ 에 보관한다.
사용: set PLOOM_SHEET_URL, PLOOM_SHEET_KEY 후
     py -3 scripts/fetch_ops_month.py <운영 시트 ID> <YYYY-MM>
보관본은 저장소에 커밋되어 build.py 가 매일 함께 읽는다 (해당 달의 활동·SV 자료).
"""
import os, sys, json, urllib.request, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url, key = os.environ.get("PLOOM_SHEET_URL"), os.environ.get("PLOOM_SHEET_KEY")
if not url or not key or len(sys.argv) < 3: sys.exit("PLOOM_SHEET_URL, PLOOM_SHEET_KEY 와 <시트 ID> <YYYY-MM> 가 필요합니다.")
ops_id, month = sys.argv[1], sys.argv[2]
q = urllib.parse.urlencode({"key": key, "ops_id": ops_id})
raw = urllib.request.urlopen(url + "?" + q, timeout=300).read().decode("utf-8")
if raw.strip() == "forbidden": sys.exit("비밀번호가 맞지 않습니다.")
j = json.loads(raw)
out = os.path.join(ROOT, "ref", "ops_" + month); os.makedirs(out, exist_ok=True)
for name, cols in [("activity", 22), ("sv", 13)]:
    b = j.get(name)
    if not b or not b.get("rows"): sys.exit(f"{name} 자료가 비어 있습니다.")
    if len(b["header"]) != cols: sys.exit(f"{name} 열 수가 {len(b['header'])} (기대 {cols})")
    # 해당 달 행만 보관
    def kd(s):
        import re; s = str(s).strip(); m = re.match(r"(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})", s)
        if m: return f"{m.group(1)}-{int(m.group(2)):02d}"
        m = re.match(r"(\d{4})-(\d{2})", s); return m.group(0) if m else ""
    di = 1 if name == "activity" else 0
    rows = [r for r in b["rows"] if kd(r[di]) == month]
    json.dump({"header": b["header"], "rows": rows}, open(os.path.join(out, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(name, len(rows), "행 (", month, ")")
tm = j.get("team_map")
if not tm: sys.exit("팀배정 자료가 비어 있습니다.")
json.dump(tm, open(os.path.join(out, "team_map.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("team_map", len(tm), "행 →", out)
