// ===== 2단계: 메뉴별 추가 분석, 표 정렬, 점포 검색, 열지도, 달 표기 =====
(() => {
  const $ = id => document.getElementById(id);
  const AG = ['토마스컴퍼니', '비욘드', '후킷'];
  const WD = ['월', '화', '수', '목', '금', '토', '일'];
  const r2 = v => Math.round(v * 100) / 100;
  const sum = (arr, f) => arr.reduce((a, r) => a + (+f(r) || 0), 0);
  const uniq = (arr, f) => new Set(arr.map(f)).size;
  const group = (arr, keyf) => { const m = new Map(); arr.forEach(r => { const k = keyf(r); let g = m.get(k); if (!g) m.set(k, g = []); g.push(r); }); return m; };
  const weekStart = d => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - (t.getUTCDay() + 6) % 7); return t.toISOString().slice(0, 10); };

  // ---------- 추가 집계 ----------
  function extra({ R, TD, AC }) {
    const X = window.X;
    // 월별 흐름: 주별, 월별 활동 지표
    dash.set('x_weekly', [...group(R, r => weekStart(r.일자))].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([w, g]) => ({ 주: w, 판매: sum(g, r => r.수량), 판매팀일: uniq(g, r => r.팀일), 팀일당: r2(sum(g, r => r.수량) / Math.max(1, uniq(g, r => r.팀일))), 일수: uniq(g, r => r.일자) })));
    dash.set('x_month_ops', [...group(TD, r => r.월)].sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([m, g]) => { const h = g.filter(r => r.활동시간 != null); return { 월: m, 활동팀일: g.length, 판매: sum(g, r => r.판매), 팀일평균: r2(sum(g, r => r.판매) / g.length), 미판매율: r2(g.filter(r => +r.판매 === 0).length / g.length * 100), 평균활동시간: h.length ? r2(sum(h, r => r.활동시간) / h.length) : null, 팀일당이동: r2(sum(g, r => r.이동) / g.length), 팀수: uniq(g, r => r.팀) }; }));
    // 한눈에 보기: 누적 지표
    const rf = R.filter(r => r.리필구매 != null), rj = R.filter(r => r.회원가입 != null);
    dash.set('ov_summary', [{ 판매: sum(R, r => r.수량), 일수: uniq(R, r => r.일자), 일평균: R.length ? sum(R, r => r.수량) / uniq(R, r => r.일자) : null, 리필동반율: rf.length ? r2(rf.filter(r => r.리필구매 === 1).length / rf.length * 100) : null, 회원가입률: rj.length ? r2(rj.filter(r => r.회원가입 === 1).length / rj.length * 100) : null }]);
    const sh = (id, key, keyf, top) => { let a = [...group(R.filter(r => keyf(r)), keyf)].map(([k, g]) => ({ [key]: k, 판매: sum(g, r => r.수량) })).sort((x, y) => y.판매 - x.판매); if (top && a.length > top) a = a.slice(0, top - 1).concat([{ [key]: '기타', 판매: sum(a.slice(top - 1), r => r.판매) }]); dash.set(id, a); };
    sh('ov_agency', '인력사', r => r.인력사); sh('ov_color', '색상', r => r.색상, 5); sh('ov_product', '사용제품', r => r.사용제품, 5);
    dash.set('ov_hourly', [...group(R.filter(r => r.시 != null && r.시 >= 9 && r.시 <= 19), r => +r.시)].sort((a, b) => a[0] - b[0]).map(([h, g]) => ({ 시간: h, 판매: sum(g, r => r.수량) })));
    // 점포
    const stores = [...group(R.filter(r => r.점포코드), r => r.점포코드)].map(([k, g]) => { const d = g.map(r => r.일자).sort(); return { 점포코드: k, 점포명: g[0].점포명, 브랜드: g[0].브랜드, 구분: g[0].구분, 시군구: g[0].시군구, 판매: sum(g, r => r.수량), 판매일수: uniq(g, r => r.일자), 팀수: uniq(g, r => r.팀), 일당: r2(sum(g, r => r.수량) / uniq(g, r => r.일자)), 첫판매: d[0], 마지막판매: d[d.length - 1] }; }).sort((a, b) => b.판매 - a.판매);
    X.storesAll = stores; storeSearch();
    dash.set('x_brand', [...group(R.filter(r => r.브랜드), r => r.브랜드)].map(([k, g]) => ({ 브랜드: k, 판매: sum(g, r => r.수량), 점포수: uniq(g, r => r.점포코드), 점포당판매: r2(sum(g, r => r.수량) / uniq(g, r => r.점포코드)) })).sort((a, b) => b.판매 - a.판매));
    dash.set('x_kind', [...group(R.filter(r => r.구분), r => r.구분)].map(([k, g]) => ({ 구분: k, 판매: sum(g, r => r.수량), 점포수: uniq(g, r => r.점포코드), 점포당판매: r2(sum(g, r => r.수량) / uniq(g, r => r.점포코드)) })).sort((a, b) => b.판매 - a.판매));
    dash.set('x_region', [...group(R.filter(r => r.시군구), r => (r.시도 || '') + '|' + r.시군구)].map(([k, g]) => ({ 시도: g[0].시도 || '', 시군구: g[0].시군구, 판매: sum(g, r => r.수량), 점포수: uniq(g, r => r.점포코드), 점포당판매: r2(sum(g, r => r.수량) / uniq(g, r => r.점포코드)) })).sort((a, b) => b.판매 - a.판매).slice(0, 20));
    // 운영 리듬
    const heat = []; WD.forEach(w => { const g = R.filter(r => r.요일 === w); const days = uniq(g, r => r.일자); if (!days) return; for (let h = 9; h <= 19; h++) heat.push({ 요일: w, 시간: h, 판매: sum(g.filter(r => +r.시 === h), r => r.수량), 일평균: r2(sum(g.filter(r => +r.시 === h), r => r.수량) / days) }); });
    dash.set('x_heat', heat);
    dash.set('x_start_hour', [...group(TD.filter(r => r.활동시작), r => r.활동시작.slice(0, 2))].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([h, g]) => ({ 시작시각: parseInt(h) + '시', 팀일: g.length, 팀일평균: r2(sum(g, r => r.판매) / g.length), 미판매율: r2(g.filter(r => +r.판매 === 0).length / g.length * 100) })));
    dash.set('x_moves', [['이동 없음', v => v === 0], ['1회', v => v === 1], ['2회', v => v === 2], ['3회 이상', v => v >= 3]].map(([lab, t]) => { const g = TD.filter(r => t(+r.이동)); return g.length ? { 구간: lab, 팀일: g.length, 팀일평균: r2(sum(g, r => r.판매) / g.length), 미판매율: r2(g.filter(r => +r.판매 === 0).length / g.length * 100) } : null; }).filter(Boolean));
    dash.set('x_move_reason', [...group(AC.filter(r => r.기록 === '점포이동'), r => r.이동사유 || '미기재')].map(([k, g]) => ({ 사유: k, 건수: g.length, 이동후판매: r2(sum(g, r => r.구간판매) / g.length) })).sort((a, b) => b.건수 - a.건수).slice(0, 10));
    dash.set('x_hours', [['6시간 미만', v => v < 6], ['6~7시간', v => v >= 6 && v < 7], ['7~8시간', v => v >= 7 && v < 8], ['8시간 이상', v => v >= 8]].map(([lab, t]) => { const g = TD.filter(r => r.활동시간 != null && t(+r.활동시간)); return g.length ? { 구간: lab, 팀일: g.length, 팀일평균: r2(sum(g, r => r.판매) / g.length) } : null; }).filter(Boolean));
    // 상품·고객
    const months = [...new Set(R.map(r => r.월))].sort((a, b) => parseInt(a) - parseInt(b));
    const conv = [];
    months.forEach(m => { const g = R.filter(r => r.월 === m); if (!g.length) return; const rf = g.filter(r => r.리필구매 != null), gs = g.filter(r => r.성별);
      conv.push({ 월: m, 지표: '회원가입 완료율', 값: r2(g.filter(r => r.회원가입 === 1).length / g.length * 100) });
      conv.push({ 월: m, 지표: '카카오 친구 추가율', 값: r2(g.filter(r => r.카카오 === 1).length / g.length * 100) });
      if (rf.length) conv.push({ 월: m, 지표: '리필스틱 동반 구매율', 값: r2(rf.filter(r => r.리필구매 === 1).length / rf.length * 100) });
      if (gs.length) conv.push({ 월: m, 지표: '여성 구매 비중', 값: r2(sum(gs.filter(r => r.성별 === '여자'), r => r.수량) / Math.max(1, sum(gs, r => r.수량)) * 100) }); });
    dash.set('x_conv_month', conv);
    const colors = [...group(R.filter(r => r.색상), r => r.색상)].map(([k, g]) => { const o = { 색상: k, 판매: sum(g, r => r.수량) }; AG.forEach(a => o[a] = sum(g.filter(r => r.인력사 === a), r => r.수량)); o.비중 = r2(o.판매 / Math.max(1, sum(R, r => r.수량)) * 100); return o; }).sort((a, b) => b.판매 - a.판매);
    dash.set('x_color_agency', colors);
    dash.set('x_customer_all', [...group(R.filter(r => r.연령대 && r.성별), r => r.연령대 + '|' + r.성별)].map(([k, g]) => ({ 연령대: g[0].연령대, 성별: g[0].성별, 판매: sum(g, r => r.수량) })).sort((a, b) => a.연령대 < b.연령대 ? -1 : a.연령대 > b.연령대 ? 1 : a.성별 < b.성별 ? -1 : 1));
    dash.set('x_product_all', [...group(R.filter(r => r.사용제품), r => r.사용제품)].map(([k, g]) => ({ 사용제품: k, 판매: sum(g, r => r.수량) })).sort((a, b) => b.판매 - a.판매).slice(0, 8));
    dash.set('x_stick_all', [...group(R.filter(r => r.스틱), r => r.스틱)].map(([k, g]) => ({ 스틱: k, 판매: sum(g, r => r.수량) })).sort((a, b) => b.판매 - a.판매).slice(0, 8));
    dash.set('x_route', [...group(R.filter(r => r.경로), r => r.경로)].map(([k, g]) => ({ 경로: k, 판매: sum(g, r => r.수량) })).sort((a, b) => b.판매 - a.판매).slice(0, 8));
    // 사람
    dash.set('x_sv_all', [...group(TD.filter(r => r.SV), r => r.인력사 + '|' + r.SV)].map(([k, g]) => { const h = g.filter(r => r.활동시간 != null); return { SV: g[0].SV, 인력사: g[0].인력사, 팀수: uniq(g, r => r.팀), 활동팀일: g.length, 판매: sum(g, r => r.판매), 팀일평균: r2(sum(g, r => r.판매) / g.length), 미판매율: r2(g.filter(r => +r.판매 === 0).length / g.length * 100), 평균활동시간: h.length ? r2(sum(h, r => r.활동시간) / h.length) : null }; }).sort((a, b) => b.팀일평균 - a.팀일평균));
    const teamsAll = [...group(R, r => r.팀)].map(([t, g]) => { const td = TD.filter(r => +r.팀 === +t); const days = new Set([...g.map(r => r.일자), ...td.map(r => r.일자)]).size; const h = td.filter(r => r.활동시간 != null); return { 팀: +t, 인력사: (td[0] || g[0]).인력사, SV: (td[0] && td[0].SV) || g[0].SV || '', 활동일수: days, 판매: sum(g, r => r.수량), 일평균: r2(sum(g, r => r.수량) / Math.max(1, days)), 미판매일: td.length ? td.filter(r => +r.판매 === 0).length : null, 이동: td.length ? sum(td, r => r.이동) : null, 평균활동시간: h.length ? r2(sum(h, r => r.활동시간) / h.length) : null, 판매점포수: uniq(g.filter(r => r.점포코드), r => r.점포코드) }; }).sort((a, b) => b.판매 - a.판매);
    dash.set('x_teams_all', teamsAll);
    relabel({ R, TD });
  }

  // ---------- 점포 검색 ----------
  function storeSearch() {
    const X = window.X; const q = ($('store-q') ? $('store-q').value : '').trim();
    const all = X.storesAll || [];
    const rows = q ? all.filter(r => (r.점포명 || '').includes(q) || (r.시군구 || '').includes(q) || (r.브랜드 || '').includes(q) || (r.점포코드 || '').includes(q)) : all;
    dash.set('x_stores_view', rows.slice(0, 60));
    const c = $('store-q-count'); if (c) c.textContent = rows.length.toLocaleString() + '곳 중 ' + Math.min(60, rows.length) + '곳 표시';
  }

  // ---------- 달 표기 ----------
  function relabel({ R, TD }) {
    const X = window.X, F = X.F;
    let label;
    if (F.from || F.to) { if (F.from && F.to && F.from.slice(0, 7) === F.to.slice(0, 7)) label = parseInt(F.from.slice(5, 7)) + '월'; else label = (F.from ? F.from.slice(5).replace('-', '/') : '처음') + '~' + (F.to ? F.to.slice(5).replace('-', '/') : '끝'); }
    else { const m = (X.sheetMonths && X.sheetMonths[X.sheetMonths.length - 1]) || ''; label = m ? parseInt(m.slice(5, 7)) + '월' : '11월'; }
    document.querySelectorAll('.pl .panel:not(#p-today) h3, .pl .panel:not(#p-today) .k, .pl .panel:not(#p-today) .hero-top b, .pl .panel:not(#p-today) .hero-top span').forEach(el => {
      if (el.dataset.orig == null) el.dataset.orig = el.innerHTML;
      const o = el.dataset.orig; if (!o.includes('11월') || /~11월|~ 11월|4~|10~11/.test(o)) return;
      el.innerHTML = o.replace(/11월/g, label);
    });
    const s = dash.data('summary'); const sr = s.status === 'ok' && s.data[0];
    const h2 = $('nov-intro'); if (h2 && sr) h2.textContent = label + ' 상세 (' + (sr.기간시작 || '') + ' ~ ' + (sr.기간끝 || '') + ', 활동 기록 포함)';
    const sa = dash.data('summary_all'); const ar = sa.status === 'ok' && sa.data[0]; const small = document.querySelector('#p-overview .hero-stats .k small'); if (small && ar && ar.기간시작) small.textContent = ar.기간시작.slice(5).replace('-', '/') + '~' + ar.기간끝.slice(5).replace('-', '/');
    const nav = document.querySelector('#tabs a[data-panel="p-nov-intro"]'); if (nav) { nav.dataset.title = label + ' 상세'; nav.title = nav.dataset.title; nav.querySelector('span').textContent = nav.dataset.title; if (nav.classList.contains('on')) $('page-title').textContent = nav.dataset.title; }
  }

  // ---------- 열지도 그리기 ----------
  dash.draw('heat', el => {
    const d = dash.data(el.dataset.source); el.replaceChildren(); if (d.status !== 'ok' || !d.data.length) return;
    const rows = d.data, R = el.dataset.row, C = el.dataset.col, V = el.dataset.value;
    const rk = [...new Set(rows.map(r => r[R]))], ck = [...new Set(rows.map(r => r[C]))].sort((a, b) => a - b);
    const max = Math.max(...rows.map(r => +r[V] || 0)) || 1;
    const t = document.createElement('table'); t.className = 'heat';
    const th = document.createElement('tr'); th.appendChild(document.createElement('th')); ck.forEach(c => { const x = document.createElement('th'); x.textContent = c + '시'; th.appendChild(x); }); t.appendChild(th);
    rk.forEach(rv => { const tr = document.createElement('tr'); const h = document.createElement('th'); h.textContent = rv + '요일'; tr.appendChild(h);
      ck.forEach(cv => { const r = rows.find(x => x[R] === rv && x[C] === cv); const v = r ? +r[V] : 0; const td = document.createElement('td'); const a = v / max; td.style.background = `rgba(30,58,110,${(0.06 + a * 0.9).toFixed(2)})`; td.style.color = a > 0.55 ? '#fff' : 'var(--color-fg)'; td.textContent = v ? (Number.isInteger(v) ? v : v.toFixed(1)) : ''; td.title = rv + '요일 ' + cv + '시: ' + v; tr.appendChild(td); });
      t.appendChild(tr); });
    el.appendChild(t);
  });

  // ---------- 표 머리글 정렬 ----------
  const sortState = {};
  document.addEventListener('click', ev => {
    const th = ev.target.closest('.pl table[data-source] thead th[data-field]'); if (!th) return;
    const table = th.closest('table'), src = table.dataset.source, f = th.dataset.field;
    const d = dash.data(src); if (d.status !== 'ok') return;
    const key = src + '|' + f; const dir = sortState[key] === 'desc' ? 'asc' : 'desc'; Object.keys(sortState).forEach(k => { if (k.startsWith(src + '|')) delete sortState[k]; }); sortState[key] = dir;
    const rows = d.data.slice().sort((a, b) => { const x = a[f], y = b[f]; if (x == null) return 1; if (y == null) return -1; const n = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'ko'); return dir === 'asc' ? n : -n; });
    dash.set(src, rows);
    table.querySelectorAll('thead th').forEach(x => x.classList.remove('asc', 'desc')); th.classList.add(dir);
    dash.render();
  });

  // ---------- 메뉴별 카드 ----------
  function inject() {
    const add = (panelId, html) => { const p = $(panelId); if (!p) return; const wrap = document.createElement('div'); wrap.className = 'x-extra'; wrap.innerHTML = html; p.appendChild(wrap); };
    add('p-long-volume', `
      <h2>더 보기: 주별 흐름과 활동 지표</h2>
      <div class="grid2">
        <div class="card"><h3>주별 판매 (대)</h3><div class="chart" data-draw="line" data-source="x_weekly" data-x="주" data-y="판매" data-xfmt="date"></div><p class="muted">월요일 시작 주 기준. 필터가 있으면 그 범위만.</p></div>
        <div class="card"><h3>주별 팀·일당 판매 (대)</h3><div class="chart" data-draw="line" data-source="x_weekly" data-x="주" data-y="팀일당" data-xfmt="date" data-fmt=".2f"></div></div>
      </div>
      <div class="card" style="margin-top:var(--cds-gap-md)"><h3>월별 활동 지표 (활동 기록이 있는 달)</h3>
        <div class="tw"><table data-source="x_month_ops"><thead><tr><th data-field="월">월</th><th class="n" data-field="팀수">팀 수</th><th class="n" data-field="활동팀일">활동 팀·일</th><th class="n" data-field="판매">판매</th><th class="n" data-field="팀일평균">팀·일당</th><th class="n" data-field="미판매율">미판매율 %</th><th class="n" data-field="평균활동시간">평균 활동 시간</th><th class="n" data-field="팀일당이동">팀·일당 이동</th></tr></thead>
        <tbody data-draw="tbl" data-cols="월,팀수,활동팀일,판매,팀일평균,미판매율,평균활동시간,팀일당이동" data-fmts=",,,,.2f,.1f,.1f,.2f"></tbody></table></div>
        <p class="muted">머리글을 누르면 정렬됩니다. 활동 기록은 운영 시트가 보관된 달(10월부터)만 있습니다.</p></div>`);
    add('p-long-store', `
      <h2>더 보기: 점포 찾기와 브랜드·지역</h2>
      <div class="card"><h3>점포 찾기</h3>
        <div class="toolbar"><input type="search" id="store-q" placeholder="점포명, 지역, 브랜드, 코드로 찾기" style="max-width:360px"><span class="muted" id="store-q-count"></span></div>
        <div class="tw"><table data-source="x_stores_view" data-row-key="점포코드"><thead><tr><th data-field="점포명">점포</th><th data-field="브랜드">브랜드</th><th data-field="구분">구분</th><th data-field="시군구">지역</th><th class="n" data-field="판매">판매</th><th class="n" data-field="판매일수">판매일</th><th class="n" data-field="팀수">팀 수</th><th class="n" data-field="일당">일당</th><th data-field="첫판매">첫 판매</th><th data-field="마지막판매">마지막 판매</th></tr></thead>
        <tbody data-draw="tbl" data-cols="점포명,브랜드,구분,시군구,판매,판매일수,팀수,일당,첫판매,마지막판매" data-fmts=",,,,,,,.2f,,"></tbody></table></div>
        <p class="muted">점포명을 누르면 점포 상세로 갑니다. 머리글을 누르면 정렬됩니다.</p></div>
      <div class="grid3" style="margin-top:var(--cds-gap-md)">
        <div class="card"><h3>브랜드별 점포당 판매 (대)</h3><div class="chart sm" data-draw="hbar" data-source="x_brand" data-label="브랜드" data-value="점포당판매" data-fmt=".1f" data-sub="점포수" data-subunit="곳"></div></div>
        <div class="card"><h3>구분별 점포당 판매 (대)</h3><div class="chart sm" data-draw="hbar" data-source="x_kind" data-label="구분" data-value="점포당판매" data-fmt=".1f" data-sub="점포수" data-subunit="곳"></div></div>
        <div class="card"><h3>시군구별 판매 상위</h3><div class="tw"><table data-source="x_region"><thead><tr><th data-field="시도">시도</th><th data-field="시군구">시군구</th><th class="n" data-field="판매">판매</th><th class="n" data-field="점포수">점포</th><th class="n" data-field="점포당판매">점포당</th></tr></thead><tbody data-draw="tbl" data-cols="시도,시군구,판매,점포수,점포당판매" data-fmts=",,,,.1f"></tbody></table></div></div>
      </div>`);
    add('p-long-ops', `
      <h2>더 보기: 요일×시간대, 시작 시각, 이동</h2>
      <div class="card"><h3>요일 × 시간대 하루 평균 판매 (대)</h3><div data-draw="heat" data-source="x_heat" data-row="요일" data-col="시간" data-value="일평균"></div><p class="muted">같은 요일의 운영일 수로 나눈 하루 평균. 진할수록 많이 팔린 시간대.</p></div>
      <div class="grid3" style="margin-top:var(--cds-gap-md)">
        <div class="card"><h3>활동 시작 시각별 팀·일당 판매</h3><div class="tw"><table data-source="x_start_hour"><thead><tr><th data-field="시작시각">시작</th><th class="n" data-field="팀일">팀·일</th><th class="n" data-field="팀일평균">팀·일당</th><th class="n" data-field="미판매율">미판매 %</th></tr></thead><tbody data-draw="tbl" data-cols="시작시각,팀일,팀일평균,미판매율" data-fmts=",,.2f,.1f"></tbody></table></div></div>
        <div class="card"><h3>이동 횟수별 팀·일당 판매 (대)</h3><div class="chart sm" data-draw="hbar" data-source="x_moves" data-label="구간" data-value="팀일평균" data-fmt=".2f" data-sub="팀일"></div>
          <h3 style="margin-top:14px">활동 시간별 팀·일당 판매 (대)</h3><div class="chart sm" data-draw="hbar" data-source="x_hours" data-label="구간" data-value="팀일평균" data-fmt=".2f" data-sub="팀일"></div></div>
        <div class="card"><h3>이동 사유와 이동 뒤 판매</h3><div class="tw"><table data-source="x_move_reason"><thead><tr><th data-field="사유">사유</th><th class="n" data-field="건수">건수</th><th class="n" data-field="이동후판매">이동 뒤 구간 판매</th></tr></thead><tbody data-draw="tbl" data-cols="사유,건수,이동후판매" data-fmts=",,.2f"></tbody></table></div><p class="muted">구간 판매: 그 이동 뒤 다음 기록까지 판 수량의 평균.</p></div>
      </div>`);
    add('p-long-mix', `
      <h2>더 보기: 전환 지표, 색상×인력사, 고객</h2>
      <div class="grid2">
        <div class="card"><h3>월별 전환 지표 (%)</h3><div class="legend" data-source="x_conv_month"><span><i data-c="0"></i>회원가입 완료율</span><span><i data-c="1"></i>카카오 친구 추가율</span><span><i data-c="2"></i>리필스틱 동반 구매율</span><span><i data-c="3"></i>여성 구매 비중</span></div>
          <div class="chart" data-draw="line" data-source="x_conv_month" data-x="월" data-y="값" data-series="지표" data-order="회원가입 완료율,카카오 친구 추가율,리필스틱 동반 구매율,여성 구매 비중" data-fmt=".1f"></div></div>
        <div class="card"><h3>색상 × 인력사 판매 (대)</h3><div class="tw"><table data-source="x_color_agency"><thead><tr><th data-field="색상">색상</th><th class="n" data-field="판매">전체</th><th class="n" data-field="비중">비중 %</th><th class="n" data-field="토마스컴퍼니">토마스컴퍼니</th><th class="n" data-field="비욘드">비욘드</th><th class="n" data-field="후킷">후킷</th></tr></thead><tbody data-draw="tbl" data-cols="색상,판매,비중,토마스컴퍼니,비욘드,후킷" data-fmts=",,.1f,,,"></tbody></table></div></div>
      </div>
      <div class="grid3" style="margin-top:var(--cds-gap-md)">
        <div class="card"><h3>연령대 × 성별 판매 (대)</h3><div class="legend" data-source="x_customer_all"><span><i data-c="0"></i>남자</span><span><i data-c="1"></i>여자</span></div><div class="chart" data-draw="vbar" data-source="x_customer_all" data-x="연령대" data-y="판매" data-series="성별" data-order="남자,여자" data-grouped="1"></div></div>
        <div class="card"><h3>기존 사용 제품 (대)</h3><div class="chart sm" data-draw="hbar" data-source="x_product_all" data-label="사용제품" data-value="판매" data-pct></div></div>
        <div class="card"><h3>리필스틱 종류 (대, 시트 달만)</h3><div class="chart sm" data-draw="hbar" data-source="x_stick_all" data-label="스틱" data-value="판매"></div>
          <h3 style="margin-top:14px">판매 경로 (대)</h3><div class="chart sm" data-draw="hbar" data-source="x_route" data-label="경로" data-value="판매"></div></div>
      </div>`);
    add('p-long-people', `
      <h2>더 보기: 수퍼바이저와 팀</h2>
      <div class="card"><h3>수퍼바이저별 성과 (활동 기록이 있는 달)</h3>
        <div class="tw"><table data-source="x_sv_all"><thead><tr><th data-field="SV">SV</th><th data-field="인력사">인력사</th><th class="n" data-field="팀수">팀 수</th><th class="n" data-field="활동팀일">활동 팀·일</th><th class="n" data-field="판매">판매</th><th class="n" data-field="팀일평균">팀·일당</th><th class="n" data-field="미판매율">미판매 %</th><th class="n" data-field="평균활동시간">평균 활동 시간</th></tr></thead>
        <tbody data-draw="tbl" data-cols="SV,인력사,팀수,활동팀일,판매,팀일평균,미판매율,평균활동시간" data-fmts=",,,,,.2f,.1f,.1f"></tbody></table></div><p class="muted">머리글을 누르면 정렬됩니다. 위 필터의 SV를 고르면 그 SV 팀만 모든 메뉴에 반영됩니다.</p></div>
      <div class="card" style="margin-top:var(--cds-gap-md)"><h3>팀별 성과</h3>
        <div class="tw"><table data-source="x_teams_all" data-row-key="팀"><thead><tr><th class="n" data-field="팀">팀</th><th data-field="인력사">인력사</th><th data-field="SV">SV</th><th class="n" data-field="활동일수">활동일</th><th class="n" data-field="판매">판매</th><th class="n" data-field="일평균">하루 평균</th><th class="n" data-field="미판매일">미판매일</th><th class="n" data-field="판매점포수">판매 점포</th><th class="n" data-field="이동">이동</th><th class="n" data-field="평균활동시간">활동 시간</th></tr></thead>
        <tbody data-draw="tbl" data-cols="팀,인력사,SV,활동일수,판매,일평균,미판매일,판매점포수,이동,평균활동시간" data-fmts="d,,,,,.2f,,,,.1f"></tbody></table></div><p class="muted">팀 번호를 누르면 팀 상세로 갑니다. 미판매일·이동·활동 시간은 활동 기록이 있는 달만 셉니다.</p></div>`);
    const q = $('store-q'); if (q) q.addEventListener('input', () => { storeSearch(); dash.render(); });
  }

  inject();
  window.X.extra.push(extra);
})();
