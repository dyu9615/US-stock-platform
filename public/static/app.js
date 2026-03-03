/* ======================================================================
   QuantAlpha — Main Application (US Equity Quant Platform)
   Modules: Dashboard, DataCenter, Screener, Strategies, Research,
            Trading, Backtest, Performance
   ====================================================================== */

const API = ''
let charts = {}
let currentPage = 'dashboard'

// ── CLOCK ──────────────────────────────────────────────────────────────────
setInterval(() => {
  const now = new Date()
  const el = document.getElementById('clock')
  if (el) el.textContent = now.toLocaleTimeString('zh-CN', { hour12: false })
}, 1000)

// ── NAV ────────────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:   '总控台 Dashboard',
  datacenter:  '数据中心 Data Center',
  screener:    '五因子筛选 Stock Screener',
  strategies:  '策略管理 Strategy Manager',
  mlfinance:   'ML for Finance — 机器学习信号引擎',
  research:    '研究论文库 Research Library',
  trading:     '交易模块 Trade Execution',
  backtest:    '回测平台 Backtesting',
  performance: '业绩分析 Performance Analytics',
}

function navigate(page) {
  currentPage = page
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  const btn = document.getElementById('nav-' + page)
  if (btn) btn.classList.add('active')
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page
  destroyCharts()
  const container = document.getElementById('page-content')
  container.innerHTML = '<div class="flex items-center justify-center py-20"><div class="skeleton w-full h-96 rounded-xl"></div></div>'
  setTimeout(() => renderPage(page), 100)
}

function destroyCharts() {
  Object.values(charts).forEach(c => { try { c.destroy() } catch(e){} })
  charts = {}
}

async function refreshAll() {
  destroyCharts()
  renderPage(currentPage)
}

// ── MARKET TICKER ──────────────────────────────────────────────────────────
async function loadMarketTicker() {
  try {
    const { data } = await axios.get(`${API}/api/us/market-overview`)
    const ticker = document.getElementById('market-ticker')
    if (!ticker) return
    ticker.innerHTML = data.indices.slice(0,4).map(i => `
      <span class="flex items-center gap-1">
        <span class="text-gray-500 text-[10px]">${i.name}</span>
        <span class="font-mono ${i.changePct>=0?'text-emerald-400':'text-red-400'}">${i.value.toLocaleString()}</span>
        <span class="${i.changePct>=0?'text-emerald-400':'text-red-400'} text-[10px]">${i.changePct>=0?'+':''}${i.changePct.toFixed(2)}%</span>
      </span>`).join('<span class="text-gray-700">|</span>')
  } catch(e){}
}

// ── PAGE ROUTER ──────────────────────────────────────────────────────────────
async function renderPage(page) {
  const container = document.getElementById('page-content')
  container.classList.remove('fade-in')
  switch(page) {
    case 'dashboard':   await renderDashboard(container); break
    case 'datacenter':  await renderDataCenter(container); break
    case 'screener':    await renderScreener(container); break
    case 'strategies':  await renderStrategies(container); break
    case 'mlfinance':   await renderMLFinance(container); break
    case 'research':    await renderResearch(container); break
    case 'trading':     await renderTrading(container); break
    case 'backtest':    await renderBacktest(container); break
    case 'performance': await renderPerformance(container); break
  }
  container.classList.add('fade-in')
}

// ── FORMAT HELPERS ──────────────────────────────────────────────────────────
const fmt = {
  num:    v => v == null ? '—' : v.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0}),
  dec:    (v,d=2) => v == null ? '—' : v.toFixed(d),
  pct:    v => v == null ? '—' : `${v>=0?'+':''}${v.toFixed(2)}%`,
  pctAbs: v => v == null ? '—' : `${v.toFixed(2)}%`,
  money:  v => v == null ? '—' : (v>=1e9?`$${(v/1e9).toFixed(2)}B`:v>=1e6?`$${(v/1e6).toFixed(1)}M`:`$${v.toLocaleString()}`),
  moneyB: v => v == null ? '—' : `$${v.toFixed(1)}B`,
  sign:   v => v >= 0 ? 'pos' : 'neg',
  badge:  s => `<span class="badge badge-${s}">${s}</span>`,
  ratingLabel: r => r<=1.5?'Strong Buy':r<=2.5?'Buy':r<=3.5?'Hold':r<=4.5?'Sell':'Strong Sell',
  ratingColor: r => r<=1.5?'text-emerald-400':r<=2.5?'text-emerald-400':r<=3.5?'text-amber-400':'text-red-400',
}

