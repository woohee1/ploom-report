# -*- coding: utf-8 -*-
"""작년(2024.12~2025.12) 에이전트 세일즈 폼즈 엑셀 → docs/data/rows_prev.json (비교용, 고정)
올해 건 단위 자료(rows_*.json)와 같은 열. 인력사는 없음, 팀 번호는 작년 체계라 비교에 쓰지 않는다.
사용: py -3 scripts/import_last_year.py "<폼즈 엑셀 폴더>"
"""
import os, sys, re, json, glob
import openpyxl, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
DST = os.path.join(ROOT, "docs", "data")
folder = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\VRID\OneDrive\Desktop\VRID\에이전트\2025\월별 세일즈 폼즈"
MAP = [("타임스탬프", ["타임스탬프"]), ("판매시간", ["판매 시간", "판매시간"]), ("팀", ["팀명"]), ("점포구분", ["점포 구분"]),
       ("점포코드", ["점포 코드"]), ("점포타입", ["점포 타입"]), ("점포명", ["점포명"]), ("SV", ["수퍼바이저"]),
       ("회원가입", ["회원가입 완료"]), ("카카오", ["카카오 채널 추가 완료"]), ("판매경로", ["판매경로"]), ("색상", ["색상", "컬러"]),
       ("수량", ["디바이스 수량", "판매수량"]), ("스타벅스", ["스타벅스"]), ("성별", ["성별"]), ("연령대", ["연령"]), ("사용제품", ["사용 제품"])]
frames = []
for f in sorted(glob.glob(os.path.join(folder, "*.xlsx"))):
    ws = openpyxl.load_workbook(f, read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True)); hdr = [str(c).strip() if c else "" for c in rows[0]]
    col = {}
    for i, h in enumerate(hdr):
        for std, keys in MAP:
            if std not in col and any(k in h for k in keys): col[std] = i; break
    df = pd.DataFrame([[r[i] if i < len(r) else None for i in col.values()] for r in rows[1:] if r and r[0]], columns=list(col))
    frames.append(df); print(os.path.basename(f), len(df), "행, 열", sorted(col))
s = pd.concat(frames, ignore_index=True)
S = lambda c: s[c].astype(str).str.strip().replace({"nan": None, "None": None, "": None}).where(lambda x: x.notna(), None).astype(object) if c in s else pd.Series([None] * len(s), dtype=object)
# 열 밀림 보정 1: 점포 코드 칸에 '점포'/'흡연구역'이 적힌 행 → 구분으로 옮기고 코드는 비움
code = S("점포코드"); kind = S("점포구분")
shifted = code.isin(["점포", "흡연구역"])
kind = kind.where(~shifted, code); code = code.where(~shifted, None)
code = code.where(~code.isin(["0", "0.0", "신규채널", "-"]), None)
# 열 밀림 보정 2: 연령 칸에 사용 제품이 들어간 행(2025년 12월 파일) → 사용제품으로
age = S("연령대"); prod = S("사용제품")
bad = age.fillna("").str.contains("궐련|전자담배")
prod = prod.where(~bad, age); age = age.where(~bad, None)
def age_bucket(v):
    if v is None or (isinstance(v, float) and v != v): return None
    if "50" in v and "↑" in v: return "50대 이상"
    m = re.match(r"(\d+)", v)
    if not m: return None
    a = int(m.group(1)); return "20대" if a < 30 else "30대" if a < 40 else "40대" if a < 50 else "50대 이상"
def product(v):
    if v is None or (isinstance(v, float) and v != v): return None
    v = v.replace(" ", "")
    for k, o in [("아이코스", "아이코스"), ("릴", "릴"), ("글로", "글로"), ("액상", "액상형 전자담배"), ("궐련", "연초"), ("연초", "연초")]:
        if k in v: return o
    return "기타"
def route(v):
    if v is None or (isinstance(v, float) and v != v): return None
    if "CVS" in v: return "CVS : 고객 할인 쿠폰 사용" if "할인" in v else "CVS : 다회용 쿠폰 사용"
    if "카카오" in v or "자사몰" in v or "홈페이지" in v or "온라인" in v: return "자사몰 : 온라인 결제"
    return v
def brand(v):
    if v is None or (isinstance(v, float) and v != v): return None
    v = v.replace(" ", "")
    if v.startswith("CU"): return "CU"
    if v.startswith("GS"): return "GS25"
    if "세븐" in v: return "세븐일레븐"
    if "이마트" in v: return "이마트24"
    return None if v in ("-",) else v
def color(v):
    if v is None or (isinstance(v, float) and v != v): return None
    v = re.sub(r"\s+", "", v)
    return {"네이비블루": "네이비 블루", "슬레이트그레이": "슬레이트 그레이", "오라이토레드": "오라이토 레드", "아쿠아헤일로": "아쿠아 헤일로", "로즈골드": "로즈골드", "루나실버": "루나 실버", "제트블랙": "제트 블랙"}.get(v, v)
def done(v):
    if v is None or (isinstance(v, float) and v != v): return None
    return 0 if "미완료" in v else 1 if "완료" in v else None
def sbux(v):
    if v is None or (isinstance(v, float) and v != v): return 0
    m = re.match(r"(\d+)", v); return int(m.group(1)) if m else 0
stores = {d["k"]: d for d in json.load(open(os.path.join(ROOT, "ref", "stores.json"), encoding="utf-8"))}
addr = code.map(lambda k: stores.get(k, {}).get("a"))
sido = addr.map(lambda a: a.split()[0] if isinstance(a, str) and a.split() else None).replace({"경기도": "경기", "서울시": "서울", "서울특별시": "서울", "인천광역시": "인천"})
sgg = addr.map(lambda a: a.split()[1] if isinstance(a, str) and len(a.split()) > 1 else None)
out = pd.DataFrame({
    "일자": pd.to_datetime(s["타임스탬프"], errors="coerce").dt.strftime("%Y-%m-%d"),
    "시": pd.to_numeric(S("판매시간").str.extract(r"^(\d{1,2})")[0], errors="coerce"),
    "팀": pd.to_numeric(S("팀").str.extract(r"(\d+)")[0], errors="coerce"), "인력사": None, "SV": S("SV"),
    "점포코드": code, "점포명": S("점포명"), "브랜드": S("점포타입").map(brand), "구분": kind.replace({"흠연구역": "흡연구역"}),
    "시도": sido, "시군구": sgg, "색상": S("색상").map(color), "수량": pd.to_numeric(s["수량"], errors="coerce").fillna(1),
    "성별": S("성별"), "연령대": age.map(age_bucket), "사용제품": prod.map(product), "리필구매": None, "스틱": None,
    "회원가입": S("회원가입").map(done), "카카오": S("카카오").map(done), "스타벅스": S("스타벅스").map(sbux), "경로": S("판매경로").map(route),
})
out = out[out["일자"].notna()]
import export_rows_pack as P
P.save("rows_prev.json", P.pack(out))
print(out.groupby(out["일자"].str[:7]).agg(건수=("수량", "size"), 판매=("수량", "sum"), 지역=("시도", lambda x: x.notna().mean().round(2))).to_string())
for c in ["브랜드", "구분", "경로", "색상", "연령대", "사용제품"]: print(c, out[c].value_counts().to_dict())
