# -*- coding: utf-8 -*-
"""4~11월 인력사별 데일리 폼즈 엑셀 → 하나의 판매 표(long_sales.csv) + 방문점포 표(long_storeday.csv)"""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
P = _os.environ.get("PLOOM_PROJECT", _os.path.join(ROOT, "ref"))
import pandas as pd, glob, os, re, sys, warnings
warnings.filterwarnings("ignore")
B = _os.path.join(ROOT, "work", "forms_zip", "폼즈")
OUT = _os.path.join(ROOT, "work", "data", "out")

AG = {"후킷": "후킷", "토마스": "토마스컴퍼니", "비욘드": "비욘드"}
# (표준 열, 매칭 키워드 목록 - 순서대로 첫 매칭)
MAP = [
    ("판매시간", ["판매시간", "판매 시간"]),
    ("팀", ["팀명", "팀"]),
    ("에이전트", ["에이전트"]),
    ("점포구분", ["점포 구분", "점포구분"]),
    ("점포코드", ["점포 코드", "점포코드"]),
    ("점포타입", ["점포 타입", "점포타입"]),
    ("점포명", ["점포명"]),
    ("판매경로", ["판매경로", "판매 경로"]),
    ("색상", ["색상"]),
    ("수량", ["디바이스 수량", "판매수량", "판매 수량", "수량"]),
    ("차용", ["차용"]),
    ("리필스틱", ["리필스틱", "리필 스틱"]),
    ("스타벅스", ["스타벅스", "기프트카드"]),
    ("회원가입", ["회원가입"]),
    ("카카오", ["카카오"]),
    ("성별", ["성별"]),
    ("연령대", ["연령"]),
    ("사용제품", ["사용 제품", "사용제품"]),
    ("제출시간", ["타임스탬프", "제출시간"]),
]
def pick_files():
    byday = {}
    for f in glob.glob(os.path.join(B, "*", "*.xlsx")):
        n = os.path.basename(f)
        m = re.search(r"_(\d{4})", n)
        if not m or "통합본" in n: continue
        d = m.group(1)
        pri = 3 if "최종" in n else 2 if "수정" in n else 1 if "v1" in n else 0
        if d not in byday or pri > byday[d][0]: byday[d] = (pri, f)
    return {d: f for d, (p, f) in sorted(byday.items())}

def norm_cols(cols):
    out = {}; used = set()
    for c in cols:
        if not isinstance(c, str): break   # 피벗 영역 시작
        cs = c.strip()
        for std, keys in MAP:
            if std in used: continue
            if any(k in cs for k in keys):
                out[c] = std; used.add(std); break
    return out

def kdate(s, fallback):
    if isinstance(s, pd.Timestamp): return s.strftime("%Y-%m-%d")
    m = re.match(r"(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})", str(s))
    return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else fallback

rows, sd, log = [], [], []
for d, f in pick_files().items():
    date = f"2026-{d[:2]}-{d[2:]}"
    try: x = pd.ExcelFile(f)
    except Exception as e: log.append((d, "open fail", str(e))); continue
    n_file = 0
    for sn in x.sheet_names:
        key = next((k for k in AG if sn.strip().startswith(k)), None)
        if key:
            df = pd.read_excel(x, sn, header=0)
            if df.empty: continue
            cm = norm_cols(list(df.columns))
            df = df[list(cm)].rename(columns=cm)
            if "수량" not in df or "점포코드" not in df: log.append((d, sn, "열 부족 " + ",".join(cm.values()))); continue
            df = df[df["수량"].notna()]
            df["수량"] = pd.to_numeric(df["수량"], errors="coerce")
            df = df[df["수량"] > 0]
            df["인력사"] = AG[key]; df["일자"] = date; df["파일"] = os.path.basename(f)
            rows.append(df); n_file += len(df)
        elif sn.strip() in ("프로그램 진행 완료 점포", "점포별수량"):
            raw = pd.read_excel(x, sn, header=None)
            hdr_i = next((i for i in range(min(5, len(raw))) if (raw.iloc[i].astype(str).str.contains("점포 코드")).any()), None)
            if hdr_i is None: continue
            hdr = raw.iloc[hdr_i].tolist(); body = raw.iloc[hdr_i + 1:]
            cols = {}
            for j, c in enumerate(hdr):
                if not isinstance(c, str):
                    if cols: break
                    continue
                for std, keys in [("팀", ["팀"]), ("점포구분", ["점포 구분"]), ("점포코드", ["점포 코드"]), ("점포타입", ["점포 타입"]), ("점포명", ["점포명"]), ("판매량", ["판매량"]), ("시간", ["시간"])]:
                    if std not in cols.values() and any(k in c for k in keys): cols[j] = std; break
            if "점포코드" not in cols.values() or "판매량" not in cols.values(): continue
            t = body[list(cols)].rename(columns=cols)
            t = t[t["점포코드"].notna() & t["점포코드"].astype(str).str.startswith("KA")]
            t["판매량"] = pd.to_numeric(t["판매량"], errors="coerce").fillna(0)
            t["일자"] = date; sd.append(t)
    log.append((d, "ok", n_file))

s = pd.concat(rows, ignore_index=True)
s["팀"] = pd.to_numeric(s["팀"].astype(str).str.extract(r"(\d+)")[0], errors="coerce")
s["시"] = pd.to_numeric(s["판매시간"].astype(str).str.extract(r"^(\d{1,2})")[0], errors="coerce")
s["월"] = s["일자"].str[:7]
s["점포코드"] = s["점포코드"].astype(str).str.strip()
for c in ["점포구분", "점포타입", "색상", "판매경로", "성별", "연령대", "사용제품", "리필스틱", "회원가입", "카카오", "차용"]:
    if c in s: s[c] = s[c].astype(str).str.strip().replace({"nan": None, "None": None})
s["점포타입"] = s["점포타입"].replace({"GS 25": "GS25", "세븐 일레븐": "세븐일레븐", "이마트 24": "이마트24"})
s["색상"] = s["색상"].replace({"로즈골즈": "로즈골드", "제트블랙": "제트 블랙", "네이비블루": "네이비 블루", "루나실버": "루나 실버"})
s["스타벅스"] = pd.to_numeric(s.get("스타벅스"), errors="coerce").fillna(0)
s["리필구매"] = s["리필스틱"].astype(str).str.startswith("구매") if "리필스틱" in s else False
s.to_csv(os.path.join(OUT, "long_sales.csv"), index=False, encoding="utf-8-sig")
if sd:
    t = pd.concat(sd, ignore_index=True); t["월"] = t["일자"].str[:7]; t.to_csv(os.path.join(OUT, "long_storeday.csv"), index=False, encoding="utf-8-sig")
    print("storeday rows", len(t), t["일자"].min(), t["일자"].max())
pd.DataFrame(log, columns=["일","상태","건수"]).to_csv(os.path.join(OUT, "parse_log.csv"), index=False, encoding="utf-8-sig")
print("sales rows", len(s), "qty", s["수량"].sum(), "days", s["일자"].nunique(), s["일자"].min(), "~", s["일자"].max())
print(s.groupby("월").agg(판매=("수량","sum"), 건수=("수량","size"), 일수=("일자","nunique"), 팀수=("팀","nunique")).to_string())
print([l for l in log if l[1] != "ok"][:20])
print("색상", s["색상"].value_counts().head(8).to_dict())
print("점포타입", s["점포타입"].value_counts().head(8).to_dict())
print("성별 결측률 by month", s.groupby("월")["성별"].apply(lambda x: x.isna().mean()).round(2).to_dict())
