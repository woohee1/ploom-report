// 구글 시트 → JSON 내보내기 (앱스 스크립트 웹 앱)
// 설치: 개편본 시트에서 확장 프로그램 > Apps Script 를 열고 이 코드를 붙여 넣은 뒤,
//   1) 프로젝트 설정 > 스크립트 속성에 KEY 라는 이름으로 긴 비밀번호를 저장
//   2) 배포 > 새 배포 > 유형 "웹 앱", 실행 계정 "나", 액세스 권한 "모든 사용자" 로 배포
//   3) 배포된 웹 앱 주소(…/exec)를 복사해 클라우드 환경 변수 PLOOM_SHEET_URL 에, KEY 값을 PLOOM_SHEET_KEY 에 등록
// 호출: GET <URL>?key=<KEY>[&sales=12월 세일즈 제출]

const SALES_ID = '1AzT7nN44RwiV4Tef_LgmwIFZw4EVVx1vClcVrBMvrEg'; // 통합본
const OPS_ID = '1TEwtOBraqADTaGB5pbEl4lou2IX00Mmf5g-GK-W6E6I';   // 개편본

function doGet(e) {
  const key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key || !e || !e.parameter || e.parameter.key !== key) {
    return ContentService.createTextOutput('forbidden').setMimeType(ContentService.MimeType.TEXT);
  }
  const sales = SpreadsheetApp.openById(SALES_ID);
  const ops = SpreadsheetApp.openById(OPS_ID);
  const salesTab = (e.parameter.sales || '11월 세일즈 제출');
  const out = {
    sales_tab: salesTab,
    sales: block(sales.getSheetByName(salesTab), 20),
    activity: block(ops.getSheetByName('활동이동로그'), 22),
    sv: block(ops.getSheetByName('SV개입_기록'), 13),
    team_map: teamMap(ops.getSheetByName('팀배정')),
    fetched_at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm')
  };
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// 머리글 1행 + 자료 행 (화면에 보이는 문자열 그대로)
function block(sh, cols) {
  if (!sh) return null;
  const n = sh.getLastRow();
  if (n < 1) return { header: [], rows: [] };
  const v = sh.getRange(1, 1, n, cols).getDisplayValues();
  const rows = v.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
  return { header: v[0], rows: rows };
}

// 팀배정: '인력사' 머리글 행 아래의 [인력사, 구분, 수퍼바이저, 팀번호]
function teamMap(sh) {
  if (!sh) return null;
  const v = sh.getDataRange().getDisplayValues();
  const hi = v.findIndex(r => String(r[0]).trim() === '인력사');
  if (hi < 0) return null;
  return v.slice(hi + 1).filter(r => r[0] && r[3]).map(r => [r[0], r[1], r[2], r[3]]);
}
