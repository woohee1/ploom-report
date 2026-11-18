// 구글 시트 → JSON 내보내기 (앱스 스크립트 웹 앱)
// 설치: script.google.com 새 프로젝트에 이 코드를 붙여 넣고,
//   1) 프로젝트 설정 > 스크립트 속성에 KEY 라는 이름으로 비밀번호 저장
//      (선택) ADMIN_KEY 를 따로 두면 오늘 현황 화면은 그 비밀번호로만 열림. 없으면 KEY 를 같이 씀.
//   2) 배포 > 새 배포 > 유형 "웹 앱", 실행 계정 "나", 액세스 권한 "모든 사용자" 로 배포
//   3) 코드를 바꾼 뒤에는 배포 > 배포 관리 > 연필 > 버전 "새 버전" > 배포 (주소는 그대로 유지됨)
// 호출:
//   전체 자료 내려받기:  GET <URL>?key=<KEY>[&sales=12월 세일즈 제출][&ops_id=<다른 운영 시트 ID>][&sales_id=<다른 통합본 ID>]
//   오늘 현황 집계:      GET <URL>?view=today&key=<ADMIN_KEY 또는 KEY>[&date=2026-11-18]

const SALES_ID = '1AzT7nN44RwiV4Tef_LgmwIFZw4EVVx1vClcVrBMvrEg'; // 통합본
const OPS_ID = '1TEwtOBraqADTaGB5pbEl4lou2IX00Mmf5g-GK-W6E6I';   // 개편본
const TZ = 'Asia/Seoul';

function doGet(e) {
  const p = (e && e.parameter) || {};
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('KEY');
  const adminKey = props.getProperty('ADMIN_KEY') || key;
  if (p.view === 'today') {
    if (!adminKey || p.key !== adminKey) return text('forbidden');
    const ck = 'today_' + (p.date || 'today'), cache = CacheService.getScriptCache();
    const hit = cache.get(ck);
    if (hit) return text(hit).setMimeType(ContentService.MimeType.JSON);   // 90초 안에는 같은 결과
    const out = JSON.stringify(todayView(p.date));
    try { cache.put(ck, out, 90); } catch (e) {}
    return text(out).setMimeType(ContentService.MimeType.JSON);
  }
  if (!key || p.key !== key) return text('forbidden');
  const sales = SpreadsheetApp.openById(p.sales_id || SALES_ID);
  const ops = SpreadsheetApp.openById(p.ops_id || OPS_ID);   // ops_id 로 지난달 운영 시트도 읽을 수 있음
  const salesTab = (p.sales || '11월 세일즈 제출');
  return json({
    sales_tab: salesTab,
    sales: block(sales.getSheetByName(salesTab), 20),
    activity: block(ops.getSheetByName('활동이동로그'), 22),
    sv: block(ops.getSheetByName('SV개입_기록'), 13),
    team_map: teamMap(ops.getSheetByName('팀배정')),
    fetched_at: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm')
  });
}

