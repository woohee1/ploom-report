# -*- coding: utf-8 -*-
"""건 단위 자료 공통: 열 목록, 사전 압축, 저장 (export_rows.py / import_last_year.py 공용)"""
import os, json
import pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, "docs", "data")
COLS = ["일자","시","팀","인력사","SV","점포코드","점포명","브랜드","구분","시도","시군구","색상","수량","성별","연령대","사용제품","리필구매","스틱","회원가입","카카오","스타벅스","경로"]
DICT = {"인력사","SV","점포코드","점포명","브랜드","구분","시도","시군구","색상","성별","연령대","사용제품","스틱","경로","일자"}

def done(v):  # "회원가입 완료"/"완료" → 1, "미완료" → 0, 그 외 None
    s = str(v) if pd.notna(v) else ""
    if not s: return None
    if "미완료" in s: return 0
    return 1 if "완료" in s else None

def first(v):
    if pd.isna(v): return None
    return str(v).split(",")[0].strip() or None

def pack(df, cols=COLS):
    df = df.reindex(columns=cols)
    dicts, out = {}, []
    enc = {}
    for c in cols:
        if c in DICT:
            vals = sorted(set(str(x) for x in df[c].dropna() if str(x).strip()))
            dicts[c] = vals; enc[c] = {v: i for i, v in enumerate(vals)}
    for r in df.itertuples(index=False):
        row = []
        for c, v in zip(cols, r):
            if c in enc:
                row.append(enc[c].get(str(v)) if pd.notna(v) and str(v).strip() else None)
            elif isinstance(v, float):
                row.append(None if pd.isna(v) else (int(v) if v == int(v) else round(v, 2)))
            else:
                row.append(None if (v is None or (isinstance(v, str) and not v)) else v)
        out.append(row)
    return {"cols": cols, "dict": dicts, "rows": out}

def save(name, obj):
    p = os.path.join(DST, name)
    json.dump(obj, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(name, len(obj.get("rows", obj)), "행,", os.path.getsize(p) // 1024, "KB")


def brand(v):  # 엑셀 자동 채움으로 생긴 GS26, 이마트25 같은 값 정리
    import re
    if v is None or (isinstance(v, float) and v != v): return None
    v = str(v).replace(" ", "")
    if re.match(r"^GS[0-9]+$", v): return "GS25"
    if v.startswith("CU"): return "CU"
    if v.startswith("이마트"): return "이마트24"
    if "세븐" in v: return "세븐일레븐"
    return v or None

SIDO = {"서울특별시": "서울", "서울시": "서울", "인천광역시": "인천", "인천시": "인천", "경기도": "경기", "강원도": "강원", "강원특별자치도": "강원",
        "충청북도": "충북", "충청남도": "충남", "전라북도": "전북", "전북특별자치도": "전북", "전라남도": "전남", "경상북도": "경북", "경상남도": "경남",
        "부산광역시": "부산", "대구광역시": "대구", "대전광역시": "대전", "광주광역시": "광주", "울산광역시": "울산", "세종특별자치시": "세종", "제주특별자치도": "제주"}
def sido(v):  # 시도 이름 통일 (인천광역시 → 인천 등), 주소가 아닌 값(폐점 등)은 비움
    if v is None or (isinstance(v, float) and v != v): return None
    v = str(v).strip(); v = SIDO.get(v, v)
    return v if v in SIDO.values() else None
