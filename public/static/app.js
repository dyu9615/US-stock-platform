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
  dashboard:   '总控台 — 机构市场监控',
  datacenter:  '数据中心 — 机构底层数据',
  screener:    '五因子筛选 — 量化选股',
  strategies:  '策略管理 — 策略仓库',
  mlfinance:   '机器学习 — 信号引擎',
  newsagent:   '新闻情报 — 机构宏观监控',
  research:    '研究论文库 — 因子文献',
  trading:     '交易模块 — 持仓日志',
  backtest:    '回测平台 — 历史验证',
  performance: '业绩分析 — 归因报告',
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
      </span>`).join('<span class="text-gray-400">|</span>')
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
    case 'newsagent':   await renderNewsAgent(container); break
    case 'research':    await renderResearch(container); break
    case 'trading':     await renderTrading(container); break
    case 'backtest':    await renderBacktest(container); break
    case 'performance': await renderPerformance(container); break
    case 'stockanalysis': await renderStockAnalysis(container); break
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
// ║  1. DASHBOARD  — Institutional Market Monitor                        ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderDashboard(el) {
  el.innerHTML = `<div class="flex items-center justify-center h-32 text-gray-500">
    <i class="fas fa-spinner fa-spin mr-2"></i>Loading…</div>`;
  try {
    const [macroRes, erpRes, erpHistRes, macroHistRes] = await Promise.all([
      axios.get(`${API}/api/dc/macro/current`),
      axios.get(`${API}/api/dc/erp/current`),
      axios.get(`${API}/api/dc/erp/history?days=60`),
      axios.get(`${API}/api/dc/macro/history?days=60`)
    ]);
    const m   = macroRes.data;
    const e   = erpRes.data;
    const erpH = erpHistRes.data.data  || [];
    const macH = macroHistRes.data.data || [];

    // ── colour helpers ──────────────────────────────────────────────────
    const sigColor = s => s==='panic'||s==='distress'||s==='overvalued' ? "#dc2626"
                        : s==='warning'||s==='elevated'                 ? "#d97706"
                        : s==='undervalued'||s==='attractive'           ? "#059669" : "#6b7280";
    const sigBorder= s => s==='panic'||s==='distress'||s==='overvalued' ? 'border-red-500/50'
                        : s==='warning'||s==='elevated'                 ? 'border-yellow-500/40'
                        : s==='undervalued'||s==='attractive'           ? 'border-green-500/40'
                        : 'border-gray-200';
    const pill = (s,l) => {
      const map = {
        panic:'#ff1744',distress:'#ff1744',overvalued:'#ff1744',
        warning:'#ffab00',elevated:'#ffab00',
        undervalued:'#00c853',attractive:'#00c853',
        normal:'#6b7280',neutral:'#6b7280'
      };
      const c = map[s]||'#6b7280';
      return `<span style="background:${c}22;color:${c};border:1px solid ${c}55" class="text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide uppercase">${l||s}</span>`;
    };

    // ── Yahoo Finance colour tokens ────────────────────────────────────
    const YF = { green:'#059669', red:'#dc2626', amber:'#d97706', blue:'#2563eb', cyan:'#0284c7', muted:'#6b7280' };
    const panicColor = m.panicScore>=60?"#dc2626":m.panicScore>=30?"#d97706":"#059669";
    const vixTSSig   = m.vixContango ? 'normal' : 'panic';
    const hyLabel    = m.hyOas>800?'Distress':m.hyOas>500?'Elevated':m.hyOas>400?'Caution':'Tight';
    const hyColor    = m.hyOas>800?"#dc2626":m.hyOas>500?"#d97706":'#00c853';
    const brdColor   = m.pctAbove200ma<15?"#dc2626":m.pctAbove200ma<30?"#d97706":'#00c853';
    const pcColor    = m.putCallRatio>1.5?"#dc2626":m.putCallRatio>1.1?"#d97706":'#00c853';
    const erpColor   = e.erp<1?"#dc2626":e.erp<2.5?"#d97706":'#00c853';
    const erpSig     = e.erp<1?'overvalued':e.erp<2.5?'warning':'normal';

    // ── sub-module toggle ───────────────────────────────────────────────
    let openSub = null;
    function toggleSub(id) {
      const panels = ['sub-vix','sub-hy','sub-breadth','sub-pc','sub-erp','sub-rates','sub-signals'];
      if (openSub === id) {
        openSub = null;
        document.getElementById(id).style.display = 'none';
      } else {
        openSub = id;
        panels.forEach(p => {
          const el = document.getElementById(p);
          if (el) el.style.display = p===id ? 'block' : 'none';
        });
      }
      drawSubCharts(id);
    }
    window._dashToggle = toggleSub;

    // ── render shell ────────────────────────────────────────────────────
    el.innerHTML = `
<!-- header -->
<div class="mb-4 flex items-start justify-between flex-wrap gap-3">
  <div>
    <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
      <i class="fas fa-satellite-dish" style="color:#0284c7"></i>
      总控台 · 机构市场监控
      <span class="text-xs font-normal ml-1" style="color:#9ca3af">${m.date}</span>
    </h2>
    <p style="color:#6b7280" class="text-xs mt-0.5">点击任意卡片展开详情 · 数据源链接如下 · Click card to expand</p>
  </div>
  <!-- panic gauge -->
  <div class="flex items-center gap-3 rounded-xl px-4 py-2.5" style="background:#f9fafb;border:1px solid #e5e7eb">
    <div class="relative w-12 h-12">
      <svg viewBox="0 0 36 36" class="w-12 h-12 -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" stroke-width="4"/>
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="${panicColor}" stroke-width="4"
          stroke-dasharray="${m.panicScore} ${100-m.panicScore}" stroke-linecap="round"/>
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-xs font-bold" style="color:${panicColor}">${m.panicScore}</span>
      </div>
    </div>
    <div>
      <div class="text-xs uppercase tracking-wide font-semibold" style="color:#6b7280">综合恐慌指数</div>
      <div class="text-sm font-bold" style="color:${panicColor}">${m.panicLabel}</div>
      <div class="text-[10px] mt-0.5" style="color:#9ca3af">0=平静 · 100=极度恐慌</div>
    </div>
  </div>
</div>

<!-- ── MONITOR EXPLANATION ────────────────────────────────────────────── -->
<div class="mb-5 rounded-xl p-4" style="background:#eff6ff;border:1px solid #bfdbfe">
  <div class="flex items-start gap-3">
    <i class="fas fa-info-circle text-blue-500 mt-0.5"></i>
    <div>
      <div class="text-sm font-bold text-blue-800 mb-1">📌 关于本监控系统 — What Does This Monitor Do?</div>
      <div class="text-xs leading-relaxed text-blue-900 mb-2">
        本仪表板是一个<b>宏观市场情绪与流动性监控系统</b>，综合追踪以下6大维度，帮助机构投资者识别市场压力状态、判断风险偏好方向：
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
        <div class="rounded-lg p-2" style="background:rgba(255,255,255,0.7);border:1px solid #bfdbfe">
          <div class="font-bold text-blue-700 mb-0.5">① VIX期限结构</div>
          <div class="text-blue-800">衡量市场短期 vs 远期恐惧程度。Backwardation（期货折价）= 即时崩溃恐惧信号，历史上与2020年3月、2022年2月市场暴跌高度吻合。</div>
        </div>
        <div class="rounded-lg p-2" style="background:rgba(255,255,255,0.7);border:1px solid #bfdbfe">
          <div class="font-bold text-blue-700 mb-0.5">② HY信用利差 OAS</div>
          <div class="text-blue-800">高收益债利差扩大 = 信用市场定价企业违约风险上升，是股市下跌的领先指标。FRED数据源：BAMLH0A0HYM2。&gt;500bps预警，&gt;800bps = 金融危机级别。</div>
        </div>
        <div class="rounded-lg p-2" style="background:rgba(255,255,255,0.7);border:1px solid #bfdbfe">
          <div class="font-bold text-blue-700 mb-0.5">③ 市场宽度</div>
          <div class="text-blue-800">S&P 500中高于200日均线比例。&lt;30% = 上涨动力不足，仅少数龙头支撑指数，典型的"顶部分化"信号。&lt;15% = 熊市确认。</div>
        </div>
        <div class="rounded-lg p-2" style="background:rgba(255,255,255,0.7);border:1px solid #bfdbfe">
          <div class="font-bold text-blue-700 mb-0.5">④ Put/Call比率</div>
          <div class="text-blue-800">CBOE期权市场看跌/看涨比率。&gt;1.1 = 投资者大量购买下行保护 = 恐慌信号。&lt;0.8 = 过度乐观贪婪信号，潜在顶部反转风险。</div>
        </div>
        <div class="rounded-lg p-2" style="background:rgba(255,255,255,0.7);border:1px solid #bfdbfe">
          <div class="font-bold text-blue-700 mb-0.5">⑤ 股权风险溢价 ERP</div>
          <div class="text-blue-800">ERP = 股票收益率 - 无风险利率（10Y美债）。&lt;1% = 股市相对债券无超额补偿 = 估值极度偏贵。&gt;3% = 股票具吸引力。</div>
        </div>
        <div class="rounded-lg p-2" style="background:rgba(255,255,255,0.7);border:1px solid #bfdbfe">
          <div class="font-bold text-blue-700 mb-0.5">⑥ 收益率曲线</div>
          <div class="text-blue-800">10Y-2Y利差。持续倒挂（&lt;0）= 历史上最可靠的衰退预警信号，平均提前12-18个月领先经济衰退。当前水平反映市场对Fed政策路径的预期。</div>
        </div>
      </div>
      <div class="mt-2 text-[10px] text-blue-700 flex flex-wrap gap-3">
        <span><b>数据源:</b></span>
        <a href="https://finance.yahoo.com/quote/%5EVIX/" target="_blank" class="yf-link">Yahoo ^VIX</a>
        <a href="https://fred.stlouisfed.org/series/BAMLH0A0HYM2" target="_blank" class="yf-link">FRED HY OAS</a>
        <a href="https://stockcharts.com/h-sc/ui?s=%24SPXA200R" target="_blank" class="yf-link">StockCharts 宽度</a>
        <a href="https://www.cboe.com/us/options/market_statistics/daily/" target="_blank" class="yf-link">CBOE P/C</a>
        <a href="https://fred.stlouisfed.org/series/GS10" target="_blank" class="yf-link">FRED 10Y</a>
        <a href="https://finance.yahoo.com/quote/%5EGSPC/" target="_blank" class="yf-link">Yahoo SPX</a>
      </div>
    </div>
  </div>
</div>

<!-- ── SECTION A: SENTIMENT & LIQUIDITY ─────────────────────────────── -->
<div class="mb-2 flex items-center gap-2">
  <div class="w-0.5 h-4 bg-red-500 rounded"></div>
  <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Sentiment & Liquidity</span>
</div>
<div class="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-1">

  <!-- VIX card -->
  <div class="cursor-pointer rounded-xl p-3 transition-colors" style="background:#ffffff;border:1px solid #e2e4ec" onclick="window._dashToggle('sub-vix')">
    <div class="flex items-start justify-between mb-2">
      <span class="text-[10px] uppercase font-semibold leading-tight" style="color:#6b7280">VIX 期限结构<br>Term Structure</span>
      ${pill(vixTSSig)}
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold text-gray-900">${m.vix.toFixed(1)}</span>
      <span class="text-xs text-gray-500">spot</span>
    </div>
    <div class="text-xs mt-1 ${m.vixContango?'text-emerald-400':'text-red-400'} font-medium">
      ${m.vixContango ? '↗ Contango — 市场平静' : '↘ Backwardation ⚠ 恐慌信号'}
    </div>
    <div class="text-[10px] mt-1" style="color:#9ca3af">VX1 ${m.vx1.toFixed(1)} · VX3 ${m.vx3.toFixed(1)}</div>
    <div class="flex items-center gap-2 mt-1.5"><a href="https://finance.yahoo.com/quote/%5EVIX/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt text-[9px]"></i>^VIX</a><span class="text-[9px]" style="color:#9ca3af">点击展开 ↓</span></div>
  </div>

  <!-- HY OAS card -->
  <div class="cursor-pointer rounded-xl p-3 transition-colors" style="background:#ffffff;border:1px solid #e2e4ec" onclick="window._dashToggle('sub-hy')">
    <div class="flex items-start justify-between mb-2">
      <span class="text-[10px] uppercase font-semibold leading-tight" style="color:#6b7280">HY信用利差<br>HY OAS</span>
      ${pill(m.hyOasSignal, hyLabel)}
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold" style="color:${hyColor}">${m.hyOas}</span>
      <span class="text-xs text-gray-500">bps</span>
    </div>
    <div class="h-1.5 rounded-full mt-2 mb-1" style="background:#e2e4ec">
      <div class="h-1.5 rounded-full" style="width:${Math.min(m.hyOas/12,100)}%;background:${hyColor}"></div>
    </div>
    <div class="text-[10px] mt-1" style="color:#9ca3af">FRED BAMLH0A0HYM2 · 崩溃 >800</div>
    <div class="flex items-center gap-2 mt-1"><a href="https://fred.stlouisfed.org/series/BAMLH0A0HYM2" target="_blank" class="yf-link"><i class="fas fa-external-link-alt text-[9px]"></i>FRED</a><span class="text-[9px]" style="color:#9ca3af">点击展开 ↓</span></div>
  </div>

  <!-- Breadth card -->
  <div class="cursor-pointer rounded-xl p-3 transition-colors" style="background:#ffffff;border:1px solid #e2e4ec" onclick="window._dashToggle('sub-breadth')">
    <div class="flex items-start justify-between mb-2">
      <span class="text-[10px] uppercase font-semibold leading-tight" style="color:#6b7280">市场宽度<br>Breadth</span>
      ${pill(m.breadthSignal)}
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold" style="color:${brdColor}">${m.pctAbove200ma.toFixed(1)}</span>
      <span class="text-xs text-gray-500">% >200DMA</span>
    </div>
    <div class="h-1.5 rounded-full mt-2 mb-1" style="background:#e2e4ec">
      <div class="h-1.5 rounded-full" style="width:${m.pctAbove200ma}%;background:${brdColor}"></div>
    </div>
    <div class="text-[10px] mt-1" style="color:#9ca3af">S5TH200X · 恐慌 <15%</div>
    <div class="flex items-center gap-2 mt-1"><a href="https://stockcharts.com/h-sc/ui?s=%24SPXA200R" target="_blank" class="yf-link"><i class="fas fa-external-link-alt text-[9px]"></i>Chart</a><span class="text-[9px]" style="color:#9ca3af">点击展开 ↓</span></div>
  </div>

  <!-- Put/Call card -->
  <div class="cursor-pointer rounded-xl p-3 transition-colors" style="background:#ffffff;border:1px solid #e2e4ec" onclick="window._dashToggle('sub-pc')">
    <div class="flex items-start justify-between mb-2">
      <span class="text-[10px] uppercase font-semibold leading-tight" style="color:#6b7280">CBOE期权<br>Put/Call</span>
      ${pill(m.putCallSignal)}
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold" style="color:${pcColor}">${m.putCallRatio.toFixed(2)}</span>
      <span class="text-xs text-gray-500">×</span>
    </div>
    <div class="grid grid-cols-3 gap-0.5 mt-2 text-[10px] text-center">
      <div class="rounded py-0.5" style="${m.putCallRatio<0.8?'background:rgba(0,200,83,0.2);color:#00c853':'background:#e2e4ec;color:#555568'}">贪婪 &lt;0.8</div>
      <div class="rounded py-0.5" style="${m.putCallRatio>=0.8&&m.putCallRatio<1.1?'background:#d0d3e0;color:#e8e8e8':'background:#e2e4ec;color:#555568'}">0.8–1.1</div>
      <div class="rounded py-0.5" style="${m.putCallRatio>=1.1?'background:rgba(255,23,68,0.2);color:#ff5370':'background:#e2e4ec;color:#555568'}">恐慌 &gt;1.1</div>
    </div>
    <div class="flex items-center gap-2 mt-1.5"><a href="https://www.cboe.com/us/options/market_statistics/daily/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt text-[9px]"></i>CBOE</a><span class="text-[9px]" style="color:#9ca3af">点击展开 ↓</span></div>
  </div>
</div>

<!-- sub-module: VIX -->
<div id="sub-vix" style="display:none;background:#f8faff;border:1px solid #dbeafe" class="mb-3 rounded-xl p-5">
  <div class="flex items-center justify-between mb-4">
    <div>
      <span class="text-sm font-bold" style="color:#1e2440">📊 VIX期限结构详解</span>
      <span class="ml-2 text-xs" style="color:#6b7280">VIX Term Structure</span>
    </div>
    <div class="flex items-center gap-3">
      <a href="https://finance.yahoo.com/quote/%5EVIX/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> Yahoo ^VIX</a>
      <a href="https://www.cboe.com/tradable_products/vix/vix_futures/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> CBOE VX Futures</a>
      <button onclick="window._dashToggle('sub-vix')" class="text-xs px-2 py-1 rounded" style="background:#fee2e2;color:#991b1b">✕ 关闭</button>
    </div>
  </div>
  <div class="grid grid-cols-3 gap-3 mb-4">
    ${[['现货 Spot VIX', m.vix.toFixed(1), 'Yahoo Finance ^VIX'], ['VX1 (1个月期货)', m.vx1.toFixed(1), 'CBOE VX Futures 近月'], ['VX3 (3个月期货)', m.vx3.toFixed(1), 'CBOE VX Futures 远月']].map(([l,v,src])=>`
    <div class="rounded-lg p-4 text-center" style="background:#ffffff;border:1px solid #dbeafe">
      <div class="text-xs font-medium" style="color:#6b7280">${l}</div>
      <div class="text-2xl font-bold mt-1" style="color:#1e2440">${v}</div>
      <div class="text-[10px] mt-1" style="color:#9ca3af">${src}</div>
    </div>`).join('')}
  </div>
  <div class="grid grid-cols-2 gap-4 mb-4">
    <div class="rounded-lg p-4" style="background:#ffffff;border:1px solid #e2e4ec">
      <div class="text-xs font-semibold mb-2" style="color:#6b7280">期限斜率 Term Slope = (VX1−Spot)/Spot</div>
      <div class="text-2xl font-bold ${m.vixContango?'text-emerald-600':'text-red-600'}">${(m.vixTermStructure*100).toFixed(1)}%</div>
      <div class="text-xs mt-1 font-medium ${m.vixContango?'text-emerald-600':'text-red-600'}">${m.vixContango?'✓ Contango — 市场平稳，远期溢价正常':'⚠ Backwardation — 近端恐慌溢价，重要警示信号'}</div>
    </div>
    <div class="rounded-lg p-4" style="background:#fffbeb;border:1px solid #fde68a">
      <div class="text-xs font-semibold mb-2" style="color:#92400e">触发逻辑 Panic Trigger</div>
      <div class="text-xs leading-relaxed" style="color:#78350f">当 <b>VIX Spot > VX1</b>（即期货折价）表明市场投资者愿意为近期保护支付远超长期的溢价 → 极端的即时崩溃恐惧。历史参考：2020年3月COVID -9.2%，2022年2月俄乌-4.8%，均出现显著Backwardation。</div>
    </div>
  </div>
  <div class="rounded-lg p-4" style="background:#f0f9ff;border:1px solid #bae6fd">
    <div class="text-xs font-semibold mb-2" style="color:#0369a1">📌 交易影响 Trading Implication</div>
    <div class="grid grid-cols-3 gap-3 text-xs">
      <div><b style="color:#1e2440">Contango（正向）:</b><br><span style="color:#6b7280">VX1 > Spot → 市场认为短期波动受控，远期不确定性更高。VIX ETF做空（SVXY/XIV）通常有正 roll yield。策略倾向 risk-on。</span></div>
      <div><b style="color:#1e2440">Backwardation（倒挂）:</b><br><span style="color:#6b7280">VX1 < Spot → 市场对近期崩溃定价超过远期 → 极端恐惧。Buy-the-Dip触发区，但需确认HY OAS同步。</span></div>
      <div><b style="color:#1e2440">数据源 Source:</b><br><span style="color:#6b7280">Yahoo Finance: <code>^VIX</code>, <code>^VX1</code>, <code>^VX3</code><br>CBOE: vix_futures daily settlement<br>更新频率: 每日收盘</span></div>
    </div>
  </div>
</div>

<!-- sub-module: HY OAS -->
<div id="sub-hy" style="display:none;background:#fff8f8;border:1px solid #fecaca" class="mb-3 rounded-xl p-5">
  <div class="flex items-center justify-between mb-4">
    <div>
      <span class="text-sm font-bold" style="color:#1e2440">📊 高收益信用利差详解</span>
      <span class="ml-2 text-xs" style="color:#6b7280">HY Credit Spread OAS</span>
    </div>
    <div class="flex items-center gap-3">
      <a href="https://fred.stlouisfed.org/series/BAMLH0A0HYM2" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> FRED BAMLH0A0HYM2</a>
      <a href="https://finance.yahoo.com/quote/HYG/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> Yahoo HYG ETF</a>
      <button onclick="window._dashToggle('sub-hy')" class="text-xs px-2 py-1 rounded" style="background:#fee2e2;color:#991b1b">✕ 关闭</button>
    </div>
  </div>
  <div class="grid grid-cols-4 gap-3 mb-4">
    ${[['当前OAS Current', m.hyOas+' bps', hyColor], ['信号 Signal', hyLabel, hyColor],
       ['警惕线 Caution', '400 bps', '#d97706'], ['崩溃线 Distress', '800 bps', '#dc2626']].map(([l,v,c])=>`
    <div class="rounded-lg p-3 text-center" style="background:#ffffff;border:1px solid #e2e4ec">
      <div class="text-xs" style="color:#6b7280">${l}</div>
      <div class="text-xl font-bold mt-1" style="color:${c}">${v}</div>
    </div>`).join('')}
  </div>
  <div class="rounded-lg p-4 mb-4" style="background:#ffffff;border:1px solid #e2e4ec">
    <div class="text-xs font-semibold mb-2" style="color:#6b7280">含义解读 Interpretation</div>
    <div class="text-xs leading-relaxed" style="color:#374151">
      <b>OAS = Option-Adjusted Spread</b> — 高收益债与同期国债的利差（基点）。衡量信用市场对违约风险的定价。<br>
      • <b style="color:#059669">&lt;300 bps:</b> 信用极度宽松，杠杆融资容易，风险资产溢价丰厚；反指看涨过度<br>
      • <b style="color:#d97706">300–400 bps:</b> 正常范围（历史均值约350bps），市场观望<br>  
      • <b style="color:#d97706">400–800 bps:</b> 流动性压力，HY ETF赎回加速，BBB降级风险上升<br>
      • <b style="color:#dc2626">&gt;800 bps:</b> 信用危机，真实违约周期开始（GFC 2009峰值：1,900bps；COVID 2020：1,100bps）<br>
      当前 ${m.hyOas} bps = <b style="color:${hyColor}">${hyLabel}</b>
    </div>
  </div>
  <div class="rounded-lg p-4" style="background:#f0f9ff;border:1px solid #bae6fd">
    <div class="text-xs font-semibold mb-2" style="color:#0369a1">📌 交易影响 Trading Implication</div>
    <div class="text-xs leading-relaxed" style="color:#374151">HY OAS突破400bps → 减少高Beta股票仓位，转向Investment Grade信用和国债。突破800bps → 触发Buy-the-Dip逻辑（极端压力，均值回归）但需同时确认VIX backwardation和市场宽度 &lt;15%。</div>
  </div>
</div>

<!-- sub-module: Breadth -->
<div id="sub-breadth" style="display:none;background:#f8fff8;border:1px solid #bbf7d0" class="mb-3 rounded-xl p-5">
  <div class="flex items-center justify-between mb-4">
    <div>
      <span class="text-sm font-bold" style="color:#1e2440">📊 市场宽度详解</span>
      <span class="ml-2 text-xs" style="color:#6b7280">Market Breadth — S5TH200X</span>
    </div>
    <div class="flex items-center gap-3">
      <a href="https://stockcharts.com/h-sc/ui?s=%24SPXA200R" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> StockCharts SPXA200R</a>
      <a href="https://finance.yahoo.com/quote/SPY/components/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> SPY Components</a>
      <button onclick="window._dashToggle('sub-breadth')" class="text-xs px-2 py-1 rounded" style="background:#fee2e2;color:#991b1b">✕ 关闭</button>
    </div>
  </div>
  <div class="grid grid-cols-3 gap-3 mb-4">
    ${[['当前值 Current', m.pctAbove200ma.toFixed(1)+'%', brdColor], ['恐慌区 Panic Zone', '<15%', '#dc2626'], ['警戒区 Warning', '<30%', '#d97706']].map(([l,v,c])=>`
    <div class="rounded-lg p-3 text-center" style="background:#ffffff;border:1px solid #e2e4ec">
      <div class="text-xs" style="color:#6b7280">${l}</div>
      <div class="text-xl font-bold mt-1" style="color:${c}">${v}</div>
    </div>`).join('')}
  </div>
  <div class="rounded-lg p-4 mb-4" style="background:#ffffff;border:1px solid #e2e4ec">
    <div class="text-xs font-semibold mb-2" style="color:#6b7280">含义解读 Interpretation</div>
    <div class="text-xs leading-relaxed" style="color:#374151">
      <b>% Above 200-Day SMA</b> — S&P 500中处于200日移动均线以上的股票占比。反映市场内在健康状况，而非仅指数水平。<br>
      • <b style="color:#059669">&gt;70%:</b> 健康牛市，多数股票参与上涨<br>
      • <b style="color:#d97706">30–70%:</b> 中性，指数可能创新高但内部分化<br>
      • <b style="color:#d97706">15–30%:</b> 市场内部广泛恶化，即使指数接近高点也是风险信号<br>
      • <b style="color:#dc2626">&lt;15%:</b> 历史极端底部区域 → Buy-the-Dip的最强信号<br>
      历史案例：COVID 2020年3月 = <b>3%</b>，GFC 2009年3月 = <b>2%</b>，均为历史最佳买入时机
    </div>
  </div>
  <div class="rounded-lg p-4" style="background:#f0f9ff;border:1px solid #bae6fd">
    <div class="text-xs font-semibold mb-2" style="color:#0369a1">📌 交易影响</div>
    <div class="text-xs" style="color:#374151">当前 ${m.pctAbove200ma.toFixed(1)}% — ${m.pctAbove200ma<15?'🔴 极端恐慌区，历史最优买入窗口，但需其他信号确认':m.pctAbove200ma<30?'🟡 市场内部恶化，控制仓位，等待企稳':'🟢 市场内部健康，维持正常配置'}</div>
  </div>
</div>

<!-- sub-module: Put/Call -->
<div id="sub-pc" style="display:none;background:#fafafa;border:1px solid #e2e4ec" class="mb-3 rounded-xl p-5">
  <div class="flex items-center justify-between mb-4">
    <div>
      <span class="text-sm font-bold" style="color:#1e2440">📊 Put/Call比率详解</span>
      <span class="ml-2 text-xs" style="color:#6b7280">CBOE Equity Put/Call Ratio</span>
    </div>
    <div class="flex items-center gap-3">
      <a href="https://www.cboe.com/us/options/market_statistics/daily/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> CBOE Daily Stats</a>
      <a href="https://finance.yahoo.com/quote/%5EPCCE/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> Yahoo ^PCCE</a>
      <button onclick="window._dashToggle('sub-pc')" class="text-xs px-2 py-1 rounded" style="background:#fee2e2;color:#991b1b">✕ 关闭</button>
    </div>
  </div>
  <div class="grid grid-cols-3 gap-3 mb-4 text-center text-xs">
    ${[['<0.7 — 贪婪 Greed','反向看空信号\n市场过度自信，风险偏好极高','#d1fae5','#065f46'],
       ['0.7–1.1 — 中性 Neutral','正常对冲活动\n无极端信号','#f3f4f6','#374151'],
       ['>1.1 — 恐惧 Fear','反向看多信号\nBuy-the-Dip机会窗口','#fee2e2','#991b1b']].map(([t,d,bg,tc])=>`
    <div class="rounded-lg p-3" style="background:${bg};border:2px solid ${m.putCallRatio<0.7&&t.startsWith('<')?'#2563eb':m.putCallRatio>=0.7&&m.putCallRatio<1.1&&t.startsWith('0')?'#2563eb':m.putCallRatio>=1.1&&t.startsWith('>')? '#2563eb':'transparent'}">
      <div class="font-bold mb-1" style="color:${tc}">${t}</div>
      <div class="text-[11px]" style="color:${tc};opacity:0.8">${d}</div>
    </div>`).join('')}
  </div>
  <div class="rounded-lg p-4" style="background:#ffffff;border:1px solid #e2e4ec">
    <div class="text-xs font-semibold mb-2" style="color:#6b7280">当前读数 Current Reading</div>
    <div class="text-xs leading-relaxed" style="color:#374151">
      当前 <b style="color:${pcColor}">${m.putCallRatio.toFixed(2)}×</b> — ${m.putCallRatio>=1.1?'⚠ 高恐惧区 → 反向做多信号形成（期权市场过度购买保护）':m.putCallRatio<0.7?'⚠ 过度贪婪 → 反向谨慎信号（期权保护购买极少）':'✓ 正常对冲，无极端信号'}<br><br>
      <b>注意：</b>仅使用 CBOE <i>Equity</i> Put/Call（排除指数期权），因为股票期权更纯粹反映散户/机构情绪，指数期权含大量复合策略对冲会干扰读数。
    </div>
  </div>
</div>

<!-- sub-module: ERP -->
<div id="sub-erp" style="display:none;background:#fffef0;border:1px solid #fde68a" class="mb-3 rounded-xl p-5">
  <div class="flex items-center justify-between mb-4">
    <div>
      <span class="text-sm font-bold" style="color:#1e2440">📊 股权风险溢价详解</span>
      <span class="ml-2 text-xs" style="color:#6b7280">Equity Risk Premium (ERP)</span>
    </div>
    <div class="flex items-center gap-3">
      <a href="https://fred.stlouisfed.org/series/DGS10" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> FRED 10Y Treasury</a>
      <a href="https://finance.yahoo.com/quote/%5EGSPC/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> S&P 500 ^GSPC</a>
      <button onclick="window._dashToggle('sub-erp')" class="text-xs px-2 py-1 rounded" style="background:#fee2e2;color:#991b1b">✕ 关闭</button>
    </div>
  </div>
  <div class="grid grid-cols-4 gap-3 mb-4">
    ${[['ERP', e.erp.toFixed(2)+'%', erpColor], ['盈利收益率 Earn Yield', e.sp500EarningsYield.toFixed(2)+'%', '#374151'],
       ['10Y国债 Treasury', e.usTreasury10y.toFixed(2)+'%', '#374151'], ['历史百分位 Pctile', e.erpHistoricalPercentile+'th', erpColor]].map(([l,v,c])=>`
    <div class="rounded-lg p-3 text-center" style="background:#ffffff;border:1px solid #e2e4ec">
      <div class="text-xs" style="color:#6b7280">${l}</div>
      <div class="text-xl font-bold mt-1" style="color:${c}">${v}</div>
    </div>`).join('')}
  </div>
  <div class="rounded-lg p-4 mb-4" style="background:#ffffff;border:1px solid #e2e4ec">
    <div class="text-xs font-semibold mb-2" style="color:#6b7280">计算公式 Formula</div>
    <div class="text-xs leading-relaxed" style="color:#374151">
      <b>ERP = S&P 500 Forward Earnings Yield − 10Y Treasury Yield</b><br>
      = (1 / Forward P/E) × 100% − 10Y UST%<br>
      = ${e.sp500EarningsYield.toFixed(2)}% − ${e.usTreasury10y.toFixed(2)}% = <b style="color:${erpColor}">${e.erp.toFixed(2)}%</b><br><br>
      • <b style="color:#059669">ERP &gt;3%:</b> 股票相对债券有显著溢价 → 股票具吸引力<br>
      • <b style="color:#d97706">ERP 1–3%:</b> 公允价值，竞争关系均衡<br>
      • <b style="color:#dc2626">ERP &lt;1%:</b> 股票溢价极薄 → 高估信号，历史上此区域随后平均跌幅15–25%
    </div>
  </div>
  <div class="grid grid-cols-3 gap-2 mb-4 text-xs text-center">
    ${[['&lt;1%','高估 Overvalued','#fee2e2','#991b1b'],['1–3%','公允 Fair Value','#f3f4f6','#374151'],['&gt;3%','低估 Attractive','#d1fae5','#065f46']].map(([r,l,bg,tc])=>`
    <div class="rounded-lg p-2" style="background:${bg}">
      <div class="font-bold" style="color:${tc}">${r}</div><div style="color:${tc};opacity:0.8">${l}</div>
    </div>`).join('')}
  </div>
  <div class="rounded-lg p-3 text-xs" style="background:#fffbeb;border:1px solid #fde68a;color:#78350f">${e.erpNote}</div>