function text(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// 머리글 1행 + 자료 행 (화면에 보이는 문자열 그대로). tail 을 주면 마지막 tail 행만 (오늘 현황은 최근 기록만 필요)
function block(sh, cols, tail) {
  if (!sh) return null;
  const n = sh.getLastRow();
  if (n < 1) return { header: [], rows: [] };
  const header = sh.getRange(1, 1, 1, cols).getDisplayValues()[0];
  const start = tail ? Math.max(2, n - tail + 1) : 2;
  if (n < start) return { header: header, rows: [] };
  const v = sh.getRange(start, 1, n - start + 1, cols).getDisplayValues();
  return { header: header, rows: v.filter(r => r.some(c => String(c).trim() !== '')) };
}

// 팀배정: '인력사' 머리글 행 아래의 [인력사, 구분, 수퍼바이저, 팀번호]
function teamMap(sh) {
  if (!sh) return null;
  const v = sh.getDataRange().getDisplayValues();
  const hi = v.findIndex(r => String(r[0]).trim() === '인력사');
  if (hi < 0) return null;
  return v.slice(hi + 1).filter(r => r[0] && r[3]).map(r => [r[0], r[1], r[2], r[3]]);
}

// "2026. 11. 3." / "2026. 11. 3" / "2026-11-03" → "2026-11-03"
function kdate(s) {
  s = String(s).trim();
  let m = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}
function hhmm(s) { s = String(s).trim(); const m = s.match(/^(\d{1,2}):(\d{2})/); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : s; }

// 하루치 집계: 팀별 현황, 시간대별 누적, 인력사별, SV 개입, 최근 판매 (원본 행은 내보내지 않음)
function todayView(date) {
  const now = new Date();
  const today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) date = today;
  const isToday = date === today;
  const nowHM = Utilities.formatDate(now, TZ, 'HH:mm');
  const month = parseInt(date.slice(5, 7), 10);

  const sales = SpreadsheetApp.openById(SALES_ID);
  const ops = SpreadsheetApp.openById(OPS_ID);
  const sTab = sales.getSheetByName(month + '월 세일즈 제출');
  const sb = sTab ? block(sTab, 20) : { rows: [] };
  const ab = block(ops.getSheetByName('활동이동로그'), 22, 2500) || { rows: [] };
  const vb = block(ops.getSheetByName('SV개입_기록'), 13, 500) || { rows: [] };
  const tm = teamMap(ops.getSheetByName('팀배정')) || [];

  const info = {};
  tm.forEach(r => { const t = parseInt(r[3], 10); if (t) info[t] = { agency: r[0], kind: r[1], sv: r[2] }; });
  const agencyOf = t => (info[t] && info[t].agency) || (t >= 911 ? '토마스컴퍼니' : t >= 901 ? '비욘드' : t >= 69 ? '비욘드' : t >= 31 ? '토마스컴퍼니' : '후킷');
  const teams = {};
  const T = t => teams[t] || (teams[t] = { 팀: t, 인력사: agencyOf(t), SV: (info[t] && info[t].sv) || '', 에이전트: '', 활동시작: '', 활동종료: '', 현재점포: '', 이동: 0, 판매: 0, 마지막기록: '', _last: '' });
  // 배정표의 낮 운영 팀은 기록이 없어도 표에 나오게 함 (야간 팀 제외)
  tm.forEach(r => { const t = parseInt(r[3], 10); if (t && t < 900 && !/야간/.test(r[1] || '')) T(t); });

  const byHour = new Array(24).fill(0), byAgency = {}, recent = [];
  let total = 0;
  sb.rows.forEach(r => {
    if (kdate(r[0]) !== date) return;
    const t = parseInt(r[2], 10); if (!t) return;
    const q = parseInt(r[9], 10) || 1, h = parseInt(r[1], 10);
    const o = T(t); o.판매 += q; total += q;
    if (!o.에이전트) { const a = String(r[2]).split('·')[1]; if (a) o.에이전트 = a.trim(); }
    if (h >= 0 && h < 24) byHour[h] += q;
    byAgency[o.인력사] = (byAgency[o.인력사] || 0) + q;
    recent.push({ 시간: hhmm(r[1]), 팀: t, 인력사: o.인력사, 점포: r[6], 수량: q, 색상: r[8] });
  });
  ab.rows.forEach(r => {
    if (kdate(r[1]) !== date) return;
    const t = parseInt(r[4], 10); if (!t) return;
    const o = T(t), time = hhmm(r[2]), kind = String(r[7]).trim();
    if (!o.에이전트 && r[5]) o.에이전트 = r[5];
    if (kind.indexOf('활동시작') >= 0 && (!o.활동시작 || time < o.활동시작)) o.활동시작 = time;
    if (kind.indexOf('활동종료') >= 0) o.활동종료 = time; else if (kind.indexOf('활동시작') >= 0 && time > o.활동종료) o.활동종료 = '';
    if (kind.indexOf('이동') >= 0 && kind !== '활동시작') o.이동++;
    if (time >= o._last) { o._last = time; o.마지막기록 = time + ' ' + kind; if (r[11]) o.현재점포 = r[11]; }
  });
  const svRows = vb.rows.filter(r => kdate(r[0]) === date).map(r => ({ 인력사: r[1], 팀: r[2], SV: r[3], 시간: hhmm(r[4]), 개입구분: r[12], 개입전: r[6], 개입후: r[7], 효과: r[10] }));

  const list = Object.values(teams).map(o => {
    let s = '정상';
    if (!o.활동시작 && o.판매 === 0) s = '활동 없음';
    else if (o.활동종료) s = '종료';
    else if (o.판매 === 0 && (!isToday || nowHM >= '12:00')) s = '미판매';
    o.상태 = s; delete o._last; return o;
  }).sort((a, b) => (a.인력사 < b.인력사 ? -1 : a.인력사 > b.인력사 ? 1 : a.팀 - b.팀));
  const hours = []; let acc = 0;
  for (let h = 8; h <= 20; h++) { acc += byHour[h]; hours.push({ 시간: h, 판매: byHour[h], 누적: acc }); }
  recent.sort((a, b) => (a.시간 < b.시간 ? 1 : a.시간 > b.시간 ? -1 : 0));
  return {
    date: date, as_of: Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm'), sales_tab: month + '월 세일즈 제출',
    summary: [{ 판매: total, 활동팀: list.filter(o => o.활동시작).length, 판매팀: list.filter(o => o.판매 > 0).length,
      미판매팀: list.filter(o => o.상태 === '미판매').length, 활동없음팀: list.filter(o => o.상태 === '활동 없음').length, SV개입: svRows.length }],
    hours: hours,
    agency: Object.keys(byAgency).map(k => ({ 인력사: k, 판매: byAgency[k] })).sort((a, b) => b.판매 - a.판매),
    teams: list, sv: svRows, recent: recent.slice(0, 15)
  };
}
