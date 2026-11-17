# -*- coding: utf-8 -*-
"""시트 원본(JSON) + 점포 마스터/인사이트/추천 → 분석용 표 생성"""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
P = _os.environ.get("PLOOM_PROJECT", _os.path.join(ROOT, "ref"))
import json, sys, glob, os, re
import pandas as pd

D = _os.path.join(ROOT, "work", "data")
OUT = os.path.join(D, "out"); os.makedirs(OUT, exist_ok=True)

def load_parts(stem):
    files = sorted(glob.glob(os.path.join(D, stem + "*.json")))
    header, rows = None, []
    for f in files:
        j = json.load(open(f, encoding="utf-8"))
        if isinstance(j, dict):
            header = header or j.get("header"); rows += j.get("rows", [])
        elif isinstance(j, list):
            if header is None and j and isinstance(j[0], list) and j[0] and "날짜" in "".join(map(str, j[0])):
                header = j[0]; rows += j[1:]
            else:
                rows += j
    if header is None: raise SystemExit("header missing: " + stem)
    rows = [r["value"] if isinstance(r, dict) else r for r in rows]
    header = header["value"] if isinstance(header, dict) else header
    w = len(header)
    rows = [r + [""] * (w - len(r)) if len(r) < w else r[:w] for r in rows if any(str(c).strip() for c in r)]
    df = pd.DataFrame(rows, columns=header)
    return df

def kdate(s):
    s = str(s).strip()
    m = re.match(r"(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})", s)
    if m: return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    return m.group(0) if m else None

# ---------- 팀 배정 ----------
tm = pd.DataFrame(json.load(open(os.path.join(D, "team_map.json"), encoding="utf-8")), columns=["인력사","구분","SV","팀"])
tm["팀"] = tm["팀"].astype(int)
team_agency = dict(zip(tm["팀"], tm["인력사"])); team_sv = dict(zip(tm["팀"], tm["SV"]))

def agency_of(t):
    if pd.isna(t): return None
    t = int(t)
    if t in team_agency: return team_agency[t]
    if 901 <= t <= 910: return "비욘드"
    if 911 <= t <= 920: return "토마스컴퍼니"
    if t <= 30: return "후킷"
    if t <= 68: return "토마스컴퍼니"
    return "비욘드"

# ---------- 점포 마스터 / 인사이트 / 추천 ----------
stores = pd.DataFrame(json.load(open(os.path.join(P, "stores.json"), encoding="utf-8")))
stores = stores.rename(columns={"c":"점포구분_M","k":"점포코드","t":"브랜드_M","n":"점포명_M","a":"주소"})
stores["시도"] = stores["주소"].astype(str).str.split().str[0]
stores["시군구"] = stores["주소"].astype(str).str.split().str[1]
stores = stores.drop_duplicates("점포코드")

ins = json.load(open(os.path.join(P, "store_insights.json"), encoding="utf-8"))
ins_rows = []
for k, v in ins.items():
    f = (v or {}).get("f") or {}
    row = {"점포코드": k, "인사이트_상태": f.get("s"), "인사이트_날짜": f.get("d"), "점주협조": f.get("o")}
    for t in (f.get("t") or []):
        if isinstance(t, list) and len(t) >= 2: row["인사이트_" + str(t[0])] = t[1]
    ins_rows.append(row)
insight = pd.DataFrame(ins_rows).drop_duplicates("점포코드")

rec = pd.DataFrame(json.load(open(os.path.join(P, "recommend_points.json"), encoding="utf-8")))
rec = rec.rename(columns={"k":"점포코드","e":"추천등급","r":"추천순위","why":"추천사유","tm":"추천시간대","st":"인근역","p":"추천점수","press":"언론사근접","g":"추천G"})
rec = rec[["점포코드","추천등급","추천순위","추천사유","추천시간대","인근역","추천점수","언론사근접"]].drop_duplicates("점포코드")

