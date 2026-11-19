# -*- coding: utf-8 -*-
"""탐색용 건 단위 자료 → docs/data/
  rows_long.json      4월~ 폼즈 통합표(long_sales_enriched.csv) 중 시트 집계 달 이전 (고정, 없을 때만 생성, --long 이면 다시 생성)
  rows_YYYY-MM.json   시트(sales_merged.csv)에 있는 달 (매일 갱신)
  rows_index.json     위 파일 목록
  team_day.json       팀·일 운영 요약 (활동 기록 있는 달)
  activity.json       활동 기록 (시작·이동·종료 등)
에이전트 이름 등 개인 정보는 넣지 않는다. 문자열 열은 사전(dict) 방식으로 압축한다.
사용: py -3 scripts/export_rows.py [--long]
"""
import os, sys, json, glob
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "work", "data", "out"); DST = os.path.join(ROOT, "docs", "data")
os.makedirs(DST, exist_ok=True)
from export_rows_pack import COLS, DICT, done, first, pack, save, brand, sido
# ---- 시트 달 (sales_merged.csv) ----
s = pd.read_csv(os.path.join(D, "sales_merged.csv"), low_memory=False)
sheet_months = sorted(set(str(x)[:7] for x in s["일자"].dropna()))
m = pd.DataFrame({
    "일자": s["일자"], "시": pd.to_numeric(s["시"], errors="coerce"), "팀": pd.to_numeric(s["팀"], errors="coerce"),
    "인력사": s["인력사"], "SV": s["SV"], "점포코드": s["점포코드"], "점포명": s["점포명"], "브랜드": s["점포 타입"].map(brand), "구분": s["점포 구분"],
    "시도": s["시도"].map(sido), "시군구": s["시군구"].where(s["시도"].map(sido).notna(), None), "색상": s["디바이스 색상"], "수량": pd.to_numeric(s["수량"], errors="coerce").fillna(0),
    "성별": s["구매자 성별"], "연령대": s["구매자 연령대"], "사용제품": s["구매자 사용 제품"].map(first),
    "리필구매": s["리필스틱 구매 여부"].map(lambda v: None if pd.isna(v) else (1 if str(v).strip() == "구매" else 0)),
    "스틱": s["리필스틱 종류"].map(lambda v: None if pd.isna(v) else str(v).split("(")[0].strip()),
    "회원가입": s["회원가입 여부"].map(done), "카카오": s["카카오플러스친구 추가 완료 여부"].map(done),
    "스타벅스": pd.to_numeric(s["스타벅스"], errors="coerce").fillna(0), "경로": s["판매 경로"],
})
m = m[m["일자"].notna() & m["팀"].notna()]
files = []
for mo in sheet_months:
    save(f"rows_{mo}.json", pack(m[m["일자"].str[:7] == mo])); files.append(f"rows_{mo}.json")

# ---- 장기 (폼즈 통합표) : 시트 달 이전만, 고정 ----
longp = os.path.join(DST, "rows_long.json"); lsrc = os.path.join(D, "long_sales_enriched.csv")
if (not os.path.exists(longp) or "--long" in sys.argv) and os.path.exists(lsrc):
    L = pd.read_csv(lsrc, low_memory=False)
    L = L[L["일자"].str[:7] < min(sheet_months)]
    # 달별 팀배정 보관본(ref/ops_YYYY-MM/team_map.json)으로 수퍼바이저 채움
    month_sv = {}
    for f in sorted(glob.glob(os.path.join(ROOT, "ref", "ops_*", "team_map.json"))):
        mo = os.path.basename(os.path.dirname(f))[4:]
        month_sv[mo] = {int(r[3]): r[2] for r in json.load(open(f, encoding="utf-8")) if str(r[3]).strip().isdigit()}
    def sv_long(day, team):
        if pd.isna(team) or not isinstance(day, str): return None
        return month_sv.get(day[:7], {}).get(int(team))
    lg = pd.DataFrame({
        "일자": L["일자"], "시": pd.to_numeric(L["시"], errors="coerce"), "팀": pd.to_numeric(L["팀"], errors="coerce"),
        "인력사": L["인력사"], "SV": [sv_long(d, t) for d, t in zip(L["일자"], pd.to_numeric(L["팀"], errors="coerce"))], "점포코드": L["점포코드"], "점포명": L["점포명"], "브랜드": L["점포타입"].map(brand), "구분": L["점포구분"],
        "시도": L["시도"].map(sido), "시군구": L["시군구"].where(L["시도"].map(sido).notna(), None), "색상": L["색상"], "수량": pd.to_numeric(L["수량"], errors="coerce").fillna(0),
        "성별": L["성별"], "연령대": L["연령대"], "사용제품": L["사용제품"].map(first),
        "리필구매": L.apply(lambda r: None if pd.isna(r["리필스틱"]) else (1 if bool(r["리필구매"]) else 0), axis=1),
        "스틱": None, "회원가입": L["회원가입"].map(done), "카카오": L["카카오"].map(done),
        "스타벅스": pd.to_numeric(L["스타벅스"], errors="coerce").fillna(0), "경로": L["판매경로"],
    })
    lg = lg[lg["일자"].notna() & lg["팀"].notna()]
    save("rows_long.json", pack(lg))
if os.path.exists(longp): files.insert(0, "rows_long.json")
json.dump({"files": files, "sheet_months": sheet_months}, open(os.path.join(DST, "rows_index.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("rows_index", files)

# ---- 팀·일 운영 요약 ----
t = pd.read_csv(os.path.join(D, "team_day.csv"), low_memory=False)
hm = lambda v: None if pd.isna(v) else str(v)[11:16]
td = pd.DataFrame({
    "일자": t["일자"], "인력사": t["인력사"], "팀": pd.to_numeric(t["팀"], errors="coerce"), "SV": t["SV"],
    "활동시작": t["활동시작"].map(hm), "활동종료": t["활동종료"].map(hm), "활동시간": pd.to_numeric(t["활동시간h"], errors="coerce").round(2),
    "이동": pd.to_numeric(t["이동횟수"], errors="coerce").fillna(0), "시작점포": t["시작점포"], "시작점포코드": t["시작점포코드"],
    "방문점포": pd.to_numeric(t["방문점포수"], errors="coerce").fillna(0), "판매": pd.to_numeric(t["판매"], errors="coerce").fillna(0),
    "건수": pd.to_numeric(t["건수"], errors="coerce").fillna(0),
})
td = td[td["팀"].notna()]
TD_COLS = list(td.columns); DICT |= {"시작점포", "시작점포코드"}
save("team_day.json", pack(td, TD_COLS))

# ---- 활동 기록 ----
a = pd.read_csv(os.path.join(D, "activity_clean.csv"), low_memory=False)
ac = pd.DataFrame({
    "일자": a["일자"], "시각": a["기록시간"].astype(str).str[:5], "팀": pd.to_numeric(a["팀"], errors="coerce"), "인력사": a["인력사"],
    "기록": a["기록구분"], "점포코드": a["현재점포 코드"], "점포명": a["현재점포명"], "이동사유": a["이동사유"],
    "구간판매": pd.to_numeric(a["구간판매"], errors="coerce").fillna(0),
})
ac = ac[ac["팀"].notna() & ac["일자"].notna()]
DICT |= {"기록", "이동사유", "시각"}
save("activity.json", pack(ac, list(ac.columns)))