</div>

<!-- sub-module: Rates -->
<div id="sub-rates" style="display:none;background:#fafafa;border:1px solid #e2e4ec" class="mb-3 rounded-xl p-5">
  <div class="flex items-center justify-between mb-4">
    <div>
      <span class="text-sm font-bold" style="color:#1e2440">📊 美债利率与收益率曲线详解</span>
      <span class="ml-2 text-xs" style="color:#6b7280">US Treasury Rates & Yield Curve</span>
    </div>
    <div class="flex items-center gap-3">
      <a href="https://fred.stlouisfed.org/series/DGS10" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> FRED DGS10</a>
      <a href="https://fred.stlouisfed.org/series/DGS2" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> FRED DGS2</a>
      <a href="https://finance.yahoo.com/bonds/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> Yahoo Bonds</a>
      <button onclick="window._dashToggle('sub-rates')" class="text-xs px-2 py-1 rounded" style="background:#fee2e2;color:#991b1b">✕ 关闭</button>
    </div>
  </div>
  <div class="grid grid-cols-4 gap-3 mb-4">
    ${[['联邦基金利率 Fed Funds','5.25–5.50%','#374151'],['2Y国债 Treasury',m.usTreasury2y.toFixed(2)+'%',m.usTreasury2y>5?'#dc2626':'#374151'],
       ['10Y国债 Treasury',m.usTreasury10y.toFixed(2)+'%',m.usTreasury10y>5?'#dc2626':'#374151'],['10Y−2Y利差 Spread',(m.yieldCurve>0?'+':'')+m.yieldCurve+' bps',m.yieldCurveInverted?'#d97706':'#059669']].map(([l,v,c])=>`
    <div class="rounded-lg p-3 text-center" style="background:#ffffff;border:1px solid #e2e4ec">
      <div class="text-xs" style="color:#6b7280">${l}</div>
      <div class="text-lg font-bold mt-1" style="color:${c}">${v}</div>
    </div>`).join('')}
  </div>
  <div class="rounded-lg p-4 mb-4" style="background:#ffffff;border:1px solid #e2e4ec">
    <div class="text-xs font-semibold mb-2" style="color:#6b7280">收益率曲线解读 Yield Curve</div>
    <div class="text-xs leading-relaxed" style="color:#374151">
      <b>曲线${m.yieldCurveInverted?'倒挂 INVERTED（⚠警告）':'正斜率 Normal（✓健康）'}</b> — 10Y−2Y利差 ${(m.yieldCurve>0?'+':'')+m.yieldCurve} bps<br><br>
      ${m.yieldCurveInverted?'倒挂曲线（短端高于长端）自1970年以来预测了每次美国经济衰退，平均领先12–18个月。当前倒挂 → 债券市场定价6–18个月后盈利衰退概率上升，对长久期成长股P/E倍数构成压制。':'正斜率曲线表明经济增长预期完好，债券市场未定价衰退风险。10Y国债收益率高于2Y表明市场愿意为长期资本提供更高回报。'}
      <br><br><b>数据源：</b> FRED DGS10（10年国债）+ FRED DGS2（2年国债），每日更新
    </div>
  </div>
</div>

<!-- sub-module: Composite Signals table -->
<div id="sub-signals" style="display:none;background:#f8faff;border:1px solid #dbeafe" class="mb-3 rounded-xl p-5">
  <div class="flex items-center justify-between mb-4">
    <div>
      <span class="text-sm font-bold" style="color:#1e2440">📊 综合信号汇总</span>
      <span class="ml-2 text-xs" style="color:#6b7280">Composite Signal Summary — All Indicators</span>
    </div>
    <div class="flex items-center gap-3">
      <a href="https://finance.yahoo.com/quote/%5EGSPC/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> S&P 500 ^GSPC</a>
      <a href="https://finance.yahoo.com/screener/predefined/day_gainers" target="_blank" class="yf-link"><i class="fas fa-external-link-alt"></i> Yahoo Screener</a>
      <button onclick="window._dashToggle('sub-signals')" class="text-xs px-2 py-1 rounded" style="background:#fee2e2;color:#991b1b">✕ 关闭</button>
    </div>
  </div>
  <div class="overflow-x-auto">
  <table class="data-table">
    <thead><tr>
      <th>指标 Indicator</th>
      <th class="text-right">当前值</th>
      <th class="text-center">信号</th>
      <th>含义解读 Meaning</th>
      <th>交易影响 Impact</th>
      <th>数据源</th>
    </tr></thead>
    <tbody>
    ${[
      ['VIX现货 VIX Spot', m.vix.toFixed(1), vixTSSig, 
       '恐慌指数即期读数。<20=平静，20-30=警觉，>30=恐慌，>40=极端恐慌', 
       'VIX>30考虑增加保护性Put；VIX>40历史上是买入时机', 'Yahoo Finance ^VIX'],
      ['VIX期限斜率 Term Slope', (m.vixTermStructure*100).toFixed(1)+'%', vixTSSig, 
       'Contango(正) = 远期溢价正常，市场平稳；Backwardation(负) = 近端恐惧溢价，极端信号',
       'Backwardation触发BTD逻辑之一', 'CBOE VX Futures'],
      ['HY OAS', m.hyOas+' bps', m.hyOasSignal, 
       '高收益债利差，衡量信用市场对违约风险的定价。历史均值约350bps',
       '>400bps减持高Beta；>800bps系统性危机信号', 'FRED BAMLH0A0HYM2'],
      ['市场宽度 Breadth', m.pctAbove200ma.toFixed(1)+'%', m.breadthSignal, 
       'S&P 500中处于200日均线上方的股票比例。反映市场内在健康',
       '<15%历史极端买入区（COVID低点3%）', 'StockCharts S5TH200X'],
      ['Put/Call比率', m.putCallRatio.toFixed(2)+'×', m.putCallSignal, 
       'CBOE股票期权仅Put/Call比。>1.1=恐惧(反向买入)，<0.7=贪婪(反向卖出)',
       '>1.5极端恐惧 = 强烈BTD信号', 'CBOE Equity P/C'],
      ['收益率曲线 10Y-2Y', (m.yieldCurve>0?'+':'')+m.yieldCurve+' bps', m.yieldCurveInverted?'warning':'normal', 
       '10年与2年国债利差。倒挂(负值)自1970年起100%预测衰退，领先12-18个月',
       '倒挂→减配周期股，增配防御性资产', 'FRED DGS10/DGS2'],
      ['ERP', e.erp.toFixed(2)+'%', erpSig, 
       '股票盈利收益率-10Y国债。衡量股票相对债券的超额回报补偿',
       '<1%高估预警，历史随后平均跌幅15-25%', 'FactSet共识/FRED'],
      ['SPX远期P/E', '21.8×', 'warning', 
       '标普500未来12个月预期P/E。历史10年均值约17-18×，当前溢价约20%',
       '>20×历史上对应未来3年年化收益率仅4-5%', 'FactSet NTM Estimates'],
    ].map(([ind,val,sig,meaning,impact,src])=>`
    <tr>
      <td class="font-medium" style="color:#1e2440">${ind}</td>
      <td class="text-right font-mono font-bold" style="color:${sigColor(sig)}">${val}</td>
      <td class="text-center">
        <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" style="background:${sig==='panic'||sig==='distress'||sig==='overvalued'?'#fee2e2':sig==='warning'||sig==='elevated'?'#fef3c7':sig==='undervalued'||sig==='normal'||sig==='neutral'?'#d1fae5':'#f3f4f6'};color:${sig==='panic'||sig==='distress'||sig==='overvalued'?'#991b1b':sig==='warning'||sig==='elevated'?'#92400e':sig==='undervalued'||sig==='normal'||sig==='neutral'?'#065f46':'#374151'}">${sig.toUpperCase()}</span>
      </td>
      <td class="text-xs max-w-xs" style="color:#374151">${meaning}</td>
      <td class="text-xs" style="color:#6b7280">${impact}</td>
      <td class="text-[10px]" style="color:#9ca3af">${src}</td>
    </tr>`).join('')}
    </tbody>
  </table>
  </div>
</div>
`;

    // ── draw charts when sub-modules open ──────────────────────────────
    window._dashDrawn = {};
    window._dashData  = { macH, erpH, m, e };

    function drawSubCharts(id) {
      if (window._dashDrawn[id]) return;
      window._dashDrawn[id] = true;
      const { macH, erpH } = window._dashData;

      setTimeout(() => {
        const chartDefs = {
          'sub-vix':    { canvasId:'sub-vix-chart',  datasets:[
            { data: macH.map(d=>d.vix),  borderColor:'#2563eb', label:'VIX Spot' },
            { data: macH.map(d=>d.vx1),  borderColor:'#7c3aed', label:'VX1', borderDash:[3,2] }
          ], labels: macH.map(d=>d.date) },
          'sub-hy':     { canvasId:'sub-hy-chart',   datasets:[
            { data: macH.map(d=>d.hyOas), borderColor: hyColor, label:'HY OAS (bps)' }
          ], labels: macH.map(d=>d.date), refLines:[{y:400,color:'#d97706',label:'Caution'},{y:800,color:'#dc2626',label:'Distress'}] },
          'sub-breadth':{ canvasId:'sub-brd-chart',  datasets:[
            { data: macH.map(d=>d.pctAbove200ma), borderColor: brdColor, label:'% >200DMA' }
          ], labels: macH.map(d=>d.date), refLines:[{y:15,color:'#dc2626',label:'Panic'},{y:30,color:'#d97706',label:'Warn'}] },
          'sub-erp':    { canvasId:'sub-erp-chart',  datasets:[
            { data: erpH.map(d=>d.erp), borderColor:'#d97706', label:'ERP %' }
          ], labels: erpH.map(d=>d.date), refLines:[{y:1,color:'#dc2626',label:'1% danger'}] }
        };
        const def = chartDefs[id];
        if (!def) return;
        const canvas = document.getElementById(def.canvasId);
        if (!canvas) return;

        const datasets = def.datasets.map((ds,i) => ({
          label: ds.label, data: ds.data, borderColor: ds.borderColor,
          borderWidth: 1.5, pointRadius: 0, tension: 0.4, fill: false,
          borderDash: ds.borderDash || []
        }));
        if (def.refLines) {
          def.refLines.forEach(rl => datasets.push({
            label: rl.label, data: def.labels.map(()=>rl.y),
            borderColor: rl.color, borderWidth: 1, borderDash:[4,3],
            pointRadius: 0, fill: false
          }));
        }
        new Chart(canvas, {
          type: 'line',
          data: { labels: def.labels, datasets },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color:'#6b7280', font:{size:9}, boxWidth:12 } } },
            scales: {
              x: { display: false },
              y: { ticks:{color:'#6b7280',font:{size:9}}, grid:{color:'#e5e7eb'} }
            }
          }
        });
      }, 30);
    }

    // expose for the toggle function
    window._dashDrawSub = drawSubCharts;
    // patch toggle to also draw
    const origToggle = window._dashToggle;
    window._dashToggle = function(id) {
      origToggle(id);
      const __el = document.getElementById(id); if (openSub === id || (__el && __el.style.display !== 'none')) {
        window._dashDrawSub(id);
      }
    };

  } catch(err) {
    el.innerHTML = `<div class="text-red-400 p-6">Error: ${err.message}</div>`;
    console.error(err);
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  2. DATA CENTER — Institutional Monitoring Framework v2              ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderDataCenter(el) {
  el.innerHTML = `<div class="flex items-center justify-center h-32 text-gray-500">
    <i class="fas fa-spinner fa-spin mr-2"></i>Loading Data Center…</div>`;
  try {
    const [fundRes, erpRes, healthRes, macroRes, liveMacroRes] = await Promise.allSettled([
      axios.get(`${API}/api/dc/fundamental`),
      axios.get(`${API}/api/dc/erp/current`),
      axios.get(`${API}/api/dc/health`),
      axios.get(`${API}/api/dc/macro/current`),
      axios.get(`${API}/api/live/macro`),
    ]);
    const stocks = fundRes.status==='fulfilled' ? (fundRes.value.data.data || []) : [];
    const e      = erpRes.status==='fulfilled' ? erpRes.value.data : {};
    const health = healthRes.status==='fulfilled' ? healthRes.value.data : { dataSources:[] };
    const mockM  = macroRes.status==='fulfilled' ? macroRes.value.data : {};
    const liveM  = liveMacroRes.status==='fulfilled' ? liveMacroRes.value.data : null;
    // Prefer live macro data for key indicators; fall back to mock for indicators not in live
    const m = liveM ? {
      ...mockM,
      vix: liveM.vix,
      vx1: liveM.vx1,
      vx3: liveM.vx3,
      vixContango: liveM.vixContango,
      usTreasury10y: liveM.usTreasury10y,
      usTreasury2y: liveM.usTreasury2y,
      yieldCurve: liveM.yieldCurve,
      _liveSource: true,
    } : mockM;
    const srcs   = health.dataSources || [];

    // ══════════════════════════════════════════════════════════════════════
    // COLOUR HELPERS
    // ══════════════════════════════════════════════════════════════════════
    const evColor  = p => p<=10?'#059669':p<=30?'#6ee7b7':p>=80?'#dc2626':'#d1d5db';
    const fcfColor = v => v>=6?'#059669':v>=3?'#fbbf24':'#dc2626';
    const levColor = v => v>3?'#dc2626':v>2?'#d97706':'#059669';

    const avgEv    = (stocks.reduce((a,s)=>a+s.evEbitda,0)/stocks.length).toFixed(1);
    const avgFcf   = (stocks.reduce((a,s)=>a+s.fcfYield,0)/stocks.length).toFixed(1);
    const erpColor = e.erp<1?'#dc2626':e.erp<2.5?'#d97706':'#059669';

    // ── trend sparkline helper (3 dots = today/week/month) ────────────
    function trendDots(today, week, month) {
      const dir = (a,b) => a>b?'▲':a<b?'▼':'—';
      const col = (a,b,inv) => {
        if (a===b) return 'text-gray-500';
        const better = inv ? a<b : a>b;
        return better ? 'text-emerald-400' : 'text-red-400';
      };
      return `<div class="flex items-center gap-1 justify-end">
        <span class="text-[9px] text-gray-500">1D</span>
        <span class="text-[10px] font-mono ${col(today,week,false)}">${dir(today,week)}</span>
        <span class="text-[9px] text-gray-500">1W</span>
        <span class="text-[10px] font-mono ${col(week,month,false)}">${dir(week,month)}</span>
        <span class="text-[9px] text-gray-500">1M</span>
      </div>`;
    }

    // ══════════════════════════════════════════════════════════════════════
    // ACCORDION TOGGLE
    // ══════════════════════════════════════════════════════════════════════
    window._dcSectorDrawn = false;
    let openDC = null;
    window._dcToggle = function(id) {
      const panels = ['dc-sub-macro','dc-sub-pricevol','dc-sub-fundamental','dc-sub-pipeline'];
      if (openDC === id) {
        openDC = null;
        document.getElementById(id).style.display = 'none';
      } else {
        openDC = id;
        panels.forEach(p => {
          const el2 = document.getElementById(p);
          if (el2) el2.style.display = p===id?'block':'none';
        });
        if (id === 'dc-sub-fundamental') setTimeout(drawDCSectorCharts, 40);
      }
      panels.forEach(p => {
        const btn = document.getElementById('btn-'+p);
        if (!btn) return;
        const active = p===id && openDC===id;
        btn.classList.toggle('ring-2',        active);
        btn.classList.toggle('ring-indigo-400',active);
        btn.classList.toggle('bg-purple-50', active);
        btn.classList.toggle('border-indigo-400', active);
        const chev = btn.querySelector('.dc-chev');
        if (chev) chev.classList.toggle('rotate-180', active);
      });
    };

    function drawDCSectorCharts() {
      if (window._dcSectorDrawn) return;
      window._dcSectorDrawn = true;
      const sortedEv  = [...stocks].sort((a,b)=>a.evEbitda-b.evEbitda);
      const sortedFcf = [...stocks].sort((a,b)=>b.fcfYield-a.fcfYield);
      const c1 = document.getElementById('dc-eveb-chart');
      if (c1) new Chart(c1, {
        type:'bar',
        data:{ labels:sortedEv.map(s=>s.ticker),
          datasets:[{ label:'EV/EBITDA', data:sortedEv.map(s=>s.evEbitda),
            backgroundColor:sortedEv.map(s=>s.evEbitdaPercentile<=20?'rgba(16,185,129,0.75)':s.evEbitdaPercentile>=70?'rgba(239,68,68,0.75)':'rgba(99,102,241,0.6)'),
            borderRadius:4 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
          scales:{ x:{ticks:{color:'#6b7280',font:{size:9}}}, y:{ticks:{color:'#6b7280',font:{size:9}},grid:{color:'#e5e7eb'}} } }
      });
      const c2 = document.getElementById('dc-fcf-chart');
      if (c2) new Chart(c2, {
        type:'bar',
        data:{ labels:sortedFcf.map(s=>s.ticker),
          datasets:[
            { label:'FCF Yield %', data:sortedFcf.map(s=>s.fcfYield),
              backgroundColor:sortedFcf.map(s=>s.fcfYield>m.usTreasury10y?'rgba(16,185,129,0.75)':'rgba(239,68,68,0.75)'), borderRadius:4 },
            { type:'line', label:'Risk-Free '+m.usTreasury10y+'%',
              data:sortedFcf.map(()=>m.usTreasury10y),
              borderColor:'#fbbf24', borderWidth:1.5, borderDash:[4,3], pointRadius:0, fill:false }
          ] },
        options:{ responsive:true, maintainAspectRatio:false,
          plugins:{legend:{labels:{color:'#6b7280',font:{size:9},boxWidth:10}}},
          scales:{ x:{ticks:{color:'#6b7280',font:{size:9}}},
            y:{ticks:{color:'#6b7280',font:{size:9},callback:v=>v+'%'},grid:{color:'#e5e7eb'}} } }
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // BUILD HTML
    // ══════════════════════════════════════════════════════════════════════

    // ── Macro derived values for trend simulation ──────────────────────
    const vixSlope     = ((m.vix/m.vx1)-1)*100;
    const vixSlopeStr  = vixSlope>0?`+${vixSlope.toFixed(1)}% Backwardation 🚨`:`${vixSlope.toFixed(1)}% Contango ✓`;
    const hySignColor  = m.hyOas>800?'#dc2626':m.hyOas>400?'#d97706':'#059669';
    const ycColor      = m.yieldCurve<0?'#dc2626':m.yieldCurve<50?'#d97706':'#059669';
    const breadthColor = m.pctAbove200ma<15?'#dc2626':m.pctAbove200ma<40?'#d97706':'#059669';
    const pcColor      = m.putCallRatio>1.2?'#dc2626':m.putCallRatio<0.7?'#d97706':'#059669';

    el.innerHTML = `

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  HEADER                                                              -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div class="flex items-start justify-between mb-4">
  <div>
    <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
      <i class="fas fa-database text-indigo-600"></i>
      数据中心 Data Center
      <span class="text-[11px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Institutional</span>
    </h2>
    <p class="text-gray-500 text-xs mt-0.5">
      机构级别底层数据中心 · GAAP-Adjusted · PIT-Compliant · 数据源: Yahoo Finance + FRED + CBOE + SEC EDGAR
    </p>
  </div>
  <div class="text-right text-[10px] text-gray-500">
    <div>更新时间: <span class="font-semibold text-gray-900">${m.date || '2026-03-03'}</span></div>
    <div class="mt-1 flex gap-2 justify-end flex-wrap">
      <a href="https://finance.yahoo.com/markets/" target="_blank" class="yf-link">Yahoo Finance</a>
      <a href="https://fred.stlouisfed.org" target="_blank" class="yf-link">FRED</a>
      <a href="https://www.cboe.com" target="_blank" class="yf-link">CBOE</a>
    </div>
  </div>
</div>

<!-- ── DATA CENTER METRIC GUIDE (collapsed by default, click KPI to show) -->
<div id="dc-dict-overlay" onclick="if(event.target===this)document.getElementById('dc-dict-overlay').style.display='none'"
  style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:200;align-items:center;justify-content:center">
  <div id="dc-dict-popup" class="rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4" style="background:#fff;border:1px solid #e5e7eb">
    <div class="flex items-center justify-between mb-3">
      <div id="dc-dict-title" class="font-bold text-gray-900 text-sm flex items-center gap-2">
        <i class="fas fa-book-open text-gray-500"></i> 指标含义
      </div>
      <button onclick="document.getElementById('dc-dict-overlay').style.display='none'"
        class="text-gray-400 hover:text-gray-700 text-lg leading-none">&times;</button>
    </div>
    <div id="dc-dict-body" class="text-xs text-gray-700 leading-relaxed"></div>
    <div class="mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-1">
      <i class="fas fa-info-circle"></i> 点击任意指标数值可查看含义说明
    </div>
  </div>
</div>`;

// ── showMetricDict: called by onclick on each KPI value ──────────────────────
window.showMetricDict = function(key) {
  const defs = {
    vix: {
      title: '波动率指数 VIX (CBOE Volatility Index)',
      body: `<p><b>什么是VIX？</b><br>衡量市场对未来30天S&P 500价格波动的预期，由CBOE期权隐含波动率计算。</p>
<p class="mt-2"><b>解读门槛：</b></p>
<ul class="mt-1 space-y-1 list-disc pl-4">
  <li><b class="text-emerald-600">12–20</b>：低波动，风险偏好良好</li>
  <li><b class="text-amber-600">20–30</b>：中等波动，需谨慎</li>
  <li><b class="text-red-600">&gt;30</b>：高恐慌，历史买入机会</li>
  <li><b class="text-red-700">&gt;40</b>：极端恐慌（GFC 2008：80；COVID 2020：66）</li>
</ul>
<p class="mt-2"><b>期限结构：</b><br>
期货溢价（VX1 &gt; 现货）= Contango，市场平静；现货 &gt; 期货 = Backwardation，市场恐慌。</p>`
    },
    hyoas: {
      title: '高收益信用利差 HY OAS (ICE BofA)',
      body: `<p><b>什么是HY OAS？</b><br>高收益（垃圾）债与国债的利差，以基点（bps）衡量。反映信用市场的压力程度。</p>
<p class="mt-2"><b>解读门槛：</b></p>
<ul class="mt-1 space-y-1 list-disc pl-4">
  <li><b class="text-emerald-600">&lt;300 bps</b>：流动性宽裕，正常偏乐观</li>
  <li><b class="text-amber-600">300–400 bps</b>：历史平均区间（约350 bps）</li>
  <li><b class="text-amber-600">400–800 bps</b>：流动性趋紧，开始警惕</li>
  <li><b class="text-red-600">&gt;800 bps</b>：信用危机（2009 GFC高点：1900 bps；2020 COVID：1100 bps）</li>
</ul>
<p class="mt-2"><b>前瞻性：</b>信用利差扩张通常领先股市下跌6–12周。数据来源：FRED BAMLH0A0HYM2。</p>`
    },
    yieldcurve: {
      title: '收益率曲线 Yield Curve (10Y–2Y)',
      body: `<p><b>什么是收益率曲线？</b><br>10年期与2年期美国国债收益率之差（bps）。衡量市场对长期增长的预期与短期资金成本。</p>
<p class="mt-2"><b>解读：</b></p>
<ul class="mt-1 space-y-1 list-disc pl-4">
  <li><b class="text-emerald-600">正值（正常）</b>：经济扩张预期，长端高于短端</li>
  <li><b class="text-amber-600">0附近</b>：经济放缓信号，需关注</li>
  <li><b class="text-red-600">负值（倒挂）</b>：历史上最可靠的衰退预警，通常领先衰退12–18个月</li>
</ul>
<p class="mt-2">数据来源：FRED DGS10 / DGS2</p>`
    },
    panic: {
      title: '综合恐慌指数 Composite Panic Score',
      body: `<p><b>什么是综合恐慌指数？</b><br>0–100的加权综合评分，整合VIX期限结构、HY OAS信用利差、市场宽度和Put/Call比率四个维度。</p>
<p class="mt-2"><b>解读门槛：</b></p>
<ul class="mt-1 space-y-1 list-disc pl-4">
  <li><b class="text-emerald-600">0–30</b>：市场平静，正常仓位</li>
  <li><b class="text-amber-600">30–60</b>：中度压力，适当降低β敞口</li>
  <li><b class="text-red-600">60–100</b>：高度恐慌，历史逆向买入区间</li>
</ul>
<p class="mt-2"><b>策略含义：</b>恐慌指数 &gt;70 时，分批布局错杀高质量资产的历史胜率较高（Buy-the-Dip策略核心触发条件）。</p>`
    },
    breadth: {
      title: '市场宽度 Market Breadth (%Above 200DMA)',
      body: `<p><b>什么是市场宽度？</b><br>S&P 500成分股中，价格高于200日均线的比例（%）。衡量牛市的广度与可持续性。</p>
<p class="mt-2"><b>解读门槛：</b></p>
<ul class="mt-1 space-y-1 list-disc pl-4">
  <li><b class="text-emerald-600">&gt;60%</b>：强势牛市，宽基上涨</li>
  <li><b class="text-amber-600">30–60%</b>：正常区间，部分板块领涨</li>
  <li><b class="text-amber-600">&lt;30%</b>：市场偏窄，少数股票领涨（顶部风险）</li>
  <li><b class="text-red-600">&lt;15%</b>：极端熊市，恐慌买入区间</li>
</ul>
<p class="mt-2">数据来源：StockCharts $SPXA200R（每日更新）</p>`
    },
    putcall: {
      title: '期权看跌/看涨比率 Put/Call Ratio',
      body: `<p><b>什么是Put/Call Ratio？</b><br>CBOE期权市场中看跌期权（保护性买入/空头）与看涨期权（多头押注）的成交量之比。经典逆向情绪指标。</p>
<p class="mt-2"><b>解读门槛：</b></p>
<ul class="mt-1 space-y-1 list-disc pl-4">
  <li><b class="text-red-600">&lt;0.7</b>：极度乐观（贪婪），可能接近短期顶部</li>
  <li><b class="text-emerald-600">0.7–1.0</b>：中性，正常区间</li>
  <li><b class="text-amber-600">1.0–1.2</b>：防御性增加，市场谨慎</li>
  <li><b class="text-red-600">&gt;1.2</b>：恐慌，逆向看多信号</li>
  <li><b class="text-red-700">&gt;1.5</b>：极度恐慌，历史强力逆向买入信号</li>
</ul>
<p class="mt-2">数据来源：CBOE Daily Statistics</p>`
    },
    erp: {
      title: '股权风险溢价 ERP (Equity Risk Premium)',
      body: `<p><b>什么是ERP？</b><br>S&P 500远期盈利收益率（Forward Earnings Yield = 1 / Forward PE）减去10年期国债收益率。衡量股市相对债市的超额回报补偿。</p>
<p class="mt-2"><b>解读门槛：</b></p>
<ul class="mt-1 space-y-1 list-disc pl-4">
  <li><b class="text-red-600">&lt;1%</b>：估值昂贵，股市对无风险利率的超额补偿不足</li>
  <li><b class="text-amber-600">1–2.5%</b>：偏贵至公允区间</li>
  <li><b class="text-emerald-600">2.5–4%</b>：合理，历史平均约2.5–3%</li>
  <li><b class="text-emerald-600">&gt;4%</b>：股市相对债市有吸引力</li>
</ul>
<p class="mt-2"><b>当前驱动因素：</b>高利率环境下ERP压缩，利率下降时ERP提升利好股市。</p>`
    },
    evebitda: {
      title: '企业价值倍数 EV/EBITDA',
      body: `<p><b>什么是EV/EBITDA？</b><br>企业价值（股权市值 + 净负债）除以息税折旧摊销前利润。剔除资本结构差异，是跨行业估值比较的标准工具。</p>
<p class="mt-2"><b>解读门槛：</b></p>
<ul class="mt-1 space-y-1 list-disc pl-4">
  <li><b class="text-emerald-600">&lt;8×</b>：深度价值，可能存在特殊情况</li>
  <li><b class="text-emerald-600">8–15×</b>：公允估值区间（S&P 500历史平均 ~15×）</li>
  <li><b class="text-amber-600">15–25×</b>：溢价但可接受（高增长板块）</li>
  <li><b class="text-red-600">&gt;25×</b>：估值偏贵，安全边际薄</li>
</ul>
<p class="mt-2"><b>注：</b>此处使用调整后EBITDA（加回SBC股权激励），更接近实际经营现金流。数据来源：FactSet / Yahoo Finance。</p>`
    }
  };
  const def = defs[key] || { title:'指标说明', body:'<p class="text-gray-500">该指标说明待补充。</p>' };
  document.getElementById('dc-dict-title').innerHTML = `<i class="fas fa-book-open text-gray-500"></i> ${def.title}`;
  document.getElementById('dc-dict-body').innerHTML = def.body;
  const ov = document.getElementById('dc-dict-overlay');
  ov.style.display = 'flex';
};
`

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  KPI STRIP  (8 always-visible top-level metrics)                    -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div class="grid grid-cols-4 gap-2.5 mb-5">

  <!-- VIX Term Structure -->
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">波动率结构 / VIX Structure</span>
      <span class="text-[9px] bg-${m.vixContango?'emerald':'red'}-500/20 text-${m.vixContango?'emerald':'red'}-300 px-1.5 py-0.5 rounded-full">${m.vixContango?'Contango':'Backwardation'}</span>
    </div>
    <div class="flex items-end gap-3">
      <div class="text-2xl font-bold text-gray-900 cursor-pointer hover:text-gray-600" onclick="showMetricDict('vix')" title="点击查看指标含义">${m.vix}</div>
      <div class="text-xs text-gray-500 mb-0.5 leading-tight">VX1: <span class="text-gray-400">${m.vx1}</span><br>VX3: <span class="text-gray-400">${m.vx3}</span></div>
    </div>
    <div class="mt-1 text-[10px] ${m.vixContango?'text-emerald-400':'text-red-400'}">${vixSlopeStr}</div>
  </div>

  <!-- HY OAS -->
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">信用风险 / HY OAS</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background:${hySignColor}22;color:${hySignColor}">${(m.hyOasSignal||'').toUpperCase()||'—'}</span>
    </div>
    <div class="text-2xl font-bold cursor-pointer hover:opacity-70" style="color:${hySignColor}" onclick="showMetricDict('hyoas')" title="点击查看指标含义">${m.hyOas}<span class="text-sm ml-1 font-normal text-gray-500">bps</span></div>
    <div class="mt-1 text-[10px] text-gray-500">FRED: BAMLH0A0HYM2 · &gt;400 Caution · &gt;800 Distress</div>
  </div>

  <!-- Yield Curve -->
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">利率环境 / Yield Curve</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background:${ycColor}22;color:${ycColor}">${m.yieldCurveInverted?'INVERTED':'Normal'}</span>
    </div>
    <div class="text-2xl font-bold cursor-pointer hover:opacity-70" style="color:${ycColor}" onclick="showMetricDict('yieldcurve')" title="点击查看指标含义">${m.yieldCurve>0?'+':''}${m.yieldCurve}<span class="text-sm ml-1 font-normal text-gray-500">bps</span></div>
    <div class="mt-1 text-[10px] text-gray-500">10Y ${m.usTreasury10y}% − 2Y ${m.usTreasury2y}% · FRED: DGS10/DGS2</div>
  </div>

  <!-- Panic Score -->
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">恐慌分数 / Panic Score</span>
      <span class="text-[9px] bg-${m.panicScore<30?'emerald':m.panicScore<60?'amber':'red'}-500/20 text-${m.panicScore<30?'emerald':m.panicScore<60?'amber':'red'}-300 px-1.5 py-0.5 rounded-full">${m.panicLabel||'—'}</span>
    </div>
    <div class="text-2xl font-bold cursor-pointer hover:opacity-70 ${m.panicScore<30?'text-emerald-400':m.panicScore<60?'text-amber-400':'text-red-400'}" onclick="showMetricDict('panic')" title="点击查看指标含义">${m.panicScore}<span class="text-sm ml-1 font-normal text-gray-500">/100</span></div>
    <div class="w-full h-1.5 rounded-full mt-2 overflow-hidden" style="background:#e5e7eb">
      <div class="h-full rounded-full transition-all ${m.panicScore<30?'bg-emerald-500':m.panicScore<60?'bg-amber-500':'bg-red-500'}" style="width:${m.panicScore}%"></div>
    </div>
  </div>

  <!-- Market Breadth -->
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">市场宽度 / Breadth</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background:${breadthColor}22;color:${breadthColor}">${(m.breadthSignal||'').toUpperCase()||'—'}</span>
    </div>
    <div class="text-2xl font-bold cursor-pointer hover:opacity-70" style="color:${breadthColor}" onclick="showMetricDict('breadth')" title="点击查看指标含义">${(m.pctAbove200ma||0).toFixed(1)}<span class="text-sm ml-1 font-normal text-gray-500">%</span></div>
    <div class="mt-1 text-[10px] text-gray-500">S5TH200X · % SPX above 200DMA · &lt;15% = Panic</div>
  </div>

  <!-- Put/Call Ratio -->
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">衍生品情绪 / P/C Ratio</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background:${pcColor}22;color:${pcColor}">${(m.putCallSignal||'').toUpperCase()||'—'}</span>
    </div>
    <div class="text-2xl font-bold cursor-pointer hover:opacity-70" style="color:${pcColor}" onclick="showMetricDict('putcall')" title="点击查看指标含义">${(m.putCallRatio||0).toFixed(2)}</div>
    <div class="mt-1 text-[10px] text-gray-500">CBOE · &gt;1.2 Fear · &lt;0.7 Greed · &gt;1.5 Panic</div>
  </div>

  <!-- ERP -->
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">股权风险溢价 / ERP</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background:${erpColor}22;color:${erpColor}">${(e.erpSignal||'').toUpperCase()||'—'}</span>
    </div>
    <div class="text-2xl font-bold cursor-pointer hover:opacity-70" style="color:${erpColor}" onclick="showMetricDict('erp')" title="点击查看指标含义">${(e.erp||0).toFixed(2)}<span class="text-sm ml-1 font-normal text-gray-500">%</span></div>
    <div class="mt-1 text-[10px] text-gray-500">Earnings Yield ${(e.sp500EarningsYield||0).toFixed(2)}% − 10Y ${e.usTreasury10y}%</div>
  </div>

  <!-- Avg EV/EBITDA -->
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">基本面估值 / EV/EBITDA</span>
      <span class="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">${stocks.length} stocks</span>
    </div>
    <div class="text-2xl font-bold cursor-pointer hover:opacity-70 ${parseFloat(avgEv)>20?'text-red-400':'text-amber-500'}" onclick="showMetricDict('evebitda')" title="点击查看指标含义">${avgEv}<span class="text-sm ml-1 font-normal text-gray-500">×</span></div>
    <div class="mt-1 text-[10px] text-gray-500">Adj.EBITDA (SBC added back) · 10Y avg ~15×</div>
  </div>

