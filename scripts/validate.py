# -*- coding: utf-8 -*-
"""추천 목록 효과 검증: 실적 기반(R) / 입지 기반(N) / 비추천 으로 나눠 비교
입력: long_sales_enriched.csv(4~11월 폼즈), sales_merged.csv·activity_clean.csv(11월 시트), recommend_points.json
"""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
P = _os.environ.get("PLOOM_PROJECT", _os.path.join(ROOT, "ref"))
import pandas as pd, json, os, numpy as np
pd.set_option("display.width", 220); pd.set_option("display.max_columns", 30)
D = _os.path.join(ROOT, "work", "data", "out")
E = os.path.join(D, "dash3"); os.makedirs(E, exist_ok=True)
CODE = open(__file__, encoding="utf-8").read()
def save(name, df, inp):
    df = df.copy()
    for c in df.columns:
        if df[c].dtype.kind == "f": df[c] = df[c].round(2)
    rows = json.loads(df.to_json(orient="records", force_ascii=False))
    json.dump({"rows": rows, "meta": [{"label": "validate.py", "value": CODE, "type": "code", "lang": "python"}, {"label": "입력", "value": inp}]}, open(os.path.join(E, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("saved", name, len(rows))

rec = pd.DataFrame(json.load(open(os.path.join(P, "recommend_points.json"), encoding="utf-8")))
grp = dict(zip(rec["k"], rec["g"].map({"R": "실적 기반 추천", "N": "입지 기반 추천"})))
s = pd.read_csv(os.path.join(D, "long_sales_enriched.csv")); s = s[s["점포코드"].str.startswith("KA")]
s["그룹"] = s["점포코드"].map(grp).fillna("추천 외")
s["월"] = s["월"].str[5:].str.lstrip("0") + "월"
MO = ["4월","5월","6월","7월","8월","9월","10월","11월"]
def order(df, col="월"): df[col] = pd.Categorical(df[col], MO, ordered=True); return df.sort_values(col).assign(**{col: lambda d: d[col].astype(str)})

print("== 그룹별 점포 수와 판매 이력 ==")
sold_before_nov = set(s[s["월"] != "11월"]["점포코드"])
for g, k in [("실적 기반 추천", "R"), ("입지 기반 추천", "N")]:
    ks = set(rec[rec["g"] == k]["k"]); print(g, len(ks), "11월 이전 판매 이력 있는 점포", len(ks & sold_before_nov), "4~11월 판매 발생", len(ks & set(s["점포코드"])))

# 1) 월별 그룹별 점포당 판매
g1 = s.groupby(["월","그룹"]).agg(판매=("수량","sum"), 점포수=("점포코드","nunique")).reset_index(); g1["점포당"] = g1["판매"]/g1["점포수"]; g1["판매"] = g1["판매"].astype(int)
print(g1.pivot(index="월", columns="그룹", values="점포당").round(2).loc[MO])
save("rec_group_month", order(g1), "long_sales_enriched.csv + recommend_points.json")

# 2) 첫 방문(1회차) 하루 판매: 그룹별 — 과거 실적과 무관한 공정 비교
sp = s.groupby(["점포코드","일자"])["수량"].sum().reset_index().sort_values(["점포코드","일자"]); sp["차수"] = sp.groupby("점포코드").cumcount()+1
sp["그룹"] = sp["점포코드"].map(grp).fillna("추천 외")
first = sp[sp["차수"] == 1].groupby("그룹")["수량"].agg(점포수="size", 첫방문일평균="mean").reset_index()
print(first)
# 3) 11월 팀 내 비교 (같은 팀이 추천 점포에서 시작한 날 vs 아닌 날)
a = pd.read_csv(os.path.join(D, "activity_clean.csv")); sm = pd.read_csv(os.path.join(D, "sales_merged.csv"))
st = a[a["기록구분"] == "활동시작"].drop_duplicates(["일자","팀"]).copy()
st["그룹"] = st["시작점포 코드"].map(grp).fillna("추천 외")
sd = sm.groupby(["일자","팀"])["수량"].sum().reset_index()
st = st.merge(sd, on=["일자","팀"], how="left").fillna({"수량": 0})
print("\n== 11월 시작점포 그룹별 팀·일 평균 =="); g3 = st.groupby("그룹")["수량"].agg(팀일="size", 팀일평균="mean", 무판매율=lambda x: (x == 0).mean()*100).reset_index(); print(g3)
save("rec_group_nov", g3, "activity_clean.csv 활동시작 + sales_merged.csv + recommend_points.json")
# 팀 내 비교: 추천(실적+입지 합산) vs 추천 외, 둘 다 경험한 팀만
st["추천"] = st["그룹"] != "추천 외"
tm = st.groupby(["팀","추천"])["수량"].agg(["mean","size"]).unstack("추천")
both = tm.dropna(); both.columns = ["비추천평균","추천평균","비추천일수","추천일수"]
both["차이"] = both["추천평균"] - both["비추천평균"]
print("\n== 팀 내 비교 (두 경우 모두 있는 팀) =="); print("팀 수", len(both), "추천이 더 높은 팀", int((both["차이"] > 0).sum()), "같음", int((both["차이"] == 0).sum()), "낮은 팀", int((both["차이"] < 0).sum()))
print("팀별 평균 차이", both["차이"].mean().round(2), " 중앙값", both["차이"].median().round(2), " 추천일 평균", both["추천평균"].mean().round(2), " 비추천일 평균", both["비추천평균"].mean().round(2))
within = pd.DataFrame([{"구분": "같은 팀, 추천 점포에서 시작한 날", "팀일평균": both["추천평균"].mean(), "팀수": len(both)}, {"구분": "같은 팀, 추천 외 점포에서 시작한 날", "팀일평균": both["비추천평균"].mean(), "팀수": len(both)}])
save("rec_within_team", within, "activity_clean.csv + sales_merged.csv + recommend_points.json (두 경우를 모두 경험한 팀만)")
wt = pd.DataFrame([{"팀수": len(both), "추천이높은팀": int((both["차이"] > 0).sum()), "추천이낮은팀": int((both["차이"] < 0).sum()), "같은팀": int((both["차이"] == 0).sum()), "평균차이": both["차이"].mean(), "중앙값차이": both["차이"].median()}])
save("rec_within_summary", wt, "위와 같음")
# 팀 내 비교를 그룹별로 (입지 기반만 vs 추천 외)
for g in ["입지 기반 추천", "실적 기반 추천"]:
    sub = st[st["그룹"].isin([g, "추천 외"])].copy(); sub["추천"] = sub["그룹"] == g
    t2 = sub.groupby(["팀","추천"])["수량"].mean().unstack("추천").dropna()
    print(f"  {g} vs 추천 외 (팀 내): 팀수 {len(t2)}, 추천일 {t2[True].mean():.2f} vs {t2[False].mean():.2f}, 높은 팀 {(t2[True]>t2[False]).sum()}/{len(t2)}")

# 4) 실적 기반 점포의 전후 비교: 목록 기준일(11/11) 이전 vs 이후 점포당 일판매 — 다른 그룹과 비교
# 점포·일 단위로 10월(이전) 대비 11월(이후) 일평균 변화
s["기간"] = np.where(s["월"] == "11월", "11월", np.where(s["월"].isin(["9월","10월"]), "9~10월", "그 전"))
spd = s.groupby(["그룹","기간","점포코드","일자"])["수량"].sum().reset_index()
g4 = spd[spd["기간"] != "그 전"].groupby(["그룹","기간"])["수량"].agg(점포일="size", 점포일평균="mean").reset_index()
print("\n== 그룹별 9~10월 vs 11월 점포·일 평균 =="); print(g4.pivot(index="그룹", columns="기간", values="점포일평균").round(2))
save("rec_group_period", g4, "long_sales_enriched.csv + recommend_points.json")

# 5) 입지 기반 추천 사유별 성과
n = s[s["그룹"] == "입지 기반 추천"].merge(rec[["k","e","why","press"]].rename(columns={"k":"점포코드"}), on="점포코드", how="left")
n["언론사근접"] = n["press"].notna().map({True: "언론사 1km 안", False: "아님"})
n["오피스"] = n["why"].astype(str).str.contains("오피스 가능성 높음").map({True: "오피스 가능성 높음", False: "아님"})
for c in ["e", "언론사근접", "오피스"]:
    x = n.groupby(c).agg(판매=("수량","sum"), 점포수=("점포코드","nunique")); x["점포당"] = (x["판매"]/x["점포수"]).round(2); print(c); print(x)
x = n.groupby("e").agg(판매=("수량","sum"), 점포수=("점포코드","nunique")).reset_index().rename(columns={"e":"추천등급"}); x["점포당"] = x["판매"]/x["점포수"]; x["판매"] = x["판매"].astype(int)
save("rec_grade", x, "long_sales_enriched.csv + recommend_points.json (입지 기반 추천 점포만)")
# 요약
summ = pd.DataFrame([{"실적기반점포수": int((rec["g"]=="R").sum()), "입지기반점포수": int((rec["g"]=="N").sum()), "입지기반_11월이전이력": len(set(rec[rec["g"]=="N"]["k"]) & sold_before_nov),
    "첫방문_입지기반": float(first.set_index("그룹").loc["입지 기반 추천","첫방문일평균"]), "첫방문_실적기반": float(first.set_index("그룹").loc["실적 기반 추천","첫방문일평균"]), "첫방문_추천외": float(first.set_index("그룹").loc["추천 외","첫방문일평균"]),
    "첫방문점포수_입지기반": int(first.set_index("그룹").loc["입지 기반 추천","점포수"]), "첫방문점포수_추천외": int(first.set_index("그룹").loc["추천 외","점포수"])}])
save("rec_validation_summary", summ, "위 계산 모음")
save("rec_first_visit", first, "long_sales_enriched.csv + recommend_points.json")