# ---------- 판매 ----------
s = load_parts("sales")
s["일자"] = s["날짜"].map(kdate)
s["시"] = pd.to_numeric(s["판매시간"].astype(str).str.split(":").str[0], errors="coerce")
tp = s["팀 · 판매 에이전트"].astype(str).str.split("·", n=1)
s["팀"] = pd.to_numeric(tp.str[0].str.strip(), errors="coerce")
s["에이전트"] = tp.str[1].str.strip()
s["수량"] = pd.to_numeric(s["판매수량"], errors="coerce").fillna(0)
s["스타벅스"] = pd.to_numeric(s["스타벅스 기프트카드 제공 수량"], errors="coerce").fillna(0)
s["인력사"] = s["팀"].map(agency_of); s["SV"] = s["팀"].map(team_sv)
s["야간"] = s["팀"] >= 900
s["고유ID_base"] = s["고유 ID"].astype(str).str.extract(r"^([0-9a-f\-]{36})")[0]
s = s.rename(columns={"점포 코드":"점포코드"})
s = s.merge(stores[["점포코드","시도","시군구","주소"]], on="점포코드", how="left")
s = s.merge(insight, on="점포코드", how="left").merge(rec, on="점포코드", how="left")
s["요일"] = pd.to_datetime(s["일자"]).dt.dayofweek.map({0:"월",1:"화",2:"수",3:"목",4:"금",5:"토",6:"일"})
s.to_csv(os.path.join(OUT, "sales_merged.csv"), index=False, encoding="utf-8-sig")

# ---------- 활동 ----------
a = load_parts("activity")
a["일자"] = a["날짜"].map(kdate)
a["팀"] = pd.to_numeric(a["팀명"].astype(str).str.replace("팀",""), errors="coerce")
a["시각"] = pd.to_datetime(a["일자"] + " " + a["기록시간"].astype(str), errors="coerce")
a["구간판매"] = pd.to_numeric(a["구간 판매수량"], errors="coerce").fillna(0)
a["거리m"] = pd.to_numeric(a["점포와 거리(m)"], errors="coerce")
a.to_csv(os.path.join(OUT, "activity_clean.csv"), index=False, encoding="utf-8-sig")

# 팀-일 단위 운영 요약
g = a.sort_values("시각").groupby(["일자","인력사","팀"])
def summ(df):
    st = df[df["기록구분"]=="활동시작"]["시각"].min()
    en = df[df["기록구분"]=="활동종료"]["시각"].max()
    ls = df[df["기록구분"]=="점심시작"]["시각"].min()
    le = df[df["기록구분"].str.contains("오후", na=False)]["시각"].min()
    moves = df[df["기록구분"].str.contains("이동", na=False)]
    return pd.Series({
        "활동시작": st, "활동종료": en,
        "활동시간h": ((en - st).total_seconds()/3600) if pd.notna(st) and pd.notna(en) else None,
        "점심분": ((le - ls).total_seconds()/60) if pd.notna(ls) and pd.notna(le) else None,
        "이동횟수": len(moves),
        "이동사유": "|".join(moves["이동사유"].dropna().astype(str).unique()[:5]),
        "시작점포": df["시작점포명"].dropna().astype(str).iloc[0] if df["시작점포명"].notna().any() else None,
        "시작점포코드": df["시작점포 코드"].dropna().astype(str).iloc[0] if df["시작점포 코드"].notna().any() else None,
        "방문점포수": df["현재점포 코드"].dropna().astype(str).nunique(),
        "에이전트": df["판매 에이전트"].dropna().astype(str).iloc[0] if df["판매 에이전트"].notna().any() else None,
    })
ops = g.apply(summ).reset_index()
sales_td = s.groupby(["일자","팀"]).agg(판매=("수량","sum"), 건수=("수량","size"), 스타벅스=("스타벅스","sum"), 판매점포수=("점포코드","nunique")).reset_index()
ops = ops.merge(sales_td, on=["일자","팀"], how="outer")
ops["인력사"] = ops["인력사"].fillna(ops["팀"].map(agency_of)); ops["SV"] = ops["팀"].map(team_sv)
ops["판매"] = ops["판매"].fillna(0)
ops["시간당판매"] = ops["판매"] / ops["활동시간h"]
ops.to_csv(os.path.join(OUT, "team_day.csv"), index=False, encoding="utf-8-sig")

print("sales rows", len(s), "dates", s["일자"].min(), "~", s["일자"].max())
print("activity rows", len(a), "team-days", len(ops))
print("store match", s["시도"].notna().mean().round(3), "insight match", s["인사이트_상태"].notna().mean().round(3), "rec match", s["추천등급"].notna().mean().round(3))
