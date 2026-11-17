# 자동 갱신 절차 (클라우드 에이전트용)

이 저장소의 공개 페이지(docs/)는 11월 이후 집계를 구글 시트에서 다시 계산해 갱신한다.
4~10월 장기 집계(export2.py, validate.py 결과)는 고정이며 다시 돌리지 않는다.

## 1. 시트 내려받기

```
python scripts/fetch_sheets.py
```

- 환경 변수 `PLOOM_SHEET_URL`(앱스 스크립트 웹 앱 주소)과 `PLOOM_SHEET_KEY`로 시트 자료를 받아 `work/data/`에 sales.json, activity.json, sv.json, team_map.json을 만든다. 웹 앱 코드는 `scripts/sheet_api.gs`.
- 이 스크립트가 오류로 끝나면(환경 변수 없음, 키 불일치, 열 수 다름, 자료 비어 있음) **갱신을 중단**하고 출력된 사유를 그대로 보고한다. 구글 시트 연결 도구로 값을 손으로 옮겨 적지 않는다.
- 12월부터는 환경 변수 `PLOOM_SALES_TAB`에 새 탭 이름(예: `12월 세일즈 제출`)을 넣어야 한다.

## 2. 집계

```
pip install pandas openpyxl   # 없으면
python scripts/build.py
python scripts/export.py
python scripts/publish.py "$(cat work/data/fetched_at.txt)"
```

`publish.py`는 work/data/out/dash*/ 의 JSON을 docs/data/ 로 옮긴다. dash2/dash3 폴더가 없으면(클라우드에서는 없음) 기존 docs/data/ 의 장기 집계 파일은 그대로 남는다.

## 3. 확인과 반영

- `docs/data/summary.json`의 판매대수가 0이 아니고, 직전 커밋 값보다 줄지 않았는지 확인한다. 줄었으면 중단하고 보고한다.
- `git add docs/data && git commit -m "자료 갱신 YYYY-MM-DD" && git push`
- work/ 와 ref/ 는 커밋하지 않는다(work/는 .gitignore에 있음).
