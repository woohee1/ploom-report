// ===== 탐색 엔진: 건 단위 자료 + 공통 필터 + 팀·점포 상세 =====
(() => {
  const $ = id => document.getElementById(id);
  const X = { rows: [], td: [], act: [], ready: false, orig: {}, computed: new Set(), firstMonth: {}, extra: [] };
  window.X = X;
  const AG = ['토마스컴퍼니', '비욘드', '후킷'];
  const WD = ['월', '화', '수', '목', '금', '토', '일'];
  const mon = d => parseInt(d.slice(5, 7), 10) + '월';
  const wday = d => WD[(new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7];
  const r2 = v => Math.round(v * 100) / 100;
  const sum = (arr, f) => arr.reduce((a, r) => a + (+f(r) || 0), 0);
  const uniq = (arr, f) => new Set(arr.map(f)).size;
  const group = (arr, keyf) => { const m = new Map(); arr.forEach(r => { const k = keyf(r); let g = m.get(k); if (!g) m.set(k, g = []); g.push(r); }); return m; };
  const byMonth = (a, b) => parseInt(a) - parseInt(b);

  function decode(j) {
    const cols = j.cols, dict = j.dict || {};
    return j.rows.map(a => { const o = {}; cols.forEach((c, i) => { let v = a[i]; if (dict[c] && v != null) v = dict[c][v]; o[c] = v; }); return o; });
  }
  async function loadAll() {
    const v = Date.now();
    const idx = await (await fetch('data/rows_index.json?v=' + v)).json();
    const parts = await Promise.all(idx.files.map(f => fetch('data/' + f + '?v=' + v).then(r => r.json()).then(decode)));
    X.rows = [].concat(...parts);
    X.rows.forEach(r => { r.월 = mon(r.일자); r.요일 = wday(r.일자); r.팀일 = r.일자 + '_' + r.팀; });
    X.sheetMonths = idx.sheet_months || [];
    try { X.td = decode(await (await fetch('data/team_day.json?v=' + v)).json()); X.td.forEach(r => { r.월 = mon(r.일자); }); } catch (e) { X.td = []; }
    try { X.act = decode(await (await fetch('data/activity.json?v=' + v)).json()); } catch (e) { X.act = []; }
    const svMap = {}; X.td.forEach(r => { if (r.SV) svMap[r.팀] = r.SV; }); X.act.forEach(r => { r.SV = svMap[r.팀] || ''; });
    // 점포별 첫 판매 달 (전체 자료 기준)
    X.rows.forEach(r => { if (r.점포코드 && (!X.firstMonth[r.점포코드] || r.일자 < X.firstMonth[r.점포코드])) X.firstMonth[r.점포코드] = r.일자; });
    X.ready = true;
  }

  // ---------- 필터 ----------
  const F = { from: '', to: '', agency: '', sv: '', team: '', brand: '', kind: '', wd: '' };
  X.F = F; X.active = () => active(); X.filtered = () => filtered(); X.wday = wday; X.mon = mon;
  const active = () => Object.values(F).some(v => v);
  const dateOnly = () => !!(F.from || F.to);
  function match(r) {
    if (F.from && r.일자 < F.from) return false;
    if (F.to && r.일자 > F.to) return false;
    if (F.agency && r.인력사 !== F.agency) return false;
    if (F.sv && r.SV !== F.sv) return false;
    if (F.team && +r.팀 !== +F.team) return false;
    if (F.wd && r.요일 !== F.wd) return false;
    return true;
  }
  const matchS = r => match(r) && (!F.brand || r.브랜드 === F.brand) && (!F.kind || r.구분 === F.kind);
  function filtered() {
    const R = X.rows.filter(matchS);
    const TD = X.td.filter(r => match(Object.assign({ 요일: wday(r.일자) }, r)));
    const AC = X.act.filter(r => match(Object.assign({ 요일: wday(r.일자) }, r)));
    // 시트 달(11월 상세 등) 범위: 날짜 필터가 없으면 시트에 있는 달만
    const inSheet = r => X.sheetMonths.includes(r.일자.slice(0, 7));
    const Rn = dateOnly() ? R : R.filter(inSheet), TDn = dateOnly() ? TD : TD.filter(inSheet), ACn = dateOnly() ? AC : AC.filter(inSheet);
    return { R, TD, AC, Rn, TDn, ACn };
  }

  // ---------- 집계 ----------
  function tdStats(td, salesRows) {
    // 활동 기록이 있으면 팀·일 기준, 없으면 판매 팀·일 기준
    if (td.length) { const z = td.filter(r => +r.판매 === 0).length; return { 활동팀일: td.length, 미판매팀일: z, 미판매율: r2(z / td.length * 100), 팀일평균: r2(sum(td, r => r.판매) / td.length), 평균활동시간: r2(sum(td.filter(r => r.활동시간 != null), r => r.활동시간) / Math.max(1, td.filter(r => r.활동시간 != null).length)) }; }
    const n = uniq(salesRows, r => r.팀일); return { 활동팀일: n, 미판매팀일: null, 미판매율: null, 팀일평균: n ? r2(sum(salesRows, r => r.수량) / n) : null, 평균활동시간: null };
  }
  function compute() {
    const { R, TD, AC, Rn, TDn, ACn } = filtered();
    const out = {};
    const allMonths = [...new Set(R.map(r => r.월))].sort(byMonth);
    // 장기
    out.summary_all = Object.assign({}, X.orig.summary_all && X.orig.summary_all[0], { 총판매: sum(R, r => r.수량), 운영일수: uniq(R, r => r.일자), 제출건수: R.length, 기간시작: R.length ? R.map(r => r.일자).reduce((a, b) => a < b ? a : b) : '', 기간끝: R.length ? R.map(r => r.일자).reduce((a, b) => a > b ? a : b) : '', 팀일당전체: r2(sum(R, r => r.수량) / Math.max(1, uniq(R, r => r.팀일))) });
    out.summary_all = [out.summary_all];
    out.monthly = allMonths.map(m => {
      const g = R.filter(r => r.월 === m), q = sum(g, r => r.수량), tj = uniq(g, r => r.팀일), st = uniq(g, r => r.점포코드), days = uniq(g, r => r.일자);
      const o = { 월: m, 판매: q, 운영일수: days, 판매팀수: uniq(g, r => r.팀), 판매팀일: tj, 점포수: st, 스타벅스: sum(g, r => r.스타벅스), 일평균: r2(q / Math.max(1, days)), 팀일당: r2(q / Math.max(1, tj)), 점포당: r2(q / Math.max(1, st)), 스타벅스건당: r2(sum(g, r => r.스타벅스) / Math.max(1, q)) };
      AG.forEach(a => { const h = g.filter(r => r.인력사 === a); o[a] = sum(h, r => r.수량); o[a + '_팀일당'] = r2(o[a] / Math.max(1, uniq(h, r => r.팀일))); });
      o.신규점포비중 = r2(sum(g.filter(r => r.점포코드 && X.firstMonth[r.점포코드] && X.firstMonth[r.점포코드].slice(0, 7) === r.일자.slice(0, 7)), r => r.수량) / Math.max(1, q) * 100);
      o.흡연구역비중 = r2(sum(g.filter(r => r.구분 === '흡연구역'), r => r.수량) / Math.max(1, q) * 100);
      o.쿠폰경로비중 = r2(sum(g.filter(r => String(r.경로 || '').startsWith('CVS')), r => r.수량) / Math.max(1, q) * 100);
      o.회원가입완료율 = r2(g.filter(r => r.회원가입 === 1).length / Math.max(1, g.length) * 100);
      o.카카오완료율 = r2(g.filter(r => r.카카오 === 1).length / Math.max(1, g.length) * 100);
      const rf = g.filter(r => r.리필구매 != null); o.리필동반율 = rf.length ? r2(rf.filter(r => r.리필구매 === 1).length / rf.length * 100) : null;
      const gs = g.filter(r => r.성별); o.여성비중 = gs.length ? r2(sum(gs.filter(r => r.성별 === '여자'), r => r.수량) / Math.max(1, sum(gs, r => r.수량)) * 100) : null;
      const ga = g.filter(r => r.연령대); o['20대비중'] = ga.length ? r2(sum(ga.filter(r => r.연령대 === '20대'), r => r.수량) / Math.max(1, sum(ga, r => r.수량)) * 100) : null;
      return o;
    });
    out.monthly_agency = []; allMonths.forEach(m => AG.forEach(a => { const g = R.filter(r => r.월 === m && r.인력사 === a); if (!g.length) return; const tj = uniq(g, r => r.팀일); out.monthly_agency.push({ 월: m, 인력사: a, 판매: sum(g, r => r.수량), 팀일: tj, 팀수: uniq(g, r => r.팀), 팀일당: r2(sum(g, r => r.수량) / tj) }); }));
    out.daily_all = [...group(R, r => r.일자)].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([d, g]) => ({ 일자: d, 판매: sum(g, r => r.수량), 판매팀수: uniq(g, r => r.팀), 팀당: r2(sum(g, r => r.수량) / uniq(g, r => r.팀)) }));
    out.weekday = WD.map(w => { const g = R.filter(r => r.요일 === w); const d = uniq(g, r => r.일자); return d ? { 요일: w, 판매: sum(g, r => r.수량), 일수: d, 일평균: r2(sum(g, r => r.수량) / d) } : null; }).filter(Boolean);
    const share = (key, name) => { const o = []; allMonths.forEach(m => { const g = R.filter(r => r.월 === m), q = sum(g, r => r.수량); [...group(g.filter(r => r[key]), r => r[key])].forEach(([k, h]) => o.push({ 월: m, [name]: k, 판매: sum(h, r => r.수량), 비중: r2(sum(h, r => r.수량) / Math.max(1, q) * 100) })); }); return o; };
    out.color_month = share('색상', '색상'); out.brand_month = share('브랜드', '브랜드');
    const storeAgg = rows => [...group(rows.filter(r => r.점포코드), r => r.점포코드)].map(([k, g]) => ({ 점포코드: k, 점포명: g[0].점포명, 브랜드: g[0].브랜드, 구분: g[0].구분, 시군구: g[0].시군구, 판매: sum(g, r => r.수량), 판매일수: uniq(g, r => r.일자), 팀수: uniq(g, r => r.팀), 첫달: X.firstMonth[k] ? mon(X.firstMonth[k]) : '', 일당: r2(sum(g, r => r.수량) / uniq(g, r => r.일자)) }));
    const SA = storeAgg(R).sort((a, b) => b.판매 - a.판매);
    out.top_stores_all = SA.slice(0, 20);
    if (SA.length) { const tot = sum(SA, r => r.판매), top = SA.slice(0, Math.max(1, Math.ceil(SA.length * 0.1))); const days = SA.map(r => r.판매일수).sort((a, b) => a - b); out.store_concentration = [{ 점포수: SA.length, 상위10퍼센트점포판매비중: r2(sum(top, r => r.판매) / tot * 100), 한번만판매점포비중: r2(SA.filter(r => r.판매일수 === 1).length / SA.length * 100), 중앙값판매일수: days[Math.floor(days.length / 2)] }]; }
    const visitDepth = rows => { const sd = [...group(rows.filter(r => r.점포코드), r => r.점포코드 + '|' + r.일자)].map(([k, g]) => ({ 점포코드: g[0].점포코드, 일자: g[0].일자, 판매: sum(g, r => r.수량) })); const per = group(sd, r => r.점포코드); const b = {}; per.forEach(list => { list.sort((a, c) => a.일자 < c.일자 ? -1 : 1).forEach((r, i) => { const n = i + 1; (b[n] = b[n] || []).push(r.판매); }); }); return b; };
    const vd = visitDepth(R); out.visit_depth_all = []; for (let n = 1; n <= 7; n++) { let v = vd[n] || []; if (n === 7) { v = []; Object.keys(vd).forEach(k => { if (+k >= 7) v = v.concat(vd[k]); }); } if (v.length) out.visit_depth_all.push({ 구간: n === 7 ? '7회차 이상' : n + '회차', 점포일: v.length, 일평균: r2(v.reduce((a, c) => a + c, 0) / v.length) }); }
    // 시트 달(11월 상세·한눈에 보기 11월 항목)
    const q = sum(Rn, r => r.수량), ts = tdStats(TDn, Rn);
    const rf = Rn.filter(r => r.리필구매 != null);
    const dn = Rn.map(r => r.일자).sort();
    out.summary = [{ 기간시작: dn[0] || '', 기간끝: dn[dn.length - 1] || '', 판매대수: q, 제출건수: Rn.length, 운영일수: uniq(Rn, r => r.일자), 판매팀수: uniq(Rn, r => r.팀), 활동팀일: ts.활동팀일, 미판매팀일: ts.미판매팀일, 미판매율: ts.미판매율, 팀일평균: ts.팀일평균, 판매점포수: uniq(Rn.filter(r => r.점포코드), r => r.점포코드), 스타벅스: sum(Rn, r => r.스타벅스), 리필스틱동반율: rf.length ? r2(rf.filter(r => r.리필구매 === 1).length / rf.length * 100) : null }];
    out.daily = [...group(Rn, r => r.일자)].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([d, g]) => { const td = TDn.filter(r => r.일자 === d); const o = { 일자: d, 요일: g[0].요일, 판매: sum(g, r => r.수량), 건수: g.length, 판매팀수: uniq(g, r => r.팀), 활동팀일: td.length || uniq(g, r => r.팀) }; AG.forEach(a => o[a] = sum(g.filter(r => r.인력사 === a), r => r.수량)); o.팀일평균 = r2(o.판매 / Math.max(1, o.활동팀일)); return o; });
    out.agency = AG.map(a => { const g = Rn.filter(r => r.인력사 === a), td = TDn.filter(r => r.인력사 === a); if (!g.length && !td.length) return null; const s = tdStats(td, g); return Object.assign({ 인력사: a, 판매: td.length ? sum(td, r => r.판매) : sum(g, r => r.수량), 팀수: uniq(g, r => r.팀) }, s); }).filter(Boolean).sort((a, b) => b.판매 - a.판매);
    if (TDn.length) out.sv = [...group(TDn.filter(r => r.SV), r => r.인력사 + '|' + r.SV)].map(([k, td]) => { const s = tdStats(td, []); return Object.assign({ 인력사: td[0].인력사, SV: td[0].SV, 판매: sum(td, r => r.판매), 팀수: uniq(td, r => r.팀) }, s); }).sort((a, b) => b.팀일평균 - a.팀일평균);
    out.teams = [...group(TDn.length ? TDn : Rn, r => r.팀)].map(([t, g]) => TDn.length ? { 인력사: g[0].인력사, 팀: +t, SV: g[0].SV || '미배정', 활동일수: g.length, 판매: sum(g, r => r.판매), 팀일평균: r2(sum(g, r => r.판매) / g.length), 평균활동시간: tdStats(g, []).평균활동시간, 이동횟수: sum(g, r => r.이동) } : { 인력사: g[0].인력사, 팀: +t, SV: g[0].SV || '', 활동일수: uniq(g, r => r.일자), 판매: sum(g, r => r.수량), 팀일평균: r2(sum(g, r => r.수량) / uniq(g, r => r.일자)), 평균활동시간: null, 이동횟수: null }).sort((a, b) => b.팀일평균 - a.팀일평균);
    out.hourly = []; for (let h = 9; h <= 19; h++) out.hourly.push({ 시간: h, 판매: sum(Rn.filter(r => +r.시 === h), r => r.수량) });
    out.store_type = [...group(Rn.filter(r => r.구분 && r.브랜드), r => r.구분 + '|' + r.브랜드)].map(([k, g]) => ({ 구분: g[0].구분, 브랜드: g[0].브랜드, 판매: sum(g, r => r.수량), 점포수: uniq(g, r => r.점포코드), 팀일: g.length, 점포당판매: r2(sum(g, r => r.수량) / uniq(g, r => r.점포코드)) })).sort((a, b) => b.판매 - a.판매);
    out.region = [...group(Rn.filter(r => r.시군구), r => (r.시도 || '') + '|' + r.시군구)].map(([k, g]) => ({ 시도: g[0].시도 || '', 시군구: g[0].시군구, 판매: sum(g, r => r.수량), 점포수: uniq(g, r => r.점포코드), 점포당판매: r2(sum(g, r => r.수량) / uniq(g, r => r.점포코드)) })).sort((a, b) => b.판매 - a.판매).slice(0, 15);
    out.customer = [...group(Rn.filter(r => r.연령대 && r.성별), r => r.연령대 + '|' + r.성별)].map(([k, g]) => ({ 연령대: g[0].연령대, 성별: g[0].성별, 판매: sum(g, r => r.수량) })).sort((a, b) => a.연령대 < b.연령대 ? -1 : a.연령대 > b.연령대 ? 1 : a.성별 < b.성별 ? -1 : 1);
    const top = (rows, key, name, n) => [...group(rows.filter(r => r[key]), r => r[key])].map(([k, g]) => ({ [name]: k, 판매: sum(g, r => r.수량) })).sort((a, b) => b.판매 - a.판매).slice(0, n || 99);
    out.color = top(Rn, '색상', '색상'); out.product = top(Rn, '사용제품', '사용제품'); out.stick = top(Rn, '스틱', '스틱', 8);
    out.top_stores = storeAgg(Rn).sort((a, b) => b.판매 - a.판매).slice(0, 15);
    const vn = visitDepth(Rn); out.revisit = []; for (let n = 1; n <= 5; n++) if (vn[n]) out.revisit.push({ 방문차수: n, 점포일: vn[n].length, 일평균: r2(vn[n].reduce((a, c) => a + c, 0) / vn[n].length) });
    if (TDn.length) {
      const bucket = (rows, f, labels, item) => labels.map(([lab, test]) => { const g = rows.filter(r => test(f(r))); return g.length ? { 항목: item, 구간: lab, 팀일: g.length, 팀일평균: r2(sum(g, r => r.판매) / g.length) } : null; }).filter(Boolean);
      out.ops = bucket(TDn, r => +r.이동, [['이동 없음', v => v === 0], ['1회 이동', v => v === 1], ['2회 이상', v => v >= 2]], '점포 이동').concat(bucket(TDn.filter(r => r.활동시간 != null), r => +r.활동시간, [['6시간 미만', v => v < 6], ['6~7시간', v => v >= 6 && v < 7], ['7~8시간', v => v >= 7 && v < 8], ['8시간 이상', v => v >= 8]], '활동 시간'));
      out.zero_teams = [...group(TDn, r => r.인력사 + '|' + r.팀)].map(([k, g]) => ({ 인력사: g[0].인력사, 팀: +g[0].팀, 활동일수: g.length, 판매: sum(g, r => r.판매) })).filter(r => r.활동일수 >= 4 && r.판매 === 0).sort((a, b) => a.인력사 < b.인력사 ? -1 : a.인력사 > b.인력사 ? 1 : a.팀 - b.팀);
    }
    if (ACn.length) out.move_reason = [...group(ACn.filter(r => r.기록 === '점포이동'), r => r.이동사유 || '미기재')].map(([k, g]) => ({ 사유: k, 건수: g.length })).sort((a, b) => b.건수 - a.건수).slice(0, 8);
    return out;
  }

  function apply() {
    if (!X.ready) return;
    const ids = Object.keys(X.orig);
    if (!active()) { ids.forEach(id => dash.set(id, X.orig[id])); X.computed = new Set(); }
    else { const out = compute(); X.computed = new Set(Object.keys(out)); Object.entries(out).forEach(([id, rows]) => dash.set(id, rows)); ids.forEach(id => { if (!(id in out)) dash.set(id, X.orig[id]); }); }
    const fr = filtered(); X.extra.forEach(fn => { try { fn(fr); } catch (e) { console.error('추가 집계', e); } });
    markStatic(); renderChips(); dash.render();
    if (detail) showDetail(location.hash);
  }
  function snapshot() { ['summary_all', 'monthly', 'monthly_agency', 'daily_all', 'weekday', 'color_month', 'brand_month', 'top_stores_all', 'store_concentration', 'visit_depth_all', 'summary', 'daily', 'agency', 'sv', 'teams', 'hourly', 'store_type', 'region', 'customer', 'color', 'product', 'stick', 'top_stores', 'revisit', 'ops', 'zero_teams', 'move_reason'].forEach(id => { const d = dash.data(id); if (d.status === 'ok') X.orig[id] = d.data; }); }
  function markStatic() {
    document.querySelectorAll('.pl .card').forEach(card => {
      const srcs = [...card.querySelectorAll('[data-source]')].map(e => e.dataset.source).filter(s => !s.startsWith('live_') && !s.startsWith('x_'));
      const isStatic = active() && srcs.length && srcs.every(s => !X.computed.has(s));
      card.classList.toggle('nofilter', !!isStatic);
    });
  }

  // ---------- 필터 줄 ----------
  function buildBar() {
    const bar = document.createElement('div'); bar.className = 'xbar'; bar.id = 'xbar';
    bar.innerHTML = `
      <label>기간 <select id="xf-preset"><option value="">전체</option><option value="month">이번 달</option><option value="prev">지난 달</option><option value="30">최근 30일</option><option value="7">최근 7일</option><option value="custom">직접 지정</option></select></label>
      <span class="xf-dates" id="xf-dates" hidden><input type="date" id="xf-from"> ~ <input type="date" id="xf-to"></span>
      <label>인력사 <select id="xf-agency"><option value="">전체</option>${AG.map(a => `<option>${a}</option>`).join('')}</select></label>
      <label>SV <select id="xf-sv"><option value="">전체</option></select></label>
      <label>팀 <input type="number" id="xf-team" min="1" placeholder="번호" style="width:72px"></label>
      <label>브랜드 <select id="xf-brand"><option value="">전체</option></select></label>
      <label>구분 <select id="xf-kind"><option value="">전체</option></select></label>
      <label>요일 <select id="xf-wd"><option value="">전체</option>${WD.map(w => `<option>${w}</option>`).join('')}</select></label>
      <button type="button" class="link" id="xf-reset">초기화</button>
      <span class="xf-chips" id="xf-chips"></span>`;
    const head = document.querySelector('main.pl .head'); head.insertAdjacentElement('afterend', bar);
    const opt = (sel, vals) => vals.forEach(v => { const o = document.createElement('option'); o.textContent = v; sel.appendChild(o); });
    opt($('xf-sv'), [...new Set(X.td.map(r => r.SV).concat(X.rows.map(r => r.SV)).filter(Boolean))].sort());
    opt($('xf-brand'), [...new Set(X.rows.map(r => r.브랜드).filter(Boolean))].sort());
    opt($('xf-kind'), [...new Set(X.rows.map(r => r.구분).filter(Boolean))].sort());
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const dstr = d => d.toISOString().slice(0, 10);
    $('xf-preset').addEventListener('change', () => {
      const p = $('xf-preset').value; $('xf-dates').hidden = p !== 'custom';
      const t = new Date(today + 'T00:00:00Z');
      if (p === 'month') { F.from = today.slice(0, 8) + '01'; F.to = today; }
      else if (p === 'prev') { const a = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)), b = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0)); F.from = dstr(a); F.to = dstr(b); }
      else if (p === '30' || p === '7') { const a = new Date(t.getTime() - (+p - 1) * 86400e3); F.from = dstr(a); F.to = today; }
      else if (p === 'custom') { F.from = $('xf-from').value; F.to = $('xf-to').value; }
      else { F.from = ''; F.to = ''; }
      $('xf-from').value = F.from; $('xf-to').value = F.to; apply();
    });
    ['xf-from', 'xf-to'].forEach(id => $(id).addEventListener('change', () => { F.from = $('xf-from').value; F.to = $('xf-to').value; apply(); }));
    const bind = (id, key) => $(id).addEventListener('change', () => { F[key] = $(id).value; apply(); });
    bind('xf-agency', 'agency'); bind('xf-sv', 'sv'); bind('xf-team', 'team'); bind('xf-brand', 'brand'); bind('xf-kind', 'kind'); bind('xf-wd', 'wd');
    $('xf-reset').addEventListener('click', () => { Object.keys(F).forEach(k => F[k] = ''); ['xf-preset', 'xf-agency', 'xf-sv', 'xf-team', 'xf-brand', 'xf-kind', 'xf-wd', 'xf-from', 'xf-to'].forEach(id => $(id).value = ''); $('xf-dates').hidden = true; apply(); });
  }
  function renderChips() {
    const c = $('xf-chips'); if (!c) return; c.replaceChildren();
    if (!active()) { c.textContent = ''; return; }
    const parts = [];
    if (F.from || F.to) parts.push((F.from || '처음') + ' ~ ' + (F.to || '끝'));
    if (F.agency) parts.push(F.agency); if (F.sv) parts.push('SV ' + F.sv); if (F.team) parts.push(F.team + '팀'); if (F.brand) parts.push(F.brand); if (F.kind) parts.push(F.kind); if (F.wd) parts.push(F.wd + '요일');
    const { R } = filtered();
    const s = document.createElement('span'); s.className = 'pill ok'; s.textContent = '필터 적용: ' + parts.join(' · ') + ' · 판매 ' + sum(R, r => r.수량).toLocaleString() + '대'; c.appendChild(s);
  }
  function barVisible() { const b = $('xbar'); if (!b) return; const p = document.querySelector('.pl .panel:not([hidden])'); b.hidden = !p || p.id === 'p-today' || p.id === 'p-actions'; }

  // ---------- 상세 화면 ----------
  let detail = null;
  function buildDetailPanels() {
    const main = document.querySelector('main.pl');
    const team = document.createElement('div'); team.className = 'panel'; team.id = 'p-team'; team.hidden = true;
    team.innerHTML = `
      <p><a href="#" class="back" id="team-back">← 돌아가기</a></p>
      <div class="hero"><div class="hero-top"><b id="team-title">팀</b><span id="team-sub"></span></div>
        <div class="hero-stats">
          <div><div class="k">판매</div><div class="v"><span data-draw="num" data-source="x_team_sum" data-field="판매" data-row="0">—</span><span class="u">대</span></div></div>
          <div><div class="k">활동 일수</div><div class="v"><span data-draw="num" data-source="x_team_sum" data-field="활동일수" data-row="0">—</span><span class="u">일</span></div></div>
          <div><div class="k">하루 평균</div><div class="v"><span data-draw="num" data-source="x_team_sum" data-field="일평균" data-row="0" data-fmt=".2f">—</span><span class="u">대</span></div></div>
          <div><div class="k">미판매 일</div><div class="v"><span data-draw="num" data-source="x_team_sum" data-field="미판매일" data-row="0">—</span><span class="u">일</span></div></div>
          <div><div class="k">판매 점포</div><div class="v"><span data-draw="num" data-source="x_team_sum" data-field="판매점포수" data-row="0">—</span><span class="u">곳</span></div></div>
          <div><div class="k">점포 이동</div><div class="v"><span data-draw="num" data-source="x_team_sum" data-field="이동" data-row="0">—</span><span class="u">회</span></div></div>
          <div><div class="k">평균 활동 시간</div><div class="v"><span data-draw="num" data-source="x_team_sum" data-field="평균활동시간" data-row="0" data-fmt=".1f">—</span><span class="u">시간</span></div></div>
        </div></div>
      <div class="grid3">
        <div class="card"><h3>일자별 판매 (대)</h3><div class="chart" data-draw="line" data-source="x_team_daily" data-x="일자" data-y="판매" data-xfmt="date"></div></div>
        <div class="card"><h3>시간대별 판매 (대)</h3><div class="chart" data-draw="vbar" data-source="x_team_hourly" data-x="시간" data-y="판매"></div></div>
        <div class="card"><h3>색상별 판매</h3><div class="donut" data-draw="donut" data-source="x_team_color" data-label="색상" data-value="판매"></div></div>
      </div>
      <div class="live-grid" style="margin-top:var(--cds-gap-md)">
        <div class="live-main">
          <div class="card"><h3>활동 일지 (활동 기록이 있는 달)</h3><div class="tw"><table data-source="x_team_days" data-row-key="일자"><thead><tr><th data-field="일자">일자</th><th data-field="요일">요일</th><th data-field="활동시작">시작</th><th data-field="활동종료">종료</th><th class="n" data-field="활동시간">활동 시간</th><th data-field="시작점포">시작 점포</th><th class="n" data-field="방문점포">방문 점포</th><th class="n" data-field="이동">이동</th><th class="n" data-field="판매">판매</th></tr></thead>
            <tbody data-draw="tbl" data-cols="일자,요일,활동시작,활동종료,활동시간,시작점포,방문점포,이동,판매" data-fmts=",,,,.1f,,,,"></tbody></table></div></div>
          <div class="card"><h3>점포별 판매</h3><div class="tw"><table data-source="x_team_stores" data-row-key="점포코드"><thead><tr><th data-field="점포명">점포</th><th data-field="브랜드">브랜드</th><th data-field="구분">구분</th><th data-field="시군구">지역</th><th class="n" data-field="판매">판매</th><th class="n" data-field="판매일수">판매일</th><th class="n" data-field="일당">일당</th></tr></thead>
            <tbody data-draw="tbl" data-cols="점포명,브랜드,구분,시군구,판매,판매일수,일당" data-fmts=",,,,,,.2f"></tbody></table></div></div>
        </div>
        <div class="live-side">
          <div class="card"><h3>구매자 연령대 × 성별</h3><div class="tw"><table data-source="x_team_customer"><thead><tr><th data-field="연령대">연령대</th><th data-field="성별">성별</th><th class="n" data-field="판매">판매</th></tr></thead><tbody data-draw="tbl" data-cols="연령대,성별,판매" data-fmts=",,"></tbody></table></div></div>
          <div class="card"><h3>부가 지표</h3><div class="tw"><table data-source="x_team_extra"><thead><tr><th data-field="항목">항목</th><th class="n" data-field="값">값</th></tr></thead><tbody data-draw="tbl" data-cols="항목,값" data-fmts=","></tbody></table></div></div>
        </div>
      </div>`;
    const store = document.createElement('div'); store.className = 'panel'; store.id = 'p-store'; store.hidden = true;
    store.innerHTML = `
      <p><a href="#" class="back" id="store-back">← 돌아가기</a></p>
      <div class="hero"><div class="hero-top"><b id="store-title">점포</b><span id="store-sub"></span></div>
        <div class="hero-stats">
          <div><div class="k">판매</div><div class="v"><span data-draw="num" data-source="x_store_sum" data-field="판매" data-row="0">—</span><span class="u">대</span></div></div>
          <div><div class="k">판매 일수</div><div class="v"><span data-draw="num" data-source="x_store_sum" data-field="판매일수" data-row="0">—</span><span class="u">일</span></div></div>
          <div><div class="k">하루 평균</div><div class="v"><span data-draw="num" data-source="x_store_sum" data-field="일당" data-row="0" data-fmt=".2f">—</span><span class="u">대</span></div></div>
          <div><div class="k">다녀간 팀</div><div class="v"><span data-draw="num" data-source="x_store_sum" data-field="팀수" data-row="0">—</span><span class="u">팀</span></div></div>
          <div><div class="k">첫 판매</div><div class="v sm"><span data-draw="txt" data-source="x_store_sum" data-field="첫판매" data-row="0">—</span></div></div>
          <div><div class="k">마지막 판매</div><div class="v sm"><span data-draw="txt" data-source="x_store_sum" data-field="마지막판매" data-row="0">—</span></div></div>
        </div></div>
      <div class="grid3">
        <div class="card"><h3>일자별 판매 (대)</h3><div class="chart" data-draw="line" data-source="x_store_daily" data-x="일자" data-y="판매" data-xfmt="date"></div></div>
        <div class="card"><h3>시간대별 판매 (대)</h3><div class="chart" data-draw="vbar" data-source="x_store_hourly" data-x="시간" data-y="판매"></div></div>
        <div class="card"><h3>색상별 판매</h3><div class="donut" data-draw="donut" data-source="x_store_color" data-label="색상" data-value="판매"></div></div>
      </div>
      <div class="live-grid" style="margin-top:var(--cds-gap-md)">
        <div class="live-main">
          <div class="card"><h3>팀별 판매</h3><div class="tw"><table data-source="x_store_teams" data-row-key="팀"><thead><tr><th class="n" data-field="팀">팀</th><th data-field="인력사">인력사</th><th data-field="SV">SV</th><th class="n" data-field="판매">판매</th><th class="n" data-field="판매일수">판매일</th><th data-field="첫판매">첫 판매</th><th data-field="마지막판매">마지막 판매</th></tr></thead>
            <tbody data-draw="tbl" data-cols="팀,인력사,SV,판매,판매일수,첫판매,마지막판매" data-fmts="d,,,,,,"></tbody></table></div></div>
          <div class="card"><h3>방문·이동 기록 (활동 기록이 있는 달)</h3><div class="tw"><table data-source="x_store_visits"><thead><tr><th data-field="일자">일자</th><th data-field="시각">시각</th><th class="n" data-field="팀">팀</th><th data-field="기록">기록</th><th data-field="이동사유">이동 사유</th><th class="n" data-field="구간판매">구간 판매</th></tr></thead>
            <tbody data-draw="tbl" data-cols="일자,시각,팀,기록,이동사유,구간판매" data-fmts=",,d,,,"></tbody></table></div></div>
        </div>
        <div class="live-side">
          <div class="card"><h3>구매자 연령대 × 성별</h3><div class="tw"><table data-source="x_store_customer"><thead><tr><th data-field="연령대">연령대</th><th data-field="성별">성별</th><th class="n" data-field="판매">판매</th></tr></thead><tbody data-draw="tbl" data-cols="연령대,성별,판매" data-fmts=",,"></tbody></table></div></div>
          <div class="card"><h3>부가 지표</h3><div class="tw"><table data-source="x_store_extra"><thead><tr><th data-field="항목">항목</th><th class="n" data-field="값">값</th></tr></thead><tbody data-draw="tbl" data-cols="항목,값" data-fmts=","></tbody></table></div></div>
        </div>
      </div>`;
    main.appendChild(team); main.appendChild(store);
    $('team-back').addEventListener('click', e => { e.preventDefault(); history.length > 1 ? history.back() : (location.hash = '#overview'); });
    $('store-back').addEventListener('click', e => { e.preventDefault(); history.length > 1 ? history.back() : (location.hash = '#long-store'); });
    dash.draw('txt', el => { const d = dash.data(el.dataset.source); const r = d.status === 'ok' && d.data[+el.dataset.row || 0]; el.textContent = r ? (r[el.dataset.field] ?? '—') : '—'; });
  }
  const extras = rows => { const n = rows.length || 1, rf = rows.filter(r => r.리필구매 != null), f = rows.filter(r => r.성별); return [
    { 항목: '회원가입 완료율 (%)', 값: r2(rows.filter(r => r.회원가입 === 1).length / n * 100) },
    { 항목: '카카오 친구 추가율 (%)', 값: r2(rows.filter(r => r.카카오 === 1).length / n * 100) },
    { 항목: '리필스틱 동반 구매율 (%)', 값: rf.length ? r2(rf.filter(r => r.리필구매 === 1).length / rf.length * 100) : null },
    { 항목: '스타벅스 카드 (장)', 값: sum(rows, r => r.스타벅스) },
    { 항목: '여성 구매 비중 (%)', 값: f.length ? r2(sum(f.filter(r => r.성별 === '여자'), r => r.수량) / Math.max(1, sum(f, r => r.수량)) * 100) : null },
    { 항목: '흡연구역 판매 비중 (%)', 값: r2(sum(rows.filter(r => r.구분 === '흡연구역'), r => r.수량) / Math.max(1, sum(rows, r => r.수량)) * 100) }]; };
  const hourly = rows => { const o = []; for (let h = 9; h <= 19; h++) o.push({ 시간: h, 판매: sum(rows.filter(r => +r.시 === h), r => r.수량) }); return o; };
  const dailyOf = rows => [...group(rows, r => r.일자)].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([d, g]) => ({ 일자: d, 판매: sum(g, r => r.수량) }));
  const colorOf = rows => [...group(rows.filter(r => r.색상), r => r.색상)].map(([k, g]) => ({ 색상: k, 판매: sum(g, r => r.수량) })).sort((a, b) => b.판매 - a.판매);
  const custOf = rows => [...group(rows.filter(r => r.연령대 && r.성별), r => r.연령대 + '|' + r.성별)].map(([k, g]) => ({ 연령대: g[0].연령대, 성별: g[0].성별, 판매: sum(g, r => r.수량) })).sort((a, b) => b.판매 - a.판매);

  function showDetail(hash) {
    const m = hash.match(/^#(team|store)=(.+)$/); if (!m) return false;
    detail = m[1]; const key = decodeURIComponent(m[2]);
    // 상세 화면은 기간·브랜드·구분·요일 필터만 적용 (인력사·SV·팀 필터는 무시)
    const keep = { agency: F.agency, sv: F.sv, team: F.team }; F.agency = ''; F.sv = ''; F.team = '';
    const { R, TD, AC } = filtered(); Object.assign(F, keep);
    if (detail === 'team') {
      const t = +key, rows = R.filter(r => +r.팀 === t), td = TD.filter(r => +r.팀 === t);
      const info = td[0] || rows[0] || {}; const days = new Set([...td.map(r => r.일자), ...rows.map(r => r.일자)]).size;
      $('team-title').textContent = t + '팀'; $('team-sub').textContent = [info.인력사, info.SV ? 'SV ' + info.SV : '', t >= 900 ? '야간' : ''].filter(Boolean).join(' · ');
      dash.set('x_team_sum', [{ 판매: sum(rows, r => r.수량), 활동일수: days, 일평균: r2(sum(rows, r => r.수량) / Math.max(1, days)), 미판매일: td.length ? td.filter(r => +r.판매 === 0).length : null, 판매점포수: uniq(rows.filter(r => r.점포코드), r => r.점포코드), 이동: td.length ? sum(td, r => r.이동) : null, 평균활동시간: tdStats(td, rows).평균활동시간 }]);
      dash.set('x_team_daily', dailyOf(rows)); dash.set('x_team_hourly', hourly(rows)); dash.set('x_team_color', colorOf(rows)); dash.set('x_team_customer', custOf(rows)); dash.set('x_team_extra', extras(rows));
      dash.set('x_team_days', td.slice().sort((a, b) => a.일자 < b.일자 ? 1 : -1).map(r => Object.assign({ 요일: wday(r.일자) }, r)));
      dash.set('x_team_stores', [...group(rows.filter(r => r.점포코드), r => r.점포코드)].map(([k, g]) => ({ 점포코드: k, 점포명: g[0].점포명, 브랜드: g[0].브랜드, 구분: g[0].구분, 시군구: g[0].시군구, 판매: sum(g, r => r.수량), 판매일수: uniq(g, r => r.일자), 일당: r2(sum(g, r => r.수량) / uniq(g, r => r.일자)) })).sort((a, b) => b.판매 - a.판매));
      document.getElementById('page-title').textContent = t + '팀 상세';
    } else {
      const rows = R.filter(r => r.점포코드 === key), ac = AC.filter(r => r.점포코드 === key);
      const info = rows[0] || X.rows.find(r => r.점포코드 === key) || { 점포명: key };
      const dates = rows.map(r => r.일자).sort();
      $('store-title').textContent = info.점포명 || key; $('store-sub').textContent = [info.브랜드, info.구분, info.시군구, key].filter(Boolean).join(' · ');
      dash.set('x_store_sum', [{ 판매: sum(rows, r => r.수량), 판매일수: uniq(rows, r => r.일자), 일당: r2(sum(rows, r => r.수량) / Math.max(1, uniq(rows, r => r.일자))), 팀수: uniq(rows, r => r.팀), 첫판매: dates[0] || '—', 마지막판매: dates[dates.length - 1] || '—' }]);
      dash.set('x_store_daily', dailyOf(rows)); dash.set('x_store_hourly', hourly(rows)); dash.set('x_store_color', colorOf(rows)); dash.set('x_store_customer', custOf(rows)); dash.set('x_store_extra', extras(rows));
      dash.set('x_store_teams', [...group(rows, r => r.팀)].map(([t, g]) => { const d = g.map(r => r.일자).sort(); return { 팀: +t, 인력사: g[0].인력사, SV: g[0].SV || '', 판매: sum(g, r => r.수량), 판매일수: uniq(g, r => r.일자), 첫판매: d[0], 마지막판매: d[d.length - 1] }; }).sort((a, b) => b.판매 - a.판매));
      dash.set('x_store_visits', ac.slice().sort((a, b) => (a.일자 + a.시각) < (b.일자 + b.시각) ? 1 : -1).slice(0, 60));
      document.getElementById('page-title').textContent = '점포 상세';
    }
    document.querySelectorAll('.pl .panel').forEach(p => p.hidden = p.id !== 'p-' + detail);
    document.querySelectorAll('#tabs a').forEach(a => a.classList.remove('on'));
    barVisible(); dash.render(); window.scrollTo(0, 0);
    return true;
  }

  // ---------- 표 안의 팀·점포 링크 ----------
  function linkify() {
    document.querySelectorAll('.pl table[data-source]').forEach(table => {
      const src = table.dataset.source, d = dash.data(src); if (d.status !== 'ok') return;
      const tb = table.querySelector('tbody[data-draw="tbl"]'); if (!tb) return;
      const cols = tb.dataset.cols.split(','); const ti = cols.indexOf('팀'), si = cols.indexOf('점포명'), sti = cols.indexOf('시작점포');
      [...tb.rows].forEach((tr, i) => {
        const r = d.data[i]; if (!r) return;
        const wrap = (td, href) => { if (!td || td.querySelector('a')) return; const a = document.createElement('a'); a.href = href; a.className = 'xl'; a.textContent = td.textContent; td.replaceChildren(a); };
        if (ti >= 0 && r.팀 != null && r.팀 !== '') wrap(tr.cells[ti], '#team=' + r.팀);
        if (si >= 0 && r.점포코드) wrap(tr.cells[si], '#store=' + encodeURIComponent(r.점포코드));
        if (sti >= 0 && r.시작점포코드) wrap(tr.cells[sti], '#store=' + encodeURIComponent(r.시작점포코드));
      });
    });
  }

  // ---------- 연결 ----------
  const origShow = window.showPanel;
  function route() { if (showDetail(location.hash)) return; detail = null; origShow(); barVisible(); }
  removeEventListener('hashchange', origShow); addEventListener('hashchange', route);
  dash.onData(linkify);
  const waitDash = () => new Promise(res => { let n = 0; const id = setInterval(() => { if (dash.data('summary').status === 'ok' || ++n > 300) { clearInterval(id); res(); } }, 100); });
  Promise.all([loadAll(), waitDash()]).then(() => { snapshot(); buildBar(); buildDetailPanels(); apply(); route(); }).catch(e => console.error('탐색 자료 로드 실패', e));
})();