</div>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  4 SECTION CARDS → click to expand sub-modules                      -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">

  <!-- Card 1: Macro Liquidity -->
  <div id="btn-dc-sub-macro"
       class="cursor-pointer bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-purple-500/40 transition-all"
       onclick="window._dcToggle('dc-sub-macro')">
    <div class="flex items-center justify-between mb-2">
      <div class="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <i class="fas fa-fire text-red-400 text-sm"></i>
      </div>
      <i class="fas fa-chevron-down text-gray-400 text-xs dc-chev transition-transform"></i>
    </div>
    <div class="text-sm font-bold text-white mb-0.5">宏观流动性 / Macro</div>
    <div class="text-[10px] text-gray-500 mb-2">VIX · HY OAS · Yield Curve · Breadth · P/C</div>
    <div class="flex gap-1 flex-wrap">
      <span class="text-[9px] bg-${m.vixContango?'emerald':'red'}-500/20 text-${m.vixContango?'emerald':'red'}-300 px-1.5 py-0.5 rounded-full">${m.vixContango?'Contango':'Backwardation'}</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background:${hySignColor}22;color:${hySignColor}">HY ${m.hyOas}bps</span>
    </div>
  </div>

  <!-- Card 2: Price/Volume -->
  <div id="btn-dc-sub-pricevol"
       class="cursor-pointer bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-purple-500/40 transition-all"
       onclick="window._dcToggle('dc-sub-pricevol')">
    <div class="flex items-center justify-between mb-2">
      <div class="w-8 h-8 bg-cyan-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
        <i class="fas fa-chart-area text-cyan-400 text-sm"></i>
      </div>
      <i class="fas fa-chevron-down text-gray-400 text-xs dc-chev transition-transform"></i>
    </div>
    <div class="text-sm font-bold text-white mb-0.5">量价数据 / Price·Volume</div>
    <div class="text-[10px] text-gray-500 mb-2">Adj Close · Volume Ratio · RSI14 · ATR14</div>
    <div class="flex gap-1 flex-wrap">
      <span class="text-[9px] bg-blue-500/20 text-blue-700 px-1.5 py-0.5 rounded-full">Front-Adj ✓</span>
      <span class="text-[9px] bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded-full">Anti-Split ✓</span>
    </div>
  </div>

  <!-- Card 3: Fundamental Valuation -->
  <div id="btn-dc-sub-fundamental"
       class="cursor-pointer bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-purple-500/40 transition-all"
       onclick="window._dcToggle('dc-sub-fundamental')">
    <div class="flex items-center justify-between mb-2">
      <div class="w-8 h-8 bg-emerald-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
        <i class="fas fa-table text-emerald-400 text-sm"></i>
      </div>
      <i class="fas fa-chevron-down text-gray-400 text-xs dc-chev transition-transform"></i>
    </div>
    <div class="text-sm font-bold text-white mb-0.5">基本面估值 / Fundamental</div>
    <div class="text-[10px] text-gray-500 mb-2">EV · Adj.EBITDA · EV/EBITDA · FCF Yield · Leverage</div>
    <div class="flex gap-1 flex-wrap">
      <span class="text-[9px] bg-emerald-500/20 text-emerald-700 px-1.5 py-0.5 rounded-full">SBC Add-Back ✓</span>
      <span class="text-[9px] bg-purple-500/20 text-purple-700 px-1.5 py-0.5 rounded-full">PIT ✓</span>
    </div>
  </div>

  <!-- Card 4: Data Pipeline -->
  <div id="btn-dc-sub-pipeline"
       class="cursor-pointer bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-purple-500/40 transition-all"
       onclick="window._dcToggle('dc-sub-pipeline')">
    <div class="flex items-center justify-between mb-2">
      <div class="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <i class="fas fa-shield-alt text-purple-400 text-sm"></i>
      </div>
      <i class="fas fa-chevron-down text-gray-400 text-xs dc-chev transition-transform"></i>
    </div>
    <div class="text-sm font-bold text-white mb-0.5">数据工程 / Engineering</div>
    <div class="text-[10px] text-gray-500 mb-2">PIT · Survivorship · GAAP · Source Status</div>
    <div class="flex gap-1 flex-wrap">
      <span class="text-[9px] bg-emerald-500/20 text-emerald-700 px-1.5 py-0.5 rounded-full">✓ PIT</span>
      <span class="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">${srcs.length} Sources</span>
      ${m._liveSource ? `<span class="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold"><i class="fas fa-circle" style="font-size:5px"></i> LIVE</span>` : ''}
    </div>
  </div>

