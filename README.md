# 플룸 현장 판매 분석 페이지

깃허브 페이지로 공개되는 정적 보고서입니다. `docs/` 폴더가 그대로 웹사이트가 됩니다.

- `docs/index.html` — 보고서 페이지 (d3로 그래프를 그림)
- `docs/data/*.json` — 집계 결과 (행만 담김). 페이지가 열릴 때 읽어 옵니다.
- `docs/data/updated.json` — 자료 기준 시각. 페이지 맨 위에 표시됩니다.
- `scripts/` — 집계 스크립트 (파이썬 3, 판다스, openpyxl)
- `work/` — 원본 시트 덤프와 중간 파일. **깃에 올리지 않습니다** (점포·에이전트 개인정보 포함).

## 갱신 순서

1. 구글 시트를 `work/data/sales.json`, `activity.json`, `team_map.json` 등으로 내려받습니다. 앱스 스크립트 웹 앱(`scripts/sheet_api.gs`)이 설치되어 있으면 `py -3 scripts/fetch_sheets.py`로 자동 내려받기가 됩니다(환경 변수 PLOOM_SHEET_URL, PLOOM_SHEET_KEY 필요). 매일 아침 8시 클라우드 예약 작업이 같은 절차(`scripts/REFRESH.md`)를 돌립니다.
2. 집계를 돌립니다.
   ```
   py -3 scripts/build.py        # 11월 시트 → 중간 CSV
   py -3 scripts/export.py       # 11월 상세 집계
   py -3 scripts/export_rows.py  # 탐색용 건 단위 자료 (필터·팀 상세·점포 상세)
   py -3 scripts/export2.py      # 4월~ 장기 집계 (폼즈 자료 필요)
   py -3 scripts/validate.py     # 추천 목록 검증
   py -3 scripts/publish.py "2026-11-18 08:00"
   ```
3. 커밋하고 올리면 몇 분 안에 페이지가 바뀝니다.
   ```
   git add docs/data; git commit -m "자료 갱신"; git push
   ```

과거분(4~10월)은 바뀌지 않으므로 평소에는 1·2단계 중 11월 부분(build, export, publish)만 돌리면 됩니다.
