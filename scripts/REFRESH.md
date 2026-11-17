# 자동 갱신 절차 (클라우드 에이전트용)

이 저장소의 공개 페이지(docs/)는 11월 이후 집계를 구글 시트에서 다시 계산해 갱신한다.
4~10월 장기 집계(export2.py, validate.py 결과)는 고정이며 다시 돌리지 않는다.

## 1. 시트 내려받기 → work/data/

구글 시트 연결 도구로 아래 범위를 읽어 JSON 파일로 저장한다. 모든 파일은 UTF-8.

| 파일 | 스프레드시트 ID | 탭 | 범위 | 형식 |
|---|---|---|---|---|
| work/data/sales.json | 1AzT7nN44RwiV4Tef_LgmwIFZw4EVVx1vClcVrBMvrEg | 11월 세일즈 제출 | A:T | `{"header":[첫 행 20칸], "rows":[[...], ...]}` |
| work/data/activity.json | 1TEwtOBraqADTaGB5pbEl4lou2IX00Mmf5g-GK-W6E6I | 활동이동로그 | A:V | `{"header":[첫 행 22칸], "rows":[[...], ...]}` |
| work/data/team_map.json | 1TEwtOBraqADTaGB5pbEl4lou2IX00Mmf5g-GK-W6E6I | 팀배정 | 전체 | 머리글 없이 `[[인력사, 구분, SV, 팀번호], ...]` 4칸 행 목록 |
| work/data/sv.json | 1TEwtOBraqADTaGB5pbEl4lou2IX00Mmf5g-GK-W6E6I | SV개입_기록 | A:M | `{"header":[첫 행], "rows":[[...], ...]}` |

- 시트 행이 많으면 여러 번 나눠 읽어 합친다. 빈 행은 그대로 둬도 된다(스크립트가 거른다).
- `rows`의 각 행은 문자열 배열이어야 한다. 날짜는 시트에 보이는 그대로("2026. 11. 3." 또는 "2026-11-03") 둔다.
- 팀배정 탭은 열 순서가 인력사·구분·수퍼바이저·팀번호인지 머리글로 확인하고, 머리글 행은 뺀다.
- 탭 이름이 바뀌었거나(예: 12월 세일즈 제출) 열 수가 다르면 **갱신을 중단**하고 사유를 보고한다.

## 2. 집계

```
pip install pandas openpyxl   # 없으면
python scripts/build.py
python scripts/export.py
python scripts/publish.py "YYYY-MM-DD HH:MM"   # 한국 시간, 시트를 읽은 시각
```

`publish.py`는 work/data/out/dash*/ 의 JSON을 docs/data/ 로 옮긴다. dash2/dash3 폴더가 없으면(클라우드에서는 없음) 기존 docs/data/ 의 장기 집계 파일은 그대로 남는다.

## 3. 확인과 반영

- `docs/data/summary.json`의 판매대수가 0이 아니고, 이전 커밋보다 줄지 않았는지 확인한다. 줄었으면 중단하고 보고한다.
- `git add docs/data && git commit -m "자료 갱신 YYYY-MM-DD" && git push`
- work/ 폴더는 .gitignore에 있어 커밋되지 않는다. 절대 work/ 를 커밋하지 않는다.
