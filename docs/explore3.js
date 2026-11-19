// ===== 3단계: 작년 비교 (docs/data/rows_prev.json, 2024.12~2025.12 폼즈 자료) =====
(() => {
  const $ = id => document.getElementById(id);
  const WD = ['월', '화', '수', '목', '금', '토', '일'];
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  const sum = (arr, f) => arr.reduce((a, r) => a + (+f(r) || 0), 0);
  const uniq = (arr, f) => new Set(arr.map(f)).size;
  const group = (arr, keyf) => { const m = new Map(); arr.forEach(r => { const k = keyf(r); let g = m.get(k); if (!g) m.set(k, g = []); g.push(r); }); return m; };
  const decode = j => { const cols = j.cols, dict = j.dict || {}; return j.rows.map(a => { const o = {}; cols.forEach((c, i) => { let v = a[i]; if (dict[c] && v != null) v = dict[c][v]; o[c] = v; }); return o; }); };
  const pct = (a, b) => b ? r1(a / b * 100) : null;
  const chg = (a, b) => b ? r1((a - b) / b * 100) : null;
  const prevOf = m => (parseInt(m.slice(0, 4)) - 1) + m.slice(4);
  const nextOf = m => (parseInt(m.slice(0, 4)) + 1) + m.slice(4);
  let PREV = null;

  // ---------- 메뉴·화면 ----------
  function build() {
    const nav = $('tabs'); const ref = nav.querySelector('a[data-panel="p-actions"]');
    const a = document.createElement('a'); a.href = '#compare'; a.dataset.panel = 'p-compare'; a.dataset.title = '작년 비교'; a.title = '작년 비교';
    a.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-8"/><path d="M22 19V3"/><path d="M2 19h21"/></svg><span>작년 비교</span>';
    nav.insertBefore(a, ref);
    const p = document.createElement('div'); p.className = 'panel'; p.id = 'p-compare'; p.hidden = true;
    const share = (id, title, label, note) => `
      <div class="card"><h3>${title}</h3><div class="tw"><table data-source="${id}"><thead><tr><th data-field="항목">${label}</th><th class="n" data-field="올해">올해</th><th class="n" data-field="올해비중">비중 %</th><th class="n" data-field="작년">작년</th><th class="n" data-field="작년비중">비중 %</th><th class="n" data-field="차이">차이 p</th></tr></thead>
        <tbody data-draw="tbl" data-cols="항목,올해,올해비중,작년,작년비중,차이" data-fmts=",,.1f,,.1f,+.1f"></tbody></table></div>${note ? '<p class="muted">' + note + '</p>' : ''}</div>`;
    p.innerHTML = `
      <h2 id="compare">작년 비교 <small class="muted" id="cmp-range"></small></h2>
      <p class="muted">작년 자료는 에이전트 세일즈 폼즈(2024년 12월~2025년 12월) 기준입니다. 2025년 1월·8월은 자료가 없고, 인력사 구분이 없으며 팀 번호 체계가 달라 팀·인력사 비교는 하지 않습니다. 지역은 점포 코드로 맞춘 것만 잡혀 작년은 60~90%만 지역이 있습니다. 위 기간 필터는 "작년 같은 달"로 함께 적용되고, 브랜드·구분·요일 필터도 양쪽에 같이 적용됩니다.</p>
      <div class="kpis">
        <div class="kpi"><div class="k">올해 판매 (비교 가능한 달)</div><div class="v"><span data-draw="num" data-source="c_kpi" data-field="올해판매" data-row="0">—</span><span class="u">대</span></div><div class="s">작년 같은 달 <span data-draw="num" data-source="c_kpi" data-field="작년판매" data-row="0">—</span>대 · <span data-draw="num" data-source="c_kpi" data-field="증감률" data-row="0" data-fmt="+.1f">—</span>%</div><div class="ic o"><svg viewBox="0 0 24 24"><path d="M4 17l5-6 4 4 7-8"/><path d="M16 7h4v4"/></svg></div></div>
        <div class="kpi"><div class="k">하루 평균 판매</div><div class="v"><span data-draw="num" data-source="c_kpi" data-field="올해일평균" data-row="0" data-fmt=".1f">—</span><span class="u">대</span></div><div class="s">작년 <span data-draw="num" data-source="c_kpi" data-field="작년일평균" data-row="0" data-fmt=".1f">—</span>대 · <span data-draw="num" data-source="c_kpi" data-field="일평균증감률" data-row="0" data-fmt="+.1f">—</span>%</div><div class="ic p"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div></div>
        <div class="kpi"><div class="k">판매 점포 수</div><div class="v"><span data-draw="num" data-source="c_kpi" data-field="올해점포" data-row="0">—</span><span class="u">곳</span></div><div class="s">작년 <span data-draw="num" data-source="c_kpi" data-field="작년점포" data-row="0">—</span>곳</div><div class="ic g"><svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/></svg></div></div>
        <div class="kpi"><div class="k">팀·일당 판매</div><div class="v"><span data-draw="num" data-source="c_kpi" data-field="올해팀일당" data-row="0" data-fmt=".2f">—</span><span class="u">대</span></div><div class="s">작년 <span data-draw="num" data-source="c_kpi" data-field="작년팀일당" data-row="0" data-fmt=".2f">—</span>대 · 판매가 있던 팀·일 기준</div><div class="ic o"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/></svg></div></div>
      </div>
      <div class="grid2">
        <div class="card"><h3>월별 판매 (대)</h3><div class="legend" data-source="c_month_line"><span><i data-c="0"></i>올해</span><span><i data-c="1"></i>작년</span></div>
          <div class="chart" data-draw="line" data-source="c_month_line" data-x="월" data-y="값" data-series="연도" data-order="올해,작년"></div><p class="muted">같은 달끼리 겹쳐 그렸습니다. 선이 끊긴 곳은 자료가 없는 달입니다.</p></div>
        <div class="card"><h3>월별 하루 평균 판매 (대)</h3><div class="legend" data-source="c_month_line2"><span><i data-c="0"></i>올해</span><span><i data-c="1"></i>작년</span></div>
          <div class="chart" data-draw="line" data-source="c_month_line2" data-x="월" data-y="값" data-series="연도" data-order="올해,작년" data-fmt=".1f"></div></div>
      </div>
      <div class="card" style="margin-top:var(--cds-gap-md)"><h3>월별 비교</h3>
        <div class="tw"><table data-source="c_month"><thead><tr><th data-field="월">월</th><th class="n" data-field="올해판매">올해 판매</th><th class="n" data-field="작년판매">작년 판매</th><th class="n" data-field="증감률">증감 %</th><th class="n" data-field="올해일수">올해 영업일</th><th class="n" data-field="작년일수">작년 영업일</th><th class="n" data-field="올해일평균">올해 일평균</th><th class="n" data-field="작년일평균">작년 일평균</th><th class="n" data-field="올해점포">올해 점포</th><th class="n" data-field="작년점포">작년 점포</th><th class="n" data-field="올해팀일당">올해 팀·일당</th><th class="n" data-field="작년팀일당">작년 팀·일당</th></tr></thead>
        <tbody data-draw="tbl" data-cols="월,올해판매,작년판매,증감률,올해일수,작년일수,올해일평균,작년일평균,올해점포,작년점포,올해팀일당,작년팀일당" data-fmts=",,,+.1f,,,.1f,.1f,,,.2f,.2f"></tbody></table></div>
        <p class="muted">영업일은 판매 기록이 있는 날 수입니다. 머리글을 누르면 정렬됩니다.</p></div>
      <h2>어디서 팔렸나</h2>
      <div class="grid2">
        ${share('c_brand', '브랜드 비중', '브랜드')}
        ${share('c_kind', '점포 구분 비중', '구분', '작년 2~7월 파일에는 구분 열이 없어 작년 비중은 9~12월 중심입니다.')}
        ${share('c_sido', '시도 비중', '시도', '점포 코드가 맞은 건만.')}
        <div class="card"><h3>시군구별 판매, 상위 20 (올해 기준)</h3><div class="tw"><table data-source="c_sgg"><thead><tr><th data-field="항목">시군구</th><th class="n" data-field="올해">올해</th><th class="n" data-field="작년">작년</th><th class="n" data-field="증감률">증감 %</th></tr></thead>
          <tbody data-draw="tbl" data-cols="항목,올해,작년,증감률" data-fmts=",,,+.1f"></tbody></table></div></div>
      </div>
      <h2>언제 팔렸나</h2>
      <div class="grid2">
        ${share('c_hour', '시간대 비중', '시간대')}
        ${share('c_wday', '요일 비중', '요일')}
      </div>
      <h2>무엇을, 누가 샀나</h2>
      <div class="grid2">
        ${share('c_color', '색상 비중', '색상', '작년 색상 이름은 올해와 다를 수 있습니다(실버·블랙 등).')}
        ${share('c_route', '판매 경로 비중', '경로', '작년 자사몰·카카오톡 스토어는 "자사몰 : 온라인 결제"로 묶었습니다.')}
        ${share('c_gender', '성별 비중', '성별')}
        ${share('c_age', '연령대 비중', '연령대', '작년은 50세 이상이 한 칸이라 올해 50대·60대 이상도 함께 묶어 비교합니다.')}
        ${share('c_product', '기존 사용 제품 비중', '제품')}
        <div class="card"><h3>가입·채널 전환</h3><div class="tw"><table data-source="c_conv"><thead><tr><th data-field="항목">지표</th><th class="n" data-field="올해">올해 %</th><th class="n" data-field="작년">작년 %</th><th class="n" data-field="차이">차이 p</th></tr></thead>
          <tbody data-draw="tbl" data-cols="항목,올해,작년,차이" data-fmts=",.1f,.1f,+.1f"></tbody></table></div><p class="muted">응답이 있는 건 기준. 작년 카카오 채널은 11월부터만 물었습니다.</p></div>
      </div>`;
    $('p-actions').insertAdjacentElement('beforebegin', p);
  }

  // ---------- 집계 ----------
  function compute({ R }) {
    if (!PREV) return;
    const X = window.X, F = X.F;
    const curMonths = [...new Set(R.map(r => r.일자.slice(0, 7)))].sort();
    const prevMonths = curMonths.map(prevOf);
    const P = PREV.filter(r => prevMonths.includes(r.일자.slice(0, 7)) && (!F.brand || r.브랜드 === F.brand) && (!F.kind || r.구분 === F.kind) && (!F.wd || r.요일 === F.wd));
    const haveBoth = curMonths.filter((m, i) => P.some(r => r.일자.slice(0, 7) === prevMonths[i]) && R.some(r => r.일자.slice(0, 7) === m));
    const Rb = R.filter(r => haveBoth.includes(r.일자.slice(0, 7))), Pb = P.filter(r => haveBoth.includes(nextOf(r.일자.slice(0, 7))));
    const rng = $('cmp-range'); if (rng) rng.textContent = haveBoth.length ? '(' + haveBoth.map(m => parseInt(m.slice(5, 7)) + '월').join(', ') + ' 같은 달끼리)' : '(겹치는 달 없음)';
    const st = g => ({ 판매: sum(g, r => r.수량), 일수: uniq(g, r => r.일자), 점포: uniq(g.filter(r => r.점포코드), r => r.점포코드), 팀일: uniq(g, r => r.일자 + '_' + r.팀) });
    const a = st(Rb), b = st(Pb);
    dash.set('c_kpi', [{ 올해판매: a.판매, 작년판매: b.판매, 증감률: chg(a.판매, b.판매), 올해일평균: a.일수 ? r1(a.판매 / a.일수) : null, 작년일평균: b.일수 ? r1(b.판매 / b.일수) : null,
      일평균증감률: (a.일수 && b.일수) ? chg(a.판매 / a.일수, b.판매 / b.일수) : null, 올해점포: a.점포, 작년점포: b.점포, 올해팀일당: a.팀일 ? r2(a.판매 / a.팀일) : null, 작년팀일당: b.팀일 ? r2(b.판매 / b.팀일) : null }]);
    const month = curMonths.map(m => { const pm = prevOf(m); const g = R.filter(r => r.일자.slice(0, 7) === m), h = P.filter(r => r.일자.slice(0, 7) === pm); const x = st(g), y = st(h);
      return { 월: parseInt(m.slice(5, 7)) + '월', 올해판매: g.length ? x.판매 : null, 작년판매: h.length ? y.판매 : null, 증감률: (g.length && h.length) ? chg(x.판매, y.판매) : null, 올해일수: g.length ? x.일수 : null, 작년일수: h.length ? y.일수 : null,
        올해일평균: x.일수 ? r1(x.판매 / x.일수) : null, 작년일평균: y.일수 ? r1(y.판매 / y.일수) : null, 올해점포: g.length ? x.점포 : null, 작년점포: h.length ? y.점포 : null, 올해팀일당: x.팀일 ? r2(x.판매 / x.팀일) : null, 작년팀일당: y.팀일 ? r2(y.판매 / y.팀일) : null }; });
    dash.set('c_month', month);
    const line = [], line2 = [];
    month.forEach(m => { line.push({ 월: m.월, 연도: '올해', 값: m.올해판매 }); line.push({ 월: m.월, 연도: '작년', 값: m.작년판매 }); line2.push({ 월: m.월, 연도: '올해', 값: m.올해일평균 }); line2.push({ 월: m.월, 연도: '작년', 값: m.작년일평균 }); });
    dash.set('c_month_line', line); dash.set('c_month_line2', line2);
    const share = (id, keyf, order) => {
      const ra = Rb.filter(r => keyf(r) != null), rb = Pb.filter(r => keyf(r) != null);
      const ga = group(ra, keyf), gb = group(rb, keyf), ta = sum(ra, r => r.수량), tb = sum(rb, r => r.수량);
      let keys = [...new Set([...ga.keys(), ...gb.keys()])];
      keys = order ? order.filter(k => keys.includes(k)).concat(keys.filter(k => !order.includes(k))) : keys.sort((k1, k2) => sum(ga.get(k2) || [], r => r.수량) - sum(ga.get(k1) || [], r => r.수량));
      dash.set(id, keys.map(k => { const va = sum(ga.get(k) || [], r => r.수량), vb = sum(gb.get(k) || [], r => r.수량); const pa = pct(va, ta), pb = pct(vb, tb); return { 항목: k, 올해: va, 올해비중: pa, 작년: vb, 작년비중: pb, 차이: (pa != null && pb != null) ? r1(pa - pb) : null }; }));
    };
    share('c_brand', r => r.브랜드); share('c_kind', r => r.구분); share('c_sido', r => r.시도);
    share('c_hour', r => r.시 != null && r.시 >= 9 && r.시 <= 19 ? r.시 + '시' : null, [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(h => h + '시'));
    share('c_wday', r => r.요일, WD);
    share('c_color', r => r.색상); share('c_route', r => r.경로); share('c_gender', r => r.성별);
    share('c_age', r => r.연령대 == null ? null : /^[2-4]0대/.test(r.연령대) ? r.연령대 : '50대 이상', ['20대', '30대', '40대', '50대 이상']); share('c_product', r => r.사용제품);
    const sg = group(Rb.filter(r => r.시군구), r => r.시군구), sgp = group(Pb.filter(r => r.시군구), r => r.시군구);
    dash.set('c_sgg', [...sg].map(([k, g]) => { const o = { 항목: k, 올해: sum(g, r => r.수량), 작년: sum(sgp.get(k) || [], r => r.수량) }; o.증감률 = chg(o.올해, o.작년); return o; }).sort((x, y) => y.올해 - x.올해).slice(0, 20));
    const rate = (g, f) => { const h = g.filter(r => f(r) != null); return h.length ? r1(h.filter(r => f(r) === 1).length / h.length * 100) : null; };
    dash.set('c_conv', [['회원가입 완료율', r => r.회원가입], ['카카오 채널 추가율', r => r.카카오]].map(([k, f]) => { const x = rate(Rb, f), y = rate(Pb, f); return { 항목: k, 올해: x, 작년: y, 차이: (x != null && y != null) ? r1(x - y) : null }; }));
  }

  // ---------- 시작 ----------
  async function init() {
    build();
    try { PREV = decode(await (await fetch('data/rows_prev.json?v=' + Date.now())).json()); } catch (e) { console.error('작년 자료', e); PREV = []; }
    const wait = () => { const X = window.X; if (X && X.ready && X.F) { PREV.forEach(r => { r.요일 = X.wday(r.일자); }); X.extra.push(compute); compute(X.filtered()); dash.render(); } else setTimeout(wait, 100); };
    wait();
  }
  init();
})();
