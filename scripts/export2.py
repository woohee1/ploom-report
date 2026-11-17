# -*- coding: utf-8 -*-
"""4~11월 폼즈 통합표(long_sales_enriched.csv, long_storeday.csv) → 대시보드 장기 추이용 집계 JSON
입력: '폼즈 (3).zip'의 인력사별 데일리 폼즈 엑셀 136일분(parse_forms.py로 합침), stores.json, recommend_points.json
"""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
P = _os.environ.get("PLOOM_PROJECT", r"C:\Users\VRID\Downloads\Ploom_v12_10_FAST_MISSING_SYNC")
import pandas as pd, json, os
D = _os.path.join(ROOT, "work", "data", "out")
E = os.path.join(D, "dash2"); os.makedirs(E, exist_ok=True)
CODE = open(__file__, encoding="utf-8").read()
s = pd.read_csv(os.path.join(D, "long_sales_enriched.csv")); t = pd.read_csv(os.path.join(D, "long_storeday.csv"))
s["팀일"] = s["일자"] + "_" + s["팀"].astype(str)
s["월"] = s["월"].str[5:].str.lstrip("0") + "월"
t["월"] = t["월"].str[5:].str.lstrip("0") + "월"
MO = ["4월","5월","6월","7월","8월","9월","10월","11월"]
def save(name, df, inp):
    df = df.copy()
    for c in df.columns:
        if df[c].dtype.kind == "f": df[c] = df[c].round(2)
    rows = json.loads(df.to_json(orient="records", force_ascii=False))
    json.dump({"rows": rows, "meta": [{"label": "export2.py", "value": CODE, "type": "code", "lang": "python"}, {"label": "입력", "value": inp}]},
              open(os.path.join(E, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(name, len(rows))
def order(df, col="월"):
    df[col] = pd.Categorical(df[col], MO, ordered=True); return df.sort_values(col).assign(**{col: lambda d: d[col].astype(str)})

# 월별 종합
m = s.groupby("월").agg(판매=("수량","sum"), 운영일수=("일자","nunique"), 판매팀수=("팀","nunique"), 판매팀일=("팀일","nunique"), 점포수=("점포코드","nunique"), 스타벅스=("스타벅스","sum")).reset_index()
m["일평균"] = m["판매"]/m["운영일수"]; m["팀일당"] = m["판매"]/m["판매팀일"]; m["점포당"] = m["판매"]/m["점포수"]; m["스타벅스건당"] = m["스타벅스"]/m["판매"]
for ag in ["토마스컴퍼니","비욘드","후킷"]:
    g = s[s["인력사"]==ag].groupby("월"); m[ag] = m["월"].map(g["수량"].sum()); m[ag+"_팀일당"] = m["월"].map(g["수량"].sum()/g["팀일"].nunique())
first = s.groupby("점포코드")["일자"].min().str[5:7].str.lstrip("0") + "월"; s["신규"] = s["점포코드"].map(first) == s["월"]
m["신규점포비중"] = m["월"].map(s.groupby("월").apply(lambda g: g[g["신규"]]["수량"].sum()/g["수량"].sum()*100))
m["흡연구역비중"] = m["월"].map(s.groupby("월").apply(lambda g: g[g["점포구분"]=="흡연구역"]["수량"].sum()/g["수량"].sum()*100))
m["쿠폰경로비중"] = m["월"].map(s.groupby("월").apply(lambda g: g[g["판매경로"].astype(str).str.startswith("CVS")]["수량"].sum()/g["수량"].sum()*100))
m["회원가입완료율"] = m["월"].map(s.groupby("월").apply(lambda g: (g["회원가입"].astype(str).str.contains("완료") & ~g["회원가입"].astype(str).str.contains("미완료")).mean()*100))
m["카카오완료율"] = m["월"].map(s.groupby("월").apply(lambda g: (g["카카오"].astype(str).str.contains("완료") & ~g["카카오"].astype(str).str.contains("미완료")).mean()*100))
r = s[s["리필스틱"].notna()]; m["리필동반율"] = m["월"].map(r.groupby("월")["리필구매"].mean()*100)
c = s[s["성별"].notna()]; m["여성비중"] = m["월"].map(c.groupby("월").apply(lambda g: g[g["성별"]=="여자"]["수량"].sum()/g["수량"].sum()*100))
m["20대비중"] = m["월"].map(c.groupby("월").apply(lambda g: g[g["연령대"]=="20대"]["수량"].sum()/g["수량"].sum()*100))
m["판매"] = m["판매"].astype(int); m["스타벅스"] = m["스타벅스"].astype(int)
m = order(m); save("monthly", m, "long_sales_enriched.csv")

# 월별 인력사 (long)
x = s.groupby(["월","인력사"]).agg(판매=("수량","sum"), 팀일=("팀일","nunique"), 팀수=("팀","nunique")).reset_index(); x["팀일당"] = x["판매"]/x["팀일"]; x["판매"] = x["판매"].astype(int)
save("monthly_agency", order(x), "long_sales_enriched.csv")

# 일자별 전체
d = s.groupby("일자").agg(판매=("수량","sum"), 판매팀수=("팀","nunique")).reset_index(); d["팀당"] = d["판매"]/d["판매팀수"]; d["판매"] = d["판매"].astype(int)
save("daily_all", d, "long_sales_enriched.csv")

# 요일
w = s.copy(); w["요일"] = pd.to_datetime(w["일자"]).dt.day_of_week.map({0:"월",1:"화",2:"수",3:"목",4:"금",5:"토"})
w = w.groupby("요일").agg(판매=("수량","sum"), 일수=("일자","nunique")).reset_index(); w["일평균"] = w["판매"]/w["일수"]; w = w[w["일수"]>=5]
w["요일"] = pd.Categorical(w["요일"], ["월","화","수","목","금"], ordered=True); w = w.sort_values("요일").assign(요일=lambda d: d["요일"].astype(str)); w["판매"] = w["판매"].astype(int)
save("weekday", w, "long_sales_enriched.csv")

# 브랜드·색상 월별 비중 (long)
b = s[s["점포타입"].isin(["CU","세븐일레븐","GS25","이마트24"])].groupby(["월","점포타입"])["수량"].sum().reset_index()
b["비중"] = b["수량"]/b.groupby("월")["수량"].transform("sum")*100; b = b.rename(columns={"점포타입":"브랜드","수량":"판매"}); b["판매"] = b["판매"].astype(int)
save("brand_month", order(b), "long_sales_enriched.csv")
cm = s.groupby(["월","색상"])["수량"].sum().reset_index(); cm["비중"] = cm["수량"]/cm.groupby("월")["수량"].transform("sum")*100; cm = cm.rename(columns={"수량":"판매"}); cm["판매"] = cm["판매"].astype(int)
save("color_month", order(cm), "long_sales_enriched.csv")

# 추천 점포 월별 점포당
rc = s.groupby(["월","추천"]).agg(판매=("수량","sum"), 점포수=("점포코드","nunique")).reset_index(); rc["점포당"] = rc["판매"]/rc["점포수"]
rc["구분"] = rc["추천"].map({True:"추천 목록 점포", False:"그 외 점포"}); rc["판매"] = rc["판매"].astype(int)
save("rec_month", order(rc[["월","구분","판매","점포수","점포당"]]), "long_sales_enriched.csv + recommend_points.json")

# 방문점포(0 포함) 월별
tt = t.groupby("월").agg(점포일=("점포코드","size"), 무판매점포일=("판매량", lambda v:int((v==0).sum())), 판매량=("판매량","sum")).reset_index(); tt["무판매율"] = tt["무판매점포일"]/tt["점포일"]*100; tt["점포일당"] = tt["판매량"]/tt["점포일"]
tt = tt[tt["점포일"]>=500]; tt["판매량"] = tt["판매량"].astype(int)
save("storeday_month", order(tt), "long_storeday.csv (엑셀의 '프로그램 진행 완료 점포'/'점포별수량' 시트)")

# 방문 차수별
sp = s.groupby(["점포코드","일자"])["수량"].sum().reset_index(); sp["차수"] = sp.groupby("점포코드").cumcount()+1
sp["차수구간"] = pd.cut(sp["차수"], [0,1,2,3,5,10,20,999], labels=["1회차","2회차","3회차","4~5회차","6~10회차","11~20회차","21회차 이상"])
v = sp.groupby("차수구간", observed=True)["수량"].agg(점포일="size", 일평균="mean").reset_index().rename(columns={"차수구간":"구간"}); v["구간"] = v["구간"].astype(str)
save("visit_depth_all", v, "long_sales_enriched.csv")

# 점포 누적 상위 (코드 없는 행 제외)
st = s[s["점포코드"].str.startswith("KA")].groupby("점포코드").agg(점포명=("점포명","first"), 브랜드=("점포타입","first"), 구분=("점포구분","first"), 판매=("수량","sum"), 판매일수=("일자","nunique"), 첫달=("월","first"), 팀수=("팀","nunique")).reset_index()
st["일당"] = st["판매"]/st["판매일수"]; st["판매"] = st["판매"].astype(int)
save("top_stores_all", st.sort_values("판매", ascending=False).head(20), "long_sales_enriched.csv")
conc = pd.DataFrame([{"점포수": int(st["점포코드"].nunique()), "상위10퍼센트점포판매비중": float(st.sort_values("판매", ascending=False).head(len(st)//10)["판매"].sum()/st["판매"].sum()*100), "한번만판매점포비중": float((st["판매일수"]==1).mean()*100), "중앙값판매일수": float(st["판매일수"].median())}])
save("store_concentration", conc, "long_sales_enriched.csv")

# 에이전트
a = s.groupby(["인력사","에이전트"]).agg(판매=("수량","sum"), 활동일수=("일자","nunique"), 활동월수=("월","nunique")).reset_index(); a["일당"] = a["판매"]/a["활동일수"]; a["판매"] = a["판매"].astype(int)
save("agents_top", a[a["활동일수"]>=20].sort_values("일당", ascending=False).head(12), "long_sales_enriched.csv")
ag = pd.DataFrame([{"에이전트수": int(len(a)), "20일이상": int((a["활동일수"]>=20).sum()), "20일이상판매비중": float(a[a["활동일수"]>=20]["판매"].sum()/a["판매"].sum()*100), "총판매": int(s["수량"].sum()), "운영일수": int(s["일자"].nunique()), "제출건수": int(len(s)), "기간시작": s["일자"].min(), "기간끝": s["일자"].max(), "팀일당전체": float(s["수량"].sum()/s["팀일"].nunique())}])
save("summary_all", ag, "long_sales_enriched.csv")