const scoreColor = s => s>=85?'bg-emerald-500':s>=70?'bg-cyan-500':s>=55?'bg-amber-500':'bg-red-500'

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  1. DASHBOARD  — Panic / Liquidity + Valuation Monitor              ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderDashboard(el) {
  el.innerHTML = `<div class="flex items-center justify-center h-32 text-gray-400">
    <i class="fas fa-spinner fa-spin mr-2"></i>Loading market monitor…</div>`;

  try {
    const [macroRes, erpRes, erpHistRes, macroHistRes] = await Promise.all([
      axios.get(`${API}/api/dc/macro/current`),
      axios.get(`${API}/api/dc/erp/current`),
      axios.get(`${API}/api/dc/erp/history?days=60`),
      axios.get(`${API}/api/dc/macro/history?days=60`)
    ]);
    const m = macroRes.data;
    const e = erpRes.data;
    const erpH = erpHistRes.data.data || [];
    const macH = macroHistRes.data.data || [];

    // ── helper colours ──────────────────────────────────────────────────
    function signalColor(sig) {
      if (sig === 'panic' || sig === 'distress' || sig === 'overvalued') return '#ef4444';
      if (sig === 'warning' || sig === 'elevated')  return '#f59e0b';
      if (sig === 'undervalued' || sig === 'attractive') return '#10b981';
      return '#6b7280'; // neutral / normal
    }
    function signalBg(sig) {
      if (sig === 'panic' || sig === 'distress' || sig === 'overvalued') return 'bg-red-900/30 border-red-500/40';
      if (sig === 'warning' || sig === 'elevated')  return 'bg-yellow-900/30 border-yellow-500/40';
      if (sig === 'undervalued' || sig === 'attractive') return 'bg-emerald-900/30 border-emerald-500/40';
      return 'bg-gray-800/60 border-gray-600/40';
    }
    function badge(sig, label) {
      const map = { panic:'bg-red-500', distress:'bg-red-500', overvalued:'bg-red-500',
                    warning:'bg-yellow-500', elevated:'bg-yellow-500',
                    undervalued:'bg-emerald-500', attractive:'bg-emerald-500',
                    normal:'bg-gray-500', neutral:'bg-gray-500' };
      const cls = map[sig] || 'bg-gray-500';
      return `<span class="${cls} text-white text-xs font-bold px-2 py-0.5 rounded-full uppercase">${label||sig}</span>`;
    }

    // ── panic score gauge ────────────────────────────────────────────────
    const panicPct   = Math.min((m.panicScore / 100) * 100, 100);
    const panicColor = m.panicScore >= 60 ? '#ef4444' : m.panicScore >= 30 ? '#f59e0b' : '#10b981';

    // ── VIX term-structure label ─────────────────────────────────────────
    const vixTSLabel = m.vixContango ? 'Contango (normal)' : '⚠ Backwardation (PANIC)';
    const vixTSSig   = m.vixContango ? 'normal' : 'panic';

    // ── HY OAS colour ────────────────────────────────────────────────────
    const hyColor = m.hyOas > 800 ? '#ef4444' : m.hyOas > 500 ? '#f59e0b' : '#10b981';
    const hyLabel = m.hyOas > 800 ? 'Credit Distress' : m.hyOas > 500 ? 'Elevated' : m.hyOas > 400 ? 'Caution' : 'Tight';

    // ── breadth bar ──────────────────────────────────────────────────────
    const brdColor = m.pctAbove200ma < 15 ? '#ef4444' : m.pctAbove200ma < 30 ? '#f59e0b' : '#10b981';

    // ── put/call colour ──────────────────────────────────────────────────
    const pcColor  = m.putCallRatio > 1.5 ? '#ef4444' : m.putCallRatio > 1.1 ? '#f59e0b' : '#10b981';

    // ── ERP colours ──────────────────────────────────────────────────────
    const erpColor = e.erp < 1.0 ? '#ef4444' : e.erp < 2.5 ? '#f59e0b' : '#10b981';
    const erpSig   = e.erp < 1.0 ? 'overvalued' : e.erp < 2.5 ? 'warning' : 'normal';

    // ── Mini sparkline helper (returns canvas id, caller must draw after inject) ──
    function sparkId(n) { return `spark-${n}-${Date.now()}`; }

    const vixSparkId  = 'spark-vix';
    const hySparkId   = 'spark-hy';
    const erpSparkId  = 'spark-erp';
    const brdSparkId  = 'spark-brd';

    el.innerHTML = `
<!-- ═══ TOP ROW: HEADER + PANIC GAUGE ═════════════════════════════════ -->
<div class="mb-6 flex items-start justify-between gap-4 flex-wrap">
  <div>
    <h2 class="text-2xl font-bold text-white flex items-center gap-2">
      <i class="fas fa-satellite-dish text-blue-400"></i>
      Institutional Market Monitor
      <span class="text-sm font-normal text-gray-400 ml-2">Daily Snapshot · ${m.date}</span>
    </h2>
    <p class="text-gray-400 text-sm mt-1">Sentiment & Liquidity · Panic Indicators · Valuation · ERP</p>
  </div>
  <!-- Panic Score Gauge -->
  <div class="bg-gray-800/80 border border-gray-700 rounded-xl p-4 text-center min-w-[160px]">
    <div class="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Panic Score</div>
    <div class="relative w-24 h-24 mx-auto">
      <svg viewBox="0 0 36 36" class="w-24 h-24 -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#374151" stroke-width="3"/>
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="${panicColor}" stroke-width="3"
          stroke-dasharray="${panicPct} ${100 - panicPct}" stroke-linecap="round"/>
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-2xl font-bold" style="color:${panicColor}">${m.panicScore}</span>
        <span class="text-xs text-gray-400">/100</span>
      </div>
    </div>
    <div class="mt-2 text-sm font-bold" style="color:${panicColor}">${m.panicLabel}</div>
  </div>
</div>

<!-- ═══ SECTION 1: SENTIMENT & LIQUIDITY PANIC INDICATORS ══════════════ -->
<div class="mb-3 flex items-center gap-2">
  <div class="w-1 h-5 bg-red-500 rounded"></div>
  <h3 class="text-sm font-bold text-gray-200 uppercase tracking-wider">Sentiment & Liquidity — Panic Indicators</h3>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">

  <!-- VIX Term Structure -->
  <div class="bg-gray-800/70 border ${signalBg(vixTSSig)} rounded-xl p-4 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-xs text-gray-400 uppercase font-semibold">VIX Term Structure</span>
      ${badge(vixTSSig)}
    </div>
    <div class="flex items-end gap-3 mt-1">
      <div class="text-center">
        <div class="text-2xl font-bold text-white">${m.vix.toFixed(1)}</div>
        <div class="text-xs text-gray-500">Spot VIX</div>
      </div>
      <div class="text-gray-600 text-lg">→</div>
      <div class="text-center">
        <div class="text-xl font-semibold ${m.vixContango ? 'text-gray-300' : 'text-red-400'}">${m.vx1.toFixed(1)}</div>
        <div class="text-xs text-gray-500">VX1 (1M)</div>
      </div>
      <div class="text-gray-600 text-lg">→</div>
      <div class="text-center">
        <div class="text-xl font-semibold text-gray-400">${m.vx3.toFixed(1)}</div>
        <div class="text-xs text-gray-500">VX3 (3M)</div>
      </div>
    </div>
    <div class="text-xs ${m.vixContango ? 'text-emerald-400' : 'text-red-400'} font-medium">${vixTSLabel}</div>
    <div class="text-xs text-gray-500 mt-1">Slope: ${(m.vixTermStructure * 100).toFixed(1)}% · <b>Panic</b> when VIX > VX1</div>
    <canvas id="${vixSparkId}" height="40" class="mt-1 w-full"></canvas>
  </div>

  <!-- HY Credit Spread -->
  <div class="bg-gray-800/70 border ${signalBg(m.hyOasSignal)} rounded-xl p-4 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-xs text-gray-400 uppercase font-semibold">HY Credit Spread (OAS)</span>
      ${badge(m.hyOasSignal, hyLabel)}
    </div>
    <div class="flex items-baseline gap-2 mt-2">
      <span class="text-3xl font-bold" style="color:${hyColor}">${m.hyOas}</span>
      <span class="text-gray-400 text-sm">bps</span>
    </div>
    <!-- Threshold bar -->
    <div class="mt-2">
      <div class="flex justify-between text-xs text-gray-500 mb-1">
        <span>0</span><span class="text-yellow-500">400</span><span class="text-red-500">800</span><span>1200</span>
      </div>
      <div class="relative h-2 bg-gray-700 rounded-full">
        <div class="absolute h-2 rounded-full" style="width:${Math.min(m.hyOas/12,100)}%;background:${hyColor}"></div>
        <div class="absolute top-0 h-2 w-0.5 bg-yellow-500/60" style="left:33.3%"></div>
        <div class="absolute top-0 h-2 w-0.5 bg-red-500/60"    style="left:66.6%"></div>
      </div>
    </div>
    <div class="text-xs text-gray-500">ICE BofA US HY OAS (FRED: BAMLH0A0HYM2) · <b>Distress</b> >800 bps</div>
    <canvas id="${hySparkId}" height="40" class="mt-1 w-full"></canvas>
  </div>

  <!-- Market Breadth -->
  <div class="bg-gray-800/70 border ${signalBg(m.breadthSignal)} rounded-xl p-4 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-xs text-gray-400 uppercase font-semibold">Market Breadth (S5TH200)</span>
      ${badge(m.breadthSignal)}
    </div>
    <div class="flex items-baseline gap-2 mt-2">
      <span class="text-3xl font-bold" style="color:${brdColor}">${m.pctAbove200ma.toFixed(1)}%</span>
      <span class="text-gray-400 text-sm">above 200 DMA</span>
    </div>
    <!-- Arc gauge -->
    <div class="relative h-3 bg-gray-700 rounded-full mt-2">
      <div class="h-3 rounded-full transition-all" style="width:${m.pctAbove200ma}%;background:${brdColor}"></div>
      <div class="absolute top-0 h-3 w-0.5 bg-red-500/70"    style="left:15%"></div>
      <div class="absolute top-0 h-3 w-0.5 bg-yellow-500/70" style="left:30%"></div>
    </div>
    <div class="flex justify-between text-xs text-gray-600 mt-0.5">
      <span class="text-red-400">0% — Panic</span><span class="text-yellow-500">30%</span><span>100%</span>
    </div>
    <div class="text-xs text-gray-500">% of S&P 500 stocks above 200DMA · <b>Panic</b> <15%, <b>Warn</b> <30%</div>
    <canvas id="${brdSparkId}" height="40" class="mt-1 w-full"></canvas>
  </div>

  <!-- Put/Call Ratio -->
  <div class="bg-gray-800/70 border ${signalBg(m.putCallSignal)} rounded-xl p-4 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-xs text-gray-400 uppercase font-semibold">CBOE Equity Put/Call</span>
      ${badge(m.putCallSignal)}
    </div>
    <div class="flex items-baseline gap-2 mt-2">
      <span class="text-3xl font-bold" style="color:${pcColor}">${m.putCallRatio.toFixed(2)}</span>
      <span class="text-gray-400 text-sm">×</span>
    </div>
    <!-- Zones -->
    <div class="grid grid-cols-3 gap-1 mt-2 text-center text-xs">
      <div class="rounded py-1 ${m.putCallRatio < 0.8 ? 'bg-emerald-700 text-white' : 'bg-gray-700 text-gray-400'}">
        <div>&lt;0.8</div><div class="font-semibold">Greed</div>
      </div>
      <div class="rounded py-1 ${m.putCallRatio >= 0.8 && m.putCallRatio < 1.1 ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-400'}">
        <div>0.8–1.1</div><div class="font-semibold">Neutral</div>
      </div>
      <div class="rounded py-1 ${m.putCallRatio >= 1.1 ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-400'}">
        <div>&gt;1.1</div><div class="font-semibold">Fear</div>
      </div>
    </div>
    <div class="text-xs text-gray-500 mt-1">CBOE Total Put Volume ÷ Call Volume · <b>Extreme fear</b> >1.5</div>
  </div>
</div><!-- end panic grid -->

<!-- ═══ RATES ROW ══════════════════════════════════════════════════════ -->
<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
  ${[ ['10Y Treasury', m.usTreasury10y.toFixed(2)+'%', 'DGS10 (FRED)', m.usTreasury10y > 5 ? '#ef4444' : '#6b7280'],
      ['2Y Treasury',  m.usTreasury2y.toFixed(2)+'%',  'DGS2 (FRED)',  m.usTreasury2y > 5 ? '#ef4444' : '#6b7280'],
      ['Yield Curve (10-2)', (m.yieldCurve > 0 ? '+':'')+m.yieldCurve+' bps', m.yieldCurveInverted ? '⚠ Inverted (recession watch)' : 'Normal', m.yieldCurveInverted ? '#f59e0b' : '#10b981'],
      ['S&P 500 FWD P/E', '21.8×', 'vs 10Y avg 17-18×', '#f59e0b']
    ].map(([lbl,val,sub,col]) => `
  <div class="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3">
    <div class="text-xs text-gray-500 mb-1">${lbl}</div>
    <div class="text-xl font-bold" style="color:${col}">${val}</div>
    <div class="text-xs text-gray-600 mt-0.5">${sub}</div>
  </div>`).join('')}
</div>

<!-- ═══ SECTION 2: VALUATION — ERP ════════════════════════════════════ -->
<div class="mb-3 flex items-center gap-2">
  <div class="w-1 h-5 bg-yellow-500 rounded"></div>
  <h3 class="text-sm font-bold text-gray-200 uppercase tracking-wider">Equity Risk Premium — Over/Undervaluation</h3>
</div>
<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

  <!-- ERP Gauge -->
  <div class="bg-gray-800/70 border ${signalBg(erpSig)} rounded-xl p-5 flex flex-col">
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs text-gray-400 uppercase font-semibold">Equity Risk Premium</span>
      ${badge(erpSig)}
    </div>
    <div class="flex items-baseline gap-2">
      <span class="text-4xl font-bold" style="color:${erpColor}">${e.erp.toFixed(2)}</span>
      <span class="text-gray-400">%</span>
    </div>
    <div class="text-xs text-gray-500 mt-1">= Fwd Earnings Yield ${e.sp500EarningsYield.toFixed(2)}% − 10Y Tsy ${e.usTreasury10y.toFixed(2)}%</div>
    <div class="mt-3 grid grid-cols-3 gap-1 text-center text-xs">
      ${[['<1%','Overvalued','bg-red-700'], ['1-3%','Fair','bg-gray-600'], ['>3%','Attractive','bg-emerald-700']].map(([r,l,c])=>`
      <div class="rounded py-1.5 ${e.erp < 1 && r==='<1%' ? c+' text-white' : e.erp >=1 && e.erp < 3 && r==='1-3%' ? c+' text-white' : e.erp >=3 && r==='>3%' ? c+' text-white' : 'bg-gray-800 text-gray-600'}">
        <div class="font-bold">${r}</div><div>${l}</div></div>`).join('')}
    </div>
    <div class="mt-3 text-xs text-gray-500">
      Historical percentile: <span class="font-bold text-white">${e.erpHistoricalPercentile}th</span>
      <div class="h-1.5 bg-gray-700 rounded-full mt-1">
        <div class="h-1.5 rounded-full" style="width:${e.erpHistoricalPercentile}%;background:${erpColor}"></div>
      </div>
    </div>
    <div class="mt-3 p-2 bg-gray-900/50 rounded text-xs text-gray-400 leading-relaxed">${e.erpNote}</div>
  </div>

  <!-- ERP History Chart -->
  <div class="bg-gray-800/70 border border-gray-700/50 rounded-xl p-4 flex flex-col">
    <div class="text-xs text-gray-400 uppercase font-semibold mb-3">ERP 60-Day Trend</div>
    <canvas id="${erpSparkId}" class="flex-1" style="min-height:160px"></canvas>
    <div class="flex gap-4 mt-3 text-xs text-gray-500">
      <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-yellow-400 inline-block"></span>ERP %</span>
      <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-red-400 inline-block"></span>1% danger</span>
    </div>
  </div>

  <!-- VIX History Chart -->
  <div class="bg-gray-800/70 border border-gray-700/50 rounded-xl p-4 flex flex-col">
    <div class="text-xs text-gray-400 uppercase font-semibold mb-3">VIX Spot vs VX1 — 60D</div>
    <canvas id="spark-vix-hist" class="flex-1" style="min-height:160px"></canvas>
    <div class="flex gap-4 mt-3 text-xs text-gray-500">
      <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-blue-400 inline-block"></span>VIX Spot</span>
      <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-purple-400 inline-block"></span>VX1</span>
    </div>
  </div>
</div>

<!-- ═══ COMPOSITE SIGNAL TABLE ══════════════════════════════════════════ -->
<div class="mb-3 flex items-center gap-2">
  <div class="w-1 h-5 bg-blue-500 rounded"></div>
  <h3 class="text-sm font-bold text-gray-200 uppercase tracking-wider">Composite Signal Summary</h3>
</div>
<div class="bg-gray-800/60 border border-gray-700/40 rounded-xl overflow-hidden mb-4">
  <table class="w-full text-sm">
    <thead><tr class="border-b border-gray-700/50 text-xs text-gray-500 uppercase">
      <th class="py-2 px-4 text-left">Indicator</th>
      <th class="py-2 px-4 text-right">Value</th>
      <th class="py-2 px-4 text-center">Signal</th>
      <th class="py-2 px-4 text-left">Threshold / Note</th>
      <th class="py-2 px-4 text-left">Source</th>
    </tr></thead>
    <tbody class="divide-y divide-gray-700/30">
      ${[
        ['VIX Spot', m.vix.toFixed(1), vixTSSig, 'Backwardation (VIX > VX1) = Panic', 'Yahoo Finance'],
        ['VIX Term Slope', (m.vixTermStructure*100).toFixed(1)+'%', vixTSSig, '< 0 means contango (calm)', 'VX Futures'],
        ['HY OAS Spread', m.hyOas+' bps', m.hyOasSignal, '>400 caution · >800 distress', 'FRED BAMLH0A0HYM2'],
        ['Market Breadth', m.pctAbove200ma.toFixed(1)+'%', m.breadthSignal, '<15% panic · <30% warning', 'S5TH200X'],
        ['Put/Call Ratio', m.putCallRatio.toFixed(2)+'×', m.putCallSignal, '>1.1 fear · >1.5 extreme fear', 'CBOE Equity'],
        ['10Y–2Y Spread', m.yieldCurve+' bps', m.yieldCurveInverted ? 'warning' : 'normal', 'Inversion = recession watch', 'FRED DGS10/DGS2'],
        ['ERP (Eq. Risk Prem)', e.erp.toFixed(2)+'%', erpSig, '<1% overvalued · <1.5% caution', 'FWD P/E − 10Y'],
        ['ERP Percentile', e.erpHistoricalPercentile+'th', erpSig, 'Bottom 10% = bubble territory', 'Historical'],
      ].map(([ind, val, sig, note, src]) => `
      <tr class="hover:bg-gray-700/20">
        <td class="py-2 px-4 text-gray-300 font-medium">${ind}</td>
        <td class="py-2 px-4 text-right font-mono font-bold" style="color:${signalColor(sig)}">${val}</td>
        <td class="py-2 px-4 text-center">${badge(sig)}</td>
        <td class="py-2 px-4 text-gray-500 text-xs">${note}</td>
        <td class="py-2 px-4 text-gray-600 text-xs">${src}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>
`;

    // ── Draw sparklines & charts ────────────────────────────────────────
    // VIX spot sparkline (last 30 from history)
    const vixData = macH.slice(-30);
    if (vixData.length && document.getElementById(vixSparkId)) {
      new Chart(document.getElementById(vixSparkId), {
        type: 'line',
        data: { labels: vixData.map(d => d.date),
                datasets: [{ data: vixData.map(d => d.vix), borderColor: '#60a5fa',
                             borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: false }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                   scales: { x: { display: false }, y: { display: false } } }
      });
    }

    // HY OAS sparkline
    if (macH.length && document.getElementById(hySparkId)) {
      const hyData = macH.slice(-30);
      new Chart(document.getElementById(hySparkId), {
        type: 'line',
        data: { labels: hyData.map(d => d.date),
                datasets: [{ data: hyData.map(d => d.hyOas), borderColor: hyColor,
                             borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: false }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                   scales: { x: { display: false }, y: { display: false } } }
      });
    }

    // Breadth sparkline
    if (macH.length && document.getElementById(brdSparkId)) {
      const brd = macH.slice(-30);
      new Chart(document.getElementById(brdSparkId), {
        type: 'line',
        data: { labels: brd.map(d => d.date),
                datasets: [{ data: brd.map(d => d.pctAbove200ma), borderColor: brdColor,
                             borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: false }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                   scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } } }
      });
    }

    // ERP 60-day trend
    if (erpH.length && document.getElementById(erpSparkId)) {
      new Chart(document.getElementById(erpSparkId), {
        type: 'line',
        data: {
          labels: erpH.map(d => d.date),
          datasets: [
            { label: 'ERP %', data: erpH.map(d => d.erp),
              borderColor: '#facc15', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: false },
            { label: '1% danger', data: erpH.map(() => 1.0),
              borderColor: '#ef4444', borderWidth: 1, borderDash: [4, 3], pointRadius: 0, fill: false }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: '#374151' } }
          }
        }
      });
    }

    // VIX vs VX1 60-day
    if (macH.length && document.getElementById('spark-vix-hist')) {
      new Chart(document.getElementById('spark-vix-hist'), {
        type: 'line',
        data: {
          labels: macH.map(d => d.date),
          datasets: [
            { label: 'VIX', data: macH.map(d => d.vix),
              borderColor: '#60a5fa', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: false },
            { label: 'VX1', data: macH.map(d => d.vx1),
              borderColor: '#a78bfa', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: false, borderDash: [3, 2] }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: '#374151' } }
          }
        }
      });
    }

  } catch(err) {
    el.innerHTML = `<div class="text-red-400 p-6">Error loading dashboard: ${err.message}</div>`;
    console.error(err);
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  2. DATA CENTER — Fundamental Valuation Hub                         ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderDataCenter(el) {
  el.innerHTML = `<div class="flex items-center justify-center h-32 text-gray-400">
    <i class="fas fa-spinner fa-spin mr-2"></i>Loading data center…</div>`;

  try {
    const [fundRes, erpRes, healthRes, macroRes] = await Promise.all([
      axios.get(`${API}/api/dc/fundamental`),
      axios.get(`${API}/api/dc/erp/current`),
      axios.get(`${API}/api/dc/health`),
      axios.get(`${API}/api/dc/macro/current`)
    ]);
    const stocks = fundRes.data.data || [];
    const e = erpRes.data;
    const health = healthRes.data;
    const m = macroRes.data;

    // ── active tab state ────────────────────────────────────────────────
    let dcTab = 'valuation';

    function renderDCContent() {
      const tabContent = document.getElementById('dc-tab-content');
      if (!tabContent) return;

      if (dcTab === 'valuation') {
        // Sort by EV/EBITDA ascending (cheapest first)
        const sorted = [...stocks].sort((a, b) => a.evEbitda - b.evEbitda);
        tabContent.innerHTML = `
<div class="mb-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-xs text-blue-300">
  <i class="fas fa-info-circle mr-1"></i>
  ${fundRes.data.gaapAdjustmentNote} · All data is Point-in-Time (PIT) compliant — last filing date shown.
</div>
<div class="overflow-x-auto">
<table class="w-full text-xs">
  <thead><tr class="border-b border-gray-700/50 text-gray-500 uppercase text-xs">
    <th class="py-2 px-3 text-left">Ticker</th>
    <th class="py-2 px-3 text-left">Sector</th>
    <th class="py-2 px-3 text-right">Mkt Cap ($B)</th>
    <th class="py-2 px-3 text-right">EV ($B)</th>
    <th class="py-2 px-3 text-right">Adj EBITDA</th>
    <th class="py-2 px-3 text-right">EV/EBITDA</th>
    <th class="py-2 px-3 text-right">Pctile</th>
    <th class="py-2 px-3 text-right">EV/Sales</th>
    <th class="py-2 px-3 text-right">Fwd P/E</th>
    <th class="py-2 px-3 text-right">FCF Yield</th>
    <th class="py-2 px-3 text-right">Net Lev</th>
    <th class="py-2 px-3 text-center">PIT Date</th>
  </tr></thead>
  <tbody class="divide-y divide-gray-700/25">
  ${sorted.map(s => {
    const evEbColor = s.evEbitdaPercentile <= 10 ? '#10b981' : s.evEbitdaPercentile <= 30 ? '#6ee7b7' :
                      s.evEbitdaPercentile >= 80 ? '#ef4444' : '#d1d5db';
    const fcfColor  = s.fcfYield >= 6 ? '#10b981' : s.fcfYield >= 3 ? '#fbbf24' : '#ef4444';
    const levColor  = s.netLeverage > 3 ? '#ef4444' : s.netLeverage > 2 ? '#f59e0b' : '#10b981';
    const pitBadge  = s.pitCompliant
      ? '<span class="text-emerald-400 text-xs">✓ PIT</span>'
      : '<span class="text-red-400 text-xs">⚠ Lag</span>';
    const undervalFlag = s.evEbitdaPercentile <= 10 && s.fcfYield > 4
      ? '<span class="ml-1 bg-emerald-600 text-white text-xs px-1 py-0.5 rounded">★ Value</span>' : '';
    return `<tr class="hover:bg-gray-700/20 ${s.evEbitdaPercentile <= 10 ? 'bg-emerald-900/10' : ''}">
      <td class="py-2 px-3 font-bold text-white">${s.ticker}${undervalFlag}</td>
      <td class="py-2 px-3 text-gray-400 max-w-[120px] truncate" title="${s.sector}">${s.name}</td>
      <td class="py-2 px-3 text-right text-gray-300">$${s.marketCap.toLocaleString()}</td>
      <td class="py-2 px-3 text-right text-gray-300">$${s.ev.toLocaleString()}</td>
      <td class="py-2 px-3 text-right text-gray-300">$${s.adjustedEbitda.toFixed(1)}B</td>
      <td class="py-2 px-3 text-right font-bold" style="color:${evEbColor}">${s.evEbitda.toFixed(1)}×</td>
      <td class="py-2 px-3 text-right">
        <span class="text-xs font-semibold" style="color:${evEbColor}">${s.evEbitdaPercentile}%ile</span>
      </td>
      <td class="py-2 px-3 text-right text-gray-400">${s.evSales.toFixed(1)}×</td>
      <td class="py-2 px-3 text-right text-gray-400">${s.forwardPE.toFixed(1)}×</td>
      <td class="py-2 px-3 text-right font-semibold" style="color:${fcfColor}">${s.fcfYield.toFixed(1)}%</td>
      <td class="py-2 px-3 text-right font-semibold" style="color:${levColor}">${s.netLeverage.toFixed(1)}×</td>
      <td class="py-2 px-3 text-center">${pitBadge}<div class="text-gray-600 text-xs">${s.lastReportDate}</div></td>
    </tr>`;
  }).join('')}
  </tbody>
</table></div>

<!-- Undervaluation Signals -->
<div class="mt-4">
  <div class="mb-2 flex items-center gap-2">
    <div class="w-1 h-4 bg-emerald-500 rounded"></div>
    <span class="text-xs font-bold text-gray-300 uppercase">Undervaluation Signals — EV/EBITDA ≤10th Pctile + FCF Yield >4% + Low Leverage</span>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
  ${stocks.filter(s => s.evEbitdaPercentile <= 20 && s.fcfYield > 3).slice(0, 6).map(s => `
    <div class="bg-emerald-900/15 border border-emerald-600/30 rounded-lg p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="font-bold text-white text-sm">${s.ticker}</span>
        <span class="text-xs text-gray-400">${s.sector.split('—')[0].trim()}</span>
      </div>
      <div class="grid grid-cols-3 gap-2 text-xs">
        <div class="text-center">
          <div class="text-emerald-400 font-bold">${s.evEbitda.toFixed(1)}×</div>
          <div class="text-gray-500">EV/EBITDA</div>
          <div class="text-emerald-400 text-xs">${s.evEbitdaPercentile}%ile</div>
        </div>
        <div class="text-center">
          <div class="text-yellow-400 font-bold">${s.fcfYield.toFixed(1)}%</div>
          <div class="text-gray-500">FCF Yield</div>
          <div class="text-gray-600">(risk-free: 4.5%)</div>
        </div>
        <div class="text-center">
          <div class="font-bold" style="color:${s.netLeverage > 3 ? '#ef4444' : '#10b981'}">${s.netLeverage.toFixed(1)}×</div>
          <div class="text-gray-500">Net Lev</div>
          <div class="text-gray-600">${s.netLeverageSignal}</div>
        </div>
      </div>
      <div class="mt-2 text-xs text-gray-500 bg-gray-900/40 rounded p-1.5">${s.adjustedEbitdaNote||'Adj EBITDA = OpInc + D&A + SBC'}</div>
    </div>
  `).join('')}
  </div>
</div>`;

      } else if (dcTab === 'sector') {
        // Sector multiples (EV/EBITDA & EV/Sales)
        const sectors = [...new Set(stocks.map(s => s.sector.split('—')[0].trim()))];
        tabContent.innerHTML = `
<div class="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
  <div class="bg-gray-800/70 border border-gray-700/50 rounded-xl p-4">
    <div class="text-xs text-gray-400 uppercase font-semibold mb-3">EV/EBITDA by Ticker — TMT Universe</div>
    <canvas id="dc-eveb-chart" height="220"></canvas>
  </div>
  <div class="bg-gray-800/70 border border-gray-700/50 rounded-xl p-4">
    <div class="text-xs text-gray-400 uppercase font-semibold mb-3">FCF Yield vs Risk-Free Rate (4.52%)</div>
    <canvas id="dc-fcf-chart" height="220"></canvas>
  </div>
</div>
<div class="overflow-x-auto">
<table class="w-full text-sm">
  <thead><tr class="border-b border-gray-700/50 text-xs text-gray-500 uppercase">
    <th class="py-2 px-4 text-left">Company</th>
    <th class="py-2 px-4 text-right">Mkt Cap</th>
    <th class="py-2 px-4 text-right">EV/EBITDA</th>
    <th class="py-2 px-4 text-right">EV/Sales</th>
    <th class="py-2 px-4 text-right">Fwd P/E</th>
    <th class="py-2 px-4 text-right">FCF Yield</th>
    <th class="py-2 px-4 text-right">Earn Yield</th>
    <th class="py-2 px-4 text-left">Signal</th>
  </tr></thead>
  <tbody class="divide-y divide-gray-700/30">
  ${stocks.map(s => {
    const sig = s.fcfYield > 6 && m.usTreasury10y < 5 ? 'undervalued' :
                s.evEbitdaPercentile >= 80 ? 'overvalued' : 'neutral';
    const fcfVsRf = s.fcfYield - m.usTreasury10y;
    const rfColor = fcfVsRf > 0 ? '#10b981' : '#ef4444';
    return `<tr class="hover:bg-gray-700/20">
      <td class="py-2 px-4">
        <div class="font-semibold text-white">${s.ticker}</div>
        <div class="text-xs text-gray-500">${s.sector.split('—')[0].trim()}</div>
      </td>
      <td class="py-2 px-4 text-right text-gray-300">$${s.marketCap}B</td>
      <td class="py-2 px-4 text-right font-mono">${s.evEbitda.toFixed(1)}×</td>
      <td class="py-2 px-4 text-right font-mono text-gray-400">${s.evSales.toFixed(1)}×</td>
      <td class="py-2 px-4 text-right font-mono text-gray-400">${s.forwardPE.toFixed(0)}×</td>
      <td class="py-2 px-4 text-right font-semibold" style="color:${fcfVsRf > 0 ? '#10b981' : '#ef4444'}">${s.fcfYield.toFixed(1)}%</td>
      <td class="py-2 px-4 text-right text-gray-400">${s.earningsYield.toFixed(1)}%</td>
      <td class="py-2 px-4">
        <span class="px-2 py-0.5 rounded-full text-xs font-bold ${sig==='undervalued' ? 'bg-emerald-700 text-emerald-100' : sig==='overvalued' ? 'bg-red-700 text-red-100' : 'bg-gray-700 text-gray-300'}">${sig}</span>
      </td>
    </tr>`;
  }).join('')}
  </tbody>
</table></div>`;

        setTimeout(() => {
          // EV/EBITDA bar chart
          const c1 = document.getElementById('dc-eveb-chart');
          if (c1) {
            const sortedByEv = [...stocks].sort((a,b) => a.evEbitda - b.evEbitda);
            new Chart(c1, {
              type: 'bar',
              data: {
                labels: sortedByEv.map(s => s.ticker),
                datasets: [{
                  label: 'EV/EBITDA',
                  data: sortedByEv.map(s => s.evEbitda),
                  backgroundColor: sortedByEv.map(s =>
                    s.evEbitdaPercentile <= 20 ? 'rgba(16,185,129,0.7)' :
                    s.evEbitdaPercentile >= 70 ? 'rgba(239,68,68,0.7)' : 'rgba(99,102,241,0.6)'),
                  borderRadius: 4
                }]
              },
              options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
                  y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } }
                }
              }
            });
          }
          // FCF Yield chart
          const c2 = document.getElementById('dc-fcf-chart');
          if (c2) {
            const sortedByFcf = [...stocks].sort((a,b) => b.fcfYield - a.fcfYield);
            new Chart(c2, {
              type: 'bar',
              data: {
                labels: sortedByFcf.map(s => s.ticker),
                datasets: [
                  { label: 'FCF Yield %', data: sortedByFcf.map(s => s.fcfYield),
                    backgroundColor: sortedByFcf.map(s => s.fcfYield > m.usTreasury10y ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)'),
                    borderRadius: 4 },
                  { label: '10Y Risk-Free', data: sortedByFcf.map(() => m.usTreasury10y),
                    type: 'line', borderColor: '#fbbf24', borderWidth: 2,
                    borderDash: [5, 3], pointRadius: 0, fill: false }
                ]
              },
              options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#9ca3af', font: { size: 10 } } } },
                scales: {
                  x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
                  y: { ticks: { color: '#9ca3af', callback: v => v+'%' }, grid: { color: '#374151' } }
                }
              }
            });
          }
        }, 50);

      } else if (dcTab === 'pipeline') {
        // Data pipeline health
        const srcs = health.dataSources || [];
        tabContent.innerHTML = `
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
  <!-- Sources -->
  <div>
    <div class="mb-3 text-xs font-bold text-gray-300 uppercase">Data Sources & Freshness</div>
    <div class="space-y-2">
    ${srcs.map(s => `
      <div class="bg-gray-800/60 border border-gray-700/40 rounded-lg p-3 flex items-center gap-3">
        <div class="w-2 h-2 rounded-full ${s.status === 'live' ? 'bg-emerald-400 animate-pulse' : s.status === 'connected' ? 'bg-emerald-400 animate-pulse' : s.status === 'mock' ? 'bg-yellow-400' : 'bg-gray-500'}"></div>
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-white">${s.name}</span>
            <span class="text-xs px-2 py-0.5 rounded-full ${(s.status==='live'||s.status==='connected') ? 'bg-emerald-800 text-emerald-200' : 'bg-yellow-800 text-yellow-200'}">${s.status||'mock'}</span>
          </div>
          ${s.apiCode ? `<div class="text-xs text-gray-500 mt-0.5 font-mono">${s.apiCode}</div>` : ''}
          ${s.compliance ? `<div class="text-xs text-blue-400 mt-0.5">${s.compliance}</div>` : ''}
          ${s.updateFreq ? `<div class="text-xs text-gray-600">Update: ${s.updateFreq}</div>` : ''}
          ${s.latency ? `<div class="text-xs text-gray-600">Latency: ${s.latency}</div>` : ''}
        </div>
      </div>
    `).join('')}
    </div>
  </div>
  <!-- Bias Safeguards -->
  <div>
    <div class="mb-3 text-xs font-bold text-gray-300 uppercase">Backtest Bias Safeguards</div>
    <div class="space-y-2">
      ${health.pitArchitecture ? `
      <div class="bg-emerald-900/20 border border-emerald-600/30 rounded-lg p-3">
        <div class="text-sm font-bold text-emerald-300 mb-2">✓ Point-in-Time (PIT) Architecture</div>
        <ul class="text-xs text-gray-400 space-y-1">
          ${health.pitArchitecture.map(r => `<li class="flex items-start gap-1"><span class="text-emerald-500 mt-0.5">•</span>${r}</li>`).join('')}
        </ul>
      </div>` : ''}
      ${health.survivorshipBias ? `
      <div class="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
        <div class="text-sm font-bold text-blue-300 mb-2">✓ Survivorship Bias Mitigation</div>
        <ul class="text-xs text-gray-400 space-y-1">
          ${health.survivorshipBias.map(r => `<li class="flex items-start gap-1"><span class="text-blue-500 mt-0.5">•</span>${r}</li>`).join('')}
        </ul>
      </div>` : ''}
      ${health.gaapAdjustments ? `
      <div class="bg-purple-900/20 border border-purple-600/30 rounded-lg p-3">
        <div class="text-sm font-bold text-purple-300 mb-2">GAAP Adjustment Rules</div>
        <ul class="text-xs text-gray-400 space-y-1">
          ${health.gaapAdjustments.map(r => `<li class="flex items-start gap-1"><span class="text-purple-500 mt-0.5">•</span>${r}</li>`).join('')}
        </ul>
      </div>` : ''}
    </div>
    <!-- ERP note -->
    <div class="mt-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3">
      <div class="text-xs font-bold text-yellow-300 mb-1">Live ERP Warning</div>
      <div class="text-xs text-gray-300">${e.erpNote}</div>
    </div>
  </div>
</div>`;
      }
    }

    el.innerHTML = `
<!-- Header -->
<div class="mb-5 flex items-start justify-between flex-wrap gap-4">
  <div>
    <h2 class="text-2xl font-bold text-white flex items-center gap-2">
      <i class="fas fa-database text-purple-400"></i>
      数据中心 Data Center
    </h2>
    <p class="text-gray-400 text-sm mt-1">Fundamental Valuation · Sector Multiples · FCF Yield · GAAP-Adjusted · PIT-Compliant</p>
  </div>
  <div class="flex gap-2 text-xs">
    ${[['valuation','Valuation Table'],['sector','Sector Multiples'],['pipeline','Data Pipeline']].map(([t,l])=>`
    <button onclick="window.__dcSetTab('${t}')" id="dc-tab-${t}"
      class="px-3 py-1.5 rounded-lg font-semibold border transition-colors
        ${dcTab===t ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}">${l}</button>`).join('')}
  </div>
</div>

<!-- Mini KPI row -->
<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
  ${[
    ['Stocks in Universe', stocks.length, 'TMT + mega cap', '#a78bfa'],
    ['Avg EV/EBITDA', (stocks.reduce((a,s)=>a+s.evEbitda,0)/stocks.length).toFixed(1)+'×', 'vs 10Y avg ~15×', '#60a5fa'],
    ['Avg FCF Yield', (stocks.reduce((a,s)=>a+s.fcfYield,0)/stocks.length).toFixed(1)+'%', `vs 10Y Tsy ${m.usTreasury10y}%`, '#34d399'],
    ['ERP', e.erp.toFixed(2)+'%', e.erpSignal, e.erp < 1 ? '#ef4444' : '#fbbf24']
  ].map(([l,v,s,c])=>`
  <div class="bg-gray-800/60 border border-gray-700/40 rounded-lg p-3">
    <div class="text-xs text-gray-500 mb-1">${l}</div>
    <div class="text-2xl font-bold" style="color:${c}">${v}</div>
    <div class="text-xs text-gray-600">${s}</div>
  </div>`).join('')}
</div>

<div id="dc-tab-content"></div>`;

    // Set tab switcher
    window.__dcSetTab = function(t) {
      dcTab = t;
      ['valuation','sector','pipeline'].forEach(x => {
        const btn = document.getElementById(`dc-tab-${x}`);
        if (btn) {
          btn.className = btn.className.replace(/bg-purple-600 border-purple-500 text-white|bg-gray-800 border-gray-600 text-gray-400 hover:text-white/g, '');
          btn.className += t === x ? ' bg-purple-600 border-purple-500 text-white' : ' bg-gray-800 border-gray-600 text-gray-400 hover:text-white';
        }
      });
      renderDCContent();
    };

    renderDCContent();

  } catch(err) {
    el.innerHTML = `<div class="text-red-400 p-6">Error loading data center: ${err.message}</div>`;
    console.error(err);
  }
}


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  3. FIVE-FACTOR SCREENER                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderScreener(el) {
  const { data } = await axios.get(`${API}/api/us/screener?sort=compositeScore`)
  const stocks = data.stocks

  el.innerHTML = `
  <div class="grid grid-cols-5 gap-3 mb-5">
    ${Object.entries(data.fiveFactorWeights).map(([k,v])=>`
    <div class="kpi-card text-center">
      <div class="text-xs text-gray-500 mb-1">${{growth:'成长因子',valuation:'估值因子',quality:'质量因子',safety:'安全因子',momentum:'动量因子'}[k]}</div>
      <div class="text-2xl font-bold text-cyan-400">${(v*100).toFixed(0)}%</div>
      <div class="text-[10px] text-gray-600 mt-1">${{growth:'Rev/EPS Growth',valuation:'Fwd PE/EV-EBITDA',quality:'ROE/Margin',safety:'Debt/Beta',momentum:'52W High%'}[k]}</div>
    </div>`).join('')}
  </div>

  <div class="card mb-4 p-3 flex items-center gap-4 flex-wrap">
    <span class="text-xs text-gray-400">过滤条件:</span>
    <span class="text-xs text-emerald-400"><i class="fas fa-check-circle"></i> 市值>$5B</span>
    <span class="text-xs text-emerald-400"><i class="fas fa-check-circle"></i> 收入增速>0%</span>
    <span class="text-xs text-emerald-400"><i class="fas fa-check-circle"></i> 毛利率>20%</span>
    <span class="ml-auto text-xs text-gray-400">共 <span class="text-white font-bold">${stocks.length}</span> 只股票通过筛选</span>
    <select onchange="sortScreener(this.value)" class="bg-[#1a2540] border border-[#1e2d4a] text-xs text-gray-300 rounded px-2 py-1">
      <option value="compositeScore">综合评分排序</option>
      <option value="growthScore">成长评分</option>
      <option value="valuationScore">估值评分</option>
      <option value="qualityScore">质量评分</option>
      <option value="revenueGrowth">收入增速</option>
      <option value="forwardPE">前向PE</option>
    </select>
  </div>

  <div class="card overflow-hidden">
    <div class="overflow-auto">
      <table class="data-table" id="screenerTable"><thead><tr>
        <th>股票</th><th>板块</th><th>股价</th><th>市值($B)</th>
        <th>Fwd PE</th><th>EV/EBITDA</th><th>Rev增速</th><th>毛利率</th><th>ROE</th>
        <th>FCF收益率</th><th>Beta</th><th>分析师</th>
        <th class="text-cyan-400">综合评分</th>
        <th>成长</th><th>估值</th><th>质量</th>
      </tr></thead><tbody>
        ${stocks.map(s=>`<tr onclick="showStockDetail('${s.ticker}')" class="cursor-pointer">
          <td>
            <div class="font-bold text-white">${s.ticker}</div>
            <div class="text-[10px] text-gray-500">${s.name.slice(0,20)}</div>
          </td>
          <td class="text-[11px] text-gray-400">${s.sector.slice(0,12)}</td>
          <td>
            <div class="font-mono text-white">$${s.price.toFixed(1)}</div>
            <div class="text-[10px] ${s.changePct>=0?'text-emerald-400':'text-red-400'}">${fmt.pct(s.changePct)}</div>
          </td>
          <td class="font-mono text-gray-300">$${s.marketCap.toFixed(0)}B</td>
          <td class="font-mono ${s.forwardPE>40?'text-amber-400':'text-gray-300'}">${s.forwardPE>0?s.forwardPE.toFixed(1)+'x':'N/A'}</td>
          <td class="font-mono text-gray-300">${s.evEbitda>0?s.evEbitda.toFixed(1)+'x':'N/A'}</td>
          <td class="font-mono font-bold ${s.revenueGrowth>=20?'text-emerald-400':s.revenueGrowth>=10?'text-amber-400':'text-gray-400'}">${s.revenueGrowth>0?'+':''}${s.revenueGrowth.toFixed(0)}%</td>
          <td class="font-mono text-gray-300">${s.grossMargin.toFixed(0)}%</td>
          <td class="font-mono text-gray-300">${s.roe.toFixed(0)}%</td>
          <td class="font-mono text-gray-300">${s.fcfYield.toFixed(1)}%</td>
          <td class="font-mono text-gray-400">${s.beta.toFixed(2)}</td>
          <td class="text-[11px] ${fmt.ratingColor(s.analystRating)}">${fmt.ratingLabel(s.analystRating)}<br><span class="text-gray-600">${s.numAnalysts}家</span></td>
          <td>
            <div class="flex items-center gap-2">
              <span class="text-white font-bold text-sm">${s.compositeScore}</span>
              <div class="score-bar w-12"><div class="score-bar-fill ${scoreColor(s.compositeScore)}" style="width:${s.compositeScore}%"></div></div>
            </div>
          </td>
          <td><div class="score-bar w-10"><div class="score-bar-fill bg-cyan-500" style="width:${s.growthScore}%"></div></div><span class="text-[10px] text-gray-500">${s.growthScore}</span></td>
          <td><div class="score-bar w-10"><div class="score-bar-fill bg-amber-500" style="width:${s.valuationScore}%"></div></div><span class="text-[10px] text-gray-500">${s.valuationScore}</span></td>
          <td><div class="score-bar w-10"><div class="score-bar-fill bg-purple-500" style="width:${s.qualityScore}%"></div></div><span class="text-[10px] text-gray-500">${s.qualityScore}</span></td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  </div>

  <!-- Stock Detail Modal -->
  <div id="stockModal" class="hidden fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onclick="closeModal(event)">
    <div class="card w-[700px] max-h-[80vh] overflow-y-auto p-6" id="stockModalContent"></div>
  </div>`

  window._screenerData = stocks
}

window.sortScreener = function(field) {
  navigate('screener')
}

window.showStockDetail = function(ticker) {
  axios.get(`${API}/api/us/stock/${ticker}`).then(({ data }) => {
    const s = data.stock, e = data.earnings[0]
    document.getElementById('stockModalContent').innerHTML = `
      <div class="flex justify-between items-start mb-4">
        <div>
          <h2 class="text-xl font-bold text-white">${s.ticker} — ${s.name}</h2>
          <p class="text-xs text-gray-400">${s.sector} · ${s.industry}</p>
        </div>
        <button onclick="document.getElementById('stockModal').classList.add('hidden')" class="text-gray-400 hover:text-white text-xl">&times;</button>
      </div>
      <div class="grid grid-cols-3 gap-3 mb-4">
        ${miniKpi('股价', '$'+s.price.toFixed(2), fmt.pct(s.changePct), s.changePct>=0)}
        ${miniKpi('市值', '$'+s.marketCap.toFixed(0)+'B', '')}
        ${miniKpi('分析师评分', fmt.ratingLabel(s.analystRating), 'PT $'+s.priceTarget)}
      </div>
      <div class="grid grid-cols-4 gap-2 mb-4">
        ${[
          ['Fwd PE', s.forwardPE>0?s.forwardPE.toFixed(1)+'x':'N/A'],
          ['EV/EBITDA', s.evEbitda>0?s.evEbitda.toFixed(1)+'x':'N/A'],
          ['Rev增速', s.revenueGrowth.toFixed(0)+'%'],
          ['EPS增速', s.earningsGrowth.toFixed(0)+'%'],
          ['毛利率', s.grossMargin.toFixed(1)+'%'],
          ['ROE', s.roe.toFixed(1)+'%'],
          ['FCF收益率', s.fcfYield.toFixed(1)+'%'],
          ['Beta', s.beta.toFixed(2)],
        ].map(([k,v])=>`<div class="bg-[#111827] rounded p-2">
          <div class="text-[10px] text-gray-500">${k}</div>
          <div class="text-sm font-bold text-white">${v}</div>
        </div>`).join('')}
      </div>
      ${e ? `<div class="card p-3 mb-3">
        <div class="text-xs font-semibold text-gray-400 mb-2">最新财报: ${e.quarter}</div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>EPS: <span class="text-white font-bold">$${e.epsReported.toFixed(2)}</span> vs 预期 $${e.epsEstimate.toFixed(2)} <span class="${e.epsSurprisePct>=0?'text-emerald-400':'text-red-400'}">(${e.epsSurprisePct>=0?'+':''}${e.epsSurprisePct.toFixed(1)}%)</span></div>
          <div>收入: <span class="text-white font-bold">$${e.revenueReported.toFixed(1)}B</span> vs 预期 $${e.revenueEstimate.toFixed(1)}B <span class="${e.revenueSurprisePct>=0?'text-emerald-400':'text-red-400'}">(${e.revenueSurprisePct>=0?'+':''}${e.revenueSurprisePct.toFixed(1)}%)</span></div>
        </div>
        <div class="mt-2 text-[11px] text-gray-400">${e.analystNote}</div>
      </div>` : ''}
      <div class="flex items-center gap-3 text-xs">
        <span class="text-gray-500">综合评分:</span>
        <span class="text-2xl font-bold text-white">${s.compositeScore}</span>
        <div class="score-bar flex-1"><div class="score-bar-fill ${scoreColor(s.compositeScore)}" style="width:${s.compositeScore}%"></div></div>
        <span class="text-gray-500">数据源:</span>
        <span class="text-cyan-400">${s.dataSource}</span>
        ${s.divergenceFlag?'<span class="text-amber-400">⚠️ 数据偏差>5%</span>':''}
      </div>`
    document.getElementById('stockModal').classList.remove('hidden')
  })
}
window.closeModal = function(e) {
  if (e.target.id === 'stockModal') document.getElementById('stockModal').classList.add('hidden')
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  4. STRATEGIES                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderStrategies(el) {
  const [stgRes, aiRes] = await Promise.all([
    axios.get(`${API}/api/strategies`),
    axios.get(`${API}/api/research/ai-strategies`),
  ])
  const strategies = stgRes.data, aiStgs = aiRes.data.strategies

  el.innerHTML = `
  <div class="flex gap-2 mb-4">
    <button class="tab-btn active" onclick="stgTab('live',this)">📈 实盘策略</button>
    <button class="tab-btn" onclick="stgTab('ai',this)">🤖 AI提炼策略</button>
  </div>

  <div id="stg-live">
    <div class="grid grid-cols-3 gap-4 mb-5">
      ${strategies.map(s=>`
      <div class="card p-4 cursor-pointer hover:border-cyan-500/40 transition" onclick="toggleStratDetail('${s.id}')">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="font-semibold text-white text-sm">${s.name}</div>
            <div class="text-[11px] text-gray-500 mt-0.5">${s.typeLabel} · ${s.startDate}</div>
          </div>
          <span class="badge badge-${s.status}">${s.status}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div><div class="text-[10px] text-gray-500">收益率</div><div class="text-lg font-bold ${s.pnl>=0?'text-emerald-400':'text-red-400'}">${fmt.pct(s.pnlPct)}</div></div>
          <div><div class="text-[10px] text-gray-500">夏普比率</div><div class="text-lg font-bold text-amber-400">${s.sharpe.toFixed(2)}</div></div>
          <div><div class="text-[10px] text-gray-500">最大回撤</div><div class="text-sm font-bold text-red-400">${s.maxDrawdown.toFixed(1)}%</div></div>
          <div><div class="text-[10px] text-gray-500">胜率</div><div class="text-sm font-bold text-gray-300">${s.winRate.toFixed(1)}%</div></div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-500">权重</span>
          <div class="flex items-center gap-2">
            <div class="score-bar w-20"><div class="score-bar-fill bg-cyan-500" style="width:${s.weight*4}%"></div></div>
            <span class="text-xs text-gray-300">${s.weight}%</span>
          </div>
        </div>
        <div id="detail-${s.id}" class="hidden mt-3 pt-3 border-t border-[#1e2d4a]">
          <p class="text-xs text-gray-400">${s.description}</p>
          <div class="mt-2 text-xs text-gray-500">资金规模: <span class="text-white">${fmt.money(s.capital)}</span></div>
        </div>
      </div>`).join('')}
    </div>
  </div>

  <div id="stg-ai" class="hidden">
    <div class="bbg-alert mb-4">
      <i class="fas fa-robot mr-2"></i>
      <strong>AI提炼策略</strong> — 基于因子投资论文(李芮)、yahoo_finance.py五因子框架、bloomberg_terminal.py字段注册和earnings-analysis工作流自动提炼
    </div>
    <div class="space-y-4">
      ${aiStgs.map(s=>`
      <div class="card p-5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="flex items-center gap-3">
              <h3 class="font-bold text-white">${s.name}</h3>
              <span class="badge badge-${s.status}">${s.status}</span>
              <span class="badge ${s.type==='factor'?'badge-validated':s.type==='event'?'badge-live':'badge-backtesting'}">${s.type}</span>
            </div>
            <p class="text-xs text-gray-400 mt-1 max-w-2xl">${s.hypothesis}</p>
          </div>
          <div class="text-right text-xs text-gray-500">
            <div>年化: <span class="text-emerald-400 font-bold">${s.backtestStats.annualReturn.toFixed(1)}%</span></div>
            <div>夏普: <span class="text-amber-400 font-bold">${s.backtestStats.sharpe.toFixed(2)}</span></div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-3">
          <div>
            <div class="text-[10px] text-gray-500 uppercase mb-1">入场信号</div>
            <div class="bg-emerald-900/20 border border-emerald-800/30 rounded p-2 text-xs text-emerald-300 font-mono">${s.entrySignal}</div>
          </div>
          <div>
            <div class="text-[10px] text-gray-500 uppercase mb-1">出场信号</div>
            <div class="bg-red-900/20 border border-red-800/30 rounded p-2 text-xs text-red-300 font-mono">${s.exitSignal}</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 mb-3">
          ${s.factors.map(f=>`
          <div class="bg-[#1a2540] rounded px-3 py-1.5 text-xs">
            <span class="text-gray-300">${f.name}</span>
            <span class="text-cyan-400 ml-2">${(f.weight*100).toFixed(0)}%</span>
            <div class="text-[10px] text-gray-500 mt-0.5">${f.metric}</div>
          </div>`).join('')}
        </div>
        <div class="flex items-center gap-6 text-xs text-gray-400">
          <span>标的: <span class="text-gray-200">${s.universe.slice(0,50)}</span></span>
          <span>调仓: <span class="text-gray-200">${s.rebalance}</span></span>
          <span>回测胜率: <span class="text-gray-200">${s.backtestStats.winRate.toFixed(1)}%</span></span>
          <span>最大回撤: <span class="text-red-400">${s.backtestStats.maxDrawdown.toFixed(1)}%</span></span>
          <span class="text-[10px] text-gray-600">来源: ${s.sourceRef.join(', ')}</span>
        </div>
      </div>`).join('')}
    </div>
  </div>`
}

window.stgTab = function(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  document.getElementById('stg-live').classList.toggle('hidden', tab !== 'live')
  document.getElementById('stg-ai').classList.toggle('hidden', tab !== 'ai')
}

window.toggleStratDetail = function(id) {
  document.getElementById(`detail-${id}`)?.classList.toggle('hidden')
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  5b. ML FOR FINANCE — Machine Learning Signal Engine                 ║
// ║  Paradigm: Data + Historical Returns = Rules (not Data + Rules)      ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderMLFinance(el) {
  const [modelsRes, signalsRes, trainingRes, regimeRes] = await Promise.all([
    axios.get(`${API}/api/ml/models`),
    axios.get(`${API}/api/ml/signals`),
    axios.get(`${API}/api/ml/training`),
    axios.get(`${API}/api/ml/regime`),
  ])
  const models = modelsRes.data.models
  const signals = signalsRes.data.signals
  const runs = trainingRes.data.runs
  const regime = regimeRes.data

  el.innerHTML = `
  <!-- PARADIGM BANNER -->
  <div class="card-gold card p-4 mb-5">
    <div class="grid grid-cols-3 gap-6 items-center">
      <div class="col-span-2">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center"><i class="fas fa-brain text-purple-400"></i></div>
          <span class="text-sm font-bold text-white">范式跃迁：从确定性规则 → 模式识别</span>
        </div>
        <div class="grid grid-cols-2 gap-4 text-xs">
          <div class="bg-[#111827] rounded p-3 border border-red-800/30">
            <div class="text-red-400 font-semibold mb-2 flex items-center gap-1"><i class="fas fa-times-circle"></i> 传统方法 (Deterministic)</div>
            <code class="text-gray-400 font-mono text-[11px]">Data + <span class="text-red-300">Rules</span> = Answers<br>Growth×<span class="text-red-300">0.30</span> + Val×<span class="text-red-300">0.25</span> + ...<br><span class="text-gray-600"># 人工硬编码权重，无法适应市场变化</span></code>
          </div>
          <div class="bg-[#111827] rounded p-3 border border-emerald-800/30">
            <div class="text-emerald-400 font-semibold mb-2 flex items-center gap-1"><i class="fas fa-check-circle"></i> ML方法 (Pattern Recognition)</div>
            <code class="text-gray-400 font-mono text-[11px]">Data + <span class="text-emerald-300">Historical Returns</span> = <span class="text-emerald-300">Rules</span><br>model.fit(X_train, y_train)<br><span class="text-gray-600"># 模型自主发现最优权重</span></code>
          </div>
        </div>
      </div>
      <div class="text-center">
        <div class="text-xs text-gray-500 mb-2">当前市场状态 (HMM)</div>
        <div class="text-3xl font-bold text-emerald-400 mb-1">${regime.currentRegime}</div>
        <div class="flex gap-2 justify-center">
          ${regime.regimeProbabilities.map(r => `
          <div class="text-center">
            <div class="text-[10px] text-gray-500">${r.regime}</div>
            <div class="text-sm font-bold ${r.regime==='RISK_ON'?'text-emerald-400':r.regime==='RISK_OFF'?'text-red-400':'text-amber-400'}">${r.probability}%</div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- TABS -->
  <div class="flex gap-2 mb-5 flex-wrap">
    <button class="tab-btn active" onclick="mlTab('signals',this)">🎯 实时信号</button>
    <button class="tab-btn" onclick="mlTab('models',this)">🧠 模型注册表</button>
    <button class="tab-btn" onclick="mlTab('training',this)">⚙️ 训练监控</button>
    <button class="tab-btn" onclick="mlTab('regime',this)">🌐 市场状态机</button>
    <button class="tab-btn" onclick="mlTab('comparison',this)">📊 ML vs 传统</button>
  </div>

  <!-- ── TAB: LIVE SIGNALS ── -->
  <div id="ml-signals">
    <div class="grid grid-cols-3 gap-4 mb-4">
      ${signals.map(s => `
      <div class="card p-4 cursor-pointer hover:border-purple-500/40 transition-all" onclick="showSignalDetail('${s.ticker}')">
        <div class="flex items-start justify-between mb-2">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-white text-base">${s.ticker}</span>
              <span class="text-[10px] text-gray-500">${s.sector.slice(0,15)}</span>
            </div>
            <div class="text-[11px] text-gray-500">${s.name}</div>
          </div>
          <span class="badge ${signalBadge(s.signalStrength)}">${s.signalStrength.replace('_',' ')}</span>
        </div>

        <!-- Ensemble Score Ring -->
        <div class="flex items-center gap-4 mb-3">
          <div class="relative w-16 h-16">
            <svg class="w-16 h-16 prog-ring" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" stroke="#1e2d4a" stroke-width="5" fill="none"/>
              <circle cx="28" cy="28" r="22" stroke="${s.ensembleScore>=80?'#10b981':s.ensembleScore>=60?'#22d3ee':s.ensembleScore>=40?'#f59e0b':'#ef4444'}"
                stroke-width="5" fill="none" stroke-dasharray="${2*Math.PI*22}"
                stroke-dashoffset="${2*Math.PI*22*(1-s.ensembleScore/100)}" stroke-linecap="round"/>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-sm font-bold text-white">${s.ensembleScore}</span>
            </div>
          </div>
          <div class="flex-1">
            <div class="text-[10px] text-gray-500 mb-1">模型预测收益 (6M)</div>
            <div class="text-xl font-bold ${s.rfPredictedReturn>=0?'text-emerald-400':'text-red-400'}">${s.rfPredictedReturn>=0?'+':''}${s.rfPredictedReturn.toFixed(1)}%</div>
            <div class="text-[10px] text-gray-600">置信区间 [${s.confidenceInterval[0].toFixed(1)}%, ${s.confidenceInterval[1].toFixed(1)}%]</div>
          </div>
        </div>

        <!-- Feature Importance bars (top 3) -->
        <div class="space-y-1 mb-2">
          ${s.featureImportance.slice(0,3).map(f => `
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-gray-500 w-28 truncate">${f.feature}</span>
            <div class="flex-1 score-bar"><div class="score-bar-fill bg-purple-500" style="width:${f.importance*100}%"></div></div>
            <span class="text-[10px] text-gray-400">${(f.importance*100).toFixed(0)}%</span>
          </div>`).join('')}
        </div>

        <!-- Confidence -->
        <div class="flex items-center justify-between text-[10px]">
          <span class="text-gray-500">模型置信度</span>
          <span class="font-bold ${s.confidencePct>=75?'text-emerald-400':s.confidencePct>=55?'text-amber-400':'text-red-400'}">${s.confidencePct}%</span>
          <span class="text-gray-600">NLP: ${s.nlpSentimentScore}/100</span>
        </div>
      </div>`).join('')}
    </div>

    <!-- Signal Detail Modal -->
    <div id="signalModal" class="hidden fixed inset-0 bg-black/75 z-50 flex items-center justify-center" onclick="closeSigModal(event)">
      <div class="card w-[760px] max-h-[85vh] overflow-y-auto p-6" id="signalModalContent"></div>
    </div>
  </div>

  <!-- ── TAB: MODEL REGISTRY ── -->
  <div id="ml-models" class="hidden space-y-4">
    ${models.map(m => `
    <div class="card p-5">
      <div class="flex items-start justify-between mb-3">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <h3 class="font-bold text-white text-base">${m.name}</h3>
            <span class="badge ${m.algorithmClass==='supervised'?'badge-live':m.algorithmClass==='deep_learning'?'badge-backtesting':m.algorithmClass==='nlp'?'badge-validated':'badge-paused'}">${m.algorithmClass}</span>
            <span class="badge badge-${m.status}">${m.status}</span>
          </div>
          <code class="text-xs text-amber-300 font-mono">${m.algorithm}</code>
          <p class="text-xs text-gray-400 mt-1 max-w-2xl">${m.paradigm}</p>
        </div>
        <div class="text-right text-xs space-y-1">
          <div>IC: <span class="text-cyan-400 font-bold">${m.modelMetrics.infoCoeff.toFixed(3)}</span></div>
          <div>ICIR: <span class="text-amber-400 font-bold">${m.modelMetrics.icIR.toFixed(2)}</span></div>
          <div>Alpha: <span class="text-emerald-400 font-bold">+${m.modelMetrics.annualAlpha}%</span></div>
          <div>Sharpe: <span class="text-purple-400 font-bold">${m.modelMetrics.sharpe.toFixed(2)}</span></div>
        </div>
      </div>

      <!-- vs Baseline -->
      <div class="grid grid-cols-3 gap-3 mb-4 bg-[#111827] rounded p-3">
        <div class="text-center">
          <div class="text-[10px] text-gray-500 mb-1">基准策略 (${m.vsBaseline.baselineName})</div>
          <div class="text-xl font-bold text-gray-400">${m.vsBaseline.baselineReturn.toFixed(1)}%</div>
        </div>
        <div class="text-center flex flex-col items-center justify-center">
          <i class="fas fa-arrow-right text-emerald-400 text-xl"></i>
          <div class="text-xs text-emerald-400 font-bold mt-1">+${m.vsBaseline.improvement.toFixed(1)}% 提升</div>
        </div>
        <div class="text-center">
          <div class="text-[10px] text-gray-500 mb-1">ML模型</div>
          <div class="text-xl font-bold text-emerald-400">${m.vsBaseline.modelReturn.toFixed(1)}%</div>
        </div>
      </div>

      <!-- Key Insight -->
      <div class="bg-purple-900/20 border border-purple-800/30 rounded p-3 mb-3">
        <div class="text-[10px] text-purple-300 uppercase font-semibold mb-1">🔍 模型发现的非线性规律</div>
        <p class="text-xs text-gray-300">${m.keyInsight}</p>
      </div>

      <!-- Non-linear rules list -->
      <div>
        <div class="text-[10px] text-gray-500 uppercase mb-2">传统规则系统无法发现的模式</div>
        <div class="grid grid-cols-2 gap-2">
          ${m.nonLinearRules.map(r => `
          <div class="flex items-start gap-2 text-xs text-gray-400 bg-[#111827] rounded p-2">
            <i class="fas fa-atom text-purple-400 mt-0.5 flex-shrink-0"></i>
            <span>${r}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>`).join('')}
  </div>

  <!-- ── TAB: TRAINING MONITOR ── -->
  <div id="ml-training" class="hidden">
    <div class="grid grid-cols-3 gap-4 mb-4">
      ${runs.map(r => `
      <div class="kpi-card cursor-pointer hover:border-cyan-500/30 transition" onclick="loadTrainingChart('${r.id}')">
        <div class="text-xs text-gray-500 mb-1 truncate">${r.modelName}</div>
        <code class="text-[10px] text-amber-300">${r.algorithm.slice(0,40)}</code>
        <div class="grid grid-cols-2 gap-1 mt-2 text-[11px]">
          <div>样本: <span class="text-white">${(r.trainingSize/1000).toFixed(0)}K</span></div>
          <div>特征: <span class="text-white">${r.features}</span></div>
          <div>Final IC: <span class="text-cyan-400 font-bold">${r.finalIC.toFixed(3)}</span></div>
          <div>Sharpe: <span class="text-amber-400 font-bold">${r.finalSharpe.toFixed(2)}</span></div>
        </div>
        <div class="mt-2 text-[10px] flex items-center gap-2">
          ${r.overfitWarning ? '<span class="text-amber-400"><i class="fas fa-exclamation-triangle"></i> 过拟合风险</span>' : '<span class="text-emerald-400"><i class="fas fa-check"></i> 泛化良好</span>'}
        </div>
      </div>`).join('')}
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-1">训练 / 验证 Loss 曲线</div>
        <div class="text-xs text-gray-500 mb-3">关键检验：验证集Loss是否跟随训练集下降（泛化），或分叉（过拟合）</div>
        <div class="chart-wrap h-52"><canvas id="trainLossChart"></canvas></div>
      </div>
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-1">特征重要性 (Random Forest)</div>
        <div class="text-xs text-gray-500 mb-3">模型自主学习的因子权重 vs 人工硬编码</div>
        <div class="chart-wrap h-52"><canvas id="featImpChart"></canvas></div>
      </div>
    </div>

    <div class="card p-4 mt-4">
      <div class="text-sm font-semibold text-white mb-3">交叉验证结果 (5-Fold CV)</div>
      <table class="data-table"><thead><tr>
        <th>模型</th><th>Fold 1</th><th>Fold 2</th><th>Fold 3</th><th>Fold 4</th><th>Fold 5</th><th>均值 IC</th><th>标准差</th><th>过拟合检验</th>
      </tr></thead><tbody>
        ${runs.map(r => `<tr>
          <td class="font-semibold text-white text-xs">${r.modelName.slice(0,20)}</td>
          ${r.cvScores.map(s => `<td class="font-mono text-cyan-400 text-xs">${s.toFixed(3)}</td>`).join('')}
          <td class="font-mono font-bold text-white">${(r.cvScores.reduce((a,b)=>a+b,0)/r.cvScores.length).toFixed(3)}</td>
          <td class="font-mono text-gray-400">${Math.sqrt(r.cvScores.reduce((a,b,_,arr)=>a+Math.pow(b-arr.reduce((x,y)=>x+y)/arr.length,2),0)/r.cvScores.length).toFixed(4)}</td>
          <td>${r.overfitWarning?'<span class="text-amber-400 text-xs">⚠️ 风险</span>':'<span class="text-emerald-400 text-xs">✓ 通过</span>'}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  </div>

  <!-- ── TAB: REGIME (HMM) ── -->
  <div id="ml-regime" class="hidden">
    <div class="grid grid-cols-3 gap-4 mb-4">
      ${regime.regimeWeights.map(r => `
      <div class="card p-4 ${r.regime===regime.currentRegime?'border-cyan-500/50':''}" >
        <div class="flex items-center gap-2 mb-3">
          <div class="w-3 h-3 rounded-full ${r.regime==='RISK_ON'?'bg-emerald-400':r.regime==='RISK_OFF'?'bg-red-400':'bg-amber-400'}"></div>
          <span class="font-bold text-white">${r.regime}</span>
          ${r.regime===regime.currentRegime?'<span class="badge badge-live text-[10px]">当前</span>':''}
        </div>
        <div class="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
          <div><div class="text-gray-500">成长</div><div class="font-bold text-white">${r.growth}%</div></div>
          <div><div class="text-gray-500">估值</div><div class="font-bold text-white">${r.valuation}%</div></div>
          <div><div class="text-gray-500">质量</div><div class="font-bold text-white">${r.quality}%</div></div>
          <div><div class="text-gray-500">安全</div><div class="font-bold text-white">${r.safety}%</div></div>
          <div><div class="text-gray-500">动量</div><div class="font-bold text-white">${r.momentum}%</div></div>
          <div><div class="text-gray-500">合计</div><div class="font-bold text-cyan-400">${r.growth+r.valuation+r.quality+r.safety+r.momentum}%</div></div>
        </div>
        <p class="text-[11px] text-gray-400">${r.commentary}</p>
      </div>`).join('')}
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-3">市场状态历史 (VIX + 信用利差)</div>
        <div class="chart-wrap h-52"><canvas id="regimeChart"></canvas></div>
      </div>
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-3">HMM 概率分布 (当前)</div>
        <div class="chart-wrap h-52"><canvas id="regimePieChart"></canvas></div>
        <div class="mt-3 space-y-1">
          ${regime.regimeProbabilities.map(r => `
          <div class="flex items-center gap-2 text-xs">
            <div class="w-3 h-3 rounded-sm ${r.regime==='RISK_ON'?'bg-emerald-500':r.regime==='RISK_OFF'?'bg-red-500':'bg-amber-500'}"></div>
            <span class="text-gray-400 w-20">${r.regime}</span>
            <div class="flex-1 score-bar"><div class="score-bar-fill ${r.regime==='RISK_ON'?'bg-emerald-500':r.regime==='RISK_OFF'?'bg-red-500':'bg-amber-500'}" style="width:${r.probability}%"></div></div>
            <span class="text-white font-bold">${r.probability}%</span>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- ── TAB: COMPARISON ── -->
  <div id="ml-comparison" class="hidden">
    <div class="bbg-alert mb-4">
      <i class="fas fa-balance-scale mr-2"></i>
      <strong>核心问题：</strong> 为什么ML比硬编码规则系统更好？— 以Random Forest vs 五因子(30/25/20/15/10)为例
    </div>

    <div class="grid grid-cols-2 gap-4 mb-5">
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-3">预测收益对比</div>
        <div class="chart-wrap h-52"><canvas id="mlVsRuleChart"></canvas></div>
      </div>
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-3">动态权重 vs 硬编码权重 (META案例)</div>
        <div class="chart-wrap h-52"><canvas id="weightCompChart"></canvas></div>
      </div>
    </div>

    <div class="card p-5">
      <div class="text-sm font-semibold text-white mb-4">ML vs 传统规则：性能指标对比</div>
      <table class="data-table"><thead><tr>
        <th>模型</th><th>年化收益</th><th>信息系数(IC)</th><th>ICIR</th><th>夏普比率</th>
        <th>vs基准提升</th><th>非线性规律</th><th>自适应</th>
      </tr></thead><tbody>
        <tr class="bg-[#0a0e1a]">
          <td class="text-gray-400 text-xs">五因子硬编码 (30/25/20/15/10)</td>
          <td class="font-mono text-gray-300">18.6%</td>
          <td class="font-mono text-gray-300">0.082</td>
          <td class="font-mono text-gray-300">1.12</td>
          <td class="font-mono text-gray-300">1.74</td>
          <td class="text-gray-500">— 基准</td>
          <td class="text-red-400 text-xs">❌ 无</td>
          <td class="text-red-400 text-xs">❌ 固定权重</td>
        </tr>
        ${models.map(m => `<tr>
          <td class="font-semibold text-white text-xs">${m.name}</td>
          <td class="font-mono text-emerald-400 font-bold">${m.vsBaseline.modelReturn.toFixed(1)}%</td>
          <td class="font-mono text-cyan-400">${m.modelMetrics.infoCoeff.toFixed(3)}</td>
          <td class="font-mono text-cyan-400">${m.modelMetrics.icIR.toFixed(2)}</td>
          <td class="font-mono text-amber-400 font-bold">${m.modelMetrics.sharpe.toFixed(2)}</td>
          <td class="text-emerald-400 text-xs font-bold">+${m.vsBaseline.improvement.toFixed(1)}%</td>
          <td class="text-emerald-400 text-xs">✓ 发现</td>
          <td class="text-emerald-400 text-xs">✓ 动态</td>
        </tr>`).join('')}
      </tbody></table>

      <div class="mt-5 grid grid-cols-3 gap-4">
        <div class="bg-[#111827] rounded p-3">
          <div class="text-[10px] text-amber-400 font-semibold uppercase mb-2">📘 推荐阅读</div>
          <ul class="text-xs text-gray-400 space-y-1">
            <li>• Advances in Financial ML — Marcos López de Prado</li>
            <li>• Machine Learning for Asset Managers — López de Prado</li>
            <li>• Deep Learning for Finance — Fischer & Krauss</li>
            <li>• FinBERT: Araci (2019)</li>
            <li>• scikit-learn RandomForestRegressor docs</li>
          </ul>
        </div>
        <div class="bg-[#111827] rounded p-3">
          <div class="text-[10px] text-cyan-400 font-semibold uppercase mb-2">🔧 升级路径</div>
          <ul class="text-xs text-gray-400 space-y-1">
            <li>① 用RF替换五因子硬编码权重</li>
            <li>② 添加LSTM序列预测层</li>
            <li>③ 集成FinBERT财报情绪分析</li>
            <li>④ HMM识别市场状态动态调权</li>
            <li>⑤ Ensemble集成以上所有信号</li>
          </ul>
        </div>
        <div class="bg-[#111827] rounded p-3">
          <div class="text-[10px] text-purple-400 font-semibold uppercase mb-2">⚠️ 关键风险</div>
          <ul class="text-xs text-gray-400 space-y-1">
            <li>• 过拟合：训练数据太少/特征太多</li>
            <li>• 数据泄露：未来信息污染训练集</li>
            <li>• 模型退化：市场结构变化后失效</li>
            <li>• 策略容量：IC高不等于可扩容</li>
            <li>• 始终用Walk-Forward验证</li>
          </ul>
        </div>
      </div>
    </div>
  </div>`

  // ── Initial chart renders ────────────────────────────────────────────
  await loadTrainingChart(runs[0]?.id)
  renderRegimeCharts(regime)
  renderMLComparisonCharts(signals, models)
}

// ── SIGNAL DETAIL MODAL ──────────────────────────────────────────────────────
window.showSignalDetail = function(ticker) {
  axios.get(`${API}/api/ml/signals`).then(({ data }) => {
    const s = data.signals.find(x => x.ticker === ticker)
    if (!s) return
    document.getElementById('signalModalContent').innerHTML = `
      <div class="flex justify-between items-start mb-5">
        <div>
          <h2 class="text-xl font-bold text-white">${s.ticker} — ML信号详情</h2>
          <p class="text-xs text-gray-400">${s.name} · ${s.sector}</p>
        </div>
        <button onclick="document.getElementById('signalModal').classList.add('hidden')" class="text-gray-400 hover:text-white text-xl">&times;</button>
      </div>

      <!-- Signal Summary -->
      <div class="grid grid-cols-4 gap-3 mb-5">
        <div class="bg-[#111827] rounded p-3 text-center">
          <div class="text-[10px] text-gray-500 mb-1">信号强度</div>
          <div class="text-sm font-bold ${s.signalStrength.includes('BUY')?'text-emerald-400':'text-red-400'}">${s.signalStrength.replace('_',' ')}</div>
        </div>
        <div class="bg-[#111827] rounded p-3 text-center">
          <div class="text-[10px] text-gray-500 mb-1">综合评分</div>
          <div class="text-2xl font-bold text-white">${s.ensembleScore}</div>
        </div>
        <div class="bg-[#111827] rounded p-3 text-center">
          <div class="text-[10px] text-gray-500 mb-1">RF预测(6M)</div>
          <div class="text-xl font-bold ${s.rfPredictedReturn>=0?'text-emerald-400':'text-red-400'}">${s.rfPredictedReturn>=0?'+':''}${s.rfPredictedReturn.toFixed(1)}%</div>
        </div>
        <div class="bg-[#111827] rounded p-3 text-center">
          <div class="text-[10px] text-gray-500 mb-1">LSTM预测(30D)</div>
          <div class="text-xl font-bold ${s.lstmPredictedReturn>=0?'text-emerald-400':'text-red-400'}">${s.lstmPredictedReturn>=0?'+':''}${s.lstmPredictedReturn.toFixed(1)}%</div>
        </div>
      </div>

      <!-- Probabilistic Output -->
      <div class="bg-blue-900/20 border border-blue-800/30 rounded p-3 mb-5">
        <div class="text-[10px] text-blue-300 font-semibold mb-1">概率输出（非确定性）— Probabilistic, not Absolute</div>
        <div class="text-sm text-gray-300">置信区间 [<span class="text-blue-300 font-bold">${s.confidenceInterval[0].toFixed(1)}%</span>, <span class="text-blue-300 font-bold">${s.confidenceInterval[1].toFixed(1)}%</span>] @ <span class="text-blue-400 font-bold">${s.confidencePct}%</span> 置信度</div>
        <div class="text-xs text-gray-500 mt-1">相比传统DCF的精确值输出（如"内在价值=$142.50"），ML模型给出概率范围，更真实反映市场不确定性</div>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-4">
        <!-- Feature Importance -->
        <div>
          <div class="text-xs font-semibold text-gray-400 uppercase mb-2">特征重要性 (Random Forest学习)</div>
          ${s.featureImportance.map(f => `
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[11px] text-gray-400 w-36 truncate">${f.feature}</span>
            <div class="flex-1 score-bar"><div class="score-bar-fill bg-purple-500" style="width:${f.importance*100}%"></div></div>
            <span class="text-[11px] text-gray-300 w-8 text-right">${(f.importance*100).toFixed(0)}%</span>
          </div>`).join('')}
        </div>
        <!-- Learned vs Hardcoded Weights -->
        <div>
          <div class="text-xs font-semibold text-gray-400 uppercase mb-2">ML学习权重 vs 硬编码权重</div>
          ${s.learnedWeights.map(w => `
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[11px] text-gray-400 w-32 truncate">${w.factor}</span>
            <span class="text-[11px] font-bold text-white w-8">${w.weight}%</span>
            <span class="text-[11px] ${w.vsHardcoded>0?'text-emerald-400':w.vsHardcoded<0?'text-red-400':'text-gray-500'} w-10">${w.vsHardcoded>0?'+':''}${w.vsHardcoded}%</span>
            <div class="flex-1 score-bar"><div class="score-bar-fill ${w.weight>=25?'bg-cyan-500':'bg-blue-500'}" style="width:${w.weight*3}%"></div></div>
          </div>`).join('')}
          <div class="text-[10px] text-gray-600 mt-1">vsHardcoded = 与固定权重的偏差（绿=上调，红=下调）</div>
        </div>
      </div>

      <!-- Raw Features -->
      <div class="bg-[#111827] rounded p-3">
        <div class="text-[10px] text-gray-500 uppercase mb-2">X_live 输入特征（传入模型的原始数据）</div>
        <div class="grid grid-cols-3 gap-2">
          ${Object.entries(s.features).map(([k,v]) => `
          <div class="text-xs"><span class="text-gray-500">${k}:</span> <span class="font-mono text-white">${typeof v==='number'?v.toFixed(2):v}</span></div>`).join('')}
        </div>
      </div>`
    document.getElementById('signalModal').classList.remove('hidden')
  })
}
window.closeSigModal = function(e) {
  if (e.target.id === 'signalModal') document.getElementById('signalModal').classList.add('hidden')
}

// ── ML TAB SWITCHER ──────────────────────────────────────────────────────────
window.mlTab = function(tab, btn) {
  ['signals','models','training','regime','comparison'].forEach(t => {
    const el = document.getElementById(`ml-${t}`)
    if (el) el.classList.toggle('hidden', t !== tab)
  })
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  // Lazy render charts when tab activates
  if (tab === 'regime') setTimeout(() => {
    axios.get(`${API}/api/ml/regime`).then(r => renderRegimeCharts(r.data))
  }, 100)
  if (tab === 'comparison') setTimeout(() => {
    Promise.all([axios.get(`${API}/api/ml/signals`), axios.get(`${API}/api/ml/models`)]).then(([sRes, mRes]) => {
      renderMLComparisonCharts(sRes.data.signals, mRes.data.models)
    })
  }, 100)
}

// ── TRAINING CHART LOADER ────────────────────────────────────────────────────
window.loadTrainingChart = async function(id) {
  if (!id) return
  const { data: run } = await axios.get(`${API}/api/ml/training/${id}`)

  // Loss curve
  const lossCtx = document.getElementById('trainLossChart')?.getContext('2d')
  if (lossCtx) {
    if (charts.trainLoss) charts.trainLoss.destroy()
    charts.trainLoss = new Chart(lossCtx, {
      type: 'line',
      data: {
        labels: run.trainingCurve.map(p => p.step),
        datasets: [
          { label: 'Train Loss', data: run.trainingCurve.map(p => p.trainLoss), borderColor: '#22d3ee', borderWidth: 2, pointRadius: 0, tension: 0.4 },
          { label: 'Val Loss',   data: run.trainingCurve.map(p => p.valLoss),   borderColor: '#f59e0b', borderWidth: 2, pointRadius: 0, tension: 0.4, borderDash: [4,2] },
        ]
      },
      options: { ...chartOpts('Loss'), plugins: { legend: { display: true, labels: { color: '#9ca3af', font: { size: 10 }, boxWidth: 12 } } } }
    })
  }

  // Feature importance
  const impCtx = document.getElementById('featImpChart')?.getContext('2d')
  if (impCtx && run.featureImportances) {
    if (charts.featImp) charts.featImp.destroy()
    const sorted = [...run.featureImportances].sort((a,b) => b.importance - a.importance)
    charts.featImp = new Chart(impCtx, {
      type: 'bar',
      data: {
        labels: sorted.map(f => f.feature.replace(/_/g,' ')),
        datasets: [{ data: sorted.map(f => (f.importance*100).toFixed(1)), backgroundColor: 'rgba(139,92,246,0.7)', borderRadius: 4 }]
      },
      options: { ...chartOpts('Importance %'), plugins: { legend: { display: false } }, indexAxis: 'y' }
    })
  }
}

// ── REGIME CHARTS ────────────────────────────────────────────────────────────
function renderRegimeCharts(regime) {
  // VIX history line chart
  const rCtx = document.getElementById('regimeChart')?.getContext('2d')
  if (rCtx) {
    if (charts.regime) charts.regime.destroy()
    const pts = regime.regimeHistory.filter((_,i)=>i%3===0)
    charts.regime = new Chart(rCtx, {
      type: 'line',
      data: {
        labels: pts.map(p => p.date.slice(5)),
        datasets: [
          { label: 'VIX', data: pts.map(p => p.vix), borderColor: '#ef4444', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y', tension: 0.3 },
          { label: 'IG Spread(bp)', data: pts.map(p => p.spread), borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y1', tension: 0.3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
        plugins: { legend: { display: true, labels: { color: '#9ca3af', font: { size: 10 }, boxWidth: 12 } }, tooltip: { backgroundColor: '#1a2540', titleColor: '#9ca3af', bodyColor: '#e5e7eb', borderColor: '#1e2d4a', borderWidth: 1 } },
        scales: {
          x: { grid: { color: '#111827' }, ticks: { color: '#4b5563', font: { size: 9 }, maxTicksLimit: 8 } },
          y: { grid: { color: '#111827' }, ticks: { color: '#ef4444', font: { size: 9 } }, position: 'left' },
          y1: { grid: { drawOnChartArea: false }, ticks: { color: '#f59e0b', font: { size: 9 } }, position: 'right' },
        }
      }
    })
  }
  // Probability pie
  const pieCtx = document.getElementById('regimePieChart')?.getContext('2d')
  if (pieCtx) {
    if (charts.regimePie) charts.regimePie.destroy()
    charts.regimePie = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: regime.regimeProbabilities.map(r => r.regime),
        datasets: [{ data: regime.regimeProbabilities.map(r => r.probability), backgroundColor: ['#10b981','#ef4444','#f59e0b'], borderWidth: 0 }]
      },
      options: { plugins: { legend: { display: false } }, cutout: '65%' }
    })
  }
}

// ── ML COMPARISON CHARTS ──────────────────────────────────────────────────────
function renderMLComparisonCharts(signals, models) {
  // ML vs Rule predicted returns
  const cmpCtx = document.getElementById('mlVsRuleChart')?.getContext('2d')
  if (cmpCtx) {
    if (charts.mlVsRule) charts.mlVsRule.destroy()
    charts.mlVsRule = new Chart(cmpCtx, {
      type: 'bar',
      data: {
        labels: signals.map(s => s.ticker),
        datasets: [
          { label: 'RF预测收益%', data: signals.map(s => s.rfPredictedReturn), backgroundColor: 'rgba(139,92,246,0.7)', borderRadius: 4 },
          { label: '传统五因子评分', data: signals.map(s => s.ensembleScore/5), backgroundColor: 'rgba(75,85,99,0.5)', borderRadius: 4 },
        ]
      },
      options: { ...chartOpts('%'), plugins: { legend: { display: true, labels: { color: '#9ca3af', font: { size: 10 }, boxWidth: 12 } } } }
    })
  }
  // Dynamic weight comparison for META (first signal)
  const wCtx = document.getElementById('weightCompChart')?.getContext('2d')
  const metaSig = signals[0]
  if (wCtx && metaSig) {
    if (charts.weightComp) charts.weightComp.destroy()
    const hardcoded = [30, 25, 20, 15, 10]
    const mlLearned = metaSig.learnedWeights.slice(0,5).map(w => w.weight)
    charts.weightComp = new Chart(wCtx, {
      type: 'radar',
      data: {
        labels: ['成长', '估值', '质量', '安全', '动量'],
        datasets: [
          { label: '硬编码(30/25/20/15/10)', data: hardcoded, borderColor: '#6b7280', backgroundColor: 'rgba(107,114,128,0.1)', borderWidth: 1.5, pointRadius: 3 },
          { label: `ML学习权重(${metaSig.ticker})`, data: mlLearned, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.15)', borderWidth: 2, pointRadius: 3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
        plugins: { legend: { display: true, labels: { color: '#9ca3af', font: { size: 10 }, boxWidth: 12 } }, tooltip: { backgroundColor: '#1a2540', titleColor: '#9ca3af', bodyColor: '#e5e7eb', borderColor: '#1e2d4a', borderWidth: 1 } },
        scales: { r: { grid: { color: '#1e2d4a' }, ticks: { color: '#4b5563', font: { size: 9 }, backdropColor: 'transparent' }, pointLabels: { color: '#9ca3af', font: { size: 10 } } } }
      }
    })
  }
}

// ── SIGNAL BADGE HELPER ───────────────────────────────────────────────────────
function signalBadge(s) {
  return s==='STRONG_BUY'?'bg-emerald-600/30 text-emerald-300 border border-emerald-600/40 text-[10px] px-2 py-0.5 rounded-full font-semibold':
         s==='BUY'?'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 text-[10px] px-2 py-0.5 rounded-full':
         s==='NEUTRAL'?'bg-gray-700/30 text-gray-400 border border-gray-600/40 text-[10px] px-2 py-0.5 rounded-full':
         s==='SELL'?'bg-red-900/30 text-red-400 border border-red-800/40 text-[10px] px-2 py-0.5 rounded-full':
         'bg-red-700/30 text-red-300 border border-red-700/40 text-[10px] px-2 py-0.5 rounded-full font-semibold'
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  5. RESEARCH LIBRARY                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderResearch(el) {
  const { data } = await axios.get(`${API}/api/research/papers`)
  const papers = data.papers

  el.innerHTML = `
  <div class="bbg-alert mb-5 flex items-start gap-3">
    <i class="fas fa-book-open text-yellow-400 mt-0.5"></i>
    <div>
      <div class="font-semibold mb-1">因子投资研究论文库</div>
      <div class="text-xs text-gray-300">整合内部研究报告、脚本文档和工作流，通过AI提炼可操作的交易策略。核心论文：因子投资的方法概述和效果检验（规划研究部 李芮）。</div>
    </div>
  </div>
  <div class="space-y-4">
    ${papers.map(p=>`
    <div class="card p-5">
      <div class="flex items-start justify-between mb-3">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-1">
            <h3 class="font-bold text-white">${p.title}</h3>
            <span class="text-xs text-gray-500 border border-[#1e2d4a] px-2 py-0.5 rounded">${p.source}</span>
            <span class="text-xs text-gray-600">${p.year}</span>
          </div>
          <div class="text-xs text-cyan-400">${p.authors}</div>
          <p class="text-xs text-gray-400 mt-2 max-w-3xl">${p.abstract}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div class="text-[10px] text-gray-500 uppercase mb-2">核心发现</div>
          <ul class="space-y-1">
            ${p.keyFindings.map(f=>`<li class="text-xs text-gray-300 flex items-start gap-2"><span class="text-cyan-400 mt-0.5">▪</span>${f}</li>`).join('')}
          </ul>
        </div>
        <div>
          <div class="text-[10px] text-gray-500 uppercase mb-2">提炼因子</div>
          <div class="flex flex-wrap gap-2">
            ${p.extractedFactors.map(f=>`<span class="bg-blue-900/30 border border-blue-800/40 text-blue-300 text-[11px] px-2 py-1 rounded">${f}</span>`).join('')}
          </div>
          <div class="text-[10px] text-gray-500 uppercase mb-2 mt-3">标签</div>
          <div class="flex flex-wrap gap-1.5">
            ${p.tags.map(t=>`<span class="bg-[#1a2540] text-gray-400 text-[10px] px-2 py-0.5 rounded-full">#${t}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`).join('')}
  </div>`
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  6. TRADING MODULE                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderTrading(el) {
  const [posRes, tradeRes] = await Promise.all([
    axios.get(`${API}/api/positions`),
    axios.get(`${API}/api/trades`),
  ])
  const positions = posRes.data, trades = tradeRes.data
  const totalMV = positions.reduce((s,p)=>s+p.marketValue,0)
  const totalPnl = positions.reduce((s,p)=>s+p.pnl,0)

  el.innerHTML = `
  <div class="flex gap-2 mb-4">
    <button class="tab-btn active" onclick="tradeTab('positions',this)">📊 持仓明细</button>
    <button class="tab-btn" onclick="tradeTab('orders',this)">📋 当日交易</button>
  </div>

  <div id="trade-positions">
    <div class="grid grid-cols-4 gap-4 mb-4">
      ${kpiCard('持仓市值', fmt.money(totalMV), '', 'fas fa-briefcase', 'text-cyan-400')}
      ${kpiCard('浮动盈亏', fmt.money(totalPnl), fmt.pct(totalPnl/totalMV*100), 'fas fa-chart-line', totalPnl>=0?'text-emerald-400':'text-red-400')}
      ${kpiCard('持仓数量', positions.length+'只', '', 'fas fa-list', 'text-amber-400')}
      ${kpiCard('最大单仓', `${(Math.max(...positions.map(p=>p.weight))).toFixed(1)}%`, '仓位占比', 'fas fa-exclamation-triangle', 'text-amber-400')}
    </div>
    <div class="card overflow-hidden">
      <div class="overflow-auto">
        <table class="data-table"><thead><tr>
          <th>代码</th><th>名称</th><th>持仓量</th><th>成本</th><th>现价</th><th>市值</th><th>盈亏</th><th>盈亏率</th><th>仓位</th><th>策略</th>
        </tr></thead><tbody>
          ${positions.map(p=>`<tr>
            <td class="font-mono text-gray-400 text-xs">${p.code}</td>
            <td class="font-semibold text-white">${p.name}</td>
            <td class="font-mono text-gray-300">${p.quantity.toLocaleString()}</td>
            <td class="font-mono text-gray-400">¥${p.avgCost.toFixed(2)}</td>
            <td class="font-mono text-white font-bold">¥${p.currentPrice.toFixed(2)}</td>
            <td class="font-mono text-gray-300">${fmt.money(p.marketValue)}</td>
            <td class="font-mono font-bold ${p.pnl>=0?'text-emerald-400':'text-red-400'}">${p.pnl>=0?'+':''}${fmt.money(p.pnl)}</td>
            <td class="font-mono font-bold ${p.pnlPct>=0?'text-emerald-400':'text-red-400'}">${fmt.pct(p.pnlPct)}</td>
            <td>
              <div class="flex items-center gap-2">
                <div class="score-bar w-14"><div class="score-bar-fill bg-blue-500" style="width:${Math.min(p.weight*5,100)}%"></div></div>
                <span class="text-xs text-gray-400">${p.weight.toFixed(1)}%</span>
              </div>
            </td>
            <td class="text-[10px] text-gray-500">${p.strategyId}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  </div>

  <div id="trade-orders" class="hidden">
    <div class="card overflow-hidden">
      <div class="px-4 py-3 border-b border-[#1e2d4a] flex items-center gap-2">
        <span class="text-sm font-semibold text-white">当日交易记录</span>
        <span class="badge badge-live">${trades.filter(t=>t.status==='filled').length} 已成交</span>
        <span class="badge badge-paused">${trades.filter(t=>t.status==='pending').length} 待成交</span>
      </div>
      <div class="overflow-auto">
        <table class="data-table"><thead><tr>
          <th>时间</th><th>代码</th><th>名称</th><th>方向</th><th>数量</th><th>价格</th><th>金额</th><th>状态</th><th>策略</th>
        </tr></thead><tbody>
          ${trades.map(t=>`<tr>
            <td class="font-mono text-gray-500 text-xs">${t.time}</td>
            <td class="font-mono text-gray-400 text-xs">${t.code}</td>
            <td class="font-semibold text-white">${t.name}</td>
            <td><span class="badge ${t.direction==='buy'?'badge-beat':'badge-miss'}">${t.direction==='buy'?'买入':'卖出'}</span></td>
            <td class="font-mono text-gray-300">${t.quantity.toLocaleString()}</td>
            <td class="font-mono text-white">¥${t.price.toFixed(2)}</td>
            <td class="font-mono text-gray-300">${fmt.money(t.amount)}</td>
            <td><span class="badge ${t.status==='filled'?'badge-live':'badge-paused'}">${t.status}</span></td>
            <td class="text-[10px] text-gray-500">${t.strategyName}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  </div>`
}

window.tradeTab = function(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  document.getElementById('trade-positions').classList.toggle('hidden', tab !== 'positions')
  document.getElementById('trade-orders').classList.toggle('hidden', tab !== 'orders')
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  7. BACKTEST                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  7. BACKTESTING ENGINE — Buy-the-Dip / Contrarian / ML-Enhanced      ║
// ║  10Y SPY Data · Event-Driven · Anti-Lookahead · Realistic Costs      ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderBacktest(el) {
  el.innerHTML = `<div class="text-gray-400 text-center py-10"><i class="fas fa-spinner fa-spin mr-2"></i>Running backtests on 10Y SPY data...</div>`

  const [sumRes, compareRes, dipRes, mlRes] = await Promise.all([
    axios.get(`${API}/api/btd/summary`),
    axios.get(`${API}/api/btd/compare`),
    axios.get(`${API}/api/btd/dip-events?limit=30`),
    axios.get(`${API}/api/btd/ml-model`),
  ])
  const summary  = sumRes.data
  const compare  = compareRes.data
  const dipData  = dipRes.data
  const mlModel  = mlRes.data

  const strats   = summary.strategies
  const cmpStrats = compare.strategies
  const bench    = compare.benchmark

  const tabIds = ['nav','compare','dips','ml','tradelog']
  const tabLabels = ['📈 NAV Curves','⚖️ Strategy Compare','🎯 Dip Events','🤖 ML Classifier','📋 Trade Log']

  el.innerHTML = `
  <!-- HEADER + BIAS WARNINGS -->
  <div class="flex items-center justify-between mb-4">
    <div>
      <div class="text-white font-bold text-base">Buy-the-Dip & Contrarian Backtesting Engine</div>
      <div class="text-xs text-gray-400 mt-0.5">10Y SPY Daily · $100K Capital · 10bps Commission · 5bps Slippage · Anti-Look-Ahead · No Survivorship Bias</div>
    </div>
    <div class="flex gap-1.5">
      ${summary.biasWarnings.map(w=>`
      <div class="group relative">
        <div class="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center cursor-help">
          <i class="fas fa-exclamation text-amber-400 text-[9px]"></i>
        </div>
        <div class="hidden group-hover:block absolute right-0 top-6 bg-[#1a2540] border border-amber-500/30 text-[10px] text-amber-300 p-2 rounded w-56 z-50">${w}</div>
      </div>`).join('')}
    </div>
  </div>

  <!-- KPI CARDS — 4 strategies + benchmark -->
  <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
    ${strats.map(s=>`
    <div class="kpi-card cursor-pointer hover:border-cyan-500/40 transition" onclick="btLoadNav('${s.id}',this)">
      <div class="text-[10px] text-gray-500 mb-1 leading-tight truncate">${s.strategyName.replace('(SPY 10Y)','').trim()}</div>
      <div class="text-xl font-bold ${s.metrics.totalReturn>=0?'text-emerald-400':'text-red-400'}">${s.metrics.totalReturn>=0?'+':''}${s.metrics.totalReturn.toFixed(1)}%</div>
      <div class="text-[10px] text-gray-500 mt-0.5">${s.startDate.slice(0,4)}–${s.endDate.slice(0,4)}</div>
      <div class="grid grid-cols-2 gap-0.5 mt-1.5 text-[10px]">
        <div>Sharpe <span class="text-amber-400">${s.metrics.sharpe}</span></div>
        <div>MaxDD <span class="text-red-400">${s.metrics.maxDrawdown.toFixed(1)}%</span></div>
        <div>CAGR <span class="text-cyan-400">${s.metrics.annualReturn.toFixed(1)}%</span></div>
        <div>Win% <span class="text-gray-300">${s.metrics.winRate}%</span></div>
      </div>
      <div class="mt-1.5 text-[9px] text-gray-600">${s.tradeCount} round-trips</div>
    </div>`).join('')}
    <div class="kpi-card border-gray-700/40">
      <div class="text-[10px] text-gray-500 mb-1">SPY Buy &amp; Hold</div>
      <div class="text-xl font-bold text-gray-300">${bench.totalReturn>=0?'+':''}${bench.totalReturn.toFixed(1)}%</div>
      <div class="text-[10px] text-gray-500 mt-0.5">2014–2024 (Benchmark)</div>
      <div class="mt-2 text-[10px] text-gray-600">No active management</div>
    </div>
  </div>

  <!-- TABS -->
  <div class="flex gap-1 mb-4 border-b border-[#1e2d4a] pb-0">
    ${tabIds.map((id,i)=>`<button id="bt-tab-${id}" onclick="btTab('${id}')"
      class="tab-btn ${i===0?'active':''} text-xs px-3 py-1.5">${tabLabels[i]}</button>`).join('')}
  </div>

  <!-- TAB: NAV Curves -->
  <div id="bt-pane-nav">
    <div class="card p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="text-sm font-semibold text-white" id="bt-nav-title">NAV Curve — Click a strategy card above</div>
          <div class="text-[10px] text-gray-500 mt-0.5">Starting NAV = 1.0 · vs SPY Buy-and-Hold benchmark</div>
        </div>
        <div class="flex gap-2">
          ${strats.map((s,i)=>`<button class="tab-btn text-[10px] ${i===0?'active':''}" onclick="btLoadNav('${s.id}',this)">${s.id.replace('bt_','').replace(/_/g,' ').toUpperCase().slice(0,12)}</button>`).join('')}
        </div>
      </div>
      <div class="chart-wrap h-64"><canvas id="btNavChart"></canvas></div>
    </div>
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">Drawdown Series</div>
      <div class="chart-wrap h-36"><canvas id="btDdChart"></canvas></div>
    </div>
    <div id="bt-nav-notes" class="card p-4 mt-4 bg-[#0d1221] border border-blue-900/30">
      <div class="text-xs text-gray-400"><i class="fas fa-info-circle mr-1 text-blue-400"></i>Select a strategy to see implementation notes.</div>
    </div>
  </div>

  <!-- TAB: Strategy Compare -->
  <div id="bt-pane-compare" class="hidden">
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-3">CAGR vs Max Drawdown (Risk-Return)</div>
        <div class="chart-wrap h-56"><canvas id="btRiskReturnChart"></canvas></div>
      </div>
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-3">Sharpe / Sortino / Calmar Comparison</div>
        <div class="chart-wrap h-56"><canvas id="btRatiosChart"></canvas></div>
      </div>
    </div>
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">Full Metrics Comparison Table</div>
      <div class="overflow-x-auto">
        <table class="data-table text-xs">
          <thead><tr>
            <th>Strategy</th>
            <th>CAGR%</th><th>Total%</th><th>Sharpe</th><th>Sortino</th>
            <th>MaxDD%</th><th>Calmar</th><th>Win%</th><th>PF</th>
            <th>AvgHold</th><th>Exposure%</th><th>Alpha%</th><th>Beta</th><th>IR</th>
            <th>Trades</th>
          </tr></thead>
          <tbody>
            ${cmpStrats.map(s=>`<tr>
              <td class="font-semibold text-white text-[11px] whitespace-nowrap">${s.name.replace('(SPY 10Y)','').replace('(RF Proxy)','').trim()}</td>
              <td class="text-cyan-400 font-mono">${s.annualReturn.toFixed(1)}</td>
              <td class="text-emerald-400 font-mono">${s.totalReturn.toFixed(1)}</td>
              <td class="text-amber-400 font-mono">${s.sharpe}</td>
              <td class="text-amber-300 font-mono">${s.sortino}</td>
              <td class="text-red-400 font-mono">${s.maxDrawdown.toFixed(1)}</td>
              <td class="text-blue-400 font-mono">${s.calmarRatio}</td>
              <td class="text-gray-300 font-mono">${s.winRate}</td>
              <td class="text-purple-400 font-mono">${s.profitFactor}</td>
              <td class="text-gray-400 font-mono">${s.avgHoldDays}d</td>
              <td class="text-gray-400 font-mono">${s.exposure}%</td>
              <td class="${s.alpha>=0?'text-emerald-400':'text-red-400'} font-mono">${s.alpha>=0?'+':''}${s.alpha.toFixed(1)}</td>
              <td class="text-gray-300 font-mono">${s.beta}</td>
              <td class="text-gray-300 font-mono">${s.informationRatio}</td>
              <td class="text-gray-400 font-mono">${s.totalTrades}</td>
            </tr>`).join('')}
            <tr class="border-t border-gray-700/50">
              <td class="text-gray-500 font-semibold">SPY Buy &amp; Hold</td>
              <td class="text-gray-400 font-mono">${(Math.pow(1+bench.totalReturn/100,0.1)-1)*100>0?'+':''}${((Math.pow(1+bench.totalReturn/100,0.1)-1)*100).toFixed(1)}</td>
              <td class="text-gray-400 font-mono">${bench.totalReturn.toFixed(1)}</td>
              <td class="text-gray-500 font-mono">~0.65</td>
              <td colspan="11" class="text-gray-600 text-[10px]">Passive benchmark — no transaction costs</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- TAB: Dip Events -->
  <div id="bt-pane-dips" class="hidden">
    <div class="grid grid-cols-3 gap-4 mb-4">
      <div class="kpi-card">
        <div class="text-xs text-gray-500">Cataloged Dip Events</div>
        <div class="text-2xl font-bold text-white">${dipData.total}</div>
        <div class="text-[10px] text-gray-500">10Y SPY daily, drop &gt;2%</div>
      </div>
      <div class="kpi-card">
        <div class="text-xs text-gray-500">5-Day Rebound Rate</div>
        <div class="text-2xl font-bold text-emerald-400">${dipData.reboundRate}%</div>
        <div class="text-[10px] text-gray-500">Rebound &gt;3% within 5 days</div>
      </div>
      <div class="kpi-card">
        <div class="text-xs text-gray-500">ML Signal Fire Rate</div>
        <div class="text-2xl font-bold text-cyan-400">${dipData.mlSignalRate}%</div>
        <div class="text-[10px] text-gray-500">RF Score &gt;55% threshold</div>
      </div>
    </div>
    <div class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="text-sm font-semibold text-white">Dip Event Catalog (ML-Labeled Training Data)</div>
        <div class="flex gap-1 text-[10px]">
          <button class="tab-btn active" onclick="btFilterDips('all',this)">All</button>
          <button class="tab-btn" onclick="btFilterDips('single_day_drop',this)">Daily Drop</button>
          <button class="tab-btn" onclick="btFilterDips('volume_spike_drop',this)">Vol Spike</button>
          <button class="tab-btn" onclick="btFilterDips('macro_event',this)">Macro</button>
          <button class="tab-btn" onclick="btFilterDips('earnings_gap',this)">Earnings Gap</button>
        </div>
      </div>
      <div class="overflow-x-auto max-h-72 overflow-y-auto" id="bt-dip-table-wrap">
        ${renderDipTable(dipData.events)}
      </div>
    </div>
  </div>

  <!-- TAB: ML Classifier -->
  <div id="bt-pane-ml" class="hidden">
    <div class="grid grid-cols-2 gap-4 mb-4">
      <!-- Model Card -->
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-3">
          <i class="fas fa-robot mr-1 text-cyan-400"></i>
          ${mlModel.modelType}
        </div>
        <div class="grid grid-cols-2 gap-3 mb-4">
          ${[['Accuracy',mlModel.accuracy+'%','text-emerald-400'],['Precision',mlModel.precision+'%','text-cyan-400'],
             ['Recall',mlModel.recall+'%','text-amber-400'],['F1 Score',mlModel.f1+'%','text-purple-400'],
             ['ROC-AUC',mlModel.rocAuc,'text-blue-400'],['Train Period',mlModel.trainPeriod.slice(0,7),'text-gray-300']].map(([l,v,c])=>`
          <div class="bg-[#0d1630] rounded p-2">
            <div class="text-[10px] text-gray-500">${l}</div>
            <div class="text-base font-bold ${c}">${v}</div>
          </div>`).join('')}
        </div>
        <!-- Confusion Matrix -->
        <div class="text-xs text-gray-400 mb-2">Confusion Matrix (Test Set)</div>
        <div class="grid grid-cols-2 gap-1 text-center text-xs max-w-36">
          <div class="bg-emerald-900/30 border border-emerald-700/30 rounded p-2">
            <div class="text-[9px] text-gray-500">TP</div>
            <div class="font-bold text-emerald-400">${mlModel.confusionMatrix[0][0]}</div>
          </div>
          <div class="bg-red-900/20 border border-red-700/20 rounded p-2">
            <div class="text-[9px] text-gray-500">FP</div>
            <div class="font-bold text-red-400">${mlModel.confusionMatrix[0][1]}</div>
          </div>
          <div class="bg-orange-900/20 border border-orange-700/20 rounded p-2">
            <div class="text-[9px] text-gray-500">FN</div>
            <div class="font-bold text-orange-400">${mlModel.confusionMatrix[1][0]}</div>
          </div>
          <div class="bg-blue-900/20 border border-blue-700/20 rounded p-2">
            <div class="text-[9px] text-gray-500">TN</div>
            <div class="font-bold text-blue-400">${mlModel.confusionMatrix[1][1]}</div>
          </div>
        </div>
      </div>
      <!-- Feature Importance -->
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-3">Feature Importance (RF — MDI)</div>
        <div class="space-y-2 mb-4">
          ${mlModel.featureImportance.map(f=>`
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400 w-36 font-mono">${f.name}</span>
            <div class="flex-1 score-bar">
              <div class="score-bar-fill bg-gradient-to-r from-cyan-600 to-cyan-400" style="width:${(f.importance*100/0.28*100)}%"></div>
            </div>
            <span class="text-xs font-mono text-cyan-400 w-10 text-right">${(f.importance*100).toFixed(0)}%</span>
          </div>`).join('')}
        </div>
        <div class="text-[10px] text-gray-600 border-t border-gray-700/30 pt-2">
          <div class="text-gray-400 font-semibold mb-1">Python Implementation (scikit-learn):</div>
          <pre class="text-gray-500 text-[9px] leading-relaxed">from sklearn.ensemble import RandomForestRegressor
features = ${JSON.stringify(mlModel.features)}
X_train = historical_df[features].fillna(0)
y_train = historical_df["actual_6m_return"]
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
# Deploy via yfinance daily pull → predict rebound prob</pre>
        </div>
      </div>
    </div>
    <!-- Sample Predictions -->
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">Live Inference Samples (Test Period)</div>
      <table class="data-table text-xs">
        <thead><tr>
          <th>Date</th><th>Drop%</th><th>Vol×</th><th>RSI</th><th>VIX</th><th>MA200 Dev</th>
          <th>ML Prob</th><th>Actual</th><th>Correct?</th>
        </tr></thead>
        <tbody>
          ${mlModel.samplePredictions.map(p=>`<tr>
            <td class="font-mono text-gray-400">${p.date}</td>
            <td class="text-red-400 font-mono">${p.features.drop_magnitude?.toFixed(2)}%</td>
            <td class="text-amber-400 font-mono">${p.features.volume_multiple?.toFixed(1)}×</td>
            <td class="text-blue-400 font-mono">${p.features.rsi_14?.toFixed(0)}</td>
            <td class="text-purple-400 font-mono">${p.features.vix_level?.toFixed(1)}</td>
            <td class="text-orange-400 font-mono">${p.features.ma200_deviation?.toFixed(1)}%</td>
            <td class="font-bold font-mono ${p.predictedProb>0.55?'text-emerald-400':'text-gray-500'}">${(p.predictedProb*100).toFixed(0)}%</td>
            <td class="${p.actualOutcome===1?'text-emerald-400':'text-red-400'} font-mono">${p.actualOutcome===1?'↑ Rebound':'✗ No Rebound'}</td>
            <td>${p.correct?'<span class="text-emerald-400">✓</span>':'<span class="text-red-400">✗</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="mt-3 text-[10px] text-gray-500">
        <i class="fas fa-info-circle mr-1 text-blue-400"></i>
        Edge-runtime RF proxy computes feature-weighted score without scikit-learn dependency.
        Production deployment: Python microservice → POST /api/ml/predict → threshold 55%.
        <span class="text-amber-400 ml-2">yfinance training data guide: <code>yf.download('SPY', period='10y', interval='1d')</code></span>
      </div>
    </div>
  </div>

  <!-- TAB: Trade Log -->
  <div id="bt-pane-tradelog" class="hidden">
    <div class="flex items-center gap-3 mb-3">
      <div class="text-sm font-semibold text-white">Recent Trade Log</div>
      <div class="flex gap-1 text-[10px]">
        ${strats.map((s,i)=>`<button class="tab-btn ${i===0?'active':''}" onclick="btLoadTrades('${s.id}',this)">${s.id.replace('bt_','').replace(/_/g,' ').toUpperCase().slice(0,14)}</button>`).join('')}
      </div>
    </div>
    <div id="bt-trade-log-content" class="card p-4">
      <div class="text-gray-400 text-center py-4">Loading trades...</div>
    </div>
  </div>
  `

  // ── Initialize charts and data ────────────────────────────────────────────
  setTimeout(() => {
    btLoadNav(strats[0].id)
    btRenderCompareCharts(cmpStrats, bench)
    btLoadTrades(strats[0].id)
  }, 50)

  window._btDipEvents = dipData.events
}

// ── Tab switcher ──────────────────────────────────────────────────────────────
window.btTab = function(id) {
  ['nav','compare','dips','ml','tradelog'].forEach(t => {
    document.getElementById(`bt-pane-${t}`)?.classList.toggle('hidden', t !== id)
    document.getElementById(`bt-tab-${t}`)?.classList.toggle('active', t === id)
  })
}

// ── Load NAV curve ────────────────────────────────────────────────────────────
window.btLoadNav = async function(id, btn) {
  if (btn) {
    document.querySelectorAll('#bt-pane-nav .tab-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  }
  document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('ring-1','ring-cyan-500'))
  const strat = id.replace('bt_','')
  try {
    const { data: bt } = await axios.get(`${API}/api/btd/result/${id}`)
    const nc = bt.navCurve
    const labels = nc.map(p => p.date.slice(2))

    document.getElementById('bt-nav-title').textContent =
      `NAV: ${bt.strategyName} — $100K → $${(bt.finalCapital/1000).toFixed(1)}K`

    // NAV chart
    const ctx1 = document.getElementById('btNavChart')?.getContext('2d')
    if (ctx1) {
      if (charts.btNav) charts.btNav.destroy()
      charts.btNav = new Chart(ctx1, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: bt.strategyName.slice(0,25), data: nc.map(p=>p.nav),
              borderColor:'#22d3ee', borderWidth:2, pointRadius:0,
              fill:{target:'origin',above:'rgba(34,211,238,0.06)'}, tension:0.3 },
            { label: 'SPY Buy&Hold', data: nc.map(p=>p.benchmark),
              borderColor:'#6b7280', borderWidth:1.5, pointRadius:0,
              borderDash:[4,4], tension:0.3 },
          ]
        },
        options: chartOpts('NAV')
      })
    }

    // Drawdown chart
    const ctx2 = document.getElementById('btDdChart')?.getContext('2d')
    if (ctx2) {
      if (charts.btDd) charts.btDd.destroy()
      charts.btDd = new Chart(ctx2, {
        type: 'line',
        data: {
          labels,
          datasets: [{ label: 'Drawdown %', data: nc.map(p=>p.drawdown),
            borderColor:'#f87171', borderWidth:1.5, pointRadius:0,
            fill:{target:'origin',below:'rgba(248,113,113,0.12)'}, tension:0.2 }]
        },
        options: { ...chartOpts('DD%'), scales: { ...chartOpts('DD%').scales,
          y: { ...chartOpts('DD%').scales?.y, max: 0 } } }
      })
    }

    // Notes
    const notesEl = document.getElementById('bt-nav-notes')
    if (notesEl) {
      notesEl.innerHTML = `
        <div class="text-[11px] text-gray-300 leading-relaxed">
          <i class="fas fa-info-circle mr-1 text-blue-400"></i>
          <span class="font-semibold text-cyan-400">${bt.strategyName}:</span> ${bt.notes}
        </div>
        <div class="grid grid-cols-4 gap-3 mt-3 text-[10px]">
          <div><span class="text-gray-500">Commission:</span> <span class="text-white">${bt.commission}bps (0.1%)</span></div>
          <div><span class="text-gray-500">Slippage:</span> <span class="text-white">${bt.slippage}bps</span></div>
          <div><span class="text-gray-500">Universe:</span> <span class="text-gray-300">${bt.universe.slice(0,30)}</span></div>
          <div><span class="text-gray-500">Period:</span> <span class="text-gray-300">${bt.startDate} → ${bt.endDate}</span></div>
        </div>`
    }
  } catch(e) {
    console.error('btLoadNav error', e)
  }
}

// ── Compare Charts ────────────────────────────────────────────────────────────
function btRenderCompareCharts(strats, bench) {
  // Risk-Return scatter
  const ctx1 = document.getElementById('btRiskReturnChart')?.getContext('2d')
  if (ctx1) {
    if (charts.btRR) charts.btRR.destroy()
    const colors = ['#22d3ee','#a78bfa','#34d399','#f59e0b','#6b7280']
    const labels = [...strats.map(s=>s.name.replace('(SPY 10Y)','').replace('(RF Proxy)','').trim().slice(0,16)),
                    'SPY Buy&Hold']
    const xData  = [...strats.map(s=>Math.abs(s.maxDrawdown)), 10]
    const yData  = [...strats.map(s=>s.annualReturn), bench.annualReturn||8.5]
    charts.btRR = new Chart(ctx1, {
      type: 'scatter',
      data: {
        datasets: labels.map((l,i)=>({
          label: l,
          data: [{ x: xData[i], y: yData[i] }],
          backgroundColor: colors[i],
          pointRadius: 8, pointHoverRadius: 10,
        }))
      },
      options: {
        ...chartOpts('CAGR%'),
        scales: {
          x: { title: { display:true, text:'Max Drawdown % (risk)', color:'#6b7280' }, grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#6b7280'} },
          y: { title: { display:true, text:'Annual Return %', color:'#6b7280' }, grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#6b7280'} }
        }
      }
    })
  }

  // Ratios bar chart
  const ctx2 = document.getElementById('btRatiosChart')?.getContext('2d')
  if (ctx2) {
    if (charts.btRatios) charts.btRatios.destroy()
    const names = strats.map(s=>s.name.replace('(SPY 10Y)','').replace('(RF Proxy)','').trim().slice(0,14))
    charts.btRatios = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: names,
        datasets: [
          { label:'Sharpe',  data: strats.map(s=>s.sharpe),  backgroundColor:'rgba(251,191,36,0.7)' },
          { label:'Sortino', data: strats.map(s=>s.sortino), backgroundColor:'rgba(34,211,238,0.7)' },
          { label:'Calmar',  data: strats.map(s=>s.calmarRatio),  backgroundColor:'rgba(167,139,250,0.7)' },
        ]
      },
      options: { ...chartOpts('Ratio'), plugins:{...chartOpts('').plugins, legend:{labels:{color:'#9ca3af',font:{size:10}}}} }
    })
  }
}

// ── Load Trade Log ────────────────────────────────────────────────────────────
window.btLoadTrades = async function(id, btn) {
  if (btn) {
    document.querySelectorAll('#bt-pane-tradelog .tab-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  }
  const el = document.getElementById('bt-trade-log-content')
  if (!el) return
  el.innerHTML = `<div class="text-gray-400 text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading...</div>`
  try {
    const { data: bt } = await axios.get(`${API}/api/btd/result/${id}`)
    const sells = bt.trades.filter(t => t.type === 'SELL')
    el.innerHTML = `
      <div class="text-xs text-gray-400 mb-2">Last ${sells.length} completed trades — ${bt.strategyName}</div>
      <div class="overflow-x-auto">
        <table class="data-table text-xs">
          <thead><tr>
            <th>Date</th><th>Type</th><th>Price</th><th>Shares</th><th>Hold</th>
            <th>P&L $</th><th>P&L %</th><th>Trigger</th><th>Reason</th>
          </tr></thead>
          <tbody>
            ${bt.trades.map(t=>`<tr>
              <td class="font-mono text-gray-400">${t.date}</td>
              <td><span class="badge ${t.type==='BUY'?'badge-beat':'badge-miss'}">${t.type}</span></td>
              <td class="font-mono text-gray-300">${t.price.toFixed(2)}</td>
              <td class="font-mono text-gray-400">${t.shares}</td>
              <td class="font-mono text-gray-500">${t.holdDays||'—'}d</td>
              <td class="font-mono font-bold ${(t.pnl||0)>=0?'text-emerald-400':'text-red-400'}">${t.pnl!==undefined?((t.pnl>=0?'+':'')+'$'+Math.abs(t.pnl).toFixed(0)):'—'}</td>
              <td class="font-mono ${(t.pnlPct||0)>=0?'text-emerald-400':'text-red-400'}">${t.pnlPct!==undefined?((t.pnlPct>=0?'+':'')+t.pnlPct.toFixed(1)+'%'):'—'}</td>
              <td class="text-[10px] text-cyan-400 font-mono">${t.trigger||'—'}</td>
              <td class="text-[10px] text-gray-500 max-w-xs truncate">${t.reason}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`
  } catch(e) {
    el.innerHTML = `<div class="text-red-400 text-xs p-4">Error loading trades: ${e.message}</div>`
  }
}

// ── Dip table filter ──────────────────────────────────────────────────────────
window.btFilterDips = async function(trigger, btn) {
  document.querySelectorAll('#bt-pane-dips .tab-btn').forEach(b=>b.classList.remove('active'))
  btn.classList.add('active')
  const wrap = document.getElementById('bt-dip-table-wrap')
  if (!wrap) return
  const url = trigger === 'all'
    ? `${API}/api/btd/dip-events?limit=50`
    : `${API}/api/btd/dip-events?limit=50&trigger=${trigger}`
  const { data } = await axios.get(url)
  wrap.innerHTML = renderDipTable(data.events)
}

function renderDipTable(events) {
  if (!events || events.length === 0) return `<div class="text-gray-500 text-xs p-4">No events found.</div>`
  return `<table class="data-table text-xs">
    <thead><tr>
      <th>Date</th><th>Trigger</th><th>Drop%</th><th>Vol×</th>
      <th>RSI</th><th>VIX</th><th>MA200 Dev</th>
      <th>ML Prob</th><th>Signal</th><th>Rebound 5d</th><th>Outcome</th>
    </tr></thead>
    <tbody>
      ${events.map(e=>`<tr>
        <td class="font-mono text-gray-400">${e.date}</td>
        <td><span class="badge ${e.triggerType==='earnings_gap'?'badge-live':e.triggerType==='macro_event'?'badge-miss':'badge-backtesting'} text-[9px]">${e.triggerType.replace(/_/g,' ')}</span></td>
        <td class="text-red-400 font-mono font-bold">${e.dropMagnitude.toFixed(1)}%</td>
        <td class="text-amber-400 font-mono">${e.volumeMultiple.toFixed(1)}×</td>
        <td class="text-blue-400 font-mono">${e.rsi}</td>
        <td class="text-purple-400 font-mono">${e.vix}</td>
        <td class="text-orange-400 font-mono">${e.ma200Deviation.toFixed(1)}%</td>
        <td class="font-bold font-mono ${e.mlPredictedProb>0.55?'text-emerald-400':'text-gray-500'}">${(e.mlPredictedProb*100).toFixed(0)}%</td>
        <td>${e.signalFired?'<span class="text-emerald-400 text-[10px]">✓ FIRE</span>':'<span class="text-gray-600 text-[10px]">— skip</span>'}</td>
        <td class="${e.reboundMagnitude>0?'text-emerald-400':'text-red-400'} font-mono">${e.reboundMagnitude>0?'+':''}${e.reboundMagnitude.toFixed(1)}%</td>
        <td>${e.reboundWithin5d?'<span class="badge badge-beat text-[9px]">↑ Rebound</span>':'<span class="badge badge-miss text-[9px]">✗ No</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  8. PERFORMANCE ANALYTICS (Bloomberg PE Model风格)                   ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderPerformance(el) {
  const { data: p } = await axios.get(`${API}/api/performance`)
  const recentNav = p.navHistory.slice(-252)

  el.innerHTML = `
  <!-- KPI ROW -->
  <div class="grid grid-cols-4 gap-4 mb-5">
    ${kpiCard('年化收益', fmt.pctAbs(p.annualReturn), 'vs Benchmark +10.6%', 'fas fa-rocket', 'text-emerald-400')}
    ${kpiCard('夏普比率', fmt.dec(p.sharpe), '(>1.5 为优秀)', 'fas fa-balance-scale', 'text-amber-400')}
    ${kpiCard('最大回撤', fmt.pctAbs(p.maxDrawdown), '风险控制指标', 'fas fa-arrow-down', 'text-red-400')}
    ${kpiCard('胜率', fmt.pctAbs(p.winRate), '过去252个交易日', 'fas fa-trophy', 'text-cyan-400')}
  </div>

  <!-- NAV CHART -->
  <div class="card p-4 mb-5">
    <div class="flex items-center justify-between mb-3">
      <div>
        <div class="text-sm font-semibold text-white">组合净值 vs S&P 500 (252日)</div>
        <div class="text-xs text-gray-500 mt-0.5">Bloomberg PE Model风格 · 日频净值 · 起始基准=1.0</div>
      </div>
      <div class="text-right">
        <div class="text-xs text-gray-500">最新净值</div>
        <div class="text-2xl font-bold text-cyan-400">${recentNav[recentNav.length-1]?.nav.toFixed(4)||'—'}</div>
      </div>
    </div>
    <div class="chart-wrap h-56"><canvas id="perfNavChart"></canvas></div>
  </div>

  <div class="grid grid-cols-2 gap-4 mb-5">
    <!-- Factor Attribution -->
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">收益归因 — 因子贡献 (Bloomberg PE Style)</div>
      <div class="chart-wrap h-48 mb-3"><canvas id="perfAttrChart"></canvas></div>
      <div class="space-y-1.5">
        ${p.factorAttribution.map(f=>`
        <div class="flex items-center gap-3">
          <span class="text-xs text-gray-400 w-28">${f.factor}</span>
          <div class="flex-1 score-bar">
            <div class="score-bar-fill ${f.contribution>=0?'bg-emerald-500':'bg-red-500'}" style="width:${Math.abs(f.pct)/50*100}%"></div>
          </div>
          <span class="font-mono text-xs font-bold ${f.contribution>=0?'text-emerald-400':'text-red-400'} w-16 text-right">${f.contribution>=0?'+':''}\$${Math.abs(f.contribution/1000).toFixed(0)}K</span>
          <span class="text-xs text-gray-500 w-12 text-right">${f.pct>=0?'+':''}${f.pct.toFixed(1)}%</span>
        </div>`).join('')}
      </div>
    </div>
    <!-- Sector Allocation -->
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">行业配置与收益贡献</div>
      <div class="chart-wrap h-48 mb-3"><canvas id="sectorChart"></canvas></div>
      <div class="space-y-1.5">
        ${p.sectorAllocation.map(s=>`
        <div class="flex items-center gap-3">
          <span class="text-xs text-gray-400 w-20">${s.sector}</span>
          <div class="flex-1 score-bar">
            <div class="score-bar-fill bg-blue-500" style="width:${s.weight*4}%"></div>
          </div>
          <span class="text-xs text-gray-400 w-10">${s.weight.toFixed(1)}%</span>
          <span class="font-mono text-xs font-bold ${s.pnl>=0?'text-emerald-400':'text-red-400'} w-16 text-right">${s.pnl>=0?'+':''}\$${Math.abs(s.pnl/1000).toFixed(0)}K</span>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Risk Metrics -->
  <div class="card p-4">
    <div class="text-sm font-semibold text-white mb-3">风险指标 (Bloomberg Risk Decomposition)</div>
    <div class="grid grid-cols-6 gap-3">
      ${[
        ['年化收益率', fmt.pctAbs(p.annualReturn), 'text-emerald-400'],
        ['年化波动率', '12.4%', 'text-amber-400'],
        ['夏普比率', fmt.dec(p.sharpe), 'text-amber-400'],
        ['卡尔马比率', fmt.dec(p.annualReturn/Math.abs(p.maxDrawdown)), 'text-cyan-400'],
        ['最大回撤', fmt.pctAbs(p.maxDrawdown), 'text-red-400'],
        ['胜率', fmt.pctAbs(p.winRate), 'text-gray-300'],
      ].map(([k,v,c])=>`
      <div class="bg-[#111827] rounded p-3 text-center">
        <div class="text-[10px] text-gray-500 mb-1">${k}</div>
        <div class="text-lg font-bold ${c}">${v}</div>
      </div>`).join('')}
    </div>
  </div>`

  // NAV Chart
  const step = Math.max(1, Math.floor(recentNav.length/80))
  const pts = recentNav.filter((_,i)=>i%step===0)
  const navCtx = document.getElementById('perfNavChart')?.getContext('2d')
  if (navCtx) {
    charts.perfNav = new Chart(navCtx, {
      type: 'line',
      data: {
        labels: pts.map(p=>p.date.slice(5)),
        datasets: [
          { label:'组合净值', data:pts.map(p=>p.nav), borderColor:'#22d3ee', borderWidth:2, pointRadius:0, fill:{target:'origin',above:'rgba(34,211,238,0.06)'}, tension:0.4 },
          { label:'S&P 500', data:pts.map(p=>p.benchmark), borderColor:'#6b7280', borderWidth:1.5, pointRadius:0, borderDash:[4,4], tension:0.4 },
        ]
      },
      options: chartOpts('净值')
    })
  }

  // Attribution Chart
  const attrCtx = document.getElementById('perfAttrChart')?.getContext('2d')
  if (attrCtx) {
    charts.attr2 = new Chart(attrCtx, {
      type: 'doughnut',
      data: {
        labels: p.factorAttribution.filter(f=>f.contribution>0).map(f=>f.factor),
        datasets: [{
          data: p.factorAttribution.filter(f=>f.contribution>0).map(f=>f.contribution/1000),
          backgroundColor: ['#22d3ee','#6366f1','#10b981','#f59e0b','#8b5cf6','#ec4899'],
          borderWidth: 0,
        }]
      },
      options: { plugins:{ legend:{ position:'right', labels:{ color:'#9ca3af', font:{size:10}, boxWidth:10 } } }, cutout:'60%' }
    })
  }

  // Sector Chart
  const secCtx = document.getElementById('sectorChart')?.getContext('2d')
  if (secCtx) {
    charts.sector = new Chart(secCtx, {
      type: 'bar',
      data: {
        labels: p.sectorAllocation.map(s=>s.sector),
        datasets: [{
          label:'收益贡献($K)',
          data: p.sectorAllocation.map(s=>s.pnl/1000),
          backgroundColor: p.sectorAllocation.map(s=>s.pnl>=0?'rgba(16,185,129,0.7)':'rgba(239,68,68,0.7)'),
          borderRadius: 4,
        }]
      },
      options: { ...chartOpts('收益 ($K)'), plugins:{ legend:{ display:false } }, indexAxis:'y' }
    })
  }
}

// ── SHARED HELPERS ───────────────────────────────────────────────────────────
function kpiCard(label, value, sub, icon, iconClass) {
  return `<div class="kpi-card">
    <div class="flex items-center gap-2 mb-2">
      <i class="${icon} ${iconClass} text-sm"></i>
      <span class="text-xs text-gray-500">${label}</span>
    </div>
    <div class="text-2xl font-bold text-white">${value}</div>
    ${sub ? `<div class="text-xs text-gray-500 mt-1">${sub}</div>` : ''}
  </div>`
}

function miniKpi(label, value, sub, positive) {
  const c = positive === undefined ? 'text-white' : (positive ? 'text-emerald-400' : 'text-red-400')
  return `<div class="bg-[#111827] rounded p-2 text-center">
    <div class="text-[10px] text-gray-500">${label}</div>
    <div class="text-sm font-bold ${c}">${value}</div>
    ${sub ? `<div class="text-[10px] text-gray-600">${sub}</div>` : ''}
  </div>`
}

function chartOpts(yLabel = '') {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a2540', titleColor: '#9ca3af', bodyColor: '#e5e7eb', borderColor: '#1e2d4a', borderWidth: 1 } },
    scales: {
      x: { grid: { color: '#111827', drawBorder: false }, ticks: { color: '#4b5563', font: { size: 9 }, maxTicksLimit: 8 } },
      y: { grid: { color: '#111827', drawBorder: false }, ticks: { color: '#4b5563', font: { size: 9 } }, title: { display: !!yLabel, text: yLabel, color: '#4b5563', font: { size: 9 } } }
    }
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadMarketTicker()
  navigate('dashboard')
  // Refresh ticker every 30s
  setInterval(loadMarketTicker, 30000)
})
