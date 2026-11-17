# -*- coding: utf-8 -*-
"""분석용 표(sales_merged.csv, team_day.csv, activity_clean.csv) → 대시보드용 집계 JSON
입력: 통합본 시트 '11월 세일즈 제출', 개편본 '활동이동로그', 팀배정, stores.json, store_insights.json, recommend_points.json
"""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
P = _os.environ.get("PLOOM_PROJECT", _os.path.join(ROOT, "ref"))
import pandas as pd, json, os, sys
D = _os.path.join(ROOT, "work", "data", "out")
E = os.path.join(D, "dash"); os.makedirs(E, exist_ok=True)
CODE = open(__file__, encoding="utf-8").read()
s = pd.read_csv(os.path.join(D, "sales_merged.csv"))
a = pd.read_csv(os.path.join(D, "activity_clean.csv"))
o = pd.read_csv(os.path.join(D, "team_day.csv"))
oa = o[o["활동시작"].notna()].copy()
rec = pd.DataFrame(json.load(open(os.path.join(P, "recommend_points.json"), encoding="utf-8")))
recset = set(rec["k"])

def save(name, df, inp):
    df = df.copy()
    for c in df.columns:
        if df[c].dtype.kind == "f": df[c] = df[c].round(2)
    rows = json.loads(df.to_json(orient="records", force_ascii=False))
    json.dump({"rows": rows, "meta": [{"label": "export.py", "value": CODE, "type": "code", "lang": "python"}, {"label": "입력", "value": inp}]},
              open(os.path.join(E, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(name, len(rows))

# 1 요약
tot = pd.DataFrame([{
    "판매대수": int(s["수량"].sum()), "제출건수": len(s), "운영일수": int(s["일자"].nunique()),
    "판매팀수": int(s["팀"].nunique()), "활동팀일": len(oa), "무판매팀일": int((oa["판매"]==0).sum()),
    "무판매율": float((oa["판매"]==0).mean()*100), "팀일평균": float(oa["판매"].mean()),
    "판매점포수": int(s["점포코드"].nunique()), "스타벅스": int(s["스타벅스"].sum()),
    "기간시작": s["일자"].min(), "기간끝": s["일자"].max(),
    "리필스틱동반율": float((s["리필스틱 구매 여부"]=="구매").mean()*100),
    "추천점포수": int(rec["k"].nunique()), "판매발생추천점포": len(recset & set(s["점포코드"].dropna())),
}])
save("summary", tot, "sales_merged.csv, team_day.csv")

# 2 일자별
d = s.groupby(["일자","요일"]).agg(판매=("수량","sum"), 건수=("수량","size"), 판매팀수=("팀","nunique")).reset_index()
act = oa.groupby("일자").size().rename("활동팀일").reset_index()
d = d.merge(act, on="일자", how="left")
piv = s.pivot_table(index="일자", columns="인력사", values="수량", aggfunc="sum", fill_value=0).reset_index()
d = d.merge(piv, on="일자", how="left"); d["팀일평균"] = d["판매"]/d["활동팀일"]
save("daily", d, "sales_merged.csv, team_day.csv")

# 3 인력사
g = oa.groupby("인력사").agg(활동팀일=("판매","size"), 판매=("판매","sum"), 팀일평균=("판매","mean"), 무판매율=("판매", lambda x:(x==0).mean()*100), 평균활동시간=("활동시간h","mean")).reset_index()
g["판매"] = g["판매"].astype(int); g["팀수"] = g["인력사"].map(s.groupby("인력사")["팀"].nunique())
g["배정팀수"] = g["인력사"].map({"후킷":30, "토마스컴퍼니":33, "비욘드":13})
save("agency", g.sort_values("판매", ascending=False), "team_day.csv")

# 4 SV
g = oa.groupby(["인력사","SV"]).agg(활동팀일=("판매","size"), 판매=("판매","sum"), 팀일평균=("판매","mean"), 무판매율=("판매", lambda x:(x==0).mean()*100), 팀수=("팀","nunique")).reset_index()
g["판매"] = g["판매"].astype(int); g["SV"] = g["SV"].fillna("미배정")
save("sv", g.sort_values("팀일평균", ascending=False), "team_day.csv (SV = 팀배정 시트)")

# 5 팀
g = oa.groupby(["인력사","팀"]).agg(활동일수=("판매","size"), 판매=("판매","sum"), 팀일평균=("판매","mean"), 평균활동시간=("활동시간h","mean"), 이동횟수=("이동횟수","sum")).reset_index()
g["판매"] = g["판매"].astype(int); g["팀"] = g["팀"].astype(int); g["SV"] = g["팀"].map(dict(zip(oa["팀"], oa["SV"]))).fillna("미배정")
save("teams", g.sort_values("팀일평균", ascending=False), "team_day.csv")

# 6 시간대
h = s.groupby("시")["수량"].sum().reset_index().rename(columns={"시":"시간","수량":"판매"}); h = h[(h["시간"]>=9)&(h["시간"]<=19)]; h["시간"] = h["시간"].astype(int)
save("hourly", h, "sales_merged.csv")

# 7 점포 구분×브랜드
x = s.groupby(["점포 구분","점포 타입"]).agg(판매=("수량","sum"), 점포수=("점포코드","nunique"), 팀일=("일자","size")).reset_index().rename(columns={"점포 구분":"구분","점포 타입":"브랜드"})
x["점포당판매"] = x["판매"]/x["점포수"]; x["판매"] = x["판매"].astype(int)
save("store_type", x.sort_values("판매", ascending=False), "sales_merged.csv")

# 8 지역
s["시도N"] = s["시도"].replace({"경기도":"경기","서울시":"서울"})
r = s.groupby(["시도N","시군구"]).agg(판매=("수량","sum"), 점포수=("점포코드","nunique")).reset_index().rename(columns={"시도N":"시도"})
r["점포당판매"] = r["판매"]/r["점포수"]; r["판매"] = r["판매"].astype(int)
save("region", r.sort_values("판매", ascending=False).head(15), "sales_merged.csv + stores.json 주소")

# 9 인사이트
rows = []
for col, lab in [("인사이트_상태","점포 상태"),("인사이트_흡연","흡연 스팟"),("인사이트_점주","점주 태도"),("인사이트_유동","유동량")]:
    x = s.groupby(col).agg(판매=("수량","sum"), 점포수=("점포코드","nunique")).reset_index().rename(columns={col:"값"})
    x = x[x["점포수"]>=4]; x["항목"] = lab; x["점포당판매"] = x["판매"]/x["점포수"]; rows.append(x)
ins = pd.concat(rows)[["항목","값","판매","점포수","점포당판매"]]; ins["판매"] = ins["판매"].astype(int)
cov = pd.DataFrame([{"항목":"인사이트 보유 점포 비율","값":"판매 점포 중", "판매": int(s[s["인사이트_상태"].notna()]["수량"].sum()), "점포수": int(s[s["인사이트_상태"].notna()]["점포코드"].nunique()), "점포당판매": float(s["인사이트_상태"].notna().mean()*100)}])
save("insight", ins, "sales_merged.csv + store_insights.json")

# 10 추천 시작점포 효과
st = a[a["기록구분"]=="활동시작"].copy(); st["추천점포시작"] = st["시작점포 코드"].isin(recset)
sd = s.groupby(["일자","팀"])["수량"].sum().reset_index()
st = st.drop_duplicates(["일자","팀"]).merge(sd, on=["일자","팀"], how="left").fillna({"수량":0})
g = st.groupby("추천점포시작").agg(팀일=("수량","size"), 판매=("수량","sum"), 팀일평균=("수량","mean"), 무판매율=("수량", lambda x:(x==0).mean()*100)).reset_index()
g["구분"] = g["추천점포시작"].map({True:"추천 점포에서 시작", False:"추천 외 점포에서 시작"}); g["판매"] = g["판매"].astype(int)
g2 = st.groupby(["인력사","추천점포시작"]).agg(팀일=("수량","size"), 팀일평균=("수량","mean")).reset_index()
g2["구분"] = g2["추천점포시작"].map({True:"추천 점포에서 시작", False:"추천 외 점포에서 시작"})
save("recommend", g[["구분","팀일","판매","팀일평균","무판매율"]], "activity_clean.csv 활동시작 + recommend_points.json + sales_merged.csv")
save("recommend_agency", g2[["인력사","구분","팀일","팀일평균"]], "activity_clean.csv 활동시작 + recommend_points.json + sales_merged.csv")
cov = pd.DataFrame([{"추천점포수": int(rec["k"].nunique()), "판매발생추천점포": len(recset & set(s["점포코드"].dropna())), "추천시작비율": float(st["추천점포시작"].mean()*100)}])
save("recommend_cov", cov, "recommend_points.json, sales_merged.csv, activity_clean.csv")

# 11 운영 구간
oa["이동구간"] = pd.cut(oa["이동횟수"], [-1,0,1,99], labels=["이동 없음","1회 이동","2회 이상"])
g = oa.groupby("이동구간", observed=True).agg(팀일=("판매","size"), 팀일평균=("판매","mean")).reset_index().rename(columns={"이동구간":"구간"}); g["항목"]="점포 이동"
oa["활동구간"] = pd.cut(oa["활동시간h"], [0,6,7,8,24], labels=["6시간 미만","6~7시간","7~8시간","8시간 이상"])
g2 = oa[oa["활동시간h"].notna()].groupby("활동구간", observed=True).agg(팀일=("판매","size"), 팀일평균=("판매","mean")).reset_index().rename(columns={"활동구간":"구간"}); g2["항목"]="활동 시간"
save("ops", pd.concat([g,g2])[["항목","구간","팀일","팀일평균"]], "team_day.csv")

# 12 이동 사유
mv = a[a["기록구분"]=="점포이동"]["이동사유"].fillna("미기재").value_counts().reset_index(); mv.columns = ["사유","건수"]
save("move_reason", mv.head(8), "activity_clean.csv 점포이동")

# 13 고객
g = s.groupby(["구매자 연령대","구매자 성별"])["수량"].sum().reset_index().rename(columns={"구매자 연령대":"연령대","구매자 성별":"성별","수량":"판매"})
save("customer", g, "sales_merged.csv")
g = s.groupby("디바이스 색상")["수량"].sum().reset_index().rename(columns={"디바이스 색상":"색상","수량":"판매"}).sort_values("판매", ascending=False)
save("color", g, "sales_merged.csv")
s["주사용"] = s["구매자 사용 제품"].astype(str).str.split(",").str[0].str.strip()
g = s.groupby("주사용")["수량"].sum().reset_index().rename(columns={"주사용":"사용제품","수량":"판매"}).sort_values("판매", ascending=False)
save("product", g, "sales_merged.csv (복수 응답은 첫 항목)")
s["스틱"] = s["리필스틱 종류"].astype(str).str.split("(").str[0].str.strip()
g = s[s["리필스틱 종류"].notna()].groupby("스틱")["수량"].sum().reset_index().rename(columns={"수량":"판매"}).sort_values("판매", ascending=False).head(8)
save("stick", g, "sales_merged.csv (괄호 앞 이름 기준으로 합침)")

# 14 상위 점포
g = s.groupby(["점포코드","점포명","점포 타입","점포 구분"]).agg(판매=("수량","sum"), 판매일수=("일자","nunique"), 팀수=("팀","nunique")).reset_index().rename(columns={"점포 타입":"브랜드","점포 구분":"구분"})
g["판매"] = g["판매"].astype(int); g["추천점포"] = g["점포코드"].isin(recset).map({True:"예", False:"아니오"})
save("top_stores", g.sort_values("판매", ascending=False).head(15), "sales_merged.csv")

# 15 재방문 차수
sp = s.groupby(["점포코드","일자"])["수량"].sum().reset_index(); sp["방문차수"] = sp.groupby("점포코드").cumcount()+1
g = sp.groupby("방문차수")["수량"].agg(점포일=("size"), 일평균=("mean")).reset_index(); g = g[g["방문차수"]<=5]
save("revisit", g, "sales_merged.csv")

# 16 무판매 팀 (활동기록은 있으나 판매 0)
z = oa.groupby(["인력사","팀"]).agg(활동일수=("판매","size"), 판매=("판매","sum")).reset_index(); z = z[(z["판매"]==0)&(z["활동일수"]>=4)]
z["팀"] = z["팀"].astype(int); z["판매"] = z["판매"].astype(int)
save("zero_teams", z.sort_values(["인력사","팀"]), "team_day.csv")
