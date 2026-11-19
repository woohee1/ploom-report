# -*- coding: utf-8 -*-
"""옛 달(4~9월) 운영 엑셀 파일의 팀배정 탭 → ref/ops_YYYY-MM/team_map.json
옛 파일에는 활동이동로그·SV개입_기록 탭이 없어 팀→수퍼바이저 배정표만 보관한다.
(실운영 팀만, 유령팀·구매전용 제외. 4월 파일은 수퍼바이저가 SV1~SV5 자리표시라 쓰지 않는다.)
사용: py -3 scripts/import_ops_xlsx.py <엑셀 파일> <YYYY-MM>
"""
import os, sys, json, openpyxl
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) < 3: sys.exit("사용: import_ops_xlsx.py <엑셀 파일> <YYYY-MM>")
path, month = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
if "팀배정" not in wb.sheetnames: sys.exit("팀배정 탭이 없습니다.")
ws = wb["팀배정"]; hdr = None; out = []
for r in ws.iter_rows(values_only=True):
    cells = [str(x).strip() if x is not None else "" for x in r]
    if hdr is None:
        if "팀번호" in cells and "인력사" in cells: hdr = {c: i for i, c in enumerate(cells)}
        continue
    g = lambda k: cells[hdr[k]] if k in hdr and hdr[k] < len(cells) else ""
    agency, sv, team = g("인력사"), g("수퍼바이저"), g("팀번호")
    kind = g("구분") or ("유령팀" if "유령" in agency or sv == "구매전용" else "실운영")
    try: team = int(float(team))
    except ValueError: continue
    if kind != "실운영" or not sv or sv.upper().startswith("SV") and sv[2:].isdigit(): continue
    out.append([agency, kind, sv, str(team)])
if not out: sys.exit("쓸 수 있는 팀배정 행이 없습니다.")
d = os.path.join(ROOT, "ref", "ops_" + month); os.makedirs(d, exist_ok=True)
json.dump(out, open(os.path.join(d, "team_map.json"), "w", encoding="utf-8"), ensure_ascii=False)
print(month, "team_map", len(out), "팀, SV", len(set(r[2] for r in out)), "명 →", d)