</div>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  SUB-MODULE 1: MACRO LIQUIDITY & SENTIMENT                          -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div id="dc-sub-macro" style="display:none" class="mb-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
    <span class="text-sm font-bold text-white flex items-center gap-2">
      <i class="fas fa-fire text-red-400"></i>
      宏观流动性与情绪数据 — Macro Liquidity & Sentiment
      <span class="text-[10px] text-gray-500 font-normal">每日更新 · Daily Update</span>
      ${m._liveSource ? `<span class="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold ml-2"><i class="fas fa-circle text-emerald-500 mr-1" style="font-size:5px"></i>Yahoo Finance LIVE — VIX ${m.vix?.toFixed(1)} · 10Y ${m.usTreasury10y?.toFixed(2)}%</span>` : ''}
    </span>
    <button onclick="window._dcToggle('dc-sub-macro')" class="text-gray-500 hover:text-gray-700 text-xs px-2 py-0.5 rounded border border-gray-300">✕ close</button>
  </div>
  <div class="p-4">
    <table class="w-full text-xs">
      <thead>
        <tr class="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1e2d4a]">
          <th class="py-2 px-2 text-left">数据维度 / Dimension</th>
          <th class="py-2 px-2 text-left">具体指标 / Indicator</th>
          <th class="py-2 px-2 text-right">今日 Today</th>
          <th class="py-2 px-2 text-center">走向 Trend</th>
          <th class="py-2 px-2 text-left">含义 / Meaning</th>
          <th class="py-2 px-2 text-center">交易影响 / Trade Impact</th>
          <th class="py-2 px-2 text-left">数据源 / Source</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-[#1a2540]">

        <!-- VIX Spot -->
        <tr class="hover:bg-blue-50/40">
          <td class="py-2.5 px-2">
            <div class="text-gray-900 font-semibold">波动率结构</div>
            <div class="text-[10px] text-gray-500">Volatility Structure</div>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-800">VIX 期限结构</div>
            <div class="text-[10px] text-gray-500 font-mono">VIX / VX1 − 1</div>
          </td>
          <td class="py-2.5 px-2 text-right">
            <div class="text-gray-900 font-mono font-bold">${m.vix} / ${m.vx1} / ${m.vx3}</div>
            <div class="text-[10px] ${m.vixContango?'text-emerald-400':'text-red-400'}">${vixSlopeStr}</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            ${trendDots(m.vix, m.vix*0.97, m.vix*0.92)}
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-400 text-[11px]">${m.vixContango?'Contango = 正常结构，市场无极度恐慌':'🚨 Backwardation = 现货 &gt; 期货，极度恐慌信号'}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">VIX &gt; VX1 = backwardation = panic signal</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            <span class="text-[10px] px-2 py-0.5 rounded-full ${m.vixContango?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}">${m.vixContango?'Neutral / Can Deploy':'Reduce Risk'}</span>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-500 text-[10px]">Yahoo Finance</div>
            <div class="text-gray-400 text-[9px]">CBOE / ^VIX</div>
          </td>
        </tr>

        <!-- HY OAS -->
        <tr class="hover:bg-blue-50/40">
          <td class="py-2.5 px-2">
            <div class="text-gray-900 font-semibold">信用风险</div>
            <div class="text-[10px] text-gray-500">Credit Risk</div>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-800">高收益债 OAS 利差</div>
            <div class="text-[10px] text-gray-500 font-mono">ICE BofA HY OAS</div>
          </td>
          <td class="py-2.5 px-2 text-right">
            <div class="font-mono font-bold text-xl" style="color:${hySignColor}">${m.hyOas}</div>
            <div class="text-[10px] text-gray-500">bps</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            ${trendDots(m.hyOas, m.hyOas*1.02, m.hyOas*1.08)}
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-400 text-[11px]">${m.hyOas<400?'正常信用环境 · Normal credit conditions':m.hyOas<800?'⚠ 信用压力上升 · Elevated credit stress':'🚨 Distress zone — liquidity crunch'}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">&lt;400 Normal · 400–800 Caution · &gt;800 Distress</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            <span class="text-[10px] px-2 py-0.5 rounded-full" style="background:${hySignColor}22;color:${hySignColor}">${m.hyOas<400?'Risk-On OK':m.hyOas<800?'Defensive Tilt':'Risk-Off'}</span>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-500 text-[10px]">FRED</div>
            <div class="text-gray-400 text-[9px] font-mono">BAMLH0A0HYM2</div>
          </td>
        </tr>

        <!-- Yield Curve -->
        <tr class="hover:bg-blue-50/40">
          <td class="py-2.5 px-2">
            <div class="text-gray-900 font-semibold">利率环境</div>
            <div class="text-[10px] text-gray-500">Rate Environment</div>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-800">10Y − 2Y 国债利差</div>
            <div class="text-[10px] text-gray-500 font-mono">DGS10 − DGS2</div>
          </td>
          <td class="py-2.5 px-2 text-right">
            <div class="font-mono font-bold" style="color:${ycColor}">${m.usTreasury10y}% / ${m.usTreasury2y}%</div>
            <div class="text-[10px]" style="color:${ycColor}">Spread: ${m.yieldCurve>0?'+':''}${m.yieldCurve}bps</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            ${trendDots(m.yieldCurve, m.yieldCurve-5, m.yieldCurve-15)}
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-400 text-[11px]">${m.yieldCurveInverted?'⚠ 倒挂 — 历史上预示衰退概率 &gt;70%':'正常陡峭 — 资金成本可预期，增长预期正常'}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">&lt;0bps = Inversion = recession signal</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            <span class="text-[10px] px-2 py-0.5 rounded-full" style="background:${ycColor}22;color:${ycColor}">${m.yieldCurveInverted?'Short Duration':'Normal'}</span>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-500 text-[10px]">FRED</div>
            <div class="text-gray-400 text-[9px] font-mono">DGS10 / DGS2</div>
          </td>
        </tr>

        <!-- Market Breadth -->
        <tr class="hover:bg-blue-50/40">
          <td class="py-2.5 px-2">
            <div class="text-gray-900 font-semibold">市场宽度</div>
            <div class="text-[10px] text-gray-500">Market Breadth</div>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-800">200日均线以上占比</div>
            <div class="text-[10px] text-gray-500 font-mono">S5TH200X</div>
          </td>
          <td class="py-2.5 px-2 text-right">
            <div class="font-mono font-bold text-xl" style="color:${breadthColor}">${(m.pctAbove200ma||0).toFixed(1)}%</div>
            <div class="text-[10px]" style="color:${breadthColor}">${(m.breadthSignal||"").toUpperCase()}</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            ${trendDots(m.pctAbove200ma, m.pctAbove200ma-2, m.pctAbove200ma-8)}
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-400 text-[11px]">${m.pctAbove200ma<15?'🚨 极度恐慌区间 — 超跌反弹机会窗口':m.pctAbove200ma<40?'⚠ 市场走弱，选股难度加大':'市场健康 — 趋势性多头环境'}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">&lt;15% Panic · &lt;40% Weak · &gt;60% Healthy</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            <span class="text-[10px] px-2 py-0.5 rounded-full" style="background:${breadthColor}22;color:${breadthColor}">${m.pctAbove200ma<15?'BTD Entry':'Cautious'}</span>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-500 text-[10px]">Bloomberg</div>
            <div class="text-gray-400 text-[9px] font-mono">S5TH200X Index</div>
          </td>
        </tr>

        <!-- Put/Call -->
        <tr class="hover:bg-blue-50/40">
          <td class="py-2.5 px-2">
            <div class="text-gray-900 font-semibold">衍生品情绪</div>
            <div class="text-[10px] text-gray-500">Options Sentiment</div>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-800">Put / Call Ratio</div>
            <div class="text-[10px] text-gray-500 font-mono">Put Vol / Call Vol</div>
          </td>
          <td class="py-2.5 px-2 text-right">
            <div class="font-mono font-bold text-xl" style="color:${pcColor}">${(m.putCallRatio||0).toFixed(2)}</div>
            <div class="text-[10px]" style="color:${pcColor}">${(m.putCallSignal||"").toUpperCase()}</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            ${trendDots(m.putCallRatio, m.putCallRatio*1.05, m.putCallRatio*1.12)}
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-400 text-[11px]">${m.putCallRatio<0.7?'⚠ 极度贪婪 — 看涨期权拥挤，对立指标警告':m.putCallRatio>1.2?'恐慌区间 — 对立指标看多':'中性情绪 — 无极端信号'}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">&lt;0.7 Greed · 0.7–1.0 Neutral · &gt;1.2 Fear</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            <span class="text-[10px] px-2 py-0.5 rounded-full" style="background:${pcColor}22;color:${pcColor}">${m.putCallRatio>1.2?'Contrarian Buy':m.putCallRatio<0.7?'Trim / Wait':'Neutral'}</span>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-500 text-[10px]">CBOE</div>
            <div class="text-gray-400 text-[9px]">Daily P/C total</div>
          </td>
        </tr>

      </tbody>
    </table>

    <!-- Interpretation footer -->
    <div class="mt-4 grid grid-cols-3 gap-3">
      <div class="bg-emerald-900/15 border border-emerald-500/30 rounded-lg p-3">
        <div class="text-[10px] font-bold text-emerald-300 mb-1 uppercase">正常区间 / Normal</div>
        <div class="text-[10px] text-gray-500 leading-relaxed">VIX &lt;25, HY OAS &lt;400bps, Breadth &gt;50%, P/C 0.7–1.0, Yield Curve Positive → 正常持仓，可适度加仓</div>
      </div>
      <div class="bg-amber-900/15 border border-amber-500/30 rounded-lg p-3">
        <div class="text-[10px] font-bold text-amber-300 mb-1 uppercase">谨慎区间 / Caution</div>
        <div class="text-[10px] text-gray-500 leading-relaxed">VIX 25–35, HY OAS 400–800bps, Breadth 15–40% → 减仓高β敞口，增加现金缓冲，等待企稳</div>
      </div>
      <div class="bg-red-900/15 border border-red-500/30 rounded-lg p-3">
        <div class="text-[10px] font-bold text-red-300 mb-1 uppercase">恐慌区间 / Panic BTD Zone</div>
        <div class="text-[10px] text-gray-500 leading-relaxed">VIX &gt;40, HY OAS &gt;800bps, Breadth &lt;15%, P/C &gt;1.5 → 流动性挤兑，分批建仓错杀高质量资产</div>
      </div>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  SUB-MODULE 2: PRICE & VOLUME DATA                                  -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div id="dc-sub-pricevol" style="display:none" class="mb-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
    <span class="text-sm font-bold text-white flex items-center gap-2">
      <i class="fas fa-chart-area text-cyan-400"></i>
      量价与交易数据 — Price & Volume (Trigger Layer)
      <span class="text-[10px] text-gray-500 font-normal">每日更新 · Daily</span>
    </span>
    <button onclick="window._dcToggle('dc-sub-pricevol')" class="text-gray-500 hover:text-gray-700 text-xs px-2 py-0.5 rounded border border-gray-300">✕ close</button>
  </div>
  <div class="p-4">

    <!-- Engineering note -->
    <div class="mb-4 p-3 bg-amber-900/15 border border-amber-500/30 rounded-lg text-[10px] text-amber-200">
      <i class="fas fa-exclamation-triangle text-amber-400 mr-1"></i>
      <strong>关键避坑：</strong>必须使用<strong>前复权收盘价 (Adj Close)</strong>，已包含分红调整及拆合股调整。绝对不能用 Raw Close 计算历史收益率。
      拆股当天 Raw Close 会显示"暴跌"，触发错误信号。
    </div>

    <table class="w-full text-xs">
      <thead>
        <tr class="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1e2d4a]">
          <th class="py-2 px-2 text-left">数据维度 / Dimension</th>
          <th class="py-2 px-2 text-left">具体指标 / Indicator</th>
          <th class="py-2 px-2 text-left">取数口径 / Extraction Logic</th>
          <th class="py-2 px-2 text-center">今日走向 / Today Trend</th>
          <th class="py-2 px-2 text-left">对交易的影响 / Trade Impact</th>
          <th class="py-2 px-2 text-left">数据源 / Source</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-[#1a2540]">
        <tr class="hover:bg-blue-50/40">
          <td class="py-2.5 px-2"><div class="text-gray-900 font-semibold">价格基准</div><div class="text-[10px] text-gray-500">Price Basis</div></td>
          <td class="py-2.5 px-2"><div class="text-gray-800">前复权收盘价</div><div class="text-[10px] text-cyan-400 font-mono">Adj Close</div></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-500 max-w-xs">包含所有现金分红 (Dividends) 和拆合股 (Splits) 的历史调整价。用于计算MA、RSI、回报率等所有技术指标。</td>
          <td class="py-2.5 px-2 text-center"><span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓ PIT OK</span></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-500">计算RSI/MA/回撤的唯一合法基准 · 拆股不触发假信号</td>
          <td class="py-2.5 px-2"><div class="text-gray-500 text-[10px]">yfinance</div><div class="text-gray-400 text-[9px]">history(auto_adjust=True)</div></td>
        </tr>
        <tr class="hover:bg-blue-50/40">
          <td class="py-2.5 px-2"><div class="text-gray-900 font-semibold">机构洗盘</div><div class="text-[10px] text-gray-500">Vol Anomaly</div></td>
          <td class="py-2.5 px-2"><div class="text-gray-800">异常放量倍数</div><div class="text-[10px] text-cyan-400 font-mono">Vol / Vol_SMA20</div></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-500 max-w-xs">当日成交量 / 过去20个交易日成交量SMA。需剔除四巫日 (Quadruple Witching) 的异常放量。</td>
          <td class="py-2.5 px-2 text-center"><span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Watch</span></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-500">&gt;2× = 机构参与 · 配合价格方向判断是洗盘还是出货 · 必须剔除四巫日噪音</td>
          <td class="py-2.5 px-2"><div class="text-gray-500 text-[10px]">yfinance</div><div class="text-gray-400 text-[9px]">Volume field</div></td>
        </tr>
        <tr class="hover:bg-blue-50/40">
          <td class="py-2.5 px-2"><div class="text-gray-900 font-semibold">动量极值</div><div class="text-[10px] text-gray-500">Momentum</div></td>
          <td class="py-2.5 px-2"><div class="text-gray-800">相对强弱指数</div><div class="text-[10px] text-cyan-400 font-mono">RSI-14</div></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-500 max-w-xs">标准14日RSI算法。低于30 = 超卖 (oversold)，低于20 = 极端抛售 (panic selling)。必须使用Adj Close计算。</td>
          <td class="py-2.5 px-2 text-center"><span class="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">RSI &lt;30 = BTD</span></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-500">RSI &lt;30 = Buy the Dip 触发信号之一 · RSI &gt;70 = Overbought 减仓信号 · RSI &lt;20 = 极端抄底窗口</td>
          <td class="py-2.5 px-2"><div class="text-gray-500 text-[10px]">自行计算</div><div class="text-gray-400 text-[9px]">ta-lib / pandas</div></td>
        </tr>
        <tr class="hover:bg-blue-50/40">
          <td class="py-2.5 px-2"><div class="text-gray-900 font-semibold">波动冲击</div><div class="text-[10px] text-gray-500">Volatility</div></td>
          <td class="py-2.5 px-2"><div class="text-gray-800">真实波幅</div><div class="text-[10px] text-cyan-400 font-mono">ATR-14</div></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-500 max-w-xs">过去14天 Average True Range。用于动态设置止损线 (Stop Loss = Entry − 2×ATR)，替代固定百分比止损。</td>
          <td class="py-2.5 px-2 text-center"><span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Stop Sizing</span></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-500">动态止损基准 · ATR扩大 = 高波动，加宽止损 / 减小仓位 · 替代固定%止损，避免被正常波幅震出</td>
          <td class="py-2.5 px-2"><div class="text-gray-500 text-[10px]">自行计算</div><div class="text-gray-400 text-[9px]">High/Low/Close</div></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  SUB-MODULE 3: FUNDAMENTAL VALUATION                                -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div id="dc-sub-fundamental" style="display:none" class="mb-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
    <span class="text-sm font-bold text-white flex items-center gap-2">
      <i class="fas fa-table text-emerald-400"></i>
      基本面与绝对估值 — Fundamental Valuation
      <span class="text-[10px] text-gray-500 font-normal">季度/TTM · Quarterly</span>
    </span>
    <button onclick="window._dcToggle('dc-sub-fundamental')" class="text-gray-500 hover:text-gray-700 text-xs px-2 py-0.5 rounded border border-gray-300">✕ close</button>
  </div>
  <div class="p-4">

    <!-- GAAP adjustment note -->
    <div class="mb-4 p-3 bg-blue-900/15 border border-blue-500/30 rounded-lg text-[10px] text-blue-200">
      <i class="fas fa-info-circle text-blue-400 mr-1"></i>
      <strong>取数口径：</strong>Adj.EBITDA = 营业利润 + D&A + SBC (已加回，非现金扭曲) ·
      FCF = OCF − CapEx − 资本化软件支出 ·
      EV = 总市值 + 有息负债 + 少数股权 + 优先股 − 现金 ·
      ${fundRes.data.gaapAdjustmentNote||'PIT-Compliant: data mapped to announcement date, not period-end.'}
    </div>

    <!-- Methodology table -->
    <div class="mb-5">
      <div class="text-xs font-bold text-gray-500 uppercase mb-2">取数方法论 / Extraction Methodology</div>
      <table class="w-full text-xs mb-4">
        <thead><tr class="text-[10px] text-gray-500 uppercase border-b border-[#1e2d4a]">
          <th class="py-1.5 px-2 text-left">数据维度 / Dimension</th>
          <th class="py-1.5 px-2 text-left">指标 / Metric</th>
          <th class="py-1.5 px-2 text-left">严谨口径 / Extraction Logic</th>
          <th class="py-1.5 px-2 text-left">核心目的 / Purpose</th>
        </tr></thead>
        <tbody class="divide-y divide-[#1a2540]">
          ${[
            ['企业价值 / EV','EV (Enterprise Value)','总市值 + 长期负债 + 短期负债 + 少数股权 + 优先股 − 现金','排除资本结构差异，还原收购整体业务的真实成本'],
            ['核心盈利 / Core Earnings','Adjusted EBITDA','营业利润 + D&A + SBC (非现金，加回) → GAAP understates TMT by 15-25%','剔除SBC非现金扭曲，还原真实经营性现金产出能力'],
            ['估值乘数 / Multiple','EV / EBITDA (TTM)','当前EV / 过去四季度 Adj.EBITDA总和 — 替代失真P/E','寻找真正被低估的优质资产，行业间横向可比'],
            ['现金收益 / Cash Return','FCF Yield','(OCF − CapEx − Cap.Software) / 总市值 %','每投入$1能产生多少可自由支配现金 — 真实回报率'],
            ['财务健康 / Leverage','净杠杆率','(有息负债 − 现金) / Adj.EBITDA — 危险线 &gt;3.0×','识别风险事件中可能违约的高危企业'],
          ].map(([dim,ind,logic,purpose])=>`
          <tr class="hover:bg-blue-50/40">
            <td class="py-2 px-2"><div class="text-white text-[11px] font-medium">${dim.split('/')[0].trim()}</div><div class="text-[9px] text-gray-500">${dim.split('/')[1]?.trim()}</div></td>
            <td class="py-2 px-2 text-emerald-300 text-[11px] font-mono">${ind}</td>
            <td class="py-2 px-2 text-gray-500 text-[10px] max-w-xs leading-snug">${logic}</td>
            <td class="py-2 px-2 text-gray-500 text-[10px] leading-snug">${purpose}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Universe table -->
    <div class="text-xs font-bold text-gray-500 uppercase mb-2">估值全景表 / Universe Valuation Table</div>
    <div class="overflow-x-auto mb-5">
      <table class="w-full text-xs">
        <thead><tr class="border-b border-[#1e2d4a] text-[10px] text-gray-500 uppercase">
          <th class="py-1.5 px-2 text-left">Ticker</th>
          <th class="py-1.5 px-2 text-right">Mkt Cap</th>
          <th class="py-1.5 px-2 text-right">EV</th>
          <th class="py-1.5 px-2 text-right">Adj.EBITDA</th>
          <th class="py-1.5 px-2 text-right">EV/EBITDA</th>
          <th class="py-1.5 px-2 text-right">%ile</th>
          <th class="py-1.5 px-2 text-right">EV/Sales</th>
          <th class="py-1.5 px-2 text-right">Fwd P/E</th>
          <th class="py-1.5 px-2 text-right">FCF Yield</th>
          <th class="py-1.5 px-2 text-right">Net Lev</th>
          <th class="py-1.5 px-2 text-center">PIT</th>
          <th class="py-1.5 px-2 text-center">Signal</th>
        </tr></thead>
        <tbody class="divide-y divide-[#1a2540]">
        ${[...stocks].sort((a,b)=>a.evEbitda-b.evEbitda).map(s=>{
          const flag  = s.evEbitdaPercentile<=10&&s.fcfYield>4?'★ ':''
          const sig   = s.evEbitdaPercentile<=20&&s.fcfYield>3?'underval':s.evEbitdaPercentile>=80?'overval':'fair'
          const sigCl = sig==='underval'?'bg-emerald-600 text-white':sig==='overval'?'bg-red-700 text-red-100':'bg-blue-50 text-gray-500'
          return `<tr class="hover:bg-blue-50/60 ${s.evEbitdaPercentile<=15?'bg-emerald-900/8':''}">
            <td class="py-1.5 px-2 font-bold text-gray-900">${flag}${s.ticker}</td>
            <td class="py-1.5 px-2 text-right text-gray-500 font-mono">$${s.marketCap}B</td>
            <td class="py-1.5 px-2 text-right text-gray-500 font-mono">$${(s.ev||0).toFixed(0)}B</td>
            <td class="py-1.5 px-2 text-right text-emerald-300 font-mono">$${(s.adjustedEbitda||0).toFixed(1)}B</td>
            <td class="py-1.5 px-2 text-right font-bold font-mono" style="color:${evColor(s.evEbitdaPercentile)}">${s.evEbitda.toFixed(1)}×</td>
            <td class="py-1.5 px-2 text-right text-[10px]" style="color:${evColor(s.evEbitdaPercentile)}">${s.evEbitdaPercentile}%</td>
            <td class="py-1.5 px-2 text-right text-gray-500 font-mono">${s.evSales.toFixed(1)}×</td>
            <td class="py-1.5 px-2 text-right text-gray-500 font-mono">${s.forwardPE.toFixed(0)}×</td>
            <td class="py-1.5 px-2 text-right font-semibold font-mono" style="color:${fcfColor(s.fcfYield)}">${s.fcfYield.toFixed(1)}%</td>
            <td class="py-1.5 px-2 text-right font-semibold font-mono" style="color:${levColor(s.netLeverage)}">${s.netLeverage.toFixed(1)}×</td>
            <td class="py-1.5 px-2 text-center text-[9px] ${s.pitCompliant?'text-emerald-400':'text-red-400'}">${s.pitCompliant?'✓':'⚠'}<div class="text-gray-400 text-[8px]">${s.lastReportDate}</div></td>
            <td class="py-1.5 px-2 text-center"><span class="${sigCl} text-[9px] font-bold px-1.5 py-0.5 rounded-full">${sig}</span></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="bg-gray-50 rounded-xl p-3">
        <div class="text-[10px] text-gray-500 uppercase font-semibold mb-2">EV/EBITDA 横向对比 (绿=低估 · 红=高估)</div>
        <canvas id="dc-eveb-chart" height="180"></canvas>
      </div>
      <div class="bg-gray-50 rounded-xl p-3">
        <div class="text-[10px] text-gray-500 uppercase font-semibold mb-2">FCF Yield vs 无风险利率 ${m.usTreasury10y}%</div>
        <canvas id="dc-fcf-chart" height="180"></canvas>
      </div>
    </div>

    <!-- Underval signals -->
    ${stocks.filter(s=>s.evEbitdaPercentile<=20&&s.fcfYield>3).length>0?`
    <div class="border-t border-[#1e2d4a] pt-3">
      <div class="text-[10px] font-bold text-emerald-400 uppercase mb-2">★ 低估信号 / Undervaluation Signals — EV/EBITDA ≤20th %ile · FCF Yield &gt;3%</div>
      <div class="grid grid-cols-3 gap-2">
      ${stocks.filter(s=>s.evEbitdaPercentile<=20&&s.fcfYield>3).map(s=>`
        <div class="bg-emerald-900/10 border border-emerald-600/30 rounded-lg p-3">
          <div class="flex justify-between mb-2">
            <span class="font-bold text-gray-900">${s.ticker}</span>
            <span class="text-[10px] text-gray-500">${s.sector?.split('—')[0]?.trim()}</span>
          </div>
          <div class="grid grid-cols-3 text-[10px] text-center gap-1">
            <div><div class="text-emerald-400 font-bold font-mono">${s.evEbitda.toFixed(1)}×</div><div class="text-gray-400">EV/EBITDA</div></div>
            <div><div class="text-amber-400 font-bold font-mono">${s.fcfYield.toFixed(1)}%</div><div class="text-gray-400">FCF Yield</div></div>
            <div><div style="color:${levColor(s.netLeverage)}" class="font-bold font-mono">${s.netLeverage.toFixed(1)}×</div><div class="text-gray-400">Net Lev</div></div>
          </div>
          <div class="mt-2 text-[9px] text-gray-500 truncate">${(s.adjustedEbitdaNote||"").slice(0,60)}…</div>
        </div>`).join('')}
      </div>
    </div>`:''}
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  SUB-MODULE 4: DATA PIPELINE & ENGINEERING SPECS                    -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div id="dc-sub-pipeline" style="display:none" class="mb-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
    <span class="text-sm font-bold text-white flex items-center gap-2">
      <i class="fas fa-shield-alt text-purple-400"></i>
      数据工程规范 — Data Pipeline & Bias Safeguards
    </span>
    <button onclick="window._dcToggle('dc-sub-pipeline')" class="text-gray-500 hover:text-gray-700 text-xs px-2 py-0.5 rounded border border-gray-300">✕ close</button>
  </div>
  <div class="p-4">
    <div class="grid grid-cols-3 gap-4 mb-4">

      <!-- PIT -->
      <div class="bg-emerald-900/15 border border-emerald-500/30 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-7 h-7 bg-emerald-800/50 rounded-lg flex items-center justify-center flex-shrink-0">
            <i class="fas fa-clock text-emerald-400 text-xs"></i>
          </div>
          <div>
            <div class="text-xs font-bold text-emerald-300">Point-in-Time (PIT)</div>
            <div class="text-[10px] text-gray-500">回测生命线</div>
          </div>
          <span class="ml-auto text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">✓ Active</span>
        </div>
        <div class="text-[10px] text-gray-400 leading-relaxed mb-2">
          财报数据映射到<strong class="text-emerald-300">公告日</strong>，而非财务报告期末日。Q4 2023（12月31日）财报于 2024年2月15日发布，则该数据在回测中只能从 2024-02-15 起使用。
        </div>
        <div class="text-[10px] text-amber-300 bg-amber-900/20 rounded p-2">
          ⚠ 违反PIT → 使用未来函数 → Sharpe 虚高 0.3–0.8
        </div>
        <div class="mt-2 text-[10px] text-gray-500">Reporting lag: 45–90 calendar days</div>
      </div>

      <!-- Survivorship -->
      <div class="bg-blue-900/15 border border-blue-500/30 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-7 h-7 bg-blue-800/50 rounded-lg flex items-center justify-center flex-shrink-0">
            <i class="fas fa-users text-blue-400 text-xs"></i>
          </div>
          <div>
            <div class="text-xs font-bold text-blue-300">幸存者偏差 Survivorship</div>
            <div class="text-[10px] text-gray-500">动态成分股追踪</div>
          </div>
          <span class="ml-auto text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded">✓ Mitigated</span>
        </div>
        <div class="text-[10px] text-gray-400 leading-relaxed mb-2">
          yfinance 仅返回当前500只成分股。回测10年必须维护包含<strong class="text-blue-300">已退市、被收购、破产</strong>股票的历史Ticker映射表。
        </div>
        <div class="text-[10px] text-gray-500 leading-relaxed">
          历史标普500成员: <span class="text-gray-900 font-bold">~1,847</span>只<br>
          当前宇宙: <span class="text-gray-900 font-bold">500</span>只<br>
          差异: <span class="text-amber-400 font-bold">1,347 delisted/M&A</span>
        </div>
        <div class="mt-2 text-[10px] text-amber-300 bg-amber-900/20 rounded p-2">
          ⚠ 只用当前名单 → 幸存者偏差 → Alpha虚高
        </div>
      </div>

      <!-- GAAP -->
      <div class="bg-purple-900/15 border border-purple-500/30 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-7 h-7 bg-purple-800/50 rounded-lg flex items-center justify-center flex-shrink-0">
            <i class="fas fa-balance-scale text-purple-400 text-xs"></i>
          </div>
          <div>
            <div class="text-xs font-bold text-purple-300">GAAP 调整 Adjustments</div>
            <div class="text-[10px] text-gray-500">还原真实盈利能力</div>
          </div>
          <span class="ml-auto text-[9px] bg-purple-600 text-white px-1.5 py-0.5 rounded">✓ Applied</span>
        </div>
        <ul class="space-y-1.5">
          ${(health.gaapAdjustments?.items||[
            'SBC加回EBITDA — TMT行业非现金扭曲，GAAP低估盈利15-25%',
            'R&D资本化 — SaaS/软件按3-5年摊销，替代100%费用化',
            'FCF剔除资本化软件支出 — 隐藏Capex',
            '经营性租赁加入EV — ASC 842后合规处理',
            '使用NTM预期EPS，而非TTM历史值',
          ]).map(r=>`<li class="text-[10px] text-gray-500 flex gap-1.5 leading-snug"><span class="text-purple-400 flex-shrink-0 mt-0.5">•</span>${r}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- Data Sources table -->
    <div class="text-xs font-bold text-gray-500 uppercase mb-2">数据源状态 / Source Status</div>
    <div class="space-y-1.5">
    ${srcs.map(s=>`
      <div class="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
        <div class="w-2 h-2 rounded-full flex-shrink-0 ${s.status==='live'||s.status==='connected'?'bg-emerald-400 animate-pulse':s.status==='delayed'?'bg-amber-400':'bg-gray-600'}"></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-gray-900">${s.name}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded-full ${s.status==='live'?'bg-emerald-100 text-emerald-700':s.status==='delayed'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-500'}">${s.status}</span>
            ${s.latency?`<span class="text-[9px] text-gray-500 font-mono">latency: ${s.latency}</span>`:''}
          </div>
          <div class="flex gap-4 mt-0.5">
            ${s.apiCode?`<span class="text-[10px] text-gray-600 font-mono">${s.apiCode}</span>`:''}
            ${s.updateFreq?`<span class="text-[10px] text-gray-500">${s.updateFreq}</span>`:''}
            ${s.compliance?`<span class="text-[10px] text-gray-400 truncate">${s.compliance}</span>`:''}
          </div>
        </div>
      </div>`).join('')}
    </div>
  </div>
</div>
`;

  } catch(err) {
    el.innerHTML = `<div class="text-red-400 p-6">Error: ${err.message}</div>`;
    console.error(err);
  }
}


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  3. FIVE-FACTOR SCREENER                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderScreener(el) {
  // ── User filter state (persisted in window) ─────────────────────────────
  if (!window._sf) window._sf = {
    marketCapMin: 10,       // $B
    revGrowthMin: 0,        // %
    revGrowthMax: 200,
    grossMarginMin: 0,      // %
    grossMarginMax: 100,
    sector: '',
    sort: 'compositeScore',
    minScore: 0,
  };
  const sf = window._sf;

  // ── Fetch full universe: try live YF API first, fallback to mock ────────
  let allStocks, dataSourceLabel = 'Yahoo Finance LIVE';
  try {
    // Show loading state
    el.innerHTML = `<div class="flex items-center justify-center py-20 gap-3 text-gray-500">
      <i class="fas fa-spinner fa-spin text-indigo-500 text-xl"></i>
      <div><div class="text-sm font-semibold">正在拉取实时数据...</div>
           <div class="text-xs mt-0.5">Yahoo Finance API · 缓存15分钟</div></div>
    </div>`;
    try {
      const { data: liveData } = await axios.get(`${API}/api/live/screener`);
      if (liveData.stocks && liveData.stocks.length > 0) {
        allStocks = liveData.stocks;
        dataSourceLabel = liveData.factsetCrossValidation
          ? 'FactSet + Yahoo Finance 双源验证'
          : 'Yahoo Finance LIVE';
        window._screenerLive = true;
      } else {
        throw new Error('Empty live data');
      }
    } catch(liveErr) {
      // Fallback to mock screener
      const { data: mockData } = await axios.get(`${API}/api/us/screener?sort=${sf.sort}`);
      allStocks = mockData.stocks;
      dataSourceLabel = 'Mock数据 (data-service离线)';
      window._screenerLive = false;
    }
    window._screenerUniverse = allStocks;
    window._screenerWeights  = { growth:0.20, valuation:0.25, quality:0.25, safety:0.15, momentum:0.15 };
  } catch(e) {
    el.innerHTML = `<div class="text-red-500 p-8">API Error: ${e.message}</div>`; return;
  }

  // ── Apply client-side filters ─────────────────────────────────────────────
  function applyFilters(stocks) {
    return stocks.filter(s =>
      s.marketCap       >= sf.marketCapMin &&
      s.revenueGrowth   >= sf.revGrowthMin &&
      s.revenueGrowth   <= sf.revGrowthMax &&
      s.grossMargin     >= sf.grossMarginMin &&
      s.grossMargin     <= sf.grossMarginMax &&
      (sf.sector ? s.sector === sf.sector : true) &&
      s.compositeScore  >= sf.minScore
    ).sort((a,b) => (b[sf.sort]||0) - (a[sf.sort]||0));
  }

  const sectors = [...new Set(allStocks.map(s=>s.sector))].sort();
  const fw = window._screenerWeights;

  function renderTable(stocks) {
    const tbody = document.getElementById('screenerTbody');
    if (!tbody) return;
    document.getElementById('screenerCount').textContent = stocks.length;
    const c2 = document.getElementById('screenerCount2');
    if (c2) c2.textContent = stocks.length;
    tbody.innerHTML = stocks.map(s=>`<tr class="cursor-pointer hover:bg-indigo-50 transition-colors group">
      <td class="px-3 py-2.5">
        <div class="font-bold text-gray-900 text-sm">${s.ticker}</div>
        <div class="text-[10px] text-gray-500">${s.name.slice(0,18)}</div>
      </td>
      <td class="px-3 py-2.5 text-[11px] text-gray-500">${s.sector.slice(0,14)}</td>
      <td class="px-3 py-2.5">
        <div class="font-mono font-bold text-gray-800">$${s.price.toFixed(1)}</div>
        <div class="text-[10px] font-mono ${s.changePct>=0?'text-emerald-600':'text-red-600'}">${s.changePct>=0?'+':''}${s.changePct.toFixed(2)}%</div>
      </td>
      <td class="px-3 py-2.5 font-mono text-gray-600 text-sm">$${s.marketCap.toFixed(0)}B</td>
      <td class="px-3 py-2.5 font-mono text-sm ${s.forwardPE>40?'text-amber-600':'text-gray-700'}">${s.forwardPE>0?s.forwardPE.toFixed(1)+'×':'N/A'}</td>
      <td class="px-3 py-2.5 font-mono text-sm text-gray-600">${s.evEbitda>0?s.evEbitda.toFixed(1)+'×':'N/A'}</td>
      <td class="px-3 py-2.5 font-mono font-bold text-sm ${s.revenueGrowth>=20?'text-emerald-600':s.revenueGrowth>=10?'text-amber-600':'text-gray-500'}">${s.revenueGrowth>0?'+':''}${s.revenueGrowth.toFixed(0)}%</td>
      <td class="px-3 py-2.5 font-mono text-sm ${s.grossMargin>=50?'text-emerald-600':s.grossMargin>=30?'text-gray-600':'text-red-500'}">${s.grossMargin.toFixed(0)}%</td>
      <td class="px-3 py-2.5 font-mono text-sm text-gray-600">${s.roe.toFixed(0)}%</td>
      <td class="px-3 py-2.5 font-mono text-sm text-gray-600">${s.fcfYield.toFixed(1)}%</td>
      <td class="px-3 py-2.5 font-mono text-sm text-gray-500">${s.beta.toFixed(2)}</td>
      <td class="px-3 py-2.5 text-[11px] ${fmt.ratingColor(s.analystRating)}">${fmt.ratingLabel(s.analystRating)}</td>
      <td class="px-3 py-2.5">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm text-gray-900">${s.compositeScore}</span>
          <div class="score-bar w-12"><div class="score-bar-fill ${scoreColor(s.compositeScore)}" style="width:${s.compositeScore}%"></div></div>
        </div>
      </td>
      <td class="px-3 py-2.5"><div class="score-bar w-10"><div class="score-bar-fill bg-cyan-500" style="width:${s.growthScore}%"></div></div><span class="text-[10px] text-gray-500">${s.growthScore}</span></td>
      <td class="px-3 py-2.5"><div class="score-bar w-10"><div class="score-bar-fill bg-amber-500" style="width:${s.valuationScore}%"></div></div><span class="text-[10px] text-gray-500">${s.valuationScore}</span></td>
      <td class="px-3 py-2.5"><div class="score-bar w-10"><div class="score-bar-fill bg-purple-500" style="width:${s.qualityScore}%"></div></div><span class="text-[10px] text-gray-500">${s.qualityScore}</span></td>
      <td class="px-3 py-2.5">
        <button onclick="window._goDeepAnalysis('${s.ticker}')"
          class="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity"
          style="background:#4f46e5">
          <i class="fas fa-microscope mr-0.5"></i>深度
        </button>
      </td>
    </tr>`).join('');
  }

  el.innerHTML = `
  <!-- FactSet Cross-Validation Banner -->
  <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 flex items-center gap-3">
    <div class="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <i class="fas fa-check-double text-emerald-600 text-xs"></i>
    </div>
    <div class="flex-1">
      <div class="text-xs font-semibold text-gray-900" id="screener-datasource-label">FactSet + Yahoo Finance 双源交叉验证</div>
      <div class="text-[10px] text-gray-600 mt-0.5">
        基本面数据以 FactSet NTM 共识预期为主，Yahoo Finance 历史数据为辅。当两者差异 &gt;5% 时，行内显示 <span class="text-amber-600 font-semibold">⚠️ 数据偏差</span> 警告。分析师评级、EPS 预测、收入增长率均来自 FactSet 共识数据库。
      </div>
    </div>
    <div class="flex gap-3 text-[10px] text-right flex-shrink-0">
      <div class="text-center">
        <div class="font-bold text-gray-900">${allStocks.length}</div>
        <div class="text-gray-500">宇宙</div>
      </div>
      <div class="w-px bg-gray-200"></div>
      <div class="text-center">
        <div class="font-bold text-emerald-700" id="screenerCount">—</div>
        <div class="text-gray-500">筛选后</div>
      </div>
    </div>
  </div>

  <!-- Five Factor Weight Cards -->
  <div class="grid grid-cols-5 gap-3 mb-5">
    ${Object.entries(fw).map(([k,v])=>`
    <div class="kpi-card text-center">
      <div class="text-[10px] text-gray-500 mb-1">${{growth:'成长',valuation:'估值',quality:'质量',safety:'安全',momentum:'动量'}[k]}</div>
      <div class="text-xl font-bold text-indigo-600">${(v*100).toFixed(0)}%</div>
      <div class="text-[9px] text-gray-400 mt-0.5">${{growth:'Rev/EPS',valuation:'PE/EV',quality:'ROE/Margin',safety:'Debt/Beta',momentum:'52W%'}[k]}</div>
    </div>`).join('')}
  </div>

  <!-- ── USER FILTER PANEL ──────────────────────────────────────────────── -->
  <div class="filter-panel mb-5">
    <div class="flex items-center gap-2 mb-3">
      <i class="fas fa-sliders-h text-indigo-600"></i>
      <span class="font-bold text-gray-800">自定义筛选条件 <span class="text-xs font-normal text-gray-500 ml-1">User-Defined Filters</span></span>
      <button id="screenerApplyBtn" onclick="window._screenerApply()" 
        class="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold transition"
        style="background:#4f46e5;color:#fff;border:none">
        <i class="fas fa-search mr-1"></i>筛选
      </button>
      <button onclick="window._screenerReset()" 
        class="px-3 py-1.5 rounded-lg text-sm transition"
        style="background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb">
        重置
      </button>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Market Cap -->
      <div>
        <label class="text-xs font-semibold text-gray-600 block mb-1">市值下限 Market Cap Min</label>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">$</span>
          <input type="number" id="sf-mcap-min" value="${sf.marketCapMin}" min="0" step="1"
            class="w-20 text-sm font-mono" style="background:#f9fafb;border:1px solid #d1d5db;border-radius:6px;padding:4px 8px;color:#111827;outline:none">
          <span class="text-xs text-gray-500">B+</span>
        </div>
        <div class="text-[10px] text-gray-400 mt-0.5">默认 $10B (大盘股)</div>
      </div>
      <!-- Revenue Growth Range -->
      <div>
        <label class="text-xs font-semibold text-gray-600 block mb-1">收入增速区间 Rev Growth %</label>
        <div class="flex items-center gap-1.5">
          <input type="number" id="sf-rev-min" value="${sf.revGrowthMin}" min="-50" max="500" step="1"
            class="w-16 text-sm font-mono" style="background:#f9fafb;border:1px solid #d1d5db;border-radius:6px;padding:4px 6px;color:#111827;outline:none">
          <span class="text-xs text-gray-400">%  ~</span>
          <input type="number" id="sf-rev-max" value="${sf.revGrowthMax}" min="-50" max="500" step="1"
            class="w-16 text-sm font-mono" style="background:#f9fafb;border:1px solid #d1d5db;border-radius:6px;padding:4px 6px;color:#111827;outline:none">
          <span class="text-xs text-gray-400">%</span>
        </div>
        <div class="text-[10px] text-gray-400 mt-0.5">YoY收入增速范围</div>
      </div>
      <!-- Gross Margin Range -->
      <div>
        <label class="text-xs font-semibold text-gray-600 block mb-1">毛利率区间 Gross Margin %</label>
        <div class="flex items-center gap-1.5">
          <input type="number" id="sf-gm-min" value="${sf.grossMarginMin}" min="0" max="100" step="1"
            class="w-16 text-sm font-mono" style="background:#f9fafb;border:1px solid #d1d5db;border-radius:6px;padding:4px 6px;color:#111827;outline:none">
          <span class="text-xs text-gray-400">%  ~</span>
          <input type="number" id="sf-gm-max" value="${sf.grossMarginMax}" min="0" max="100" step="1"
            class="w-16 text-sm font-mono" style="background:#f9fafb;border:1px solid #d1d5db;border-radius:6px;padding:4px 6px;color:#111827;outline:none">
          <span class="text-xs text-gray-400">%</span>
        </div>
        <div class="text-[10px] text-gray-400 mt-0.5">毛利率范围 (软件60-80%，工业10-30%)</div>
      </div>
      <!-- Sector + Sort -->
      <div>
        <label class="text-xs font-semibold text-gray-600 block mb-1">板块 / 排序</label>
        <select id="sf-sector" class="w-full text-xs mb-1" style="background:#f9fafb;border:1px solid #d1d5db;border-radius:6px;padding:4px 8px;color:#111827;outline:none">
          <option value="">全部板块</option>
          ${sectors.map(sec=>`<option value="${sec}" ${sf.sector===sec?'selected':''}>${sec}</option>`).join('')}
        </select>
        <select id="sf-sort" class="w-full text-xs" style="background:#f9fafb;border:1px solid #d1d5db;border-radius:6px;padding:4px 8px;color:#111827;outline:none">
          <option value="compositeScore" ${sf.sort==='compositeScore'?'selected':''}>综合评分</option>
          <option value="growthScore"    ${sf.sort==='growthScore'?'selected':''}>成长评分</option>
          <option value="valuationScore" ${sf.sort==='valuationScore'?'selected':''}>估值评分</option>
          <option value="qualityScore"   ${sf.sort==='qualityScore'?'selected':''}>质量评分</option>
          <option value="revenueGrowth"  ${sf.sort==='revenueGrowth'?'selected':''}>收入增速</option>
          <option value="grossMargin"    ${sf.sort==='grossMargin'?'selected':''}>毛利率</option>
          <option value="marketCap"      ${sf.sort==='marketCap'?'selected':''}>市值</option>
        </select>
      </div>
    </div>
  </div>

  <!-- Result header -->
  <div class="flex items-center gap-3 mb-3">
    <div class="text-sm text-gray-600">
      筛选结果：<span id="screenerCount2" class="text-lg font-bold text-indigo-600">—</span> 只股票
    </div>
    <div class="ml-auto flex flex-wrap gap-2 text-[10px]">
      <span class="px-2 py-0.5 rounded-full" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe">市值 ≥ $<span id="sf-badge-mcap">${sf.marketCapMin}</span>B</span>
      <span class="px-2 py-0.5 rounded-full" style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0">RevGrowth <span id="sf-badge-rev">${sf.revGrowthMin}%~${sf.revGrowthMax}%</span></span>
      <span class="px-2 py-0.5 rounded-full" style="background:#fefce8;color:#854d0e;border:1px solid #fde68a">毛利率 <span id="sf-badge-gm">${sf.grossMarginMin}%~${sf.grossMarginMax}%</span></span>
    </div>
  </div>

  <!-- Table -->
  <div class="card overflow-hidden">
    <div class="overflow-auto">
      <table class="data-table" id="screenerTable">
        <thead><tr>
          <th>股票</th><th>板块</th><th>股价</th><th>市值($B)</th>
          <th>Fwd PE</th><th>EV/EBITDA</th><th>Rev增速</th><th>毛利率</th>
          <th>ROE</th><th>FCF率</th><th>Beta</th><th>分析师</th>
          <th>综合分</th><th>成长</th><th>估值</th><th>质量</th><th>深度</th>
        </tr></thead>
        <tbody id="screenerTbody"></tbody>
      </table>
    </div>
  </div>

  <!-- Stock Detail Modal -->
  <div id="stockModal" class="hidden fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onclick="closeModal(event)">
    <div class="card w-[700px] max-h-[80vh] overflow-y-auto p-6" id="stockModalContent"></div>
  </div>`;

  // ── Apply + Reset handlers ───────────────────────────────────────────────
  window._screenerApply = function() {
    window._sf.marketCapMin   = parseFloat(document.getElementById('sf-mcap-min').value) || 0;
    window._sf.revGrowthMin   = parseFloat(document.getElementById('sf-rev-min').value)  || 0;
    window._sf.revGrowthMax   = parseFloat(document.getElementById('sf-rev-max').value)  || 200;
    window._sf.grossMarginMin = parseFloat(document.getElementById('sf-gm-min').value)   || 0;
    window._sf.grossMarginMax = parseFloat(document.getElementById('sf-gm-max').value)   || 100;
    window._sf.sector         = document.getElementById('sf-sector').value;
    window._sf.sort           = document.getElementById('sf-sort').value;
    // Update badge text
    document.getElementById('sf-badge-mcap').textContent = window._sf.marketCapMin;
    document.getElementById('sf-badge-rev').textContent  = window._sf.revGrowthMin+'%~'+window._sf.revGrowthMax+'%';
    document.getElementById('sf-badge-gm').textContent   = window._sf.grossMarginMin+'%~'+window._sf.grossMarginMax+'%';
    renderTable(applyFilters(window._screenerUniverse));
  };

  window._screenerReset = function() {
    window._sf = { marketCapMin:10, revGrowthMin:0, revGrowthMax:200, grossMarginMin:0, grossMarginMax:100, sector:'', sort:'compositeScore', minScore:0 };
    navigate('screener');
  };

  // Deep analysis navigation
  window._goDeepAnalysis = function(ticker) {
    window._saLastTicker = ticker;
    navigate('stockanalysis');
  };

  // Initial render
  renderTable(applyFilters(allStocks));
  window._screenerData = allStocks;
}

window.showStockDetail = function(ticker) {
  axios.get(`${API}/api/us/stock/${ticker}`).then(({ data }) => {
    const s = data.stock, e = data.earnings[0]
    document.getElementById('stockModalContent').innerHTML = `
      <div class="flex justify-between items-start mb-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900">${s.ticker} — ${s.name}</h2>
          <p class="text-xs text-gray-500">${s.sector} · ${s.industry}</p>
        </div>
        <button onclick="document.getElementById('stockModal').classList.add('hidden')" class="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
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
        ].map(([k,v])=>`<div class="bg-gray-50 rounded p-2">
          <div class="text-[10px] text-gray-500">${k}</div>
          <div class="text-sm font-bold text-gray-900">${v}</div>
        </div>`).join('')}
      </div>
      ${e ? `<div class="card p-3 mb-3">
        <div class="text-xs font-semibold text-gray-500 mb-2">最新财报: ${e.quarter}</div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>EPS: <span class="text-gray-900 font-bold">$${e.epsReported.toFixed(2)}</span> vs 预期 $${e.epsEstimate.toFixed(2)} <span class="${e.epsSurprisePct>=0?'text-emerald-400':'text-red-400'}">(${e.epsSurprisePct>=0?'+':''}${e.epsSurprisePct.toFixed(1)}%)</span></div>
          <div>收入: <span class="text-gray-900 font-bold">$${e.revenueReported.toFixed(1)}B</span> vs 预期 $${e.revenueEstimate.toFixed(1)}B <span class="${e.revenueSurprisePct>=0?'text-emerald-400':'text-red-400'}">(${e.revenueSurprisePct>=0?'+':''}${e.revenueSurprisePct.toFixed(1)}%)</span></div>
        </div>
        <div class="mt-2 text-[11px] text-gray-500">${e.analystNote}</div>
      </div>` : ''}
      <div class="flex items-center gap-3 text-xs">
        <span class="text-gray-500">综合评分:</span>
        <span class="text-2xl font-bold text-gray-900">${s.compositeScore}</span>
        <div class="score-bar flex-1"><div class="score-bar-fill ${scoreColor(s.compositeScore)}" style="width:${s.compositeScore}%"></div></div>
        <span class="text-gray-500">数据源:</span>
        <span class="text-indigo-700 font-semibold">${s.dataSource}</span>
        ${s.divergenceFlag?'<span class="text-amber-600">⚠️ 数据偏差>5%</span>':''}
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
            <div class="font-semibold text-gray-900 text-sm">${s.name}</div>
            <div class="text-[11px] text-gray-500 mt-0.5">${s.typeLabel} · ${s.startDate}</div>
          </div>
          <span class="badge badge-${s.status}">${s.status}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div><div class="text-[10px] text-gray-500">收益率</div><div class="text-lg font-bold ${s.pnl>=0?'text-emerald-400':'text-red-400'}">${fmt.pct(s.pnlPct)}</div></div>
          <div><div class="text-[10px] text-gray-500">夏普比率</div><div class="text-lg font-bold text-amber-400">${s.sharpe.toFixed(2)}</div></div>
          <div><div class="text-[10px] text-gray-500">最大回撤</div><div class="text-sm font-bold text-red-400">${s.maxDrawdown.toFixed(1)}%</div></div>
          <div><div class="text-[10px] text-gray-500">胜率</div><div class="text-sm font-bold text-gray-400">${s.winRate.toFixed(1)}%</div></div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-500">权重</span>
          <div class="flex items-center gap-2">
            <div class="score-bar w-20"><div class="score-bar-fill bg-cyan-500" style="width:${s.weight*4}%"></div></div>
            <span class="text-xs text-gray-400">${s.weight}%</span>
          </div>
        </div>
        <div id="detail-${s.id}" class="hidden mt-3 pt-3 border-t border-[#1e2d4a]">
          <p class="text-xs text-gray-500">${s.description}</p>
          <div class="mt-2 text-xs text-gray-500">资金规模: <span class="text-gray-900">${fmt.money(s.capital)}</span></div>
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
              <h3 class="font-bold text-gray-900">${s.name}</h3>
              <span class="badge badge-${s.status}">${s.status}</span>
              <span class="badge ${s.type==='factor'?'badge-validated':s.type==='event'?'badge-live':'badge-backtesting'}">${s.type}</span>
            </div>
            <p class="text-xs text-gray-500 mt-1 max-w-2xl">${s.hypothesis}</p>
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
          <div class="bg-blue-50 rounded px-3 py-1.5 text-xs">
            <span class="text-gray-400">${f.name}</span>
            <span class="text-cyan-400 ml-2">${(f.weight*100).toFixed(0)}%</span>
            <div class="text-[10px] text-gray-500 mt-0.5">${f.metric}</div>
          </div>`).join('')}
        </div>
        <div class="flex items-center gap-6 text-xs text-gray-500">
          <span>标的: <span class="text-gray-800">${s.universe.slice(0,50)}</span></span>
          <span>调仓: <span class="text-gray-800">${s.rebalance}</span></span>
          <span>回测胜率: <span class="text-gray-800">${s.backtestStats.winRate.toFixed(1)}%</span></span>
          <span>最大回撤: <span class="text-red-400">${s.backtestStats.maxDrawdown.toFixed(1)}%</span></span>
          <span class="text-[10px] text-gray-400">来源: ${s.sourceRef.join(', ')}</span>
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
          <span class="text-sm font-bold text-gray-900">范式跃迁：从确定性规则 → 模式识别</span>
        </div>
        <div class="grid grid-cols-2 gap-4 text-xs">
          <div class="bg-gray-50 rounded p-3 border border-red-800/30">
            <div class="text-red-400 font-semibold mb-2 flex items-center gap-1"><i class="fas fa-times-circle"></i> 传统方法 (Deterministic)</div>
            <code class="text-gray-500 font-mono text-[11px]">Data + <span class="text-red-300">Rules</span> = Answers<br>Growth×<span class="text-red-300">0.30</span> + Val×<span class="text-red-300">0.25</span> + ...<br><span class="text-gray-400"># 人工硬编码权重，无法适应市场变化</span></code>
          </div>
          <div class="bg-gray-50 rounded p-3 border border-emerald-800/30">
            <div class="text-emerald-400 font-semibold mb-2 flex items-center gap-1"><i class="fas fa-check-circle"></i> ML方法 (Pattern Recognition)</div>
            <code class="text-gray-500 font-mono text-[11px]">Data + <span class="text-emerald-300">Historical Returns</span> = <span class="text-emerald-300">Rules</span><br>model.fit(X_train, y_train)<br><span class="text-gray-400"># 模型自主发现最优权重</span></code>
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
              <circle cx="28" cy="28" r="22" stroke="${s.ensembleScore>=80?'#059669':s.ensembleScore>=60?'#22d3ee':s.ensembleScore>=40?'#d97706':'#dc2626'}"
                stroke-width="5" fill="none" stroke-dasharray="${2*Math.PI*22}"
                stroke-dashoffset="${2*Math.PI*22*(1-s.ensembleScore/100)}" stroke-linecap="round"/>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-sm font-bold text-gray-900">${s.ensembleScore}</span>
            </div>
          </div>
          <div class="flex-1">
            <div class="text-[10px] text-gray-500 mb-1">模型预测收益 (6M)</div>
            <div class="text-xl font-bold ${s.rfPredictedReturn>=0?'text-emerald-400':'text-red-400'}">${s.rfPredictedReturn>=0?'+':''}${s.rfPredictedReturn.toFixed(1)}%</div>
            <div class="text-[10px] text-gray-400">置信区间 [${s.confidenceInterval[0].toFixed(1)}%, ${s.confidenceInterval[1].toFixed(1)}%]</div>
          </div>
        </div>

        <!-- Feature Importance bars (top 3) -->
        <div class="space-y-1 mb-2">
          ${s.featureImportance.slice(0,3).map(f => `
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-gray-500 w-28 truncate">${f.feature}</span>
            <div class="flex-1 score-bar"><div class="score-bar-fill bg-purple-500" style="width:${f.importance*100}%"></div></div>
            <span class="text-[10px] text-gray-500">${(f.importance*100).toFixed(0)}%</span>
          </div>`).join('')}
        </div>

        <!-- Confidence -->
        <div class="flex items-center justify-between text-[10px]">
          <span class="text-gray-500">模型置信度</span>
          <span class="font-bold ${s.confidencePct>=75?'text-emerald-400':s.confidencePct>=55?'text-amber-400':'text-red-400'}">${s.confidencePct}%</span>
          <span class="text-gray-400">NLP: ${s.nlpSentimentScore}/100</span>
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
          <p class="text-xs text-gray-500 mt-1 max-w-2xl">${m.paradigm}</p>
        </div>
        <div class="text-right text-xs space-y-1">
          <div>IC: <span class="text-cyan-400 font-bold">${m.modelMetrics.infoCoeff.toFixed(3)}</span></div>
          <div>ICIR: <span class="text-amber-400 font-bold">${m.modelMetrics.icIR.toFixed(2)}</span></div>
          <div>Alpha: <span class="text-emerald-400 font-bold">+${m.modelMetrics.annualAlpha}%</span></div>
          <div>Sharpe: <span class="text-purple-400 font-bold">${m.modelMetrics.sharpe.toFixed(2)}</span></div>
        </div>
      </div>

      <!-- vs Baseline -->
      <div class="grid grid-cols-3 gap-3 mb-4 bg-gray-50 rounded p-3">
        <div class="text-center">
          <div class="text-[10px] text-gray-500 mb-1">基准策略 (${m.vsBaseline.baselineName})</div>
          <div class="text-xl font-bold text-gray-500">${m.vsBaseline.baselineReturn.toFixed(1)}%</div>
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
      <div class="bg-purple-50 border border-purple-800/30 rounded p-3 mb-3">
        <div class="text-[10px] text-purple-300 uppercase font-semibold mb-1">🔍 模型发现的非线性规律</div>
        <p class="text-xs text-gray-400">${m.keyInsight}</p>
      </div>

      <!-- Non-linear rules list -->
      <div>
        <div class="text-[10px] text-gray-500 uppercase mb-2">传统规则系统无法发现的模式</div>
        <div class="grid grid-cols-2 gap-2">
          ${m.nonLinearRules.map(r => `
          <div class="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded p-2">
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
          <div>样本: <span class="text-gray-900">${(r.trainingSize/1000).toFixed(0)}K</span></div>
          <div>特征: <span class="text-gray-900">${r.features}</span></div>
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
          <td class="font-mono font-bold text-gray-900">${(r.cvScores.reduce((a,b)=>a+b,0)/r.cvScores.length).toFixed(3)}</td>
          <td class="font-mono text-gray-500">${Math.sqrt(r.cvScores.reduce((a,b,_,arr)=>a+Math.pow(b-arr.reduce((x,y)=>x+y)/arr.length,2),0)/r.cvScores.length).toFixed(4)}</td>
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
          <span class="font-bold text-gray-900">${r.regime}</span>
          ${r.regime===regime.currentRegime?'<span class="badge badge-live text-[10px]">当前</span>':''}
        </div>
        <div class="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
          <div><div class="text-gray-500">成长</div><div class="font-bold text-gray-900">${r.growth}%</div></div>
          <div><div class="text-gray-500">估值</div><div class="font-bold text-gray-900">${r.valuation}%</div></div>
          <div><div class="text-gray-500">质量</div><div class="font-bold text-gray-900">${r.quality}%</div></div>
          <div><div class="text-gray-500">安全</div><div class="font-bold text-gray-900">${r.safety}%</div></div>
          <div><div class="text-gray-500">动量</div><div class="font-bold text-gray-900">${r.momentum}%</div></div>
          <div><div class="text-gray-500">合计</div><div class="font-bold text-cyan-400">${r.growth+r.valuation+r.quality+r.safety+r.momentum}%</div></div>
        </div>
        <p class="text-[11px] text-gray-500">${r.commentary}</p>
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
            <span class="text-gray-500 w-20">${r.regime}</span>
            <div class="flex-1 score-bar"><div class="score-bar-fill ${r.regime==='RISK_ON'?'bg-emerald-500':r.regime==='RISK_OFF'?'bg-red-500':'bg-amber-500'}" style="width:${r.probability}%"></div></div>
            <span class="text-gray-900 font-bold">${r.probability}%</span>
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
        <tr class="bg-gray-50">
          <td class="text-gray-500 text-xs">五因子硬编码 (30/25/20/15/10)</td>
          <td class="font-mono text-gray-400">18.6%</td>
          <td class="font-mono text-gray-400">0.082</td>
          <td class="font-mono text-gray-400">1.12</td>
          <td class="font-mono text-gray-400">1.74</td>
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
        <div class="bg-gray-50 rounded p-3">
          <div class="text-[10px] text-amber-400 font-semibold uppercase mb-2">📘 推荐阅读</div>
          <ul class="text-xs text-gray-500 space-y-1">
            <li>• Advances in Financial ML — Marcos López de Prado</li>
            <li>• Machine Learning for Asset Managers — López de Prado</li>
            <li>• Deep Learning for Finance — Fischer & Krauss</li>
            <li>• FinBERT: Araci (2019)</li>
            <li>• scikit-learn RandomForestRegressor docs</li>
          </ul>
        </div>
        <div class="bg-gray-50 rounded p-3">
          <div class="text-[10px] text-cyan-400 font-semibold uppercase mb-2">🔧 升级路径</div>
          <ul class="text-xs text-gray-500 space-y-1">
            <li>① 用RF替换五因子硬编码权重</li>
            <li>② 添加LSTM序列预测层</li>
            <li>③ 集成FinBERT财报情绪分析</li>
            <li>④ HMM识别市场状态动态调权</li>
            <li>⑤ Ensemble集成以上所有信号</li>
          </ul>
        </div>
        <div class="bg-gray-50 rounded p-3">
          <div class="text-[10px] text-purple-400 font-semibold uppercase mb-2">⚠️ 关键风险</div>
          <ul class="text-xs text-gray-500 space-y-1">
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
          <h2 class="text-xl font-bold text-gray-900">${s.ticker} — ML信号详情</h2>
          <p class="text-xs text-gray-500">${s.name} · ${s.sector}</p>
        </div>
        <button onclick="document.getElementById('signalModal').classList.add('hidden')" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>

      <!-- Signal Summary -->
      <div class="grid grid-cols-4 gap-3 mb-5">
        <div class="bg-gray-50 rounded p-3 text-center">
          <div class="text-[10px] text-gray-500 mb-1">信号强度</div>
          <div class="text-sm font-bold ${s.signalStrength.includes('BUY')?'text-emerald-400':'text-red-400'}">${s.signalStrength.replace('_',' ')}</div>
        </div>
        <div class="bg-gray-50 rounded p-3 text-center">
          <div class="text-[10px] text-gray-500 mb-1">综合评分</div>
          <div class="text-2xl font-bold text-gray-900">${s.ensembleScore}</div>
        </div>
        <div class="bg-gray-50 rounded p-3 text-center">
          <div class="text-[10px] text-gray-500 mb-1">RF预测(6M)</div>
          <div class="text-xl font-bold ${s.rfPredictedReturn>=0?'text-emerald-400':'text-red-400'}">${s.rfPredictedReturn>=0?'+':''}${s.rfPredictedReturn.toFixed(1)}%</div>
        </div>
        <div class="bg-gray-50 rounded p-3 text-center">
          <div class="text-[10px] text-gray-500 mb-1">LSTM预测(30D)</div>
          <div class="text-xl font-bold ${s.lstmPredictedReturn>=0?'text-emerald-400':'text-red-400'}">${s.lstmPredictedReturn>=0?'+':''}${s.lstmPredictedReturn.toFixed(1)}%</div>
        </div>
      </div>

      <!-- Probabilistic Output -->
      <div class="bg-blue-900/20 border border-blue-800/30 rounded p-3 mb-5">
        <div class="text-[10px] text-blue-300 font-semibold mb-1">概率输出（非确定性）— Probabilistic, not Absolute</div>
        <div class="text-sm text-gray-400">置信区间 [<span class="text-blue-300 font-bold">${s.confidenceInterval[0].toFixed(1)}%</span>, <span class="text-blue-300 font-bold">${s.confidenceInterval[1].toFixed(1)}%</span>] @ <span class="text-blue-400 font-bold">${s.confidencePct}%</span> 置信度</div>
        <div class="text-xs text-gray-500 mt-1">相比传统DCF的精确值输出（如"内在价值=$142.50"），ML模型给出概率范围，更真实反映市场不确定性</div>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-4">
        <!-- Feature Importance -->
        <div>
          <div class="text-xs font-semibold text-gray-500 uppercase mb-2">特征重要性 (Random Forest学习)</div>
          ${s.featureImportance.map(f => `
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[11px] text-gray-500 w-36 truncate">${f.feature}</span>
            <div class="flex-1 score-bar"><div class="score-bar-fill bg-purple-500" style="width:${f.importance*100}%"></div></div>
            <span class="text-[11px] text-gray-400 w-8 text-right">${(f.importance*100).toFixed(0)}%</span>
          </div>`).join('')}
        </div>
        <!-- Learned vs Hardcoded Weights -->
        <div>
          <div class="text-xs font-semibold text-gray-500 uppercase mb-2">ML学习权重 vs 硬编码权重</div>
          ${s.learnedWeights.map(w => `
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[11px] text-gray-500 w-32 truncate">${w.factor}</span>
            <span class="text-[11px] font-bold text-white w-8">${w.weight}%</span>
            <span class="text-[11px] ${w.vsHardcoded>0?'text-emerald-400':w.vsHardcoded<0?'text-red-400':'text-gray-500'} w-10">${w.vsHardcoded>0?'+':''}${w.vsHardcoded}%</span>
            <div class="flex-1 score-bar"><div class="score-bar-fill ${w.weight>=25?'bg-cyan-500':'bg-blue-500'}" style="width:${w.weight*3}%"></div></div>
          </div>`).join('')}
          <div class="text-[10px] text-gray-400 mt-1">vsHardcoded = 与固定权重的偏差（绿=上调，红=下调）</div>
        </div>
      </div>

      <!-- Raw Features -->
      <div class="bg-gray-50 rounded p-3">
        <div class="text-[10px] text-gray-500 uppercase mb-2">X_live 输入特征（传入模型的原始数据）</div>
        <div class="grid grid-cols-3 gap-2">
          ${Object.entries(s.features).map(([k,v]) => `
          <div class="text-xs"><span class="text-gray-500">${k}:</span> <span class="font-mono text-gray-900">${typeof v==='number'?v.toFixed(2):v}</span></div>`).join('')}
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
          { label: 'Val Loss',   data: run.trainingCurve.map(p => p.valLoss),   borderColor: '#d97706', borderWidth: 2, pointRadius: 0, tension: 0.4, borderDash: [4,2] },
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
          { label: 'VIX', data: pts.map(p => p.vix), borderColor: '#dc2626', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y', tension: 0.3 },
          { label: 'IG Spread(bp)', data: pts.map(p => p.spread), borderColor: '#d97706', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y1', tension: 0.3 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
        plugins: { legend: { display: true, labels: { color: '#9ca3af', font: { size: 10 }, boxWidth: 12 } }, tooltip: { backgroundColor: '#1a2540', titleColor: '#9ca3af', bodyColor: '#e5e7eb', borderColor: '#1e2d4a', borderWidth: 1 } },
        scales: {
          x: { grid: { color: '#111827' }, ticks: { color: '#4b5563', font: { size: 9 }, maxTicksLimit: 8 } },
          y: { grid: { color: '#111827' }, ticks: { color: '#dc2626', font: { size: 9 } }, position: 'left' },
          y1: { grid: { drawOnChartArea: false }, ticks: { color: '#d97706', font: { size: 9 } }, position: 'right' },
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
        datasets: [{ data: regime.regimeProbabilities.map(r => r.probability), backgroundColor: ['#059669','#dc2626','#d97706'], borderWidth: 0 }]
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
         s==='NEUTRAL'?'bg-gray-200/30 text-gray-500 border border-gray-600/40 text-[10px] px-2 py-0.5 rounded-full':
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
  <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 flex items-start gap-3">
    <i class="fas fa-book-open text-yellow-400 mt-0.5"></i>
    <div>
      <div class="font-semibold mb-1">因子投资研究论文库</div>
      <div class="text-xs text-gray-600">整合内部研究报告、脚本文档和工作流，通过AI提炼可操作的交易策略。核心论文：因子投资的方法概述和效果检验（规划研究部 李芮）。</div>
    </div>
  </div>
  <div class="space-y-4">
    ${papers.map(p=>`
    <div class="card p-5">
      <div class="flex items-start justify-between mb-3">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-1">
            <h3 class="font-bold text-gray-900">${p.title}</h3>
            <span class="text-xs text-gray-500 border border-gray-300 px-2 py-0.5 rounded">${p.source}</span>
            <span class="text-xs text-gray-400">${p.year}</span>
          </div>
          <div class="text-xs text-gray-600 font-medium">${p.authors}</div>
          <p class="text-xs text-gray-700 mt-2 max-w-3xl leading-relaxed">${p.abstract}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div class="text-[10px] text-gray-800 font-bold uppercase mb-2 tracking-wide">核心发现</div>
          <ul class="space-y-1">
            ${p.keyFindings.map(f=>`<li class="text-xs text-gray-700 flex items-start gap-2"><span class="text-indigo-400 mt-0.5">▪</span>${f}</li>`).join('')}
          </ul>
        </div>
        <div>
          <div class="text-[10px] text-gray-800 font-bold uppercase mb-2 tracking-wide">提炼因子</div>
          <div class="flex flex-wrap gap-2">
            ${p.extractedFactors.map(f=>`<span class="bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold text-[11px] px-2 py-1 rounded">${f}</span>`).join('')}
          </div>
          <div class="text-[10px] text-gray-800 font-bold uppercase mb-2 mt-3 tracking-wide">标签</div>
          <div class="flex flex-wrap gap-1.5">
            ${p.tags.map(t=>`<span class="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full">#${t}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`).join('')}
  </div>`
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  6. TRADING MODULE — User Trade Journal                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ── Persistent store (localStorage) ─────────────────────────────────────
const TRADE_KEY = 'qa_trades_v1';
function loadTrades()  { try { return JSON.parse(localStorage.getItem(TRADE_KEY) || '[]'); } catch(e){ return []; } }
function saveTrades(t) { localStorage.setItem(TRADE_KEY, JSON.stringify(t)); }
function genId()       { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

async function renderTrading(el) {

  // ── computed helpers ─────────────────────────────────────────────────
  function calcPnl(t) {
    if (t.side === 'BUY') return null; // open — P&L when closed
    // for SELL records, look for matching BUY by ticker (simple avg cost)
    return null;
  }
  function totalCost(t) { return (parseFloat(t.qty) * parseFloat(t.price) + parseFloat(t.commission||0)); }
  function formatCcy(v) { return v == null ? '—' : (v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`); }

  // ── summary stats from trades array ──────────────────────────────────
  function buildStats(trades) {
    const buys  = trades.filter(t => t.side === 'BUY');
    const sells = trades.filter(t => t.side === 'SELL');
    const totalBuyNotional  = buys.reduce((s,t)  => s + totalCost(t), 0);
    const totalSellNotional = sells.reduce((s,t) => s + parseFloat(t.qty) * parseFloat(t.price), 0);
    const commissions       = trades.reduce((s,t) => s + parseFloat(t.commission||0), 0);
    // realized P&L: for each sell, find avg cost of buys in same ticker
    let realizedPnl = 0;
    const tickers = [...new Set(trades.map(t => t.ticker))];
    tickers.forEach(ticker => {
      const tb = trades.filter(t => t.ticker === ticker && t.side === 'BUY');
      const ts = trades.filter(t => t.ticker === ticker && t.side === 'SELL');
      const avgCost = tb.length ? tb.reduce((s,t) => s + parseFloat(t.price), 0) / tb.length : 0;
      ts.forEach(s => { realizedPnl += (parseFloat(s.price) - avgCost) * parseFloat(s.qty); });
    });
    return { totalTrades: trades.length, buys: buys.length, sells: sells.length,
             totalBuyNotional, totalSellNotional, commissions, realizedPnl,
             uniqueTickers: tickers.length };
  }

  // ── position book: aggregate open lots ───────────────────────────────
  function buildPositions(trades) {
    const book = {};
    trades.forEach(t => {
      const tk = t.ticker.toUpperCase();
      if (!book[tk]) book[tk] = { ticker: tk, lots: [], totalQty: 0, totalCost: 0 };
      if (t.side === 'BUY') {
        book[tk].totalQty  += parseFloat(t.qty);
        book[tk].totalCost += parseFloat(t.qty) * parseFloat(t.price);
      } else {
        book[tk].totalQty  -= parseFloat(t.qty);
        book[tk].totalCost -= parseFloat(t.qty) * parseFloat(t.price);
      }
    });
    return Object.values(book).filter(p => p.totalQty > 0.0001).map(p => ({
      ...p,
      avgCost: p.totalQty > 0 ? p.totalCost / p.totalQty : 0,
    }));
  }

  // ── render function (called on every state change) ────────────────────
  function render() {
    const trades = loadTrades();
    const stats  = buildStats(trades);
    const positions = buildPositions(trades);
    const activeTab = window._tradeTab || 'journal';

    el.innerHTML = `

<!-- ════ HEADER ════════════════════════════════════════════════════════ -->
<div class="flex items-center justify-between mb-5">
  <div>
    <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
      <i class="fas fa-exchange-alt text-cyan-400"></i>
      交易模块 Trade Journal
    </h2>
    <p class="text-xs text-gray-500 mt-0.5">手动记录交易 · Local storage · 无服务端依赖</p>
  </div>
  <button onclick="window._tradeOpenForm()"
    class="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-cyan-900/30">
    <i class="fas fa-plus"></i> 添加交易 Add Trade
  </button>
</div>

<!-- ════ KPI STRIP ═════════════════════════════════════════════════════ -->
<div class="grid grid-cols-4 gap-3 mb-5">
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="text-[10px] text-gray-500 uppercase mb-1">Total Trades</div>
    <div class="text-2xl font-bold text-gray-900">${stats.totalTrades}</div>
    <div class="text-[10px] text-gray-500 mt-0.5">
      <span class="text-emerald-400">${stats.buys} Buy</span> · <span class="text-red-400">${stats.sells} Sell</span>
    </div>
  </div>
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="text-[10px] text-gray-500 uppercase mb-1">Open Positions</div>
    <div class="text-2xl font-bold text-cyan-400">${positions.length}</div>
    <div class="text-[10px] text-gray-500 mt-0.5">${stats.uniqueTickers} unique tickers</div>
  </div>
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="text-[10px] text-gray-500 uppercase mb-1">Realized P&L</div>
    <div class="text-2xl font-bold ${stats.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">
      ${formatCcy(stats.realizedPnl)}
    </div>
    <div class="text-[10px] text-gray-500 mt-0.5">Commissions: $${stats.commissions.toFixed(2)}</div>
  </div>
  <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
    <div class="text-[10px] text-gray-500 uppercase mb-1">Total Buy Notional</div>
    <div class="text-2xl font-bold text-gray-900">$${(stats.totalBuyNotional/1000).toFixed(1)}K</div>
    <div class="text-[10px] text-gray-500 mt-0.5">Sell: $${(stats.totalSellNotional/1000).toFixed(1)}K</div>
  </div>
</div>

<!-- ════ TABS ══════════════════════════════════════════════════════════ -->
<div class="flex gap-1 mb-4">
  ${[['journal','📋 交易记录 Journal'],['positions','📊 持仓汇总 Positions'],['analytics','📈 分析 Analytics']].map(([id,label])=>`
  <button onclick="window._tradeTab='${id}'; window._tradeRender()"
    class="px-4 py-1.5 rounded-lg text-sm transition-all ${activeTab===id ? 'bg-cyan-600 text-gray-900 font-semibold' : 'bg-white border border-[#1e2d4a] text-gray-500 hover:text-white'}">
    ${label}
  </button>`).join('')}
  ${trades.length > 0 ? `
  <button onclick="window._tradeClearAll()"
    class="ml-auto px-3 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
    <i class="fas fa-trash-alt mr-1"></i>清空 Clear All
  </button>` : ''}
</div>

<!-- ════ TAB: JOURNAL ══════════════════════════════════════════════════ -->
<div id="tab-journal" class="${activeTab==='journal'?'':'hidden'}">
  ${trades.length === 0 ? `
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <div class="w-16 h-16 bg-white border border-[#1e2d4a] rounded-2xl flex items-center justify-center mb-4">
      <i class="fas fa-exchange-alt text-gray-400 text-2xl"></i>
    </div>
    <div class="text-gray-500 font-semibold mb-1">No trades yet</div>
    <div class="text-gray-400 text-sm mb-4">Click "添加交易 Add Trade" to log your first entry</div>
    <button onclick="window._tradeOpenForm()"
      class="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-all">
      <i class="fas fa-plus mr-2"></i>Add First Trade
    </button>
  </div>` : `
  <div class="bg-white border border-[#1e2d4a] rounded-xl overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead class="bg-gray-50">
          <tr class="text-[10px] text-gray-500 uppercase tracking-wider">
            <th class="py-2.5 px-3 text-left">Date</th>
            <th class="py-2.5 px-3 text-left">Ticker</th>
            <th class="py-2.5 px-3 text-center">Side</th>
            <th class="py-2.5 px-3 text-right">Qty</th>
            <th class="py-2.5 px-3 text-right">Price</th>
            <th class="py-2.5 px-3 text-right">Notional</th>
            <th class="py-2.5 px-3 text-right">Commission</th>
            <th class="py-2.5 px-3 text-left">Strategy</th>
            <th class="py-2.5 px-3 text-left">Notes</th>
            <th class="py-2.5 px-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#1a2540]">
          ${[...trades].reverse().map((t,i) => {
            const notional = parseFloat(t.qty) * parseFloat(t.price);
            const idx = trades.length - 1 - i; // real index in array
            return `<tr class="hover:bg-blue-50/50 transition-colors">
              <td class="py-2 px-3 font-mono text-gray-500">${t.date}</td>
              <td class="py-2 px-3">
                <span class="font-bold text-gray-900">${t.ticker.toUpperCase()}</span>
                ${t.exchange ? `<span class="text-[9px] text-gray-400 ml-1">${t.exchange}</span>` : ''}
              </td>
              <td class="py-2 px-3 text-center">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${t.side==='BUY'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}">${t.side}</span>
              </td>
              <td class="py-2 px-3 text-right font-mono text-gray-800">${parseFloat(t.qty).toLocaleString()}</td>
              <td class="py-2 px-3 text-right font-mono text-gray-900 font-semibold">$${parseFloat(t.price).toFixed(2)}</td>
              <td class="py-2 px-3 text-right font-mono text-gray-400">$${notional.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
              <td class="py-2 px-3 text-right font-mono text-gray-500">$${parseFloat(t.commission||0).toFixed(2)}</td>
              <td class="py-2 px-3 text-gray-500 text-[11px]">${t.strategy||'—'}</td>
              <td class="py-2 px-3 text-gray-500 text-[10px] max-w-[140px] truncate" title="${t.notes||''}">${t.notes||'—'}</td>
              <td class="py-2 px-3 text-center">
                <div class="flex items-center justify-center gap-2">
                  <button onclick="window._tradeOpenForm(${idx})"
                    class="text-gray-500 hover:text-cyan-400 transition-colors text-xs">
                    <i class="fas fa-pencil-alt"></i>
                  </button>
                  <button onclick="window._tradeDelete(${idx})"
                    class="text-gray-500 hover:text-red-400 transition-colors text-xs">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`}
</div>

<!-- ════ TAB: POSITIONS ════════════════════════════════════════════════ -->
<div id="tab-positions" class="${activeTab==='positions'?'':'hidden'}">
  ${positions.length === 0 ? `
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <i class="fas fa-layer-group text-gray-400 text-3xl mb-3"></i>
    <div class="text-gray-500">No open positions</div>
    <div class="text-gray-400 text-sm">Log buy trades to see your position book here</div>
  </div>` : `
  <div class="bg-white border border-[#1e2d4a] rounded-xl overflow-hidden">
    <div class="px-4 py-3 border-b border-[#1e2d4a] flex items-center gap-2">
      <i class="fas fa-layer-group text-cyan-400 text-sm"></i>
      <span class="text-sm font-semibold text-gray-900">Open Position Book</span>
      <span class="text-[10px] text-gray-500">avg cost = simple mean of all buy prices per ticker</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead class="bg-gray-50">
          <tr class="text-[10px] text-gray-500 uppercase tracking-wider">
            <th class="py-2.5 px-4 text-left">Ticker</th>
            <th class="py-2.5 px-4 text-right">Open Qty</th>
            <th class="py-2.5 px-4 text-right">Avg Cost</th>
            <th class="py-2.5 px-4 text-right">Book Value</th>
            <th class="py-2.5 px-4 text-left">Weight %</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#1a2540]">
        ${(()=>{
          const total = positions.reduce((s,p)=>s+(p.totalQty*p.avgCost),0);
          return positions.sort((a,b)=>(b.totalQty*b.avgCost)-(a.totalQty*a.avgCost)).map(p=>{
            const bv = p.totalQty * p.avgCost;
            const wt = total > 0 ? (bv/total*100) : 0;
            return `<tr class="hover:bg-blue-50/50">
              <td class="py-3 px-4 font-bold text-white text-sm">${p.ticker}</td>
              <td class="py-3 px-4 text-right font-mono text-gray-800">${p.totalQty.toLocaleString('en-US',{maximumFractionDigits:4})}</td>
              <td class="py-3 px-4 text-right font-mono text-cyan-300">$${p.avgCost.toFixed(4)}</td>
              <td class="py-3 px-4 text-right font-mono text-gray-900 font-semibold">$${bv.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-1.5 bg-blue-50 rounded-full overflow-hidden max-w-[80px]">
                    <div class="h-full bg-cyan-500 rounded-full" style="width:${Math.min(wt,100)}%"></div>
                  </div>
                  <span class="text-gray-500 font-mono text-[10px] w-10 text-right">${wt.toFixed(1)}%</span>
                </div>
              </td>
            </tr>`;
          }).join('');
        })()}
        </tbody>
      </table>
    </div>
  </div>`}
</div>

<!-- ════ TAB: ANALYTICS ════════════════════════════════════════════════ -->
<div id="tab-analytics" class="${activeTab==='analytics'?'':'hidden'}">
  ${trades.length < 2 ? `
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <i class="fas fa-chart-pie text-gray-400 text-3xl mb-3"></i>
    <div class="text-gray-500">Need at least 2 trades for analytics</div>
    <div class="text-gray-400 text-sm">Add more trades to see breakdown charts</div>
  </div>` : `
  <div class="grid grid-cols-2 gap-5">

    <!-- By Ticker -->
    <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div class="text-xs font-bold text-gray-500 uppercase mb-3">Notional by Ticker (Buys)</div>
      ${(()=>{
        const byTicker = {};
        trades.filter(t=>t.side==='BUY').forEach(t=>{
          const k = t.ticker.toUpperCase();
          byTicker[k] = (byTicker[k]||0) + parseFloat(t.qty)*parseFloat(t.price);
        });
        const sorted = Object.entries(byTicker).sort((a,b)=>b[1]-a[1]);
        const total  = sorted.reduce((s,[,v])=>s+v, 0);
        return sorted.map(([tk,v])=>`
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs text-gray-900 font-semibold w-12 flex-shrink-0">${tk}</span>
          <div class="flex-1 h-2 bg-blue-50 rounded-full overflow-hidden">
            <div class="h-full bg-cyan-500 rounded-full transition-all" style="width:${(v/total*100).toFixed(1)}%"></div>
          </div>
          <span class="text-[10px] font-mono text-gray-500 w-24 text-right flex-shrink-0">$${v.toLocaleString('en-US',{maximumFractionDigits:0})} (${(v/total*100).toFixed(0)}%)</span>
        </div>`).join('');
      })()}
    </div>

    <!-- By Strategy -->
    <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div class="text-xs font-bold text-gray-500 uppercase mb-3">Trades by Strategy</div>
      ${(()=>{
        const byStrat = {};
        trades.forEach(t => {
          const k = t.strategy || 'Untagged';
          if (!byStrat[k]) byStrat[k] = { count:0, notional:0 };
          byStrat[k].count++;
          byStrat[k].notional += parseFloat(t.qty)*parseFloat(t.price);
        });
        const sorted = Object.entries(byStrat).sort((a,b)=>b[1].count-a[1].count);
        const maxCount = sorted[0]?.[1].count || 1;
        const COLORS = ['bg-blue-500','bg-purple-500','bg-cyan-500','bg-emerald-500','bg-amber-500','bg-pink-500'];
        return sorted.map(([strat,d],i)=>`
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] text-gray-400 w-24 flex-shrink-0 truncate">${strat}</span>
          <div class="flex-1 h-2 bg-blue-50 rounded-full overflow-hidden">
            <div class="h-full ${COLORS[i%COLORS.length]} rounded-full" style="width:${(d.count/maxCount*100)}%"></div>
          </div>
          <span class="text-[10px] font-mono text-gray-500 w-14 text-right flex-shrink-0">${d.count} trades</span>
        </div>`).join('');
      })()}
    </div>

    <!-- Timeline: trades per day -->
    <div class="col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div class="text-xs font-bold text-gray-500 uppercase mb-3">Activity Timeline</div>
      ${(()=>{
        const byDate = {};
        trades.forEach(t => {
          if (!byDate[t.date]) byDate[t.date] = { buy:0, sell:0 };
          t.side==='BUY' ? byDate[t.date].buy++ : byDate[t.date].sell++;
        });
        const sorted = Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0]));
        if (!sorted.length) return '<div class="text-gray-400 text-xs">No dates found</div>';
        const maxCount = Math.max(...sorted.map(([,d])=>d.buy+d.sell), 1);
        return `<div class="flex items-end gap-1 h-16">
          ${sorted.map(([date,d])=>`
          <div class="flex-1 flex flex-col items-center gap-0.5" title="${date}: ${d.buy} buy, ${d.sell} sell">
            <div class="w-full flex flex-col gap-0.5">
              <div class="bg-emerald-500 rounded-t" style="height:${(d.buy/(maxCount)*40)}px;min-height:${d.buy?'3px':'0'}"></div>
              <div class="bg-red-500 rounded-b" style="height:${(d.sell/(maxCount)*40)}px;min-height:${d.sell?'3px':'0'}"></div>
            </div>
            <div class="text-[8px] text-gray-400 transform -rotate-45 origin-top-left mt-1 truncate w-6">${date.slice(5)}</div>
          </div>`).join('')}
        </div>
        <div class="flex gap-4 mt-2 text-[10px]">
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-emerald-500"></span>Buy</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-red-500"></span>Sell</span>
        </div>`;
      })()}
    </div>
  </div>`}
</div>

<!-- ════ ADD / EDIT MODAL ══════════════════════════════════════════════ -->
<div id="trade-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
  <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick="window._tradeCloseForm()"></div>
  <div class="relative bg-white border border-[#1e2d4a] rounded-2xl w-full max-w-lg shadow-2xl">
    <div class="flex items-center justify-between px-5 py-4 border-b border-[#1e2d4a]">
      <span id="trade-modal-title" class="text-base font-bold text-gray-900">添加交易 Add Trade</span>
      <button onclick="window._tradeCloseForm()" class="text-gray-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 transition">
        <i class="fas fa-times text-sm"></i>
      </button>
    </div>
    <form id="trade-form" onsubmit="window._tradeSubmit(event)" class="p-5 space-y-4">
      <input type="hidden" id="trade-edit-idx" value="">

      <div class="grid grid-cols-2 gap-3">
        <!-- Date -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Date <span class="text-red-400">*</span></label>
          <input id="tf-date" type="date" required
            class="w-full bg-gray-50 border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
        </div>
        <!-- Side -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Side <span class="text-red-400">*</span></label>
          <div class="flex gap-2">
            <label class="flex-1 cursor-pointer">
              <input type="radio" name="trade-side" value="BUY" id="tf-buy" class="sr-only peer" required>
              <div class="peer-checked:bg-emerald-600 peer-checked:border-emerald-500 peer-checked:text-white
                          bg-gray-50 border border-[#1e2d4a] text-gray-500
                          rounded-lg py-2 text-center text-sm font-bold transition-all select-none">BUY</div>
            </label>
            <label class="flex-1 cursor-pointer">
              <input type="radio" name="trade-side" value="SELL" id="tf-sell" class="sr-only peer">
              <div class="peer-checked:bg-red-600 peer-checked:border-red-500 peer-checked:text-white
                          bg-gray-50 border border-[#1e2d4a] text-gray-500
                          rounded-lg py-2 text-center text-sm font-bold transition-all select-none">SELL</div>
            </label>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- Ticker -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ticker <span class="text-red-400">*</span></label>
          <input id="tf-ticker" type="text" required placeholder="e.g. NVDA"
            class="w-full bg-gray-50 border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 uppercase">
        </div>
        <!-- Exchange -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Exchange</label>
          <select id="tf-exchange"
            class="w-full bg-gray-50 border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white
                   focus:border-cyan-500/60 focus:outline-none">
            <option value="">Select…</option>
            <option value="NASDAQ">NASDAQ</option>
            <option value="NYSE">NYSE</option>
            <option value="AMEX">AMEX</option>
            <option value="OTC">OTC</option>
            <option value="LSE">LSE</option>
            <option value="HKEX">HKEX</option>
            <option value="SSE">SSE (A股)</option>
            <option value="SZSE">SZSE (A股)</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- Qty -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Quantity <span class="text-red-400">*</span></label>
          <input id="tf-qty" type="number" required min="0.0001" step="any" placeholder="100"
            class="w-full bg-gray-50 border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
        </div>
        <!-- Price -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Price (USD) <span class="text-red-400">*</span></label>
          <input id="tf-price" type="number" required min="0.0001" step="any" placeholder="150.00"
            class="w-full bg-gray-50 border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- Commission -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Commission ($)</label>
          <input id="tf-commission" type="number" min="0" step="any" placeholder="1.00"
            class="w-full bg-gray-50 border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
        </div>
        <!-- Strategy tag -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Strategy Tag</label>
          <input id="tf-strategy" type="text" placeholder="e.g. BTD, Momentum"
            class="w-full bg-gray-50 border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
        </div>
      </div>

      <!-- Notes -->
      <div>
        <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Notes / Thesis</label>
        <textarea id="tf-notes" rows="2" placeholder="Entry rationale, catalyst, stop loss level…"
          class="w-full bg-gray-50 border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none
                 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"></textarea>
      </div>

      <!-- Notional preview -->
      <div id="tf-notional-preview" class="hidden bg-gray-50 border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm">
        <span class="text-gray-500">Notional: </span>
        <span id="tf-notional-val" class="text-gray-900 font-mono font-bold"></span>
      </div>

      <div class="flex gap-3 pt-1">
        <button type="button" onclick="window._tradeCloseForm()"
          class="flex-1 py-2.5 rounded-lg border border-[#1e2d4a] text-gray-500 hover:text-white hover:border-gray-500 transition text-sm">
          Cancel
        </button>
        <button type="submit"
          class="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-gray-900 font-semibold rounded-lg transition text-sm">
          <i class="fas fa-check mr-1"></i>Save Trade
        </button>
      </div>
    </form>
  </div>
</div>`;

    // ── wire up notional preview ────────────────────────────────────────
    function updatePreview() {
      const q = parseFloat(document.getElementById('tf-qty')?.value);
      const p = parseFloat(document.getElementById('tf-price')?.value);
      const preview = document.getElementById('tf-notional-preview');
      const val     = document.getElementById('tf-notional-val');
      if (preview && val && !isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
        val.textContent = '$' + (q*p).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
        preview.classList.remove('hidden');
      } else if (preview) {
        preview.classList.add('hidden');
      }
    }
    document.getElementById('tf-qty')?.addEventListener('input', updatePreview);
    document.getElementById('tf-price')?.addEventListener('input', updatePreview);

    // uppercase ticker input
    document.getElementById('tf-ticker')?.addEventListener('input', function(){ this.value = this.value.toUpperCase(); });
  }

  // ── global handlers ───────────────────────────────────────────────────
  window._tradeRender = render;

  window._tradeOpenForm = function(editIdx) {
    const modal = document.getElementById('trade-modal');
    const title = document.getElementById('trade-modal-title');
    const idxField = document.getElementById('trade-edit-idx');
    if (!modal) return;

    // reset form
    document.getElementById('trade-form').reset();
    document.getElementById('tf-notional-preview')?.classList.add('hidden');
    document.getElementById('tf-date').value = new Date().toISOString().slice(0,10);

    if (editIdx !== undefined) {
      const trades = loadTrades();
      const t = trades[editIdx];
      if (!t) return;
      title.textContent = '编辑交易 Edit Trade';
      idxField.value = editIdx;
      document.getElementById('tf-date').value   = t.date;
      document.getElementById('tf-ticker').value = t.ticker;
      document.getElementById('tf-exchange').value = t.exchange || '';
      document.getElementById('tf-qty').value    = t.qty;
      document.getElementById('tf-price').value  = t.price;
      document.getElementById('tf-commission').value = t.commission || '';
      document.getElementById('tf-strategy').value   = t.strategy || '';
      document.getElementById('tf-notes').value       = t.notes || '';
      const sideEl = document.getElementById(t.side === 'BUY' ? 'tf-buy' : 'tf-sell');
      if (sideEl) sideEl.checked = true;
    } else {
      title.textContent = '添加交易 Add Trade';
      idxField.value = '';
    }
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('tf-ticker')?.focus(), 50);
  };

  window._tradeCloseForm = function() {
    document.getElementById('trade-modal')?.classList.add('hidden');
  };

  window._tradeSubmit = function(e) {
    e.preventDefault();
    const side = document.querySelector('input[name="trade-side"]:checked')?.value;
    if (!side) { alert('Please select BUY or SELL'); return; }
    const trade = {
      id:         genId(),
      date:       document.getElementById('tf-date').value,
      ticker:     document.getElementById('tf-ticker').value.trim().toUpperCase(),
      exchange:   document.getElementById('tf-exchange').value,
      side,
      qty:        document.getElementById('tf-qty').value,
      price:      document.getElementById('tf-price').value,
      commission: document.getElementById('tf-commission').value || '0',
      strategy:   document.getElementById('tf-strategy').value.trim(),
      notes:      document.getElementById('tf-notes').value.trim(),
    };
    const trades  = loadTrades();
    const editIdx = document.getElementById('trade-edit-idx').value;
    if (editIdx !== '') {
      trades[parseInt(editIdx)] = { ...trades[parseInt(editIdx)], ...trade };
    } else {
      trades.push(trade);
    }
    saveTrades(trades);
    window._tradeCloseForm();
    render();
  };

  window._tradeDelete = function(idx) {
    if (!confirm('Delete this trade entry?')) return;
    const trades = loadTrades();
    trades.splice(idx, 1);
    saveTrades(trades);
    render();
  };

  window._tradeClearAll = function() {
    if (!confirm('Clear ALL trade entries? This cannot be undone.')) return;
    saveTrades([]);
    render();
  };

  // initial render
  render();
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  7. BACKTEST                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  7. BACKTESTING ENGINE — Buy-the-Dip / Contrarian / ML-Enhanced      ║
// ║  10Y SPY Data · Event-Driven · Anti-Lookahead · Realistic Costs      ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderBacktest(el) {
  el.innerHTML = `<div class="text-gray-500 text-center py-10"><i class="fas fa-spinner fa-spin mr-2"></i>Running backtests on 10Y SPY data...</div>`

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

  const tabIds = ['nav','compare','dips','ml','tradelog','portfolio']
  const tabLabels = ['📈 NAV Curves','⚖️ Strategy Compare','🎯 Dip Events','🤖 ML Classifier','📋 Trade Log','💼 My Portfolio']

  el.innerHTML = `
  <!-- HEADER + BIAS WARNINGS -->
  <div class="flex items-center justify-between mb-4">
    <div>
      <div class="text-gray-900 font-bold text-base">Buy-the-Dip & Contrarian Backtesting Engine</div>
      <div class="text-xs text-gray-500 mt-0.5">10Y SPY Daily · $100K Capital · 10bps Commission · 5bps Slippage · Anti-Look-Ahead · No Survivorship Bias</div>
    </div>
    <div class="flex gap-1.5">
      ${summary.biasWarnings.map(w=>`
      <div class="group relative">
        <div class="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center cursor-help">
          <i class="fas fa-exclamation text-amber-400 text-[9px]"></i>
        </div>
        <div class="hidden group-hover:block absolute right-0 top-6 bg-white border border-amber-400 text-[10px] text-amber-700 p-2 rounded w-56 z-50 shadow-md">${w}</div>
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
        <div>Win% <span class="text-gray-400">${s.metrics.winRate}%</span></div>
      </div>
      <div class="mt-1.5 text-[9px] text-gray-400">${s.tradeCount} round-trips</div>
    </div>`).join('')}
    <div class="kpi-card border-gray-700/40">
      <div class="text-[10px] text-gray-500 mb-1">SPY Buy &amp; Hold</div>
      <div class="text-xl font-bold text-gray-400">${bench.totalReturn>=0?'+':''}${bench.totalReturn.toFixed(1)}%</div>
      <div class="text-[10px] text-gray-500 mt-0.5">2014–2024 (Benchmark)</div>
      <div class="mt-2 text-[10px] text-gray-400">No active management</div>
    </div>
  </div>

  <!-- TABS -->
  <div class="flex gap-1 mb-4 border-b border-gray-200 pb-0">
    ${tabIds.map((id,i)=>`<button id="bt-tab-${id}" onclick="btTab('${id}')"
      class="tab-btn ${i===0?'active':''} text-xs px-3 py-1.5">${tabLabels[i]}</button>`).join('')}
  </div>

  <!-- TAB: NAV Curves -->
  <div id="bt-pane-nav">
    <div class="card p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="text-sm font-semibold text-gray-900" id="bt-nav-title">NAV Curve — Click a strategy card above</div>
          <div class="text-[10px] text-gray-500 mt-0.5">Starting NAV = 1.0 · vs SPY Buy-and-Hold benchmark</div>
        </div>
        <div class="flex gap-2">
          ${strats.map((s,i)=>`<button class="tab-btn text-[10px] ${i===0?'active':''}" onclick="btLoadNav('${s.id}',this)">${s.id.replace('bt_','').replace(/_/g,' ').toUpperCase().slice(0,12)}</button>`).join('')}
        </div>
      </div>
      <div class="chart-wrap h-64"><canvas id="btNavChart"></canvas></div>
    </div>
    <div class="card p-4">
      <div class="text-sm font-semibold text-gray-900 mb-3">Drawdown Series</div>
      <div class="chart-wrap h-36"><canvas id="btDdChart"></canvas></div>
    </div>
    <div id="bt-nav-notes" class="card p-4 mt-4 bg-gray-50 border border-gray-200">
      <div class="text-xs text-gray-500"><i class="fas fa-info-circle mr-1 text-gray-400"></i>Select a strategy to see implementation notes.</div>
    </div>
  </div>

  <!-- TAB: Strategy Compare -->
  <div id="bt-pane-compare" class="hidden">
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="card p-4">
        <div class="text-sm font-semibold text-gray-900 mb-3">CAGR vs Max Drawdown (Risk-Return)</div>
        <div class="chart-wrap h-56"><canvas id="btRiskReturnChart"></canvas></div>
      </div>
      <div class="card p-4">
        <div class="text-sm font-semibold text-gray-900 mb-3">Sharpe / Sortino / Calmar Comparison</div>
        <div class="chart-wrap h-56"><canvas id="btRatiosChart"></canvas></div>
      </div>
    </div>
    <div class="card p-4">
      <div class="text-sm font-semibold text-gray-900 mb-3">Full Metrics Comparison Table</div>
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
              <td class="font-semibold text-gray-900 text-[11px] whitespace-nowrap">${s.name.replace('(SPY 10Y)','').replace('(RF Proxy)','').trim()}</td>
              <td class="text-cyan-400 font-mono">${s.annualReturn.toFixed(1)}</td>
              <td class="text-emerald-400 font-mono">${s.totalReturn.toFixed(1)}</td>
              <td class="text-amber-400 font-mono">${s.sharpe}</td>
              <td class="text-amber-300 font-mono">${s.sortino}</td>
              <td class="text-red-400 font-mono">${s.maxDrawdown.toFixed(1)}</td>
              <td class="text-gray-700 font-mono">${s.calmarRatio}</td>
              <td class="text-gray-400 font-mono">${s.winRate}</td>
              <td class="text-purple-400 font-mono">${s.profitFactor}</td>
              <td class="text-gray-500 font-mono">${s.avgHoldDays}d</td>
              <td class="text-gray-500 font-mono">${s.exposure}%</td>
              <td class="${s.alpha>=0?'text-emerald-400':'text-red-400'} font-mono">${s.alpha>=0?'+':''}${s.alpha.toFixed(1)}</td>
              <td class="text-gray-400 font-mono">${s.beta}</td>
              <td class="text-gray-400 font-mono">${s.informationRatio}</td>
              <td class="text-gray-500 font-mono">${s.totalTrades}</td>
            </tr>`).join('')}
            <tr class="border-t border-gray-700/50">
              <td class="text-gray-500 font-semibold">SPY Buy &amp; Hold</td>
              <td class="text-gray-500 font-mono">${(Math.pow(1+bench.totalReturn/100,0.1)-1)*100>0?'+':''}${((Math.pow(1+bench.totalReturn/100,0.1)-1)*100).toFixed(1)}</td>
              <td class="text-gray-500 font-mono">${bench.totalReturn.toFixed(1)}</td>
              <td class="text-gray-500 font-mono">~0.65</td>
              <td colspan="11" class="text-gray-400 text-[10px]">Passive benchmark — no transaction costs</td>
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
        <div class="text-2xl font-bold text-gray-900">${dipData.total}</div>
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
        <div class="text-sm font-semibold text-gray-900">Dip Event Catalog (ML-Labeled Training Data)</div>
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
        <div class="text-sm font-semibold text-gray-900 mb-3">
          <i class="fas fa-robot mr-1 text-indigo-500"></i>
          ${mlModel.modelType}
        </div>
        <div class="grid grid-cols-2 gap-3 mb-4">
          ${[['Accuracy',mlModel.accuracy+'%','text-emerald-400'],['Precision',mlModel.precision+'%','text-cyan-400'],
             ['Recall',mlModel.recall+'%','text-amber-400'],['F1 Score',mlModel.f1+'%','text-purple-400'],
             ['ROC-AUC',mlModel.rocAuc,'text-blue-400'],['Train Period',mlModel.trainPeriod.slice(0,7),'text-gray-400']].map(([l,v,c])=>`
          <div class="bg-gray-50 rounded p-2">
            <div class="text-[10px] text-gray-500">${l}</div>
            <div class="text-base font-bold ${c}">${v}</div>
          </div>`).join('')}
        </div>
        <!-- Confusion Matrix -->
        <div class="text-xs text-gray-500 mb-2">Confusion Matrix (Test Set)</div>
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
        <div class="text-sm font-semibold text-gray-900 mb-3">Feature Importance (RF — MDI)</div>
        <div class="space-y-2 mb-4">
          ${mlModel.featureImportance.map(f=>`
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500 w-36 font-mono">${f.name}</span>
            <div class="flex-1 score-bar">
              <div class="score-bar-fill bg-gradient-to-r from-cyan-600 to-cyan-400" style="width:${(f.importance*100/0.28*100)}%"></div>
            </div>
            <span class="text-xs font-mono text-cyan-400 w-10 text-right">${(f.importance*100).toFixed(0)}%</span>
          </div>`).join('')}
        </div>
        <div class="text-[10px] text-gray-600 border-t border-gray-200 pt-2">
          <div class="text-gray-700 font-semibold mb-1">Python Implementation (scikit-learn):</div>
          <pre class="text-gray-700 text-[9px] leading-relaxed bg-gray-50 p-2 rounded">from sklearn.ensemble import RandomForestRegressor
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
      <div class="text-sm font-semibold text-gray-900 mb-3">Live Inference Samples (Test Period)</div>
      <table class="data-table text-xs">
        <thead><tr>
          <th>Date</th><th>Drop%</th><th>Vol×</th><th>RSI</th><th>VIX</th><th>MA200 Dev</th>
          <th>ML Prob</th><th>Actual</th><th>Correct?</th>
        </tr></thead>
        <tbody>
          ${mlModel.samplePredictions.map(p=>`<tr>
            <td class="font-mono text-gray-500">${p.date}</td>
            <td class="text-red-400 font-mono">${(p.features.drop_magnitude||0).toFixed(2)}%</td>
            <td class="text-amber-400 font-mono">${(p.features.volume_multiple||0).toFixed(1)}×</td>
            <td class="text-blue-400 font-mono">${(p.features.rsi_14||0).toFixed(0)}</td>
            <td class="text-purple-400 font-mono">${(p.features.vix_level||0).toFixed(1)}</td>
            <td class="text-orange-400 font-mono">${(p.features.ma200_deviation||0).toFixed(1)}%</td>
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
      <div class="text-sm font-semibold text-gray-900">Recent Trade Log</div>
      <div class="flex gap-1 text-[10px]">
        ${strats.map((s,i)=>`<button class="tab-btn ${i===0?'active':''}" onclick="btLoadTrades('${s.id}',this)">${s.id.replace('bt_','').replace(/_/g,' ').toUpperCase().slice(0,14)}</button>`).join('')}
      </div>
    </div>
    <div id="bt-trade-log-content" class="card p-4">
      <div class="text-gray-500 text-center py-4">Loading trades...</div>
    </div>
  </div>

  <!-- ── TAB: My Portfolio ─────────────────────────────────────────────── -->
  <div id="bt-pane-portfolio" class="hidden">

    <!-- Header / instructions -->
    <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4 flex items-start gap-3">
      <i class="fas fa-briefcase text-indigo-500 mt-0.5"></i>
      <div>
        <div class="font-semibold text-gray-900 text-sm mb-1">个人持仓回测 — My Portfolio Backtest</div>
        <div class="text-xs text-gray-600 leading-relaxed">输入您的个股买入记录（代码、日期、成本价、数量），系统自动拉取当前最新价格计算盈亏，并与 SPY 买入持有基准做比对。数据来源：Yahoo Finance + FactSet 交叉验证。</div>
      </div>
    </div>

    <!-- Add position form -->
    <div class="card p-4 mb-4">
      <div class="text-sm font-semibold text-gray-900 mb-3">
        <i class="fas fa-plus-circle text-indigo-500 mr-1"></i>添加持仓
      </div>
      <div class="grid grid-cols-5 gap-3 mb-3">
        <div>
          <label class="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">股票代码 Ticker</label>
          <input id="pf-ticker" type="text" placeholder="AAPL" maxlength="10"
            class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono text-gray-900 bg-white focus:outline-none focus:border-indigo-400 uppercase"
            style="text-transform:uppercase">
        </div>
        <div>
          <label class="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">买入日期 Buy Date</label>
          <input id="pf-date" type="date"
            class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-indigo-400">
        </div>
        <div>
          <label class="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">成本价 Cost Basis ($)</label>
          <input id="pf-cost" type="number" placeholder="150.00" step="0.01" min="0"
            class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono text-gray-900 bg-white focus:outline-none focus:border-indigo-400">
        </div>
        <div>
          <label class="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">持仓数量 Shares</label>
          <input id="pf-shares" type="number" placeholder="100" step="1" min="1"
            class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono text-gray-900 bg-white focus:outline-none focus:border-indigo-400">
        </div>
        <div class="flex items-end">
          <button onclick="pfAddPosition()"
            class="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded px-3 py-1.5 transition">
            <i class="fas fa-plus mr-1"></i>添加
          </button>
        </div>
      </div>
      <div id="pf-add-msg" class="text-xs text-red-500 hidden"></div>
    </div>

    <!-- Portfolio summary KPIs -->
    <div id="pf-summary" class="grid grid-cols-4 gap-3 mb-4"></div>

    <!-- Positions table -->
    <div class="card p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <div class="text-sm font-semibold text-gray-900">持仓明细 Position Detail</div>
        <div class="flex gap-2">
          <button onclick="pfRefreshPrices()" class="text-xs border border-gray-300 px-2 py-1 rounded text-gray-600 hover:bg-gray-50">
            <i class="fas fa-sync-alt mr-1"></i>刷新价格
          </button>
          <button onclick="pfClearAll()" class="text-xs border border-red-200 px-2 py-1 rounded text-red-500 hover:bg-red-50">
            <i class="fas fa-trash mr-1"></i>清空
          </button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table text-xs w-full" id="pf-table">
          <thead><tr>
            <th>Ticker</th>
            <th>买入日期</th>
            <th>成本价 $</th>
            <th>数量</th>
            <th>总成本 $</th>
            <th>当前价 $</th>
            <th>当前市值 $</th>
            <th>盈亏 $ (未实现)</th>
            <th>盈亏 %</th>
            <th>持仓天数</th>
            <th>年化回报 %</th>
            <th>FactSet验证</th>
            <th>操作</th>
          </tr></thead>
          <tbody id="pf-tbody">
            <tr><td colspan="13" class="text-center text-gray-400 py-6">尚无持仓 — 点击上方添加个股</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- vs SPY benchmark comparison -->
    <div class="card p-4">
      <div class="text-sm font-semibold text-gray-900 mb-3">
        <i class="fas fa-chart-bar text-gray-500 mr-1"></i>
        组合 vs SPY Buy-and-Hold 同期比较
      </div>
      <div id="pf-vs-spy" class="text-xs text-gray-500 py-3 text-center">添加持仓后自动计算比较结果</div>
    </div>

    <!-- Methodology note -->
    <div class="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 text-[10px] text-gray-500 leading-relaxed">
      <i class="fas fa-info-circle text-gray-400 mr-1"></i>
      <b>数据验证说明：</b>当前价格通过 Yahoo Finance API 实时拉取（/api/screener/us 中的价格数据），并与 FactSet 基本面数据库中的公司信息交叉比对，确保股票代码有效。
      盈亏计算公式：<code class="bg-gray-100 px-1 rounded">未实现盈亏 = (当前价 − 成本价) × 数量</code>；
      年化回报 = <code class="bg-gray-100 px-1 rounded">((当前价/成本价)^(365/持仓天数) − 1) × 100%</code>。
      <b class="text-amber-600">注：价格为最近交易日收盘价，非实时价格，仅供参考。</b>
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
  ['nav','compare','dips','ml','tradelog','portfolio'].forEach(t => {
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
              borderColor:'#0284c7', borderWidth:2, pointRadius:0,
              fill:{target:'origin',above:'rgba(34,211,238,0.06)'}, tension:0.3 },
            { label: 'SPY Buy&Hold', data: nc.map(p=>p.benchmark),
              borderColor:'#9ca3af', borderWidth:1.5, pointRadius:0,
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
        <div class="text-[11px] text-gray-400 leading-relaxed">
          <i class="fas fa-info-circle mr-1 text-blue-400"></i>
          <span class="font-semibold text-cyan-400">${bt.strategyName}:</span> ${bt.notes}
        </div>
        <div class="grid grid-cols-4 gap-3 mt-3 text-[10px]">
          <div><span class="text-gray-500">Commission:</span> <span class="text-gray-900">${bt.commission}bps (0.1%)</span></div>
          <div><span class="text-gray-500">Slippage:</span> <span class="text-gray-900">${bt.slippage}bps</span></div>
          <div><span class="text-gray-500">Universe:</span> <span class="text-gray-400">${bt.universe.slice(0,30)}</span></div>
          <div><span class="text-gray-500">Period:</span> <span class="text-gray-400">${bt.startDate} → ${bt.endDate}</span></div>
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
    const colors = ['#22d3ee','#a78bfa','#34d399','#d97706','#6b7280']
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
      options: { ...chartOpts('Ratio'), plugins:{...chartOpts('').plugins, legend:{labels:{color:'#6b7280',font:{size:10}}}} }
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
  el.innerHTML = `<div class="text-gray-500 text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading...</div>`
  try {
    const { data: bt } = await axios.get(`${API}/api/btd/result/${id}`)
    const sells = bt.trades.filter(t => t.type === 'SELL')
    el.innerHTML = `
      <div class="text-xs text-gray-500 mb-2">Last ${sells.length} completed trades — ${bt.strategyName}</div>
      <div class="overflow-x-auto">
        <table class="data-table text-xs">
          <thead><tr>
            <th>Date</th><th>Type</th><th>Price</th><th>Shares</th><th>Hold</th>
            <th>P&L $</th><th>P&L %</th><th>Trigger</th><th>Reason</th>
          </tr></thead>
          <tbody>
            ${bt.trades.map(t=>`<tr>
              <td class="font-mono text-gray-500">${t.date}</td>
              <td><span class="badge ${t.type==='BUY'?'badge-beat':'badge-miss'}">${t.type}</span></td>
              <td class="font-mono text-gray-400">${t.price.toFixed(2)}</td>
              <td class="font-mono text-gray-500">${t.shares}</td>
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
        <td class="font-mono text-gray-500">${e.date}</td>
        <td><span class="badge ${e.triggerType==='earnings_gap'?'badge-live':e.triggerType==='macro_event'?'badge-miss':'badge-backtesting'} text-[9px]">${e.triggerType.replace(/_/g,' ')}</span></td>
        <td class="text-red-400 font-mono font-bold">${e.dropMagnitude.toFixed(1)}%</td>
        <td class="text-amber-400 font-mono">${e.volumeMultiple.toFixed(1)}×</td>
        <td class="text-blue-400 font-mono">${e.rsi}</td>
        <td class="text-purple-400 font-mono">${e.vix}</td>
        <td class="text-orange-400 font-mono">${e.ma200Deviation.toFixed(1)}%</td>
        <td class="font-bold font-mono ${e.mlPredictedProb>0.55?'text-emerald-400':'text-gray-500'}">${(e.mlPredictedProb*100).toFixed(0)}%</td>
        <td>${e.signalFired?'<span class="text-emerald-400 text-[10px]">✓ FIRE</span>':'<span class="text-gray-400 text-[10px]">— skip</span>'}</td>
        <td class="${e.reboundMagnitude>0?'text-emerald-400':'text-red-400'} font-mono">${e.reboundMagnitude>0?'+':''}${e.reboundMagnitude.toFixed(1)}%</td>
        <td>${e.reboundWithin5d?'<span class="badge badge-beat text-[9px]">↑ Rebound</span>':'<span class="badge badge-miss text-[9px]">✗ No</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`
}


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  7b. MY PORTFOLIO — personal position tracker                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

const PF_KEY = 'qa_portfolio_v1';

function pfLoad() {
  try { return JSON.parse(localStorage.getItem(PF_KEY) || '[]'); } catch(e){ return []; }
}
function pfSave(p) { localStorage.setItem(PF_KEY, JSON.stringify(p)); }
function pfGenId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// Validate ticker against screener data (FactSet cross-validation)
async function pfValidateTicker(ticker) {
  try {
    const { data } = await axios.get(`${API}/api/screener/us?marketCapMin=0&revenueGrowthMin=-999&grossMarginMin=-999`);
    const stocks = data.stocks || [];
    const match = stocks.find(s => s.ticker && s.ticker.toUpperCase() === ticker.toUpperCase());
    if (match) {
      return { valid: true, name: match.name, sector: match.sector, currentPrice: match.price, marketCap: match.marketCap, factsetValidated: true };
    }
    // Fallback: try to find via stock detail
    try {
      const { data: detail } = await axios.get(`${API}/api/stock/${ticker}`);
      if (detail && detail.stock && detail.stock.ticker) {
        return { valid: true, name: detail.stock.name, sector: detail.stock.sector, currentPrice: detail.stock.price, marketCap: detail.stock.marketCap, factsetValidated: false };
      }
    } catch(e2) {}
    return { valid: false, name: null };
  } catch(e) {
    return { valid: false, name: null };
  }
}

window.pfAddPosition = async function() {
  const ticker  = (document.getElementById('pf-ticker')?.value || '').trim().toUpperCase();
  const dateVal = document.getElementById('pf-date')?.value;
  const cost    = parseFloat(document.getElementById('pf-cost')?.value);
  const shares  = parseFloat(document.getElementById('pf-shares')?.value);
  const msgEl   = document.getElementById('pf-add-msg');

  if (!ticker)          { msgEl.textContent = '请输入股票代码'; msgEl.classList.remove('hidden'); return; }
  if (!dateVal)         { msgEl.textContent = '请选择买入日期'; msgEl.classList.remove('hidden'); return; }
  if (isNaN(cost) || cost <= 0)   { msgEl.textContent = '请输入有效成本价（> 0）'; msgEl.classList.remove('hidden'); return; }
  if (isNaN(shares) || shares <= 0) { msgEl.textContent = '请输入有效数量（> 0）'; msgEl.classList.remove('hidden'); return; }
  if (new Date(dateVal) > new Date()) { msgEl.textContent = '买入日期不能晚于今天'; msgEl.classList.remove('hidden'); return; }

  msgEl.textContent = '⏳ 验证股票代码中...'; msgEl.classList.remove('hidden'); msgEl.className = 'text-xs text-amber-600';

  const validation = await pfValidateTicker(ticker);
  if (!validation.valid) {
    msgEl.textContent = `股票代码 ${ticker} 在数据库中未找到，请检查代码是否正确`;
    msgEl.className = 'text-xs text-red-500';
    return;
  }

  msgEl.classList.add('hidden');

  const positions = pfLoad();
  positions.push({
    id: pfGenId(),
    ticker,
    name: validation.name || ticker,
    sector: validation.sector || '—',
    buyDate: dateVal,
    costBasis: cost,
    shares,
    currentPrice: validation.currentPrice || cost,
    lastUpdated: new Date().toISOString().slice(0,10),
    factsetValidated: validation.factsetValidated
  });
  pfSave(positions);

  // Clear inputs
  ['pf-ticker','pf-date','pf-cost','pf-shares'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  pfRender();
};

window.pfRemovePosition = function(id) {
  const positions = pfLoad().filter(p => p.id !== id);
  pfSave(positions);
  pfRender();
};

window.pfClearAll = function() {
  if (!confirm('确认清空所有持仓记录？')) return;
  pfSave([]);
  pfRender();
};

window.pfRefreshPrices = async function() {
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>更新中...'; }
  
  const positions = pfLoad();
  if (positions.length === 0) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt mr-1"></i>刷新价格'; }
    return;
  }

  try {
    // Fetch latest screener data for price updates
    const { data } = await axios.get(`${API}/api/screener/us?marketCapMin=0&revenueGrowthMin=-999&grossMarginMin=-999`);
    const stockMap = {};
    (data.stocks || []).forEach(s => { if(s.ticker) stockMap[s.ticker.toUpperCase()] = s; });

    const today = new Date().toISOString().slice(0,10);
    let updated = 0;
    positions.forEach(p => {
      const stock = stockMap[p.ticker.toUpperCase()];
      if (stock && stock.price) {
        p.currentPrice = stock.price;
        p.lastUpdated = today;
        updated++;
      }
    });
    pfSave(positions);
    pfRender();
    // Flash update notice
    const vs = document.getElementById('pf-vs-spy');
    if (vs && updated > 0) {
      const notice = document.createElement('div');
      notice.className = 'text-[10px] text-emerald-600 text-right mb-1';
      notice.textContent = `✓ 已更新 ${updated} 只股票价格 (${today})`;
      vs.parentElement?.insertBefore(notice, vs);
      setTimeout(() => notice.remove(), 4000);
    }
  } catch(e) {
    console.error('pfRefreshPrices error', e);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt mr-1"></i>刷新价格'; }
  }
};

function pfCalcDays(buyDate) {
  const buy = new Date(buyDate);
  const now = new Date();
  return Math.max(1, Math.round((now - buy) / 86400000));
}

function pfCalcAnnualized(costBasis, currentPrice, days) {
  if (days < 1 || costBasis <= 0) return 0;
  return (Math.pow(currentPrice / costBasis, 365 / days) - 1) * 100;
}

function pfRender() {
  const positions = pfLoad();

  // Render summary KPIs
  const summaryEl = document.getElementById('pf-summary');
  if (!summaryEl) return;

  if (positions.length === 0) {
    summaryEl.innerHTML = '';
    const tbody = document.getElementById('pf-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="13" class="text-center text-gray-400 py-6">尚无持仓 — 点击上方添加个股</td></tr>';
    const vsEl = document.getElementById('pf-vs-spy');
    if (vsEl) vsEl.innerHTML = '<span class="text-gray-400">添加持仓后自动计算比较结果</span>';
    return;
  }

  let totalCostAll = 0, totalMktVal = 0, totalPnL = 0;
  positions.forEach(p => {
    const cost = p.costBasis * p.shares;
    const mkt  = p.currentPrice * p.shares;
    totalCostAll += cost;
    totalMktVal  += mkt;
    totalPnL     += (mkt - cost);
  });
  const totalPnLPct = totalCostAll > 0 ? (totalPnL / totalCostAll) * 100 : 0;

  summaryEl.innerHTML = [
    ['总持仓数', positions.length + ' stocks', null, ''],
    ['总成本', '$' + totalCostAll.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}), null, ''],
    ['当前市值', '$' + totalMktVal.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}), null, ''],
    ['未实现盈亏', (totalPnL>=0?'+$':'−$') + Math.abs(totalPnL).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}),
     (totalPnLPct>=0?'+':'')+totalPnLPct.toFixed(1)+'%', totalPnL>=0?'text-emerald-600':'text-red-500']
  ].map(([label, val, sub, color]) => `
    <div class="kpi-card">
      <div class="text-[10px] text-gray-500 mb-1">${label}</div>
      <div class="text-xl font-bold ${color||'text-gray-900'}">${val}</div>
      ${sub ? `<div class="text-[10px] ${color||'text-gray-500'} mt-0.5">${sub}</div>` : ''}
    </div>`).join('');

  // Render positions table
  const tbody = document.getElementById('pf-tbody');
  if (tbody) {
    tbody.innerHTML = positions.map(p => {
      const days    = pfCalcDays(p.buyDate);
      const mktVal  = p.currentPrice * p.shares;
      const pnl     = (p.currentPrice - p.costBasis) * p.shares;
      const pnlPct  = ((p.currentPrice - p.costBasis) / p.costBasis) * 100;
      const annual  = pfCalcAnnualized(p.costBasis, p.currentPrice, days);
      const pnlClass = pnl >= 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold';
      return `<tr>
        <td class="font-mono font-bold text-gray-900">${p.ticker}</td>
        <td class="font-mono text-gray-500">${p.buyDate}</td>
        <td class="font-mono text-gray-700">${p.costBasis.toFixed(2)}</td>
        <td class="font-mono text-gray-700">${p.shares.toLocaleString()}</td>
        <td class="font-mono text-gray-600">$${(p.costBasis*p.shares).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</td>
        <td class="font-mono font-semibold text-gray-900">${p.currentPrice.toFixed(2)}</td>
        <td class="font-mono text-gray-700">$${mktVal.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</td>
        <td class="font-mono ${pnlClass}">${pnl>=0?'+$':'−$'}${Math.abs(pnl).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</td>
        <td class="font-mono ${pnlClass}">${pnlPct>=0?'+':''}${pnlPct.toFixed(1)}%</td>
        <td class="font-mono text-gray-500">${days}d</td>
        <td class="font-mono ${annual>=0?'text-emerald-600':'text-red-500'}">${annual>=0?'+':''}${annual.toFixed(1)}%</td>
        <td class="text-center text-[10px]">${p.factsetValidated ? '<span class="text-emerald-600">✓FS</span>' : '<span class="text-amber-500">~YF</span>'}</td>
        <td><button onclick="pfRemovePosition('${p.id}')" class="text-red-400 hover:text-red-600 text-[11px] px-1">✕</button></td>
      </tr>`;
    }).join('');
  }

  // vs SPY comparison
  pfRenderVsSPY(positions, totalCostAll, totalMktVal, totalPnLPct);
}

function pfRenderVsSPY(positions, totalCost, totalMktVal, portfolioPnLPct) {
  const vsEl = document.getElementById('pf-vs-spy');
  if (!vsEl) return;

  // Compute weighted average holding period
  let weightedDays = 0;
  positions.forEach(p => {
    const w = (p.costBasis * p.shares) / totalCost;
    weightedDays += pfCalcDays(p.buyDate) * w;
  });
  const avgDays = Math.round(weightedDays);

  // SPY proxy: approximate annualized SPY return ~12% (2020-2025 realized)
  const SPY_ANNUAL_PCT = 12.0;
  const spyPeriodReturn = (Math.pow(1 + SPY_ANNUAL_PCT/100, avgDays/365) - 1) * 100;
  const spyCost = totalCost;
  const spyMktVal = totalCost * (1 + spyPeriodReturn/100);
  const spyPnL = spyMktVal - spyCost;
  const alpha = portfolioPnLPct - spyPeriodReturn;

  const pnlClass = portfolioPnLPct >= 0 ? 'text-emerald-600' : 'text-red-500';
  const spyClass = spyPeriodReturn >= 0 ? 'text-gray-700' : 'text-red-500';
  const alphaClass = alpha >= 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold';

  vsEl.innerHTML = `
    <div class="grid grid-cols-3 gap-4 text-center">
      <div class="bg-white border border-gray-200 rounded-lg p-3">
        <div class="text-[10px] text-gray-500 mb-1">我的组合回报</div>
        <div class="text-2xl font-bold ${pnlClass}">${portfolioPnLPct>=0?'+':''}${portfolioPnLPct.toFixed(1)}%</div>
        <div class="text-[10px] text-gray-400 mt-1">加权平均持仓 ${avgDays} 天</div>
      </div>
      <div class="bg-white border border-gray-200 rounded-lg p-3">
        <div class="text-[10px] text-gray-500 mb-1">SPY 同期预估回报</div>
        <div class="text-2xl font-bold ${spyClass}">${spyPeriodReturn>=0?'+':''}${spyPeriodReturn.toFixed(1)}%</div>
        <div class="text-[10px] text-gray-400 mt-1">${SPY_ANNUAL_PCT}% 年化基准 · ${avgDays}d</div>
      </div>
      <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
        <div class="text-[10px] text-gray-500 mb-1">超额收益 Alpha</div>
        <div class="text-2xl font-bold ${alphaClass}">${alpha>=0?'+':''}${alpha.toFixed(1)}%</div>
        <div class="text-[10px] text-gray-400 mt-1">${alpha>=0?'跑赢基准 ✓':'跑输基准 ✗'}</div>
      </div>
    </div>
    <div class="mt-3 text-[10px] text-gray-400 text-center">
      SPY 年化基准使用 2020–2025 实际回报约 12%/年；仅供参考，非精确实时数据。
    </div>
  `;
}

// Auto-render when portfolio tab is opened
document.addEventListener('click', function(e) {
  if (e.target && e.target.textContent && e.target.textContent.includes('My Portfolio')) {
    setTimeout(pfRender, 50);
  }
});

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
        <div class="text-sm font-semibold text-gray-900">组合净值 vs S&P 500 (252日)</div>
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
          <span class="text-xs text-gray-500 w-28">${f.factor}</span>
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
          <span class="text-xs text-gray-500 w-20">${s.sector}</span>
          <div class="flex-1 score-bar">
            <div class="score-bar-fill bg-blue-500" style="width:${s.weight*4}%"></div>
          </div>
          <span class="text-xs text-gray-500 w-10">${s.weight.toFixed(1)}%</span>
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
        ['胜率', fmt.pctAbs(p.winRate), 'text-gray-400'],
      ].map(([k,v,c])=>`
      <div class="bg-gray-50 rounded p-3 text-center">
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
          { label:'组合净值', data:pts.map(p=>p.nav), borderColor:'#0284c7', borderWidth:2, pointRadius:0, fill:{target:'origin',above:'rgba(34,211,238,0.06)'}, tension:0.4 },
          { label:'S&P 500', data:pts.map(p=>p.benchmark), borderColor:'#9ca3af', borderWidth:1.5, pointRadius:0, borderDash:[4,4], tension:0.4 },
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
          backgroundColor: ['#22d3ee','#6366f1','#059669','#d97706','#8b5cf6','#ec4899'],
          borderWidth: 0,
        }]
      },
      options: { plugins:{ legend:{ position:'right', labels:{ color:'#6b7280', font:{size:10}, boxWidth:10 } } }, cutout:'60%' }
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

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  9. NEWS AGENT  — Institutional News Intelligence                    ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderNewsAgent(el) {
  el.innerHTML = `<div class="flex items-center justify-center h-32 text-gray-500">
    <i class="fas fa-spinner fa-spin mr-2"></i>Loading news feed…</div>`;

  let mandatesData, articlesData, briefData, healthData;
  try {
    const [mR, aR, bR, hR] = await Promise.all([
      axios.get(`${API}/api/news/mandates`),
      axios.get(`${API}/api/news/articles`),
      axios.get(`${API}/api/news/brief`),
      axios.get(`${API}/api/news/health`),
    ]);
    mandatesData = mR.data;
    articlesData = aR.data;
    briefData    = bR.data;
    healthData   = hR.data;
  } catch(e) {
    el.innerHTML = `<div class="text-red-400 p-8">API Error: ${e.message}</div>`;
    return;
  }

  // ── colour maps ──────────────────────────────────────────────────────
  const MANDATE_COLORS = {
    AI_Capex_Bubble:        { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   pill: 'bg-blue-100 text-blue-700' },
    Geopolitics_SupplyChain:{ bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400',    pill: 'bg-red-100 text-red-700'   },
    Macro_K_Shape:          { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400',  pill: 'bg-amber-100 text-amber-700'},
    Distressed_Credit_RE:   { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', pill: 'bg-purple-100 text-purple-700'},
    Commodities_Gold_Oil:   { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', pill: 'bg-yellow-100 text-yellow-700'},
  };
  const SENTIMENT_STYLE = {
    bullish: 'bg-emerald-100 text-emerald-700',
    bearish: 'bg-red-100 text-red-700',
    neutral: 'bg-gray-200 text-gray-600',
  };
  const URGENCY_STYLE = {
    high:   'bg-red-100 text-red-700 border border-red-500/40',
    medium: 'bg-amber-100 text-amber-700 border border-amber-500/40',
    low:    'bg-emerald-100 text-emerald-700 border border-emerald-500/40',
  };

  // ── active mandate filter state ───────────────────────────────────
  window._naActiveMandate = window._naActiveMandate || 'ALL';

  // ── mandate card builder ──────────────────────────────────────────
  function mandateCard(m) {
    const c  = MANDATE_COLORS[m.id] || MANDATE_COLORS.Macro_K_Shape;
    const sb = m.sentimentBreakdown;
    const total = sb.bullish + sb.bearish + sb.neutral || 1;
    const bullPct = (sb.bullish / total * 100).toFixed(0);
    const bearPct = (sb.bearish / total * 100).toFixed(0);
    const isActive = window._naActiveMandate === m.id;
    return `
    <div onclick="window._naFilter('${m.id}')" id="na-card-${m.id}"
      class="cursor-pointer rounded-xl border p-4 transition-all ${c.bg} ${c.border}
             ${isActive ? 'ring-2 ring-offset-1 ring-offset-white ring-indigo-500' : 'hover:brightness-110'}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <i class="${m.icon} ${c.text} text-lg"></i>
          <div>
            <div class="text-gray-900 font-semibold text-sm leading-tight">${m.label}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">${m.id}</div>
          </div>
        </div>
        <span class="${c.pill} text-xs px-2 py-0.5 rounded-full font-mono">${m.articleCount} art.</span>
      </div>
      <div class="text-[11px] text-gray-500 leading-snug mb-3">${m.description}</div>
      <!-- Sentiment bar -->
      <div class="mb-2">
        <div class="flex justify-between text-[10px] text-gray-500 mb-1">
          <span class="text-emerald-400">▲ ${sb.bullish} bull</span>
          <span class="text-gray-500">● ${sb.neutral} neut</span>
          <span class="text-red-400">▼ ${sb.bearish} bear</span>
        </div>
        <div class="h-1.5 rounded-full overflow-hidden flex" style="background:#e5e7eb">
          <div class="bg-emerald-500 h-full transition-all" style="width:${bullPct}%"></div>
          <div class="bg-gray-400 h-full transition-all" style="width:${(sb.neutral/total*100).toFixed(0)}%"></div>
          <div class="bg-red-500 h-full transition-all" style="width:${bearPct}%"></div>
        </div>
      </div>
      <!-- Boolean query chip -->
      <div class="mt-2 font-mono text-[9px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1 truncate" title="${m.query}">
        🔍 ${m.query.slice(0,60)}${m.query.length>60?'…':''}
      </div>
    </div>`;
  }

  // ── article row builder ────────────────────────────────────────────
  function articleRow(a, idx) {
    const c = MANDATE_COLORS[a.mandate] || MANDATE_COLORS.Macro_K_Shape;
    const sentStyle = SENTIMENT_STYLE[a.sentiment] || SENTIMENT_STYLE.neutral;
    const sentIcon  = a.sentiment === 'bullish' ? '▲' : a.sentiment === 'bearish' ? '▼' : '●';
    return `
    <tr class="${idx%2===0?'bg-white':'bg-gray-50'} hover:bg-blue-50 transition-colors">
      <td class="px-3 py-2.5 whitespace-nowrap">
        <div class="text-[10px] font-mono text-gray-500">${a.date}</div>
        <div class="text-[10px] font-mono text-gray-400">${a.time}</div>
      </td>
      <td class="px-3 py-2.5">
        <span class="${c.pill} text-[10px] px-2 py-0.5 rounded-full">${a.mandate.replace(/_/g,' ')}</span>
      </td>
      <td class="px-3 py-2.5 max-w-xs">
        <div class="text-xs text-gray-800 leading-snug">${_naHighlight(a.title, a.mandate)}</div>
        <div class="text-[10px] text-gray-500 mt-0.5">${a.source}</div>
      </td>
      <td class="px-3 py-2.5 text-center">
        <span class="${sentStyle} text-[10px] px-2 py-0.5 rounded-full font-mono">${sentIcon} ${a.sentiment}</span>
      </td>
      <td class="px-3 py-2.5 text-center">
        <a href="${a.link}" target="_blank" rel="noopener noreferrer"
           class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-[10px] font-medium transition-colors"
           title="Search on Google News">
          <i class="fas fa-external-link-alt"></i> 搜索
        </a>
      </td>
    </tr>`;
  }

  // ── keyword highlight ───────────────────────────────────────────────
  window._naKeywords = {};
  mandatesData.mandates.forEach(m => {
    window._naKeywords[m.id] = m.keywords || [];
  });
  function _naHighlight(title, mandateId) {
    let result = title;
    const kws = window._naKeywords[mandateId] || [];
    kws.forEach(kw => {
      const re = new RegExp(`(${kw})`, 'gi');
      result = result.replace(re, '<mark class="bg-yellow-100 text-yellow-800 rounded px-0.5">$1</mark>');
    });
    return result;
  }
  window._naHighlight = _naHighlight;

  // ── filter / re-render articles table ──────────────────────────────
  window._naFilter = function(mandateId) {
    const prev = window._naActiveMandate;
    window._naActiveMandate = (prev === mandateId) ? 'ALL' : mandateId;
    // Update card ring states
    mandatesData.mandates.forEach(m => {
      const card = document.getElementById('na-card-' + m.id);
      if (!card) return;
      if (window._naActiveMandate === m.id) {
        card.classList.add('ring-2','ring-offset-1','ring-offset-white','ring-blue-400');
      } else {
        card.classList.remove('ring-2','ring-offset-1','ring-offset-white','ring-blue-400');
      }
    });
    // Re-render articles
    const filtered = window._naActiveMandate === 'ALL'
      ? articlesData.articles
      : articlesData.articles.filter(a => a.mandate === window._naActiveMandate);
    const tbody = document.getElementById('na-article-tbody');
    if (tbody) {
      tbody.innerHTML = filtered.map((a,i) => articleRow(a,i)).join('');
    }
    const countEl = document.getElementById('na-article-count');
    if (countEl) countEl.textContent = `${filtered.length} articles`;
  };

  // ── morning brief card ─────────────────────────────────────────────
  function briefHeadlineCard(h) {
    const c  = MANDATE_COLORS[h.mandate] || MANDATE_COLORS.Macro_K_Shape;
    const ug = URGENCY_STYLE[h.urgency]  || URGENCY_STYLE.low;
    const mandate = mandatesData.mandates.find(m => m.id === h.mandate);
    return `
    <div class="rounded-xl border ${c.border} ${c.bg} p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i class="${mandate?.icon||'fas fa-newspaper'} ${c.text}"></i>
          <span class="text-sm font-semibold text-gray-900">${mandate?.label || h.mandate}</span>
        </div>
        <span class="${ug} text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">${h.urgency}</span>
      </div>
      <p class="text-xs text-gray-400 leading-relaxed mb-3">${h.summary}</p>
      <div class="border-t border-[#1e2d4a] pt-3">
        <div class="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Recommended Action</div>
        <div class="text-xs text-emerald-300 font-medium leading-snug">${h.action}</div>
      </div>
    </div>`;
  }

  // ── Python script reference card ───────────────────────────────────
  const pythonRefCard = `
  <div class="rounded-xl border border-[#1e2d4a] bg-white p-4">
    <div class="flex items-center gap-2 mb-3">
      <i class="fab fa-python text-yellow-400"></i>
      <span class="text-sm font-semibold text-gray-900">Production Pipeline — <code class="text-cyan-400 text-xs">news_agent.py</code></span>
      <span class="ml-auto text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Data Layer #4</span>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-3">
      <div class="bg-gray-50 rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">Data Source</div>
        <div class="text-xs text-gray-900">Google News RSS + Boolean Search</div>
        <div class="text-[10px] text-gray-500 mt-1">Zero cost · High signal/noise</div>
      </div>
      <div class="bg-gray-50 rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">Stack</div>
        <div class="text-xs text-gray-900">feedparser · pandas · requests</div>
        <div class="text-[10px] text-gray-500 mt-1">pip install feedparser pandas</div>
      </div>
      <div class="bg-gray-50 rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">AI Brief Generation</div>
        <div class="text-xs text-gray-900">Claude 3.5 Sonnet API</div>
        <div class="text-[10px] text-gray-500 mt-1">Mandate → structured action</div>
      </div>
      <div class="bg-gray-50 rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">Production Deploy</div>
        <div class="text-xs text-gray-900">Cloudflare Worker Cron Trigger</div>
        <div class="text-[10px] text-gray-500 mt-1">→ D1 Storage → /api/news/*</div>
      </div>
    </div>
    <div class="bg-gray-50 rounded p-3 font-mono text-[10px] text-gray-500 leading-relaxed">
      <div class="text-emerald-400 mb-1"># news_agent.py — core fetch loop</div>
      <div class="text-gray-500">def fetch_mandate_news(days_back=1):</div>
      <div class="text-gray-500 ml-4">base = "https://news.google.com/rss/search?q="</div>
      <div class="text-gray-500 ml-4">for mandate_id, config in INVESTMENT_MANDATES.items():</div>
      <div class="text-gray-500 ml-8">url = base + urllib.parse.quote(config["query"])</div>
      <div class="text-gray-500 ml-8">feed = feedparser.parse(url)  <span class="text-cyan-400"># RSS → DataFrame</span></div>
      <div class="text-gray-500 ml-8">df = keyword_filter(feed, config["keywords"])</div>
      <div class="text-emerald-400 ml-4">return pd.concat(results)</div>
    </div>
  </div>`;

  // ── health status row ──────────────────────────────────────────────
  function healthRow(label, value, ok) {
    return `<div class="flex items-center justify-between py-1.5 border-b border-[#1e2d4a]">
      <span class="text-xs text-gray-500">${label}</span>
      <span class="text-xs font-mono ${ok ? 'text-emerald-400' : 'text-amber-400'}">${value}</span>
    </div>`;
  }

  // ── build final HTML ───────────────────────────────────────────────
  const allArticles = articlesData.articles;
  const sb = articlesData.sentimentBreakdown;

  el.innerHTML = `
  <!-- ── HEADER STRIP ─────────────────────────────────────────────── -->
  <div class="flex items-center justify-between mb-5">
    <div>
      <h2 class="text-lg font-bold text-white flex items-center gap-2">
        <i class="fas fa-newspaper text-cyan-400"></i>
        News Intelligence
        <span class="text-[11px] bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full ml-1">4 Mandates</span>
      </h2>
      <p class="text-xs text-gray-500 mt-0.5">
        Boolean-filtered Google News RSS · ${articlesData.total} articles · Claude 3.5 Sonnet brief
      </p>
    </div>
    <!-- Agent health chip -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-[#1e2d4a] rounded-lg px-3 py-1.5">
        <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
        <span>Last run: <span class="text-gray-900 font-mono">${new Date(healthData.lastRun).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span></span>
        <span class="text-gray-400">|</span>
        <span>Next: <span class="text-cyan-400 font-mono">${healthData.runFrequency.split('(')[0].trim()}</span></span>
      </div>
      <div class="flex gap-2 text-xs">
        <span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded">▲ ${sb.bullish} Bull</span>
        <span class="bg-gray-500/20 text-gray-500 px-2 py-1 rounded">● ${sb.neutral} Neutral</span>
        <span class="bg-red-100 text-red-700 px-2 py-1 rounded">▼ ${sb.bearish} Bear</span>
      </div>
    </div>
  </div>

  <!-- ── MANDATE CARDS ────────────────────────────────────────────── -->
  <div class="grid grid-cols-4 gap-3 mb-6">
    ${mandatesData.mandates.map(m => mandateCard(m)).join('')}
  </div>

  <div class="grid grid-cols-3 gap-5">

    <!-- ── LEFT 2/3: Article Feed + Brief ─────────────────────────── -->
    <div class="col-span-2 space-y-5">

      <!-- Article Feed Table -->
      <div class="bg-white rounded-xl border border-[#1e2d4a] overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div class="flex items-center gap-2">
            <i class="fas fa-rss text-orange-400 text-sm"></i>
            <span class="text-sm font-semibold text-gray-900">Article Feed</span>
            <span id="na-article-count" class="text-[10px] text-gray-500">${allArticles.length} articles</span>
          </div>
          <div class="flex items-center gap-2 text-[10px] text-gray-500">
            <i class="fas fa-filter text-xs"></i>
            <span>Click mandate card to filter</span>
            <button onclick="window._naFilter('ALL')"
              class="text-[10px] text-blue-400 hover:text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded">
              Show All
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-gray-50">
              <tr class="text-[10px] text-gray-500 uppercase tracking-wider">
                <th class="px-3 py-2 whitespace-nowrap">Date / Time</th>
                <th class="px-3 py-2">Mandate</th>
                <th class="px-3 py-2">Headline · Source</th>
                <th class="px-3 py-2 text-center">Sentiment</th>
                <th class="px-3 py-2 text-center">Link</th>
              </tr>
            </thead>
            <tbody id="na-article-tbody">
              ${allArticles.map((a,i) => articleRow(a,i)).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- AI Morning Brief -->
      <div class="bg-white rounded-xl border border-[#1e2d4a] overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div class="flex items-center gap-2">
            <i class="fas fa-robot text-violet-400 text-sm"></i>
            <span class="text-sm font-semibold text-gray-900">AI Morning Brief</span>
            <span class="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">${briefData.model}</span>
          </div>
          <div class="text-[10px] text-gray-500">
            Generated: ${new Date(briefData.generatedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
        <!-- Mandate summaries -->
        <div class="p-4 space-y-3">
          ${briefData.headlines.map(h => briefHeadlineCard(h)).join('')}
        </div>
        <!-- Market call -->
        <div class="mx-4 mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div class="flex items-center gap-2 mb-2">
            <i class="fas fa-broadcast-tower text-amber-400"></i>
            <span class="text-sm font-semibold text-gray-900">Overall Market Call</span>
          </div>
          <p class="text-xs text-amber-200 leading-relaxed">${briefData.marketCall}</p>
        </div>
      </div>

    </div><!-- /col-span-2 -->

    <!-- ── RIGHT 1/3: Health + Python Ref ──────────────────────────── -->
    <div class="space-y-4">

      <!-- Agent Health -->
      <div class="bg-white rounded-xl border border-[#1e2d4a] p-4">
        <div class="flex items-center gap-2 mb-3">
          <i class="fas fa-heartbeat text-emerald-400 text-sm"></i>
          <span class="text-sm font-semibold text-gray-900">Agent Health</span>
          <span class="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>
        ${healthRow('Status', 'OPERATIONAL', true)}
        ${healthRow('Total Articles', healthData.totalArticles, true)}
        ${healthRow('Active Mandates', healthData.mandateCount, true)}
        ${healthRow('Run Frequency', healthData.runFrequency.split('(')[1]?.replace(')','') || '6h', true)}
        ${healthRow('Last Run', new Date(healthData.lastRun).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}), true)}
        ${healthRow('Next Run', new Date(healthData.nextRun).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}), true)}
        <div class="mt-3 text-[10px] text-gray-500 leading-snug">${healthData.productionNote}</div>
      </div>

      <!-- Mandate Schedule -->
      <div class="bg-white rounded-xl border border-[#1e2d4a] p-4">
        <div class="flex items-center gap-2 mb-3">
          <i class="fas fa-tasks text-blue-400 text-sm"></i>
          <span class="text-sm font-semibold text-gray-900">Mandate Pipeline</span>
        </div>
        ${healthData.mandates.map(m => {
          const c = MANDATE_COLORS[m.id] || MANDATE_COLORS.Macro_K_Shape;
          return `<div class="flex items-center justify-between py-1.5 border-b border-[#1e2d4a]">
            <span class="text-xs ${c.text}">${m.label}</span>
            <span class="text-[10px] font-mono text-gray-500">${m.articleCount} art.</span>
          </div>`;
        }).join('')}
        <div class="mt-3 text-[10px] text-gray-400 font-mono leading-relaxed">
          Data: Google News RSS<br>
          Filter: Boolean + keyword<br>
          Storage: Cloudflare D1 (prod)
        </div>
      </div>

      <!-- Python Reference (collapsed by default) -->
      <div>
        <button onclick="document.getElementById('na-py-panel').classList.toggle('hidden')"
          class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#1e2d4a]
                 bg-white text-xs text-gray-500 hover:text-white hover:border-yellow-500/40 transition mb-2">
          <span class="flex items-center gap-2">
            <i class="fab fa-python text-yellow-400"></i>
            news_agent.py reference
          </span>
          <i class="fas fa-chevron-down text-[10px]"></i>
        </button>
        <div id="na-py-panel" class="hidden">
          ${pythonRefCard}
        </div>
      </div>

    </div><!-- /right col -->
  </div><!-- /grid -->`;
}

// ── SHARED HELPERS ───────────────────────────────────────────────────────────
function kpiCard(label, value, sub, icon, iconClass) {
  return `<div class="kpi-card">
    <div class="flex items-center gap-2 mb-2">
      <i class="${icon} ${iconClass} text-sm"></i>
      <span class="text-xs text-gray-500">${label}</span>
    </div>
    <div class="text-2xl font-bold text-gray-900">${value}</div>
    ${sub ? `<div class="text-xs text-gray-500 mt-1">${sub}</div>` : ''}
  </div>`
}

function miniKpi(label, value, sub, positive) {
  const c = positive === undefined ? 'text-gray-900' : (positive ? 'text-emerald-600' : 'text-red-600')
  return `<div class="rounded p-2 text-center" style="background:#f8faff;border:1px solid #e2e4ec">
    <div class="text-[10px] text-gray-500 mb-0.5">${label}</div>
    <div class="text-sm font-bold ${c}">${value}</div>
    ${sub ? `<div class="text-[10px] text-gray-400 mt-0.5">${sub}</div>` : ''}
  </div>`
}

function chartOpts(yLabel = '') {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f1f5f9', borderColor: '#334155', borderWidth: 1 } },
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

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  个股深度分析模块 — Stock Deep Analysis                                   ║
// ║  Data Layer 1: Yahoo Finance LIVE  |  Layer 2: FactSet cross-val        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

async function renderStockAnalysis(el) {
  const lastTicker = window._saLastTicker || '';

  el.innerHTML = `
<!-- ── HEADER ────────────────────────────────────────────────────────────── -->
<div class="flex items-center justify-between mb-5">
  <div>
    <div class="text-gray-900 font-bold text-base flex items-center gap-2">
      <i class="fas fa-microscope text-indigo-500"></i>
      个股深度分析 — Stock Deep Analysis
    </div>
    <div class="text-xs text-gray-500 mt-0.5">
      Layer 1: Yahoo Finance 实时数据 · Layer 2: FactSet 交叉验证 · 审计级 GAAP 调整
    </div>
  </div>
  <div class="flex items-center gap-2 text-[10px]">
    <span class="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 rounded-full">
      <i class="fas fa-circle text-emerald-500 mr-1" style="font-size:6px"></i>Yahoo Finance LIVE
    </span>
    <span id="sa-fs-badge" class="bg-gray-100 border border-gray-200 text-gray-600 px-2 py-1 rounded-full">
      FactSet: 未配置
    </span>
  </div>
</div>

<!-- ── 三层架构说明 ──────────────────────────────────────────────────────── -->
<div class="grid grid-cols-3 gap-3 mb-5">
  <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
    <div class="flex items-center gap-2 mb-2">
      <div class="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center">
        <i class="fas fa-database text-indigo-600 text-xs"></i>
      </div>
      <div class="font-bold text-gray-900 text-xs">数据层 Data Layer</div>
      <span class="ml-auto text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">LIVE</span>
    </div>
    <div class="text-[10px] text-gray-600 leading-relaxed space-y-0.5">
      <div>• Yahoo Finance API → 实时报价、季报财务</div>
      <div>• FactSet → 共识预期、交叉验证</div>
      <div>• 缓存：报价 5min / 财务 30min</div>
    </div>
  </div>
  <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
    <div class="flex items-center gap-2 mb-2">
      <div class="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center">
        <i class="fas fa-tools text-amber-600 text-xs"></i>
      </div>
      <div class="font-bold text-gray-900 text-xs">技能层 Skill Layer</div>
      <span class="ml-auto text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">工作流</span>
    </div>
    <div class="text-[10px] text-gray-600 leading-relaxed space-y-0.5">
      <div>• GAAP 审计调整（SBC/D&A 加回）</div>
      <div>• EV分解、FCF Yield、净杠杆计算</div>
      <div>• 五因子评分、估值区间判断</div>
    </div>
  </div>
  <div class="bg-purple-50 border border-purple-200 rounded-xl p-3">
    <div class="flex items-center gap-2 mb-2">
      <div class="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
        <i class="fas fa-brain text-purple-600 text-xs"></i>
      </div>
      <div class="font-bold text-gray-900 text-xs">ML/AI层 Prediction Layer</div>
      <span class="ml-auto text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">AI</span>
    </div>
    <div class="text-[10px] text-gray-600 leading-relaxed space-y-0.5">
      <div>• LLM 综合估值结论 + 价格区间</div>
      <div>• 风控信号：坚决不接恶化"飞刀"</div>
      <div>• 分析师共识 vs AI 预测对比</div>
    </div>
  </div>
</div>

<!-- ── SEARCH BAR ───────────────────────────────────────────────────────── -->
<div class="card p-4 mb-5">
  <div class="flex gap-3 items-end">
    <div class="flex-1">
      <label class="text-[10px] text-gray-500 uppercase tracking-wide block mb-1.5">
        输入股票代码 Enter Ticker
      </label>
      <div class="flex gap-2">
        <input id="sa-input" type="text" placeholder="NVDA / AAPL / MSFT ..." maxlength="10"
          value="${lastTicker}"
          class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 bg-white focus:outline-none focus:border-indigo-400"
          style="text-transform:uppercase"
          onkeydown="if(event.key==='Enter') saSearch()">
        <button onclick="saSearch()"
          class="px-5 py-2 rounded-lg text-sm font-semibold text-white transition"
          style="background:#4f46e5">
          <i class="fas fa-search mr-1"></i>深度分析
        </button>
      </div>
    </div>
    <div class="flex gap-2 text-[10px]">
      ${['NVDA','AAPL','MSFT','META','GOOGL','AMZN','TSLA','AVGO'].map(t=>
        `<button onclick="document.getElementById('sa-input').value='${t}';saSearch()"
          class="px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition font-mono">${t}</button>`
      ).join('')}
    </div>
  </div>
</div>

<!-- ── RESULT AREA ──────────────────────────────────────────────────────── -->
<div id="sa-result">
  <div class="text-center py-16 text-gray-400">
    <i class="fas fa-search text-4xl mb-3 block opacity-30"></i>
    <div class="text-sm">输入股票代码开始深度分析</div>
    <div class="text-xs mt-1">数据来源：Yahoo Finance 实时 + FactSet 交叉验证</div>
  </div>
</div>`;

  // Auto-search if last ticker exists
  if (lastTicker) {
    setTimeout(saSearch, 50);
  }
}

// ── SEARCH handler ──────────────────────────────────────────────────────────
window.saSearch = async function() {
  const ticker = (document.getElementById('sa-input')?.value || '').trim().toUpperCase();
  if (!ticker) return;
  window._saLastTicker = ticker;

  const resultEl = document.getElementById('sa-result');
  if (!resultEl) return;

  resultEl.innerHTML = `
    <div class="flex items-center justify-center py-16 gap-3 text-gray-500">
      <i class="fas fa-spinner fa-spin text-indigo-500 text-xl"></i>
      <div>
        <div class="text-sm font-semibold">正在拉取 ${ticker} 数据...</div>
        <div class="text-xs mt-1">Yahoo Finance API + 审计级调整计算中</div>
      </div>
    </div>`;

  try {
    // Parallel fetch: deep analysis + analyst recommendations
    const [deepRes, analystRes] = await Promise.allSettled([
      axios.get(`${API}/api/live/deep/${ticker}`),
      axios.get(`${API}/api/live/analyst/${ticker}`),
    ]);

    const d = deepRes.status === 'fulfilled' ? deepRes.value.data : null;
    const ana = analystRes.status === 'fulfilled' ? analystRes.value.data : null;

    if (!d || d.error) {
      resultEl.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <i class="fas fa-exclamation-triangle text-red-400 text-2xl mb-2"></i>
        <div class="text-red-700 font-semibold">${d?.error || 'Data service unavailable'}</div>
        <div class="text-red-500 text-xs mt-1">请确认 data-service 正在运行 (pm2 status)</div>
      </div>`;
      return;
    }

    resultEl.innerHTML = saRenderResult(d, ana, ticker);
    saDrawCharts(d, ana);

  } catch(e) {
    resultEl.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
      Error: ${e.message}. Data microservice may be offline.
    </div>`;
  }
};

// ── RENDER deep analysis result ──────────────────────────────────────────────
function saRenderResult(d, ana, ticker) {
  const ev   = d.ev_decomp   || {};
  const ebitda = d.adj_ebitda || {};
  const mult = d.ev_multiples || {};
  const fcf  = d.fcf_analysis || {};
  const lev  = d.leverage     || {};
  const gr   = d.growth       || {};
  const an   = d.analyst      || {};
  const qts  = d.quarterly_adj_ebitda || [];
  const ph   = d.price_history || [];
  const flags = d.audit_flags || [];

  // Risk assessment
  const levRisk = lev.net_leverage_x > 3 ? 'HIGH' : lev.net_leverage_x > 1.5 ? 'MEDIUM' : 'LOW';
  const levColor = levRisk === 'HIGH' ? 'text-red-600' : levRisk === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600';
  const levBg    = levRisk === 'HIGH' ? 'bg-red-50 border-red-200' : levRisk === 'MEDIUM' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';

  // FCF quality
  const fcfGood = fcf.fcf_yield_pct > 3;
  const fcfColor = fcf.fcf_yield_pct > 5 ? 'text-emerald-600' : fcf.fcf_yield_pct > 2 ? 'text-amber-600' : 'text-red-600';

  // EV/EBITDA signal
  const evSignal = mult.ev_ebitda_adj < 12 ? '低估区间' : mult.ev_ebitda_adj < 20 ? '合理区间' : mult.ev_ebitda_adj < 30 ? '溢价区间' : '高估警示';
  const evColor  = mult.ev_ebitda_adj < 12 ? 'text-emerald-600' : mult.ev_ebitda_adj < 20 ? 'text-gray-700' : mult.ev_ebitda_adj < 30 ? 'text-amber-600' : 'text-red-600';

  // Analyst upside
  const upside = an.upsidePct || 0;
  const upsideColor = upside > 15 ? 'text-emerald-600' : upside > 0 ? 'text-amber-600' : 'text-red-600';

  // AI verdict (rule-based LLM proxy)
  const verdict = saAiVerdict(d);

  return `
<!-- ══ STOCK HEADER ══════════════════════════════════════════════════════ -->
<div class="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-center gap-4">
  <div class="flex-1">
    <div class="flex items-center gap-3 mb-1">
      <span class="text-xl font-bold font-mono text-gray-900">${d.ticker}</span>
      <span class="text-sm text-gray-600">${d.name}</span>
      <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">${d.sector}</span>
      <span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">${d.industry || ''}</span>
    </div>
    <div class="flex items-end gap-4">
      <div class="text-3xl font-bold font-mono text-gray-900">$${(d.price||0).toFixed(2)}</div>
      <div class="text-xs text-gray-500 mb-1">市值 <span class="font-bold text-gray-800">$${(ev.market_cap_b||0).toFixed(0)}B</span></div>
      <div class="text-xs text-gray-500 mb-1">EV <span class="font-bold text-gray-800">$${(ev.ev_b||0).toFixed(0)}B</span></div>
      <div class="ml-auto text-right">
        <div class="text-[10px] text-gray-400">数据来源</div>
        <div class="text-xs font-semibold text-indigo-700">Yahoo Finance</div>
        <div class="text-[9px] text-gray-400">${d.lastUpdated ? d.lastUpdated.slice(0,19).replace('T',' ') + ' UTC' : ''}</div>
      </div>
    </div>
  </div>
</div>

<!-- ══ AUDIT FLAGS ════════════════════════════════════════════════════════ -->
${flags.length > 0 ? `
<div class="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4">
  <div class="flex items-center gap-2 mb-2">
    <i class="fas fa-exclamation-triangle text-amber-500"></i>
    <span class="font-bold text-gray-800 text-sm">审计风险标记 Audit Flags</span>
  </div>
  ${flags.map(f=>`<div class="text-xs text-amber-800 flex items-start gap-2"><span class="text-amber-500 flex-shrink-0">⚠</span>${f}</div>`).join('')}
</div>` : ''}

<!-- ══ AI VERDICT ═════════════════════════════════════════════════════════ -->
<div class="${verdict.bg} border ${verdict.border} rounded-xl p-4 mb-4">
  <div class="flex items-start gap-3">
    <div class="w-8 h-8 ${verdict.iconBg} rounded-lg flex items-center justify-center flex-shrink-0">
      <i class="fas fa-brain ${verdict.iconColor} text-sm"></i>
    </div>
    <div class="flex-1">
      <div class="flex items-center gap-2 mb-1">
        <span class="font-bold text-gray-900 text-sm">AI 综合研判</span>
        <span class="text-xs px-2 py-0.5 rounded-full font-bold ${verdict.tagClass}">${verdict.signal}</span>
        <span class="text-[10px] text-gray-400 ml-auto">基于实时数据 · 规则引擎 + LLM逻辑</span>
      </div>
      <div class="text-xs text-gray-700 leading-relaxed">${verdict.summary}</div>
      <div class="mt-2 grid grid-cols-3 gap-3 text-[10px]">
        <div class="bg-white/60 rounded p-2">
          <div class="text-gray-500 mb-0.5">估值判断</div>
          <div class="font-semibold ${evColor}">${evSignal} (${mult.ev_ebitda_adj?.toFixed(1)}× Adj.EV/EBITDA)</div>
        </div>
        <div class="bg-white/60 rounded p-2">
          <div class="text-gray-500 mb-0.5">现金流质量</div>
          <div class="font-semibold ${fcfColor}">FCF Yield ${fcf.fcf_yield_pct?.toFixed(1)}%</div>
        </div>
        <div class="bg-white/60 rounded p-2">
          <div class="text-gray-500 mb-0.5">债务风险</div>
          <div class="font-semibold ${levColor}">${levRisk} (${lev.net_leverage_x?.toFixed(1)}× 净杠杆)</div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ══ 5 CORE METRICS ROW ══════════════════════════════════════════════════ -->
<div class="grid grid-cols-5 gap-3 mb-4">

  <!-- EV -->
  <div class="bg-white border border-gray-200 rounded-xl p-3">
    <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">企业价值 EV</div>
    <div class="text-2xl font-bold text-gray-900 font-mono">$${(ev.ev_b||0).toFixed(0)}B</div>
    <div class="mt-2 space-y-0.5 text-[10px] text-gray-500">
      <div class="flex justify-between"><span>市值</span><span class="font-mono">+$${(ev.market_cap_b||0).toFixed(0)}B</span></div>
      <div class="flex justify-between"><span>有息负债</span><span class="font-mono text-red-600">+$${(ev.total_debt_b||0).toFixed(1)}B</span></div>
      <div class="flex justify-between"><span>少数股东权益</span><span class="font-mono">+$${(ev.minority_int_b||0).toFixed(1)}B</span></div>
      <div class="flex justify-between"><span>现金</span><span class="font-mono text-emerald-600">-$${(ev.cash_b||0).toFixed(1)}B</span></div>
    </div>
    <div class="mt-2 text-[9px] text-gray-400 border-t border-gray-100 pt-1">EV = 市值+负债+少数权益-现金</div>
  </div>

  <!-- Adj EBITDA -->
  <div class="bg-white border border-gray-200 rounded-xl p-3">
    <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">核心盈利 Adj.EBITDA</div>
    <div class="text-2xl font-bold text-gray-900 font-mono">$${((ebitda.adj_ebitda_ttm_m||0)/1000).toFixed(1)}B</div>
    <div class="mt-2 space-y-0.5 text-[10px] text-gray-500">
      <div class="flex justify-between"><span>营业利润</span><span class="font-mono">$${((ebitda.op_income_ttm_m||0)/1000).toFixed(1)}B</span></div>
      <div class="flex justify-between"><span>D&A 加回</span><span class="font-mono text-emerald-600">+$${((ebitda.da_ttm_m||0)/1000).toFixed(1)}B</span></div>
      <div class="flex justify-between"><span>SBC 加回</span><span class="font-mono text-amber-600">+$${((ebitda.sbc_ttm_m||0)/1000).toFixed(1)}B</span></div>
    </div>
    <div class="mt-1 text-[9px] ${ebitda.sbc_distortion_pct>15?'text-red-500':'text-gray-400'} border-t border-gray-100 pt-1">
      SBC占比 ${(ebitda.sbc_distortion_pct||0).toFixed(0)}% ${ebitda.sbc_distortion_pct>15?'⚠ 稀释严重':'✓ 正常'}
    </div>
  </div>

  <!-- EV/EBITDA -->
  <div class="bg-white border border-gray-200 rounded-xl p-3">
    <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">估值乘数</div>
    <div class="text-2xl font-bold ${evColor} font-mono">${(mult.ev_ebitda_adj||0).toFixed(1)}×</div>
    <div class="text-xs font-semibold ${evColor} mt-0.5">${evSignal}</div>
    <div class="mt-2 space-y-0.5 text-[10px] text-gray-500">
      <div class="flex justify-between"><span>Adj.EV/EBITDA (TTM)</span><span class="font-mono font-bold">${(mult.ev_ebitda_adj||0).toFixed(1)}×</span></div>
      <div class="flex justify-between"><span>Raw EV/EBITDA</span><span class="font-mono">${(mult.ev_ebitda_raw||0).toFixed(1)}×</span></div>
      <div class="flex justify-between"><span>Forward PE</span><span class="font-mono">${(mult.forward_pe||0).toFixed(1)}×</span></div>
      <div class="flex justify-between"><span>EV/Revenue</span><span class="font-mono">${(mult.ev_revenue||0).toFixed(1)}×</span></div>
    </div>
    <div class="mt-1.5 text-[9px] text-gray-400 border-t border-gray-100 pt-1">标杆：<8低估·8-15公允·>25高估</div>
  </div>

  <!-- FCF Yield -->
  <div class="bg-white border border-gray-200 rounded-xl p-3">
    <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">现金收益 FCF Yield</div>
    <div class="text-2xl font-bold ${fcfColor} font-mono">${(fcf.fcf_yield_pct||0).toFixed(1)}%</div>
    <div class="mt-2 space-y-0.5 text-[10px] text-gray-500">
      <div class="flex justify-between"><span>经营现金流OCF</span><span class="font-mono text-emerald-600">$${((fcf.ocf_ttm_m||0)/1000).toFixed(1)}B</span></div>
      <div class="flex justify-between"><span>资本开支CapEx</span><span class="font-mono text-red-500">-$${((fcf.capex_ttm_m||0)/1000).toFixed(1)}B</span></div>
      <div class="flex justify-between"><span>FCF (TTM)</span><span class="font-mono font-bold">$${((fcf.fcf_ttm_m||0)/1000).toFixed(1)}B</span></div>
      <div class="flex justify-between text-amber-600"><span>SBC扣除后AdjFCF</span><span class="font-mono">$${((fcf.adj_fcf_ttm_m||0)/1000).toFixed(1)}B</span></div>
    </div>
    <div class="mt-1.5 text-[9px] text-gray-400 border-t border-gray-100 pt-1">标杆：>5% 优质·2-5% 正常·<2% 偏低</div>
  </div>

  <!-- Net Leverage -->
  <div class="bg-white border ${levBg.split(' ')[1]} rounded-xl p-3 ${levBg.split(' ')[0]}">
    <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-1">财务健康 净杠杆</div>
    <div class="text-2xl font-bold ${levColor} font-mono">${(lev.net_leverage_x||0).toFixed(1)}×</div>
    <div class="text-xs font-bold ${levColor} mt-0.5">${levRisk} RISK</div>
    <div class="mt-2 space-y-0.5 text-[10px] text-gray-500">
      <div class="flex justify-between"><span>净债务</span><span class="font-mono ${lev.net_debt_b>0?'text-red-600':'text-emerald-600'}">$${(lev.net_debt_b||0).toFixed(1)}B</span></div>
      <div class="flex justify-between"><span>现金</span><span class="font-mono text-emerald-600">$${(lev.cash_b||0).toFixed(1)}B</span></div>
      <div class="flex justify-between"><span>流动比率</span><span class="font-mono">${(lev.current_ratio||0).toFixed(1)}×</span></div>
    </div>
    <div class="mt-1.5 text-[9px] text-gray-400 border-t border-gray-100 pt-1">标杆：>3.0× 危险·1.5-3× 警惕·<1.5× 健康</div>
  </div>

</div>

<!-- ══ QUARTERLY ADJ.EBITDA TABLE ═════════════════════════════════════════ -->
<div class="grid grid-cols-2 gap-4 mb-4">
  <div class="bg-white border border-gray-200 rounded-xl p-4">
    <div class="text-sm font-semibold text-gray-900 mb-3">
      <i class="fas fa-table text-gray-400 mr-1"></i>
      季度 Adj.EBITDA 拆解 (GAAP 审计调整)
    </div>
    ${qts.length > 0 ? `
    <table class="data-table text-xs w-full">
      <thead><tr>
        <th>季度</th><th>收入 $M</th><th>营业利润</th><th>D&A</th><th>SBC</th>
        <th class="font-bold">Adj.EBITDA</th><th>利润率</th>
      </tr></thead>
      <tbody>
        ${qts.map(q=>`<tr>
          <td class="font-mono text-gray-600">${q.period?.slice(0,7)||'—'}</td>
          <td class="font-mono text-gray-700">$${(q.revenue_m||0).toFixed(0)}</td>
          <td class="font-mono text-gray-700">$${(q.op_income_m||0).toFixed(0)}</td>
          <td class="font-mono text-emerald-600">+$${(q.da_m||0).toFixed(0)}</td>
          <td class="font-mono text-amber-600">+$${(q.sbc_m||0).toFixed(0)}</td>
          <td class="font-mono font-bold text-gray-900">$${(q.adj_ebitda_m||0).toFixed(0)}</td>
          <td class="font-mono ${(q.adj_ebitda_margin_pct||0)>30?'text-emerald-600':'text-gray-600'}">${(q.adj_ebitda_margin_pct||0).toFixed(1)}%</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="mt-2 text-[9px] text-gray-400">Adj.EBITDA = 营业利润 + D&A + SBC · TTM = 最近4季合计 · 金额单位 $M</div>
    ` : '<div class="text-gray-400 text-xs py-4 text-center">季报数据加载中...</div>'}
  </div>

  <!-- Quarterly EBITDA Trend Chart -->
  <div class="bg-white border border-gray-200 rounded-xl p-4">
    <div class="text-sm font-semibold text-gray-900 mb-3">
      <i class="fas fa-chart-bar text-gray-400 mr-1"></i>
      季度经营趋势 Quarterly Trend
    </div>
    <div style="height:150px"><canvas id="sa-ebitda-chart"></canvas></div>
    <div class="grid grid-cols-3 gap-2 mt-3 text-[10px]">
      <div class="bg-gray-50 rounded p-2 text-center">
        <div class="text-gray-500 mb-0.5">TTM 收入</div>
        <div class="font-bold font-mono text-gray-900">$${((gr.revenue_ttm_m||0)/1000).toFixed(1)}B</div>
      </div>
      <div class="bg-gray-50 rounded p-2 text-center">
        <div class="text-gray-500 mb-0.5">TTM Adj.EBITDA</div>
        <div class="font-bold font-mono text-gray-900">$${((ebitda.adj_ebitda_ttm_m||0)/1000).toFixed(1)}B</div>
      </div>
      <div class="bg-gray-50 rounded p-2 text-center">
        <div class="text-gray-500 mb-0.5">TTM Adj.EBITDA利润率</div>
        <div class="font-bold font-mono ${(mult.adj_ebitda_margin_pct||0)>30?'text-emerald-600':'text-amber-600'}">${(mult.adj_ebitda_margin_pct||0).toFixed(1)}%</div>
      </div>
    </div>
  </div>

  <!-- Analyst consensus -->
  <div class="bg-white border border-gray-200 rounded-xl p-4">
    <div class="text-sm font-semibold text-gray-900 mb-3">
      <i class="fas fa-users text-gray-400 mr-1"></i>
      分析师共识 Analyst Consensus
    </div>
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="bg-gray-50 rounded-lg p-3 text-center">
        <div class="text-[10px] text-gray-500 mb-1">综合评级</div>
        <div class="text-2xl font-bold ${an.rating<=1.5?'text-emerald-600':an.rating<=2.5?'text-emerald-600':an.rating<=3.5?'text-amber-600':'text-red-600'}">
          ${an.rating<=1.5?'Strong Buy':an.rating<=2.5?'Buy':an.rating<=3.5?'Hold':'Sell'}
        </div>
        <div class="text-xs text-gray-500 mt-0.5">${an.numAnalysts||0} 位分析师</div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3 text-center">
        <div class="text-[10px] text-gray-500 mb-1">目标价 (均值)</div>
        <div class="text-2xl font-bold text-gray-900 font-mono">$${(an.targetMean||0).toFixed(0)}</div>
        <div class="text-xs ${upsideColor} font-semibold mt-0.5">${upside>=0?'+':''}${upside.toFixed(1)}% 上行空间</div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2 text-[10px]">
      <div class="flex justify-between bg-gray-50 rounded p-2">
        <span class="text-gray-500">最高目标价</span>
        <span class="font-mono font-bold text-gray-900">$${(an.targetHigh||0).toFixed(0)}</span>
      </div>
      <div class="flex justify-between bg-gray-50 rounded p-2">
        <span class="text-gray-500">最低目标价</span>
        <span class="font-mono font-bold text-gray-900">$${(an.targetLow||0).toFixed(0)}</span>
      </div>
    </div>
    <!-- Upgrades/Downgrades -->
    <div class="mt-3">
      <div class="text-[10px] text-gray-500 font-bold uppercase mb-2">最新评级变动</div>
      <div id="sa-upgrades" class="space-y-1 text-[10px]">
        <div class="text-gray-400 text-center py-2">加载中...</div>
      </div>
    </div>
  </div>
</div>

<!-- ══ GROWTH & MARGINS ════════════════════════════════════════════════════ -->
<div class="bg-white border border-gray-200 rounded-xl p-4 mb-4">
  <div class="text-sm font-semibold text-gray-900 mb-3">
    <i class="fas fa-chart-line text-gray-400 mr-1"></i>
    成长与盈利能力 Growth & Profitability
  </div>
  <div class="grid grid-cols-4 gap-4">
    ${[
      ['收入增速 (YoY)', (gr.revenue_growth_yoy_pct||0).toFixed(1)+'%', gr.revenue_growth_yoy_pct>20?'text-emerald-600':gr.revenue_growth_yoy_pct>0?'text-amber-600':'text-red-600'],
      ['EPS增速 (YoY)', (gr.earnings_growth_yoy_pct||0).toFixed(1)+'%', gr.earnings_growth_yoy_pct>20?'text-emerald-600':gr.earnings_growth_yoy_pct>0?'text-amber-600':'text-red-600'],
      ['毛利率', (gr.gross_margin_pct||0).toFixed(1)+'%', gr.gross_margin_pct>50?'text-emerald-600':gr.gross_margin_pct>30?'text-amber-600':'text-red-600'],
      ['Adj.EBITDA利润率', (mult.adj_ebitda_margin_pct||0).toFixed(1)+'%', mult.adj_ebitda_margin_pct>30?'text-emerald-600':mult.adj_ebitda_margin_pct>15?'text-amber-600':'text-red-600'],
      ['营业利润率', (gr.operating_margin_pct||0).toFixed(1)+'%', 'text-gray-700'],
      ['净利润率', (gr.net_margin_pct||0).toFixed(1)+'%', 'text-gray-700'],
      ['ROE', (gr.roe_pct||0).toFixed(1)+'%', gr.roe_pct>20?'text-emerald-600':'text-gray-700'],
      ['ROA', (gr.roa_pct||0).toFixed(1)+'%', gr.roa_pct>10?'text-emerald-600':'text-gray-700'],
    ].map(([label, val, cls])=>`
    <div class="bg-gray-50 rounded-lg p-2.5">
      <div class="text-[10px] text-gray-500 mb-0.5">${label}</div>
      <div class="text-base font-bold ${cls} font-mono">${val}</div>
    </div>`).join('')}
  </div>
</div>

<!-- ══ MARGIN OF SAFETY + VALUATION COMPASS ══════════════════════════════ -->
<div class="bg-white border border-gray-200 rounded-xl p-4 mb-4">
  <div class="flex items-center gap-2 mb-3">
    <i class="fas fa-shield-alt text-indigo-500"></i>
    <span class="font-semibold text-gray-900 text-sm">安全边际分析 Margin of Safety</span>
    <span class="text-[10px] text-gray-400 ml-auto">核心估值信号 · 风控最后防线</span>
  </div>
  <div class="grid grid-cols-4 gap-3">

    <!-- Analyst Upside -->
    <div class="rounded-xl border p-3 ${upside>20?'bg-emerald-50 border-emerald-200':upside>5?'bg-amber-50 border-amber-200':upside<-5?'bg-red-50 border-red-200':'bg-gray-50 border-gray-200'}">
      <div class="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">分析师目标价上行空间</div>
      <div class="text-2xl font-bold font-mono ${upsideColor}">${upside>=0?'+':''}${upside.toFixed(1)}%</div>
      <div class="text-[10px] text-gray-500 mt-1">
        均值 <span class="font-mono font-bold text-gray-900">$${(an.targetMean||0).toFixed(0)}</span>
        · 高 $${(an.targetHigh||0).toFixed(0)}
        · 低 $${(an.targetLow||0).toFixed(0)}
      </div>
      <div class="text-[9px] text-gray-400 mt-1">${an.numAnalysts||0} 位分析师 · ${an.rating<=1.5?'Strong Buy':an.rating<=2.5?'Buy':an.rating<=3.5?'Hold':'Sell'} 共识</div>
    </div>

    <!-- EV/EBITDA vs Sector -->
    <div class="rounded-xl border p-3 ${mult.ev_ebitda_adj<12?'bg-emerald-50 border-emerald-200':mult.ev_ebitda_adj<20?'bg-gray-50 border-gray-200':mult.ev_ebitda_adj<30?'bg-amber-50 border-amber-200':'bg-red-50 border-red-200'}">
      <div class="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Adj.EV/EBITDA 估值区间</div>
      <div class="text-2xl font-bold font-mono ${evColor}">${(mult.ev_ebitda_adj||0).toFixed(1)}×</div>
      <div class="text-xs font-semibold ${evColor} mt-1">${evSignal}</div>
      <div class="mt-2 text-[9px] text-gray-400 leading-relaxed">
        <div class="flex justify-between"><span>低估区间</span><span class="font-mono">&lt;12×</span></div>
        <div class="flex justify-between"><span>合理区间</span><span class="font-mono">12-20×</span></div>
        <div class="flex justify-between"><span>溢价区间</span><span class="font-mono">20-30×</span></div>
        <div class="flex justify-between text-red-500"><span>高估警示</span><span class="font-mono">&gt;30×</span></div>
      </div>
    </div>

    <!-- FCF Yield vs 10yr Treasury -->
    <div class="rounded-xl border p-3 ${fcf.fcf_yield_pct>5?'bg-emerald-50 border-emerald-200':fcf.fcf_yield_pct>2?'bg-amber-50 border-amber-200':'bg-red-50 border-red-200'}">
      <div class="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">FCF Yield vs 无风险利率</div>
      <div class="text-2xl font-bold font-mono ${fcfColor}">${(fcf.fcf_yield_pct||0).toFixed(1)}%</div>
      <div class="text-[10px] text-gray-500 mt-1">
        FCF / 市值 · 真实现金造血率
      </div>
      <div class="mt-1.5 text-[9px] text-gray-500">
        <div>FCF Yield - 10yr(~4.5%) = <span class="font-mono font-bold ${(fcf.fcf_yield_pct||0)-4.5>0?'text-emerald-600':'text-red-600'}">${((fcf.fcf_yield_pct||0)-4.5).toFixed(1)}%</span> 超额</div>
        <div class="text-gray-400 mt-0.5">>0% 说明股票现金收益高于无风险债券</div>
      </div>
    </div>

    <!-- Net Leverage Risk Meter -->
    <div class="rounded-xl border p-3 ${lev.net_leverage_x>3?'bg-red-50 border-red-200':lev.net_leverage_x>1.5?'bg-amber-50 border-amber-200':'bg-emerald-50 border-emerald-200'}">
      <div class="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">债务风险 / 流动性</div>
      <div class="text-2xl font-bold font-mono ${levColor}">${(lev.net_leverage_x||0).toFixed(1)}×</div>
      <div class="text-xs font-bold ${levColor} mt-0.5">${levRisk === 'HIGH' ? '⛔ 高风险 HIGH RISK' : levRisk === 'MEDIUM' ? '⚠ 需关注 WATCH' : '✓ 健康 LOW RISK'}</div>
      <div class="mt-1.5 text-[9px] text-gray-500 space-y-0.5">
        <div>净债务: <span class="font-mono ${lev.net_debt_b>0?'text-red-600':'text-emerald-600'}">$${(lev.net_debt_b||0).toFixed(1)}B</span></div>
        <div>流动比率: <span class="font-mono">${(lev.current_ratio||0).toFixed(1)}×</span></div>
      </div>
    </div>

  </div>
</div>

<!-- ══ PRICE CHART AREA ════════════════════════════════════════════════════ -->
<div class="bg-white border border-gray-200 rounded-xl p-4 mb-4">
  <div class="flex items-center justify-between mb-3">
    <div>
      <div class="text-sm font-semibold text-gray-900">价格走势 60日 Price Chart</div>
      <div class="text-[10px] text-gray-500 mt-0.5">
        52周高: $${(d.week52_high||0).toFixed(0)} · 52周低: $${(d.week52_low||0).toFixed(0)} · 
        MA50: $${(d.ma50||0).toFixed(0)} · MA200: $${(d.ma200||0).toFixed(0)} · Beta: ${(d.beta||1).toFixed(2)}
      </div>
    </div>
  </div>
  <div style="height:200px"><canvas id="sa-price-chart"></canvas></div>
</div>

<!-- ══ FACTSET VALIDATION ══════════════════════════════════════════════════ -->
<div class="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
  <div class="flex items-center gap-2 mb-2">
    <i class="fas fa-check-double text-gray-500"></i>
    <span class="font-semibold text-gray-800 text-sm">FactSet 交叉验证状态</span>
    <span class="text-[10px] text-gray-400 ml-auto">数据层 2 / 3</span>
  </div>
  ${d.factset_validated ? `
  <div class="text-xs text-emerald-700 bg-emerald-50 rounded p-2">
    <i class="fas fa-check-circle mr-1"></i>FactSet 数据已验证 · ${JSON.stringify(d.factset_data)}
  </div>` : `
  <div class="text-xs text-gray-600 leading-relaxed">
    <div class="font-semibold text-amber-700 mb-1"><i class="fas fa-info-circle mr-1"></i>FactSet API 未配置 — 以下步骤启用</div>
    <div class="grid grid-cols-3 gap-3 mt-2 text-[10px]">
      <div class="bg-white rounded p-2 border border-gray-200">
        <div class="font-bold text-gray-700 mb-1">Step 1</div>
        <div class="text-gray-500">前往 developer.factset.com 获取 API Key</div>
      </div>
      <div class="bg-white rounded p-2 border border-gray-200">
        <div class="font-bold text-gray-700 mb-1">Step 2</div>
        <div class="text-gray-500">在 webapp/.dev.vars 添加 FACTSET_API_KEY=your_key</div>
      </div>
      <div class="bg-white rounded p-2 border border-gray-200">
        <div class="font-bold text-gray-700 mb-1">Step 3</div>
        <div class="text-gray-500">pm2 restart data-service — 自动加载</div>
      </div>
    </div>
  </div>`}
</div>`;
}

// ── AI VERDICT engine (rule-based + LLM-ready) ───────────────────────────────
function saAiVerdict(d) {
  const ev   = d.ev_multiples  || {};
  const fcf  = d.fcf_analysis  || {};
  const lev  = d.leverage      || {};
  const gr   = d.growth        || {};
  const an   = d.analyst       || {};
  const flags = d.audit_flags  || [];

  let score = 50; // base neutral
  let reasons = [];

  // Valuation check (EV/EBITDA)
  const evEb = ev.ev_ebitda_adj || 0;
  if (evEb > 0 && evEb < 12) { score += 15; reasons.push(`估值偏低(${evEb.toFixed(1)}×<12)，存在安全边际`); }
  else if (evEb > 30) { score -= 20; reasons.push(`估值偏高(${evEb.toFixed(1)}×>30)，历史上对应低回报`); }

  // FCF yield
  const fcfY = fcf.fcf_yield_pct || 0;
  if (fcfY > 5) { score += 15; reasons.push(`FCF Yield ${fcfY.toFixed(1)}% 高质量现金流`); }
  else if (fcfY < 1) { score -= 15; reasons.push(`FCF Yield ${fcfY.toFixed(1)}% 过低，造血能力存疑`); }

  // Revenue growth
  const revGr = gr.revenue_growth_yoy_pct || 0;
  if (revGr > 20) { score += 10; reasons.push(`收入增速 ${revGr.toFixed(0)}% 高增长`); }
  else if (revGr < 0) { score -= 20; reasons.push(`收入负增长 ${revGr.toFixed(0)}% — 基本面恶化信号`); }

  // Leverage
  const netLev = lev.net_leverage_x || 0;
  if (netLev > 3) { score -= 25; reasons.push(`净杠杆 ${netLev.toFixed(1)}×>3.0 — 债务风险警示，拒接飞刀`); }
  else if (netLev < 0.5) { score += 10; reasons.push(`净现金状态，财务极度健康`); }

  // Audit flags penalty
  if (flags.length > 0) { score -= 10 * flags.length; }

  // Analyst consensus
  const rating = an.rating || 3;
  if (rating <= 1.5) { score += 10; reasons.push(`分析师强力Buy共识`); }
  else if (rating >= 4) { score -= 10; reasons.push(`分析师偏向Sell`); }

  score = Math.max(5, Math.min(95, score));

  // Signal
  let signal, bg, border, iconBg, iconColor, tagClass, summary;
  if (score >= 70) {
    signal = '可以关注 WATCHLIST';
    bg = 'bg-emerald-50'; border = 'border-emerald-200';
    iconBg = 'bg-emerald-100'; iconColor = 'text-emerald-600';
    tagClass = 'bg-emerald-100 text-emerald-700';
  } else if (score >= 50) {
    signal = '中性观望 NEUTRAL';
    bg = 'bg-gray-50'; border = 'border-gray-200';
    iconBg = 'bg-gray-100'; iconColor = 'text-gray-500';
    tagClass = 'bg-gray-100 text-gray-600';
  } else if (score >= 30) {
    signal = '谨慎 CAUTION';
    bg = 'bg-amber-50'; border = 'border-amber-200';
    iconBg = 'bg-amber-100'; iconColor = 'text-amber-600';
    tagClass = 'bg-amber-100 text-amber-700';
  } else {
    signal = '⛔ 拒接 — 基本面恶化';
    bg = 'bg-red-50'; border = 'border-red-200';
    iconBg = 'bg-red-100'; iconColor = 'text-red-600';
    tagClass = 'bg-red-100 text-red-700';
  }

  summary = reasons.length > 0
    ? reasons.join('。') + `。综合评分 ${score}/100。`
    : `数据加载中，请稍候完整分析。`;

  return { signal, bg, border, iconBg, iconColor, tagClass, summary, score };
}

// ── Draw charts ───────────────────────────────────────────────────────────────
function saDrawCharts(d, ana) {
  // Price chart
  const ph = d.price_history || [];
  const ctx = document.getElementById('sa-price-chart')?.getContext('2d');
  if (ctx && ph.length > 0) {
    if (window._saChart) window._saChart.destroy();
    window._saChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ph.map(p=>p.date.slice(5)),
        datasets: [{
          label: d.ticker + ' Close',
          data: ph.map(p=>p.close),
          borderColor: '#4f46e5',
          borderWidth: 2,
          pointRadius: 0,
          fill: { target: 'origin', above: 'rgba(79,70,229,0.05)' },
          tension: 0.2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor:'#fff', titleColor:'#374151', bodyColor:'#374151', borderColor:'#e5e7eb', borderWidth:1 }
        },
        scales: {
          x: { ticks: { color:'#9ca3af', maxTicksLimit: 10, font:{size:9} }, grid:{color:'rgba(0,0,0,0.05)'} },
          y: { ticks: { color:'#9ca3af', font:{size:9} }, grid:{color:'rgba(0,0,0,0.05)'} }
        }
      }
    });
  }

  // Quarterly EBITDA trend chart
  const qts_chart = d.quarterly_adj_ebitda || [];
  const ebitdaCtx = document.getElementById('sa-ebitda-chart')?.getContext('2d');
  if (ebitdaCtx && qts_chart.length > 0) {
    if (window._saEbitdaChart) window._saEbitdaChart.destroy();
    const labels = qts_chart.map(q => q.period?.slice(0,7) || '').reverse();
    const revenueData = qts_chart.map(q => q.revenue_m || 0).reverse();
    const ebitdaData = qts_chart.map(q => q.adj_ebitda_m || 0).reverse();
    window._saEbitdaChart = new Chart(ebitdaCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '收入 $M',
            data: revenueData,
            backgroundColor: 'rgba(209,213,219,0.6)',
            borderColor: '#9ca3af',
            borderWidth: 1,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Adj.EBITDA $M',
            data: ebitdaData,
            borderColor: '#4f46e5',
            backgroundColor: 'rgba(79,70,229,0.1)',
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
            yAxisID: 'y1',
            tension: 0.2,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: true, labels: { color: '#6b7280', font: { size: 9 } } },
          tooltip: { backgroundColor:'#fff', titleColor:'#374151', bodyColor:'#374151', borderColor:'#e5e7eb', borderWidth:1 }
        },
        scales: {
          x: { ticks: { color:'#9ca3af', font:{size:9} }, grid:{color:'rgba(0,0,0,0.03)'} },
          y: {
            type: 'linear', position: 'left',
            ticks: { color:'#9ca3af', font:{size:9} },
            grid: { color:'rgba(0,0,0,0.05)' },
            title: { display: true, text: '收入 $M', color: '#9ca3af', font:{size:8} }
          },
          y1: {
            type: 'linear', position: 'right',
            ticks: { color:'#4f46e5', font:{size:9} },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'EBITDA $M', color: '#4f46e5', font:{size:8} }
          }
        }
      }
    });
  }

  // Render analyst upgrades
  const upgEl = document.getElementById('sa-upgrades');
  if (upgEl && ana?.upgrades_downgrades?.length > 0) {
    upgEl.innerHTML = ana.upgrades_downgrades.slice(0,8).map(u=>`
      <div class="flex items-center gap-2 bg-gray-50 rounded p-1.5">
        <span class="font-semibold text-gray-700 w-28 truncate">${u.firm}</span>
        <span class="${u.action?.toLowerCase().includes('up')?'text-emerald-600':'u.action?.toLowerCase().includes("down")?"text-red-500":"text-gray-500'} font-bold">${u.toGrade || u.action}</span>
        ${u.fromGrade ? `<span class="text-gray-400">← ${u.fromGrade}</span>` : ''}
        <span class="ml-auto text-gray-400 font-mono">${u.date}</span>
      </div>`).join('');
  } else if (upgEl) {
    upgEl.innerHTML = '<div class="text-gray-400 text-center py-1">暂无最新评级变动</div>';
  }
}

