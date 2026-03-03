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
    case 'newsagent':   await renderNewsAgent(container); break
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
// ║  1. DASHBOARD  — Institutional Market Monitor                        ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderDashboard(el) {
  el.innerHTML = `<div class="flex items-center justify-center h-32 text-gray-400">
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
    const sigColor = s => s==='panic'||s==='distress'||s==='overvalued' ? YF.red
                        : s==='warning'||s==='elevated'                 ? YF.amber
                        : s==='undervalued'||s==='attractive'           ? YF.green : YF.muted;
    const sigBorder= s => s==='panic'||s==='distress'||s==='overvalued' ? 'border-red-500/50'
                        : s==='warning'||s==='elevated'                 ? 'border-yellow-500/40'
                        : s==='undervalued'||s==='attractive'           ? 'border-green-500/40'
                        : 'border-[#2d2d3d]';
    const pill = (s,l) => {
      const map = {
        panic:'#ff1744',distress:'#ff1744',overvalued:'#ff1744',
        warning:'#ffab00',elevated:'#ffab00',
        undervalued:'#00c853',attractive:'#00c853',
        normal:'#555568',neutral:'#555568'
      };
      const c = map[s]||'#555568';
      return `<span style="background:${c}22;color:${c};border:1px solid ${c}55" class="text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide uppercase">${l||s}</span>`;
    };

    // ── Yahoo Finance colour tokens ────────────────────────────────────
    const YF = { green:'#00c853', red:'#ff1744', amber:'#ffab00', blue:'#448aff', cyan:'#00b0ff', muted:'#8a8a9a' };
    const panicColor = m.panicScore>=60?YF.red:m.panicScore>=30?YF.amber:YF.green;
    const vixTSSig   = m.vixContango ? 'normal' : 'panic';
    const hyLabel    = m.hyOas>800?'Distress':m.hyOas>500?'Elevated':m.hyOas>400?'Caution':'Tight';
    const hyColor    = m.hyOas>800?YF.red:m.hyOas>500?YF.amber:'#00c853';
    const brdColor   = m.pctAbove200ma<15?YF.red:m.pctAbove200ma<30?YF.amber:'#00c853';
    const pcColor    = m.putCallRatio>1.5?YF.red:m.putCallRatio>1.1?YF.amber:'#00c853';
    const erpColor   = e.erp<1?YF.red:e.erp<2.5?YF.amber:'#00c853';
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
<div class="mb-5 flex items-center justify-between flex-wrap gap-3">
  <div>
    <h2 class="text-xl font-bold text-white flex items-center gap-2">
      <i class="fas fa-satellite-dish" style="color:var(--cyan)"></i>
      总控台 · 机构市场监控
      <span class="text-xs font-normal ml-1" style="color:var(--yf-muted)">${m.date}</span>
    </h2>
    <p style="color:var(--yf-muted)" class="text-xs mt-0.5">点击任意卡片展开详情 · 图表链接至数据源 · Click card to expand · Charts link to source</p>
  </div>
  <!-- panic gauge -->
  <div class="flex items-center gap-3 rounded-xl px-4 py-2" style="background:#1a1a2e;border:1px solid #2d2d3d">
    <div class="relative w-12 h-12">
      <svg viewBox="0 0 36 36" class="w-12 h-12 -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#2d2d3d" stroke-width="4"/>
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="${panicColor}" stroke-width="4"
          stroke-dasharray="${m.panicScore} ${100-m.panicScore}" stroke-linecap="round"/>
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-xs font-bold" style="color:${panicColor}">${m.panicScore}</span>
      </div>
    </div>
    <div>
      <div class="text-xs uppercase tracking-wide" style="color:var(--yf-muted)">恐慌指数</div>
      <div class="text-sm font-bold" style="color:${panicColor}">${m.panicLabel}</div>
    </div>
  </div>
</div>

<!-- ── SECTION A: SENTIMENT & LIQUIDITY ─────────────────────────────── -->
<div class="mb-2 flex items-center gap-2">
  <div class="w-0.5 h-4 bg-red-500 rounded"></div>
  <span class="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Sentiment & Liquidity</span>
</div>
<div class="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-1">

  <!-- VIX card -->
  <div class="cursor-pointer rounded-xl p-3 transition-colors" style="background:#1a1a2e;border:1px solid #2d2d3d" onclick="window._dashToggle('sub-vix')">
    <div class="flex items-start justify-between mb-2">
      <span class="text-[10px] uppercase font-semibold leading-tight" style="color:var(--yf-muted)">VIX 期限结构<br>Term Structure</span>
      ${pill(vixTSSig)}
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold text-white">${m.vix.toFixed(1)}</span>
      <span class="text-xs text-gray-500">spot</span>
    </div>
    <div class="text-xs mt-1 ${m.vixContango?'text-emerald-400':'text-red-400'} font-medium">
      ${m.vixContango ? '↗ Contango — 市场平静' : '↘ Backwardation ⚠ 恐慌信号'}
    </div>
    <div class="text-[10px] mt-1" style="color:var(--yf-dim)">VX1 ${m.vx1.toFixed(1)} · VX3 ${m.vx3.toFixed(1)}</div>
    <div class="flex items-center gap-2 mt-1.5"><a href="https://finance.yahoo.com/quote/%5EVIX/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt text-[9px]"></i>^VIX</a><span class="text-[9px]" style="color:var(--yf-dim)">点击展开 ↓</span></div>
  </div>

  <!-- HY OAS card -->
  <div class="cursor-pointer rounded-xl p-3 transition-colors" style="background:#1a1a2e;border:1px solid #2d2d3d" onclick="window._dashToggle('sub-hy')">
    <div class="flex items-start justify-between mb-2">
      <span class="text-[10px] uppercase font-semibold leading-tight" style="color:var(--yf-muted)">HY信用利差<br>HY OAS</span>
      ${pill(m.hyOasSignal, hyLabel)}
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold" style="color:${hyColor}">${m.hyOas}</span>
      <span class="text-xs text-gray-500">bps</span>
    </div>
    <div class="h-1.5 rounded-full mt-2 mb-1" style="background:#2d2d3d">
      <div class="h-1.5 rounded-full" style="width:${Math.min(m.hyOas/12,100)}%;background:${hyColor}"></div>
    </div>
    <div class="text-[10px] mt-1" style="color:var(--yf-dim)">FRED BAMLH0A0HYM2 · 崩溃 >800</div>
    <div class="flex items-center gap-2 mt-1"><a href="https://fred.stlouisfed.org/series/BAMLH0A0HYM2" target="_blank" class="yf-link"><i class="fas fa-external-link-alt text-[9px]"></i>FRED</a><span class="text-[9px]" style="color:var(--yf-dim)">点击展开 ↓</span></div>
  </div>

  <!-- Breadth card -->
  <div class="cursor-pointer rounded-xl p-3 transition-colors" style="background:#1a1a2e;border:1px solid #2d2d3d" onclick="window._dashToggle('sub-breadth')">
    <div class="flex items-start justify-between mb-2">
      <span class="text-[10px] uppercase font-semibold leading-tight" style="color:var(--yf-muted)">市场宽度<br>Breadth</span>
      ${pill(m.breadthSignal)}
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold" style="color:${brdColor}">${m.pctAbove200ma.toFixed(1)}</span>
      <span class="text-xs text-gray-500">% >200DMA</span>
    </div>
    <div class="h-1.5 rounded-full mt-2 mb-1" style="background:#2d2d3d">
      <div class="h-1.5 rounded-full" style="width:${m.pctAbove200ma}%;background:${brdColor}"></div>
    </div>
    <div class="text-[10px] mt-1" style="color:var(--yf-dim)">S5TH200X · 恐慌 <15%</div>
    <div class="flex items-center gap-2 mt-1"><a href="https://stockcharts.com/h-sc/ui?s=%24SPXA200R" target="_blank" class="yf-link"><i class="fas fa-external-link-alt text-[9px]"></i>Chart</a><span class="text-[9px]" style="color:var(--yf-dim)">点击展开 ↓</span></div>
  </div>

  <!-- Put/Call card -->
  <div class="cursor-pointer rounded-xl p-3 transition-colors" style="background:#1a1a2e;border:1px solid #2d2d3d" onclick="window._dashToggle('sub-pc')">
    <div class="flex items-start justify-between mb-2">
      <span class="text-[10px] uppercase font-semibold leading-tight" style="color:var(--yf-muted)">CBOE期权<br>Put/Call</span>
      ${pill(m.putCallSignal)}
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold" style="color:${pcColor}">${m.putCallRatio.toFixed(2)}</span>
      <span class="text-xs text-gray-500">×</span>
    </div>
    <div class="grid grid-cols-3 gap-0.5 mt-2 text-[10px] text-center">
      <div class="rounded py-0.5" style="${m.putCallRatio<0.8?'background:rgba(0,200,83,0.2);color:#00c853':'background:#2d2d3d;color:#555568'}">贪婪 &lt;0.8</div>
      <div class="rounded py-0.5" style="${m.putCallRatio>=0.8&&m.putCallRatio<1.1?'background:#3d3d50;color:#e8e8e8':'background:#2d2d3d;color:#555568'}">0.8–1.1</div>
      <div class="rounded py-0.5" style="${m.putCallRatio>=1.1?'background:rgba(255,23,68,0.2);color:#ff5370':'background:#2d2d3d;color:#555568'}">恐慌 &gt;1.1</div>
    </div>
    <div class="flex items-center gap-2 mt-1.5"><a href="https://www.cboe.com/us/options/market_statistics/daily/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt text-[9px]"></i>CBOE</a><span class="text-[9px]" style="color:var(--yf-dim)">点击展开 ↓</span></div>
  </div>
</div>

<!-- sub-module: VIX -->
<div id="sub-vix" style="display:none" class="mb-3 bg-gray-900/60 border border-gray-700/60 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <span class="text-xs font-bold text-gray-300 uppercase">VIX Term Structure — 60-Day Detail</span>
    <button onclick="window._dashToggle('sub-vix')" class="text-gray-600 hover:text-gray-300 text-xs">✕ close</button>
  </div>
  <div class="grid grid-cols-3 gap-3 mb-3">
    ${[['Spot VIX', m.vix.toFixed(1), 'Yahoo Finance'], ['VX1 (1M Future)', m.vx1.toFixed(1), 'CBOE VX Futures'], ['VX3 (3M Future)', m.vx3.toFixed(1), 'CBOE VX Futures']].map(([l,v,s])=>`
    <div class="bg-gray-800/60 rounded-lg p-3 text-center">
      <div class="text-xs text-gray-500">${l}</div>
      <div class="text-xl font-bold text-white mt-1">${v}</div>
      <div class="text-[10px] text-gray-600 mt-0.5">${s}</div>
    </div>`).join('')}
  </div>
  <div class="grid grid-cols-2 gap-3 mb-3">
    <div class="bg-gray-800/40 rounded-lg p-3">
      <div class="text-[10px] text-gray-500 mb-1">Term Slope (VX1−Spot)/Spot</div>
      <div class="text-lg font-bold ${m.vixContango?'text-emerald-400':'text-red-400'}">${(m.vixTermStructure*100).toFixed(1)}%</div>
      <div class="text-[10px] ${m.vixContango?'text-emerald-500':'text-red-500'} mt-0.5">${m.vixContango?'Contango — market calm':'Backwardation — PANIC signal'}</div>
    </div>
    <div class="bg-gray-800/40 rounded-lg p-3">
      <div class="text-[10px] text-gray-500 mb-1">Panic Trigger</div>
      <div class="text-xs text-gray-300 leading-relaxed">VIX &gt; VX1 = backwardation.<br>Investors pay premium for near-term protection over long-term → extreme fear of imminent crash.</div>
    </div>
  </div>
  <canvas id="sub-vix-chart" height="90"></canvas>
</div>

<!-- sub-module: HY OAS -->
<div id="sub-hy" style="display:none" class="mb-3 bg-gray-900/60 border border-gray-700/60 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <span class="text-xs font-bold text-gray-300 uppercase">HY Credit Spread — 60-Day Detail</span>
    <button onclick="window._dashToggle('sub-hy')" class="text-gray-600 hover:text-gray-300 text-xs">✕ close</button>
  </div>
  <div class="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
    ${[['Current OAS', m.hyOas+' bps', hyColor], ['Signal', hyLabel, hyColor],
       ['Caution Level', '400 bps', '#f59e0b'], ['Distress Level', '800 bps', '#ef4444']].map(([l,v,c])=>`
    <div class="bg-gray-800/60 rounded-lg p-2">
      <div class="text-gray-500 text-[10px]">${l}</div>
      <div class="font-bold mt-0.5" style="color:${c}">${v}</div>
    </div>`).join('')}
  </div>
  <div class="mb-3 text-xs text-gray-400 bg-gray-800/40 rounded-lg p-3 leading-relaxed">
    <b class="text-gray-200">Reading:</b> OAS below 400 bps with falling markets = liquidity storm (investors refuse to sell risk even at distressed prices). OAS above 800 bps = genuine credit distress, default cycle begins. Current ${m.hyOas} bps = <b style="color:${hyColor}">${hyLabel}</b>.
  </div>
  <canvas id="sub-hy-chart" height="90"></canvas>
</div>

<!-- sub-module: Breadth -->
<div id="sub-breadth" style="display:none" class="mb-3 bg-gray-900/60 border border-gray-700/60 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <span class="text-xs font-bold text-gray-300 uppercase">Market Breadth (S5TH200) — 60-Day Detail</span>
    <button onclick="window._dashToggle('sub-breadth')" class="text-gray-600 hover:text-gray-300 text-xs">✕ close</button>
  </div>
  <div class="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
    ${[['Current', m.pctAbove200ma.toFixed(1)+'%', brdColor], ['Panic Zone', '<15%', '#ef4444'], ['Warning Zone', '<30%', '#f59e0b']].map(([l,v,c])=>`
    <div class="bg-gray-800/60 rounded-lg p-2">
      <div class="text-gray-500 text-[10px]">${l}</div>
      <div class="font-bold mt-0.5" style="color:${c}">${v}</div>
    </div>`).join('')}
  </div>
  <div class="mb-3 text-xs text-gray-400 bg-gray-800/40 rounded-lg p-3 leading-relaxed">
    <b class="text-gray-200">Reading:</b> % of S&P 500 stocks trading above their 200-day SMA. Below 15% historically marks major market bottoms (COVID Mar 2020: 3%, GFC 2009: 2%). Above 70% = healthy uptrend, below 30% = broad deterioration even if index holds near highs.
  </div>
  <canvas id="sub-brd-chart" height="90"></canvas>
</div>

<!-- sub-module: Put/Call -->
<div id="sub-pc" style="display:none" class="mb-3 bg-gray-900/60 border border-gray-700/60 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <span class="text-xs font-bold text-gray-300 uppercase">CBOE Put/Call Ratio — Interpretation</span>
    <button onclick="window._dashToggle('sub-pc')" class="text-gray-600 hover:text-gray-300 text-xs">✕ close</button>
  </div>
  <div class="grid grid-cols-3 gap-2 mb-3 text-xs text-center">
    ${[['<0.7 — Complacency','Contrarian bearish\nMarket overconfident','bg-emerald-900/40 border-emerald-600/30'],
       ['0.7–1.1 — Neutral','Normal hedging activity\nNo extreme signal','bg-gray-800/60 border-gray-600/30'],
       ['>1.1 — Fear Zone','Contrarian bullish\nBuy-the-Dip opportunity','bg-red-900/30 border-red-600/30']].map(([t,d,c])=>`
    <div class="border rounded-lg p-2 ${c} ${m.putCallRatio<0.7&&t.startsWith('<')?'ring-1 ring-white/30':m.putCallRatio>=0.7&&m.putCallRatio<1.1&&t.startsWith('0')?'ring-1 ring-white/30':m.putCallRatio>=1.1&&t.startsWith('>')? 'ring-1 ring-white/30':''}">
      <div class="font-bold text-gray-200 mb-1">${t}</div>
      <div class="text-gray-400 text-[10px]">${d}</div>
    </div>`).join('')}
  </div>
  <div class="text-xs text-gray-400 bg-gray-800/40 rounded-lg p-3">
    Current: <b style="color:${pcColor}">${m.putCallRatio.toFixed(2)}×</b> — ${m.putCallRatio>=1.1?'Elevated fear → contrarian buy signal forming':m.putCallRatio<0.7?'Complacency → contrarian caution':'Normal hedging, no extreme signal'}. CBOE Equity Put/Call only (excludes index options for cleaner sentiment read).
  </div>
</div>

<!-- ── SECTION B: VALUATION ──────────────────────────────────────────── -->
<div class="mb-2 mt-4 flex items-center gap-2">
  <div class="w-0.5 h-4 rounded" style="background:var(--amber)"></div>
  <span class="text-[11px] font-bold uppercase tracking-widest" style="color:var(--yf-muted)">绝对估值 · Valuation</span>
</div>
<div class="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-1">

  <!-- ERP card -->
  <div class="cursor-pointer rounded-xl p-3 transition-colors" style="background:#1a1a2e;border:1px solid #2d2d3d" onclick="window._dashToggle('sub-erp')">
    <div class="flex items-start justify-between mb-2">
      <span class="text-[10px] uppercase font-semibold leading-tight" style="color:var(--yf-muted)">股权风险溢价<br>Equity Risk Premium</span>
      ${pill(erpSig)}
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold" style="color:${erpColor}">${e.erp.toFixed(2)}</span>
      <span class="text-xs text-gray-500">%</span>
    </div>
    <div class="text-[10px] mt-1" style="color:var(--yf-dim)">盈利收益率 ${e.sp500EarningsYield.toFixed(2)}% − 10Y ${e.usTreasury10y.toFixed(2)}%</div>
    <div class="flex items-center gap-2 mt-1"><a href="https://fred.stlouisfed.org/series/DGS10" target="_blank" class="yf-link"><i class="fas fa-external-link-alt text-[9px]"></i>FRED</a><span class="text-[9px]" style="color:var(--yf-dim)">${e.erpHistoricalPercentile}th pctile · 展开 ↓</span></div>
  </div>

  <!-- Rates card -->
  <div class="cursor-pointer rounded-xl p-3 transition-colors" style="background:#1a1a2e;border:1px solid #2d2d3d" onclick="window._dashToggle('sub-rates')">
    <div class="flex items-start justify-between mb-2">
      <span class="text-[10px] uppercase font-semibold leading-tight" style="color:var(--yf-muted)">美债利率<br>US Rates</span>
      ${pill(m.yieldCurveInverted?'warning':'normal', m.yieldCurveInverted?'Inverted':'Normal')}
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold ${m.usTreasury10y>5?'text-red-400':'text-white'}">${m.usTreasury10y.toFixed(2)}</span>
      <span class="text-xs text-gray-500">% 10Y</span>
    </div>
    <div class="text-[10px] text-gray-500 mt-1">2Y ${m.usTreasury2y.toFixed(2)}% · Spread ${m.yieldCurve>0?'+':''}${m.yieldCurve} bps</div>
    <div class="text-[10px] text-gray-600 mt-0.5">tap to expand ↓</div>
  </div>

  <!-- SPX valuation card -->
  <div class="cursor-pointer rounded-xl p-3 transition-colors" style="background:#1a1a2e;border:1px solid rgba(255,171,0,0.3)" onclick="window._dashToggle('sub-signals')">
    <div class="flex items-start justify-between mb-2">
      <span class="text-[10px] uppercase font-semibold leading-tight" style="color:var(--yf-muted)">标普500估值<br>SPX Valuation</span>
      ${pill('warning', 'Rich')}
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold text-yellow-400">21.8</span>
      <span class="text-xs text-gray-500">× fwd P/E</span>
    </div>
    <div class="text-[10px] mt-1" style="color:var(--yf-dim)">vs 10年均值 17-18× · 历史高位</div>
    <div class="flex items-center gap-2 mt-1"><a href="https://finance.yahoo.com/quote/%5EGSPC/" target="_blank" class="yf-link"><i class="fas fa-external-link-alt text-[9px]"></i>^GSPC</a><span class="text-[9px]" style="color:var(--yf-dim)">展开 ↓</span></div>
  </div>

  <!-- Composite score card -->
  <div class="rounded-xl p-3" style="background:#1a1a2e;border:1px solid #2d2d3d">
    <div class="text-[10px] uppercase font-semibold mb-2" style="color:var(--yf-muted)">综合市场状态 · Regime</div>
    <div class="text-2xl font-bold text-blue-400">${m.panicScore < 20 ? 'RISK-ON' : m.panicScore < 50 ? 'NEUTRAL' : 'RISK-OFF'}</div>
    <div class="text-[10px] text-gray-500 mt-1">Panic ${m.panicScore} · ERP ${e.erp.toFixed(2)}%</div>
    <div class="mt-2 space-y-1">
      ${[['Sentiment', 100-m.panicScore, '#60a5fa'],['Valuation', Math.max(0,Math.min(100,e.erp*20)), '#facc15'],['Breadth', m.pctAbove200ma, '#34d399']].map(([l,v,c])=>`
      <div class="flex items-center gap-1.5 text-[10px]">
        <span class="text-gray-600 w-16">${l}</span>
        <div class="flex-1 h-1 bg-gray-700 rounded-full">
          <div class="h-1 rounded-full" style="width:${v}%;background:${c}"></div>
        </div>
        <span class="text-gray-500 w-6 text-right">${Math.round(v)}</span>
      </div>`).join('')}
    </div>
  </div>
</div>

<!-- sub-module: ERP -->
<div id="sub-erp" style="display:none" class="mb-3 bg-gray-900/60 border border-gray-700/60 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <span class="text-xs font-bold text-gray-300 uppercase">Equity Risk Premium — Detail</span>
    <button onclick="window._dashToggle('sub-erp')" class="text-gray-600 hover:text-gray-300 text-xs">✕ close</button>
  </div>
  <div class="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
    ${[['ERP', e.erp.toFixed(2)+'%', erpColor], ['Earn Yield', e.sp500EarningsYield.toFixed(2)+'%', '#d1d5db'],
       ['10Y Tsy', e.usTreasury10y.toFixed(2)+'%', '#d1d5db'], ['Hist Pctile', e.erpHistoricalPercentile+'th', erpColor]].map(([l,v,c])=>`
    <div class="bg-gray-800/60 rounded-lg p-2">
      <div class="text-gray-500 text-[10px]">${l}</div>
      <div class="font-bold mt-0.5" style="color:${c}">${v}</div>
    </div>`).join('')}
  </div>
  <div class="grid grid-cols-3 gap-1 mb-3 text-xs text-center">
    ${[['<1%','Overvalued','bg-red-900/40 border-red-500/40'],['1–3%','Fair Value','bg-gray-800 border-gray-600/40'],['>3%','Attractive','bg-emerald-900/40 border-emerald-500/40']].map(([r,l,c])=>`
    <div class="border ${c} rounded-lg p-2 ${(r==='<1%'&&e.erp<1)||(r==='1–3%'&&e.erp>=1&&e.erp<3)||(r==='>3%'&&e.erp>=3)?'ring-1 ring-white/20':''}">
      <div class="font-bold text-gray-200">${r}</div><div class="text-gray-400 text-[10px]">${l}</div>
    </div>`).join('')}
  </div>
  <div class="text-xs text-gray-400 bg-gray-800/40 rounded-lg p-3 mb-3 leading-relaxed">${e.erpNote}</div>
  <canvas id="sub-erp-chart" height="90"></canvas>
</div>

<!-- sub-module: Rates -->
<div id="sub-rates" style="display:none" class="mb-3 bg-gray-900/60 border border-gray-700/60 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <span class="text-xs font-bold text-gray-300 uppercase">US Treasury Rates & Yield Curve</span>
    <button onclick="window._dashToggle('sub-rates')" class="text-gray-600 hover:text-gray-300 text-xs">✕ close</button>
  </div>
  <div class="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
    ${[['Fed Funds','5.25–5.50%','#d1d5db'],['2Y Tsy',m.usTreasury2y.toFixed(2)+'%',m.usTreasury2y>5?'#ef4444':'#d1d5db'],
       ['10Y Tsy',m.usTreasury10y.toFixed(2)+'%',m.usTreasury10y>5?'#ef4444':'#d1d5db'],['10Y−2Y',(m.yieldCurve>0?'+':'')+m.yieldCurve+' bps',m.yieldCurveInverted?'#f59e0b':'#10b981']].map(([l,v,c])=>`
    <div class="bg-gray-800/60 rounded-lg p-2">
      <div class="text-gray-500 text-[10px]">${l}</div>
      <div class="font-bold mt-0.5" style="color:${c}">${v}</div>
    </div>`).join('')}
  </div>
  <div class="text-xs text-gray-400 bg-gray-800/40 rounded-lg p-3 leading-relaxed">
    <b class="text-gray-200">Yield curve ${m.yieldCurveInverted?'INVERTED':'normal'}.</b> ${m.yieldCurveInverted?'10Y−2Y inversion has preceded every US recession since 1970. Current inversion reduces discount rates for long-duration growth stocks, but signals higher probability of earnings recession in 6–18 months.':'Positively sloped curve. Growth expectations intact; no imminent recession signal from bond market.'} FRED sources: DGS10, DGS2.
  </div>
</div>

<!-- sub-module: Composite Signals table -->
<div id="sub-signals" style="display:none" class="mb-3 bg-gray-900/60 border border-gray-700/60 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <span class="text-xs font-bold text-gray-300 uppercase">Composite Signal Summary — All Indicators</span>
    <button onclick="window._dashToggle('sub-signals')" class="text-gray-600 hover:text-gray-300 text-xs">✕ close</button>
  </div>
  <div class="overflow-x-auto">
  <table class="w-full text-xs">
    <thead><tr class="border-b border-gray-700/50 text-[10px] text-gray-500 uppercase">
      <th class="py-1.5 px-3 text-left">Indicator</th>
      <th class="py-1.5 px-3 text-right">Value</th>
      <th class="py-1.5 px-3 text-center">Signal</th>
      <th class="py-1.5 px-3 text-left hidden md:table-cell">Threshold</th>
      <th class="py-1.5 px-3 text-left hidden md:table-cell">Source</th>
    </tr></thead>
    <tbody class="divide-y divide-gray-700/30">
    ${[
      ['VIX Spot', m.vix.toFixed(1), vixTSSig, 'Backwardation = Panic', 'Yahoo Finance'],
      ['VIX Term Slope', (m.vixTermStructure*100).toFixed(1)+'%', vixTSSig, '<0 = contango (calm)', 'VX Futures'],
      ['HY OAS', m.hyOas+' bps', m.hyOasSignal, '>400 caution · >800 distress', 'FRED BAMLH0A0HYM2'],
      ['Market Breadth', m.pctAbove200ma.toFixed(1)+'%', m.breadthSignal, '<15% panic · <30% warn', 'S5TH200X'],
      ['Put/Call Ratio', m.putCallRatio.toFixed(2)+'×', m.putCallSignal, '>1.1 fear · >1.5 extreme', 'CBOE Equity'],
      ['10Y−2Y Spread', (m.yieldCurve>0?'+':'')+m.yieldCurve+' bps', m.yieldCurveInverted?'warning':'normal', 'Inversion = recession watch', 'FRED DGS10/DGS2'],
      ['ERP', e.erp.toFixed(2)+'%', erpSig, '<1% overvalued · <1.5% caution', 'Fwd P/E − 10Y'],
      ['ERP Pctile', e.erpHistoricalPercentile+'th', erpSig, 'Bottom 10% = bubble', 'Historical'],
      ['SPX Fwd P/E', '21.8×', 'warning', '>20× historically expensive', 'FactSet consensus'],
    ].map(([ind,val,sig,note,src])=>`
    <tr class="hover:bg-gray-800/40">
      <td class="py-1.5 px-3 text-gray-300">${ind}</td>
      <td class="py-1.5 px-3 text-right font-mono font-bold" style="color:${sigColor(sig)}">${val}</td>
      <td class="py-1.5 px-3 text-center">
        <span class="${{panic:'bg-red-500',distress:'bg-red-500',overvalued:'bg-red-500',warning:'bg-yellow-500',elevated:'bg-yellow-500',undervalued:'bg-emerald-500',normal:'bg-gray-600',neutral:'bg-gray-600'}[sig]||'bg-gray-600'} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">${sig}</span>
      </td>
      <td class="py-1.5 px-3 text-gray-600 hidden md:table-cell">${note}</td>
      <td class="py-1.5 px-3 text-gray-700 hidden md:table-cell">${src}</td>
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
            { data: macH.map(d=>d.vix),  borderColor:'#60a5fa', label:'VIX Spot' },
            { data: macH.map(d=>d.vx1),  borderColor:'#a78bfa', label:'VX1', borderDash:[3,2] }
          ], labels: macH.map(d=>d.date) },
          'sub-hy':     { canvasId:'sub-hy-chart',   datasets:[
            { data: macH.map(d=>d.hyOas), borderColor: hyColor, label:'HY OAS (bps)' }
          ], labels: macH.map(d=>d.date), refLines:[{y:400,color:'#f59e0b',label:'Caution'},{y:800,color:'#ef4444',label:'Distress'}] },
          'sub-breadth':{ canvasId:'sub-brd-chart',  datasets:[
            { data: macH.map(d=>d.pctAbove200ma), borderColor: brdColor, label:'% >200DMA' }
          ], labels: macH.map(d=>d.date), refLines:[{y:15,color:'#ef4444',label:'Panic'},{y:30,color:'#f59e0b',label:'Warn'}] },
          'sub-erp':    { canvasId:'sub-erp-chart',  datasets:[
            { data: erpH.map(d=>d.erp), borderColor:'#facc15', label:'ERP %' }
          ], labels: erpH.map(d=>d.date), refLines:[{y:1,color:'#ef4444',label:'1% danger'}] }
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
            plugins: { legend: { labels: { color:'#9ca3af', font:{size:9}, boxWidth:12 } } },
            scales: {
              x: { display: false },
              y: { ticks:{color:'#6b7280',font:{size:9}}, grid:{color:'#1f2937'} }
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
      if (openSub === id || document.getElementById(id)?.style.display !== 'none') {
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
  el.innerHTML = `<div class="flex items-center justify-center h-32 text-gray-400">
    <i class="fas fa-spinner fa-spin mr-2"></i>Loading Data Center…</div>`;
  try {
    const [fundRes, erpRes, healthRes, macroRes] = await Promise.all([
      axios.get(`${API}/api/dc/fundamental`),
      axios.get(`${API}/api/dc/erp/current`),
      axios.get(`${API}/api/dc/health`),
      axios.get(`${API}/api/dc/macro/current`)
    ]);
    const stocks = fundRes.data.data || [];
    const e      = erpRes.data;
    const health = healthRes.data;
    const m      = macroRes.data;
    const srcs   = health.dataSources || [];

    // ══════════════════════════════════════════════════════════════════════
    // COLOUR HELPERS
    // ══════════════════════════════════════════════════════════════════════
    const evColor  = p => p<=10?'#10b981':p<=30?'#6ee7b7':p>=80?'#ef4444':'#d1d5db';
    const fcfColor = v => v>=6?'#10b981':v>=3?'#fbbf24':'#ef4444';
    const levColor = v => v>3?'#ef4444':v>2?'#f59e0b':'#10b981';

    const avgEv    = (stocks.reduce((a,s)=>a+s.evEbitda,0)/stocks.length).toFixed(1);
    const avgFcf   = (stocks.reduce((a,s)=>a+s.fcfYield,0)/stocks.length).toFixed(1);
    const erpColor = e.erp<1?'#ef4444':e.erp<2.5?'#f59e0b':'#10b981';

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
        btn.classList.toggle('ring-purple-500',active);
        btn.classList.toggle('bg-purple-900/20', active);
        btn.classList.toggle('border-purple-500/50', active);
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
          scales:{ x:{ticks:{color:'#9ca3af',font:{size:9}}}, y:{ticks:{color:'#9ca3af',font:{size:9}},grid:{color:'#1f2937'}} } }
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
          plugins:{legend:{labels:{color:'#9ca3af',font:{size:9},boxWidth:10}}},
          scales:{ x:{ticks:{color:'#9ca3af',font:{size:9}}},
            y:{ticks:{color:'#9ca3af',font:{size:9},callback:v=>v+'%'},grid:{color:'#1f2937'}} } }
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // BUILD HTML
    // ══════════════════════════════════════════════════════════════════════

    // ── Macro derived values for trend simulation ──────────────────────
    const vixSlope     = ((m.vix/m.vx1)-1)*100;
    const vixSlopeStr  = vixSlope>0?`+${vixSlope.toFixed(1)}% Backwardation 🚨`:`${vixSlope.toFixed(1)}% Contango ✓`;
    const hySignColor  = m.hyOas>800?'#ef4444':m.hyOas>400?'#f59e0b':'#10b981';
    const ycColor      = m.yieldCurve<0?'#ef4444':m.yieldCurve<50?'#f59e0b':'#10b981';
    const breadthColor = m.pctAbove200ma<15?'#ef4444':m.pctAbove200ma<40?'#f59e0b':'#10b981';
    const pcColor      = m.putCallRatio>1.2?'#ef4444':m.putCallRatio<0.7?'#f59e0b':'#10b981';

    el.innerHTML = `

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  HEADER                                                              -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div class="flex items-start justify-between mb-5">
  <div>
    <h2 class="text-xl font-bold text-white flex items-center gap-2">
      <i class="fas fa-database text-purple-400"></i>
      数据中心 Data Center
      <span class="text-[11px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">Institutional</span>
    </h2>
    <p class="text-gray-500 text-xs mt-0.5">
      机构级别底层数据中心 · GAAP-Adjusted · PIT-Compliant · 4 Data Layers
    </p>
  </div>
  <div class="text-right text-[10px] text-gray-500">
    <div>Updated: <span class="text-white">${m.date || '2026-03-03'}</span></div>
    <div class="mt-0.5">Sources: Bloomberg · FRED · CBOE · yfinance · SEC EDGAR</div>
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  KPI STRIP  (8 always-visible top-level metrics)                    -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div class="grid grid-cols-4 gap-2.5 mb-5">

  <!-- VIX Term Structure -->
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">波动率结构 / VIX Structure</span>
      <span class="text-[9px] bg-${m.vixContango?'emerald':'red'}-500/20 text-${m.vixContango?'emerald':'red'}-300 px-1.5 py-0.5 rounded-full">${m.vixContango?'Contango':'Backwardation'}</span>
    </div>
    <div class="flex items-end gap-3">
      <div class="text-2xl font-bold text-white">${m.vix}</div>
      <div class="text-xs text-gray-500 mb-0.5 leading-tight">VX1: <span class="text-gray-300">${m.vx1}</span><br>VX3: <span class="text-gray-300">${m.vx3}</span></div>
    </div>
    <div class="mt-1 text-[10px] ${m.vixContango?'text-emerald-400':'text-red-400'}">${vixSlopeStr}</div>
  </div>

  <!-- HY OAS -->
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">信用风险 / HY OAS</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background:${hySignColor}22;color:${hySignColor}">${m.hyOasSignal?.toUpperCase()||'—'}</span>
    </div>
    <div class="text-2xl font-bold" style="color:${hySignColor}">${m.hyOas}<span class="text-sm ml-1 font-normal text-gray-500">bps</span></div>
    <div class="mt-1 text-[10px] text-gray-500">FRED: BAMLH0A0HYM2 · &gt;400 Caution · &gt;800 Distress</div>
  </div>

  <!-- Yield Curve -->
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">利率环境 / Yield Curve</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background:${ycColor}22;color:${ycColor}">${m.yieldCurveInverted?'INVERTED':'Normal'}</span>
    </div>
    <div class="text-2xl font-bold" style="color:${ycColor}">${m.yieldCurve>0?'+':''}${m.yieldCurve}<span class="text-sm ml-1 font-normal text-gray-500">bps</span></div>
    <div class="mt-1 text-[10px] text-gray-500">10Y ${m.usTreasury10y}% − 2Y ${m.usTreasury2y}% · FRED: DGS10/DGS2</div>
  </div>

  <!-- Panic Score -->
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">恐慌分数 / Panic Score</span>
      <span class="text-[9px] bg-${m.panicScore<30?'emerald':m.panicScore<60?'amber':'red'}-500/20 text-${m.panicScore<30?'emerald':m.panicScore<60?'amber':'red'}-300 px-1.5 py-0.5 rounded-full">${m.panicLabel||'—'}</span>
    </div>
    <div class="text-2xl font-bold ${m.panicScore<30?'text-emerald-400':m.panicScore<60?'text-amber-400':'text-red-400'}">${m.panicScore}<span class="text-sm ml-1 font-normal text-gray-500">/100</span></div>
    <div class="w-full h-1.5 bg-[#1a2540] rounded-full mt-2 overflow-hidden">
      <div class="h-full rounded-full transition-all ${m.panicScore<30?'bg-emerald-500':m.panicScore<60?'bg-amber-500':'bg-red-500'}" style="width:${m.panicScore}%"></div>
    </div>
  </div>

  <!-- Market Breadth -->
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">市场宽度 / Breadth</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background:${breadthColor}22;color:${breadthColor}">${m.breadthSignal?.toUpperCase()||'—'}</span>
    </div>
    <div class="text-2xl font-bold" style="color:${breadthColor}">${m.pctAbove200ma?.toFixed(1)}<span class="text-sm ml-1 font-normal text-gray-500">%</span></div>
    <div class="mt-1 text-[10px] text-gray-500">S5TH200X · % SPX above 200DMA · &lt;15% = Panic</div>
  </div>

  <!-- Put/Call Ratio -->
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">衍生品情绪 / P/C Ratio</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background:${pcColor}22;color:${pcColor}">${m.putCallSignal?.toUpperCase()||'—'}</span>
    </div>
    <div class="text-2xl font-bold" style="color:${pcColor}">${m.putCallRatio?.toFixed(2)}</div>
    <div class="mt-1 text-[10px] text-gray-500">CBOE · &gt;1.2 Fear · &lt;0.7 Greed · &gt;1.5 Panic</div>
  </div>

  <!-- ERP -->
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">股权风险溢价 / ERP</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded-full" style="background:${erpColor}22;color:${erpColor}">${e.erpSignal?.toUpperCase()||'—'}</span>
    </div>
    <div class="text-2xl font-bold" style="color:${erpColor}">${e.erp?.toFixed(2)}<span class="text-sm ml-1 font-normal text-gray-500">%</span></div>
    <div class="mt-1 text-[10px] text-gray-500">Earnings Yield ${e.sp500EarningsYield?.toFixed(2)}% − 10Y ${e.usTreasury10y}%</div>
  </div>

  <!-- Avg EV/EBITDA -->
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider">基本面估值 / EV/EBITDA</span>
      <span class="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">${stocks.length} stocks</span>
    </div>
    <div class="text-2xl font-bold ${parseFloat(avgEv)>20?'text-red-400':'text-blue-400'}">${avgEv}<span class="text-sm ml-1 font-normal text-gray-500">×</span></div>
    <div class="mt-1 text-[10px] text-gray-500">Adj.EBITDA (SBC added back) · 10Y avg ~15×</div>
  </div>

</div>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  4 SECTION CARDS → click to expand sub-modules                      -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">

  <!-- Card 1: Macro Liquidity -->
  <div id="btn-dc-sub-macro"
       class="cursor-pointer bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-4 hover:border-purple-500/40 transition-all"
       onclick="window._dcToggle('dc-sub-macro')">
    <div class="flex items-center justify-between mb-2">
      <div class="w-8 h-8 bg-red-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
        <i class="fas fa-fire text-red-400 text-sm"></i>
      </div>
      <i class="fas fa-chevron-down text-gray-600 text-xs dc-chev transition-transform"></i>
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
       class="cursor-pointer bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-4 hover:border-purple-500/40 transition-all"
       onclick="window._dcToggle('dc-sub-pricevol')">
    <div class="flex items-center justify-between mb-2">
      <div class="w-8 h-8 bg-cyan-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
        <i class="fas fa-chart-area text-cyan-400 text-sm"></i>
      </div>
      <i class="fas fa-chevron-down text-gray-600 text-xs dc-chev transition-transform"></i>
    </div>
    <div class="text-sm font-bold text-white mb-0.5">量价数据 / Price·Volume</div>
    <div class="text-[10px] text-gray-500 mb-2">Adj Close · Volume Ratio · RSI14 · ATR14</div>
    <div class="flex gap-1 flex-wrap">
      <span class="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">Front-Adj ✓</span>
      <span class="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">Anti-Split ✓</span>
    </div>
  </div>

  <!-- Card 3: Fundamental Valuation -->
  <div id="btn-dc-sub-fundamental"
       class="cursor-pointer bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-4 hover:border-purple-500/40 transition-all"
       onclick="window._dcToggle('dc-sub-fundamental')">
    <div class="flex items-center justify-between mb-2">
      <div class="w-8 h-8 bg-emerald-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
        <i class="fas fa-table text-emerald-400 text-sm"></i>
      </div>
      <i class="fas fa-chevron-down text-gray-600 text-xs dc-chev transition-transform"></i>
    </div>
    <div class="text-sm font-bold text-white mb-0.5">基本面估值 / Fundamental</div>
    <div class="text-[10px] text-gray-500 mb-2">EV · Adj.EBITDA · EV/EBITDA · FCF Yield · Leverage</div>
    <div class="flex gap-1 flex-wrap">
      <span class="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full">SBC Add-Back ✓</span>
      <span class="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full">PIT ✓</span>
    </div>
  </div>

  <!-- Card 4: Data Pipeline -->
  <div id="btn-dc-sub-pipeline"
       class="cursor-pointer bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-4 hover:border-purple-500/40 transition-all"
       onclick="window._dcToggle('dc-sub-pipeline')">
    <div class="flex items-center justify-between mb-2">
      <div class="w-8 h-8 bg-purple-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
        <i class="fas fa-shield-alt text-purple-400 text-sm"></i>
      </div>
      <i class="fas fa-chevron-down text-gray-600 text-xs dc-chev transition-transform"></i>
    </div>
    <div class="text-sm font-bold text-white mb-0.5">数据工程 / Engineering</div>
    <div class="text-[10px] text-gray-500 mb-2">PIT · Survivorship · GAAP · Source Status</div>
    <div class="flex gap-1 flex-wrap">
      <span class="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full">✓ PIT</span>
      <span class="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">${srcs.length} Sources</span>
    </div>
  </div>

</div>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  SUB-MODULE 1: MACRO LIQUIDITY & SENTIMENT                          -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div id="dc-sub-macro" style="display:none" class="mb-3 bg-[#0d1221] border border-[#1e2d4a] rounded-xl overflow-hidden">
  <div class="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">
    <span class="text-sm font-bold text-white flex items-center gap-2">
      <i class="fas fa-fire text-red-400"></i>
      宏观流动性与情绪数据 — Macro Liquidity & Sentiment
      <span class="text-[10px] text-gray-500 font-normal">每日更新 · Daily Update</span>
    </span>
    <button onclick="window._dcToggle('dc-sub-macro')" class="text-gray-600 hover:text-gray-300 text-xs px-2 py-0.5 rounded border border-[#1e2d4a]">✕ close</button>
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
        <tr class="hover:bg-[#1a2540]/40">
          <td class="py-2.5 px-2">
            <div class="text-white font-semibold">波动率结构</div>
            <div class="text-[10px] text-gray-500">Volatility Structure</div>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-200">VIX 期限结构</div>
            <div class="text-[10px] text-gray-500 font-mono">VIX / VX1 − 1</div>
          </td>
          <td class="py-2.5 px-2 text-right">
            <div class="text-white font-mono font-bold">${m.vix} / ${m.vx1} / ${m.vx3}</div>
            <div class="text-[10px] ${m.vixContango?'text-emerald-400':'text-red-400'}">${vixSlopeStr}</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            ${trendDots(m.vix, m.vix*0.97, m.vix*0.92)}
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-300 text-[11px]">${m.vixContango?'Contango = 正常结构，市场无极度恐慌':'🚨 Backwardation = 现货 &gt; 期货，极度恐慌信号'}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">VIX &gt; VX1 = backwardation = panic signal</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            <span class="text-[10px] px-2 py-0.5 rounded-full ${m.vixContango?'bg-emerald-500/20 text-emerald-300':'bg-red-500/20 text-red-300'}">${m.vixContango?'Neutral / Can Deploy':'Reduce Risk'}</span>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-400 text-[10px]">Yahoo Finance</div>
            <div class="text-gray-600 text-[9px]">CBOE / ^VIX</div>
          </td>
        </tr>

        <!-- HY OAS -->
        <tr class="hover:bg-[#1a2540]/40">
          <td class="py-2.5 px-2">
            <div class="text-white font-semibold">信用风险</div>
            <div class="text-[10px] text-gray-500">Credit Risk</div>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-200">高收益债 OAS 利差</div>
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
            <div class="text-gray-300 text-[11px]">${m.hyOas<400?'正常信用环境 · Normal credit conditions':m.hyOas<800?'⚠ 信用压力上升 · Elevated credit stress':'🚨 Distress zone — liquidity crunch'}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">&lt;400 Normal · 400–800 Caution · &gt;800 Distress</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            <span class="text-[10px] px-2 py-0.5 rounded-full" style="background:${hySignColor}22;color:${hySignColor}">${m.hyOas<400?'Risk-On OK':m.hyOas<800?'Defensive Tilt':'Risk-Off'}</span>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-400 text-[10px]">FRED</div>
            <div class="text-gray-600 text-[9px] font-mono">BAMLH0A0HYM2</div>
          </td>
        </tr>

        <!-- Yield Curve -->
        <tr class="hover:bg-[#1a2540]/40">
          <td class="py-2.5 px-2">
            <div class="text-white font-semibold">利率环境</div>
            <div class="text-[10px] text-gray-500">Rate Environment</div>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-200">10Y − 2Y 国债利差</div>
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
            <div class="text-gray-300 text-[11px]">${m.yieldCurveInverted?'⚠ 倒挂 — 历史上预示衰退概率 &gt;70%':'正常陡峭 — 资金成本可预期，增长预期正常'}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">&lt;0bps = Inversion = recession signal</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            <span class="text-[10px] px-2 py-0.5 rounded-full" style="background:${ycColor}22;color:${ycColor}">${m.yieldCurveInverted?'Short Duration':'Normal'}</span>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-400 text-[10px]">FRED</div>
            <div class="text-gray-600 text-[9px] font-mono">DGS10 / DGS2</div>
          </td>
        </tr>

        <!-- Market Breadth -->
        <tr class="hover:bg-[#1a2540]/40">
          <td class="py-2.5 px-2">
            <div class="text-white font-semibold">市场宽度</div>
            <div class="text-[10px] text-gray-500">Market Breadth</div>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-200">200日均线以上占比</div>
            <div class="text-[10px] text-gray-500 font-mono">S5TH200X</div>
          </td>
          <td class="py-2.5 px-2 text-right">
            <div class="font-mono font-bold text-xl" style="color:${breadthColor}">${m.pctAbove200ma?.toFixed(1)}%</div>
            <div class="text-[10px]" style="color:${breadthColor}">${m.breadthSignal?.toUpperCase()}</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            ${trendDots(m.pctAbove200ma, m.pctAbove200ma-2, m.pctAbove200ma-8)}
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-300 text-[11px]">${m.pctAbove200ma<15?'🚨 极度恐慌区间 — 超跌反弹机会窗口':m.pctAbove200ma<40?'⚠ 市场走弱，选股难度加大':'市场健康 — 趋势性多头环境'}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">&lt;15% Panic · &lt;40% Weak · &gt;60% Healthy</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            <span class="text-[10px] px-2 py-0.5 rounded-full" style="background:${breadthColor}22;color:${breadthColor}">${m.pctAbove200ma<15?'BTD Entry':'Cautious'}</span>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-400 text-[10px]">Bloomberg</div>
            <div class="text-gray-600 text-[9px] font-mono">S5TH200X Index</div>
          </td>
        </tr>

        <!-- Put/Call -->
        <tr class="hover:bg-[#1a2540]/40">
          <td class="py-2.5 px-2">
            <div class="text-white font-semibold">衍生品情绪</div>
            <div class="text-[10px] text-gray-500">Options Sentiment</div>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-200">Put / Call Ratio</div>
            <div class="text-[10px] text-gray-500 font-mono">Put Vol / Call Vol</div>
          </td>
          <td class="py-2.5 px-2 text-right">
            <div class="font-mono font-bold text-xl" style="color:${pcColor}">${m.putCallRatio?.toFixed(2)}</div>
            <div class="text-[10px]" style="color:${pcColor}">${m.putCallSignal?.toUpperCase()}</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            ${trendDots(m.putCallRatio, m.putCallRatio*1.05, m.putCallRatio*1.12)}
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-300 text-[11px]">${m.putCallRatio<0.7?'⚠ 极度贪婪 — 看涨期权拥挤，对立指标警告':m.putCallRatio>1.2?'恐慌区间 — 对立指标看多':'中性情绪 — 无极端信号'}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">&lt;0.7 Greed · 0.7–1.0 Neutral · &gt;1.2 Fear</div>
          </td>
          <td class="py-2.5 px-2 text-center">
            <span class="text-[10px] px-2 py-0.5 rounded-full" style="background:${pcColor}22;color:${pcColor}">${m.putCallRatio>1.2?'Contrarian Buy':m.putCallRatio<0.7?'Trim / Wait':'Neutral'}</span>
          </td>
          <td class="py-2.5 px-2">
            <div class="text-gray-400 text-[10px]">CBOE</div>
            <div class="text-gray-600 text-[9px]">Daily P/C total</div>
          </td>
        </tr>

      </tbody>
    </table>

    <!-- Interpretation footer -->
    <div class="mt-4 grid grid-cols-3 gap-3">
      <div class="bg-emerald-900/15 border border-emerald-500/30 rounded-lg p-3">
        <div class="text-[10px] font-bold text-emerald-300 mb-1 uppercase">正常区间 / Normal</div>
        <div class="text-[10px] text-gray-400 leading-relaxed">VIX &lt;25, HY OAS &lt;400bps, Breadth &gt;50%, P/C 0.7–1.0, Yield Curve Positive → 正常持仓，可适度加仓</div>
      </div>
      <div class="bg-amber-900/15 border border-amber-500/30 rounded-lg p-3">
        <div class="text-[10px] font-bold text-amber-300 mb-1 uppercase">谨慎区间 / Caution</div>
        <div class="text-[10px] text-gray-400 leading-relaxed">VIX 25–35, HY OAS 400–800bps, Breadth 15–40% → 减仓高β敞口，增加现金缓冲，等待企稳</div>
      </div>
      <div class="bg-red-900/15 border border-red-500/30 rounded-lg p-3">
        <div class="text-[10px] font-bold text-red-300 mb-1 uppercase">恐慌区间 / Panic BTD Zone</div>
        <div class="text-[10px] text-gray-400 leading-relaxed">VIX &gt;40, HY OAS &gt;800bps, Breadth &lt;15%, P/C &gt;1.5 → 流动性挤兑，分批建仓错杀高质量资产</div>
      </div>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  SUB-MODULE 2: PRICE & VOLUME DATA                                  -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div id="dc-sub-pricevol" style="display:none" class="mb-3 bg-[#0d1221] border border-[#1e2d4a] rounded-xl overflow-hidden">
  <div class="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">
    <span class="text-sm font-bold text-white flex items-center gap-2">
      <i class="fas fa-chart-area text-cyan-400"></i>
      量价与交易数据 — Price & Volume (Trigger Layer)
      <span class="text-[10px] text-gray-500 font-normal">每日更新 · Daily</span>
    </span>
    <button onclick="window._dcToggle('dc-sub-pricevol')" class="text-gray-600 hover:text-gray-300 text-xs px-2 py-0.5 rounded border border-[#1e2d4a]">✕ close</button>
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
        <tr class="hover:bg-[#1a2540]/40">
          <td class="py-2.5 px-2"><div class="text-white font-semibold">价格基准</div><div class="text-[10px] text-gray-500">Price Basis</div></td>
          <td class="py-2.5 px-2"><div class="text-gray-200">前复权收盘价</div><div class="text-[10px] text-cyan-400 font-mono">Adj Close</div></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-400 max-w-xs">包含所有现金分红 (Dividends) 和拆合股 (Splits) 的历史调整价。用于计算MA、RSI、回报率等所有技术指标。</td>
          <td class="py-2.5 px-2 text-center"><span class="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">✓ PIT OK</span></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-400">计算RSI/MA/回撤的唯一合法基准 · 拆股不触发假信号</td>
          <td class="py-2.5 px-2"><div class="text-gray-400 text-[10px]">yfinance</div><div class="text-gray-600 text-[9px]">history(auto_adjust=True)</div></td>
        </tr>
        <tr class="hover:bg-[#1a2540]/40">
          <td class="py-2.5 px-2"><div class="text-white font-semibold">机构洗盘</div><div class="text-[10px] text-gray-500">Vol Anomaly</div></td>
          <td class="py-2.5 px-2"><div class="text-gray-200">异常放量倍数</div><div class="text-[10px] text-cyan-400 font-mono">Vol / Vol_SMA20</div></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-400 max-w-xs">当日成交量 / 过去20个交易日成交量SMA。需剔除四巫日 (Quadruple Witching) 的异常放量。</td>
          <td class="py-2.5 px-2 text-center"><span class="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Watch</span></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-400">&gt;2× = 机构参与 · 配合价格方向判断是洗盘还是出货 · 必须剔除四巫日噪音</td>
          <td class="py-2.5 px-2"><div class="text-gray-400 text-[10px]">yfinance</div><div class="text-gray-600 text-[9px]">Volume field</div></td>
        </tr>
        <tr class="hover:bg-[#1a2540]/40">
          <td class="py-2.5 px-2"><div class="text-white font-semibold">动量极值</div><div class="text-[10px] text-gray-500">Momentum</div></td>
          <td class="py-2.5 px-2"><div class="text-gray-200">相对强弱指数</div><div class="text-[10px] text-cyan-400 font-mono">RSI-14</div></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-400 max-w-xs">标准14日RSI算法。低于30 = 超卖 (oversold)，低于20 = 极端抛售 (panic selling)。必须使用Adj Close计算。</td>
          <td class="py-2.5 px-2 text-center"><span class="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">RSI &lt;30 = BTD</span></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-400">RSI &lt;30 = Buy the Dip 触发信号之一 · RSI &gt;70 = Overbought 减仓信号 · RSI &lt;20 = 极端抄底窗口</td>
          <td class="py-2.5 px-2"><div class="text-gray-400 text-[10px]">自行计算</div><div class="text-gray-600 text-[9px]">ta-lib / pandas</div></td>
        </tr>
        <tr class="hover:bg-[#1a2540]/40">
          <td class="py-2.5 px-2"><div class="text-white font-semibold">波动冲击</div><div class="text-[10px] text-gray-500">Volatility</div></td>
          <td class="py-2.5 px-2"><div class="text-gray-200">真实波幅</div><div class="text-[10px] text-cyan-400 font-mono">ATR-14</div></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-400 max-w-xs">过去14天 Average True Range。用于动态设置止损线 (Stop Loss = Entry − 2×ATR)，替代固定百分比止损。</td>
          <td class="py-2.5 px-2 text-center"><span class="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">Stop Sizing</span></td>
          <td class="py-2.5 px-2 text-[10px] text-gray-400">动态止损基准 · ATR扩大 = 高波动，加宽止损 / 减小仓位 · 替代固定%止损，避免被正常波幅震出</td>
          <td class="py-2.5 px-2"><div class="text-gray-400 text-[10px]">自行计算</div><div class="text-gray-600 text-[9px]">High/Low/Close</div></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  SUB-MODULE 3: FUNDAMENTAL VALUATION                                -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div id="dc-sub-fundamental" style="display:none" class="mb-3 bg-[#0d1221] border border-[#1e2d4a] rounded-xl overflow-hidden">
  <div class="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">
    <span class="text-sm font-bold text-white flex items-center gap-2">
      <i class="fas fa-table text-emerald-400"></i>
      基本面与绝对估值 — Fundamental Valuation
      <span class="text-[10px] text-gray-500 font-normal">季度/TTM · Quarterly</span>
    </span>
    <button onclick="window._dcToggle('dc-sub-fundamental')" class="text-gray-600 hover:text-gray-300 text-xs px-2 py-0.5 rounded border border-[#1e2d4a]">✕ close</button>
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
      <div class="text-xs font-bold text-gray-400 uppercase mb-2">取数方法论 / Extraction Methodology</div>
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
          <tr class="hover:bg-[#1a2540]/40">
            <td class="py-2 px-2"><div class="text-white text-[11px] font-medium">${dim.split('/')[0].trim()}</div><div class="text-[9px] text-gray-500">${dim.split('/')[1]?.trim()}</div></td>
            <td class="py-2 px-2 text-emerald-300 text-[11px] font-mono">${ind}</td>
            <td class="py-2 px-2 text-gray-400 text-[10px] max-w-xs leading-snug">${logic}</td>
            <td class="py-2 px-2 text-gray-400 text-[10px] leading-snug">${purpose}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Universe table -->
    <div class="text-xs font-bold text-gray-400 uppercase mb-2">估值全景表 / Universe Valuation Table</div>
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
          const sigCl = sig==='underval'?'bg-emerald-600 text-white':sig==='overval'?'bg-red-700 text-red-100':'bg-[#1a2540] text-gray-400'
          return `<tr class="hover:bg-[#1a2540]/60 ${s.evEbitdaPercentile<=15?'bg-emerald-900/8':''}">
            <td class="py-1.5 px-2 font-bold text-white">${flag}${s.ticker}</td>
            <td class="py-1.5 px-2 text-right text-gray-400 font-mono">$${s.marketCap}B</td>
            <td class="py-1.5 px-2 text-right text-gray-400 font-mono">$${s.ev?.toFixed(0)}B</td>
            <td class="py-1.5 px-2 text-right text-emerald-300 font-mono">$${s.adjustedEbitda?.toFixed(1)}B</td>
            <td class="py-1.5 px-2 text-right font-bold font-mono" style="color:${evColor(s.evEbitdaPercentile)}">${s.evEbitda.toFixed(1)}×</td>
            <td class="py-1.5 px-2 text-right text-[10px]" style="color:${evColor(s.evEbitdaPercentile)}">${s.evEbitdaPercentile}%</td>
            <td class="py-1.5 px-2 text-right text-gray-500 font-mono">${s.evSales.toFixed(1)}×</td>
            <td class="py-1.5 px-2 text-right text-gray-500 font-mono">${s.forwardPE.toFixed(0)}×</td>
            <td class="py-1.5 px-2 text-right font-semibold font-mono" style="color:${fcfColor(s.fcfYield)}">${s.fcfYield.toFixed(1)}%</td>
            <td class="py-1.5 px-2 text-right font-semibold font-mono" style="color:${levColor(s.netLeverage)}">${s.netLeverage.toFixed(1)}×</td>
            <td class="py-1.5 px-2 text-center text-[9px] ${s.pitCompliant?'text-emerald-400':'text-red-400'}">${s.pitCompliant?'✓':'⚠'}<div class="text-gray-600 text-[8px]">${s.lastReportDate}</div></td>
            <td class="py-1.5 px-2 text-center"><span class="${sigCl} text-[9px] font-bold px-1.5 py-0.5 rounded-full">${sig}</span></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="bg-[#0a0e1a] rounded-xl p-3">
        <div class="text-[10px] text-gray-500 uppercase font-semibold mb-2">EV/EBITDA 横向对比 (绿=低估 · 红=高估)</div>
        <canvas id="dc-eveb-chart" height="180"></canvas>
      </div>
      <div class="bg-[#0a0e1a] rounded-xl p-3">
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
            <span class="font-bold text-white">${s.ticker}</span>
            <span class="text-[10px] text-gray-500">${s.sector?.split('—')[0]?.trim()}</span>
          </div>
          <div class="grid grid-cols-3 text-[10px] text-center gap-1">
            <div><div class="text-emerald-400 font-bold font-mono">${s.evEbitda.toFixed(1)}×</div><div class="text-gray-600">EV/EBITDA</div></div>
            <div><div class="text-amber-400 font-bold font-mono">${s.fcfYield.toFixed(1)}%</div><div class="text-gray-600">FCF Yield</div></div>
            <div><div style="color:${levColor(s.netLeverage)}" class="font-bold font-mono">${s.netLeverage.toFixed(1)}×</div><div class="text-gray-600">Net Lev</div></div>
          </div>
          <div class="mt-2 text-[9px] text-gray-500 truncate">${s.adjustedEbitdaNote?.slice(0,60)}…</div>
        </div>`).join('')}
      </div>
    </div>`:''}
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--  SUB-MODULE 4: DATA PIPELINE & ENGINEERING SPECS                    -->
<!-- ════════════════════════════════════════════════════════════════════ -->
<div id="dc-sub-pipeline" style="display:none" class="mb-3 bg-[#0d1221] border border-[#1e2d4a] rounded-xl overflow-hidden">
  <div class="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">
    <span class="text-sm font-bold text-white flex items-center gap-2">
      <i class="fas fa-shield-alt text-purple-400"></i>
      数据工程规范 — Data Pipeline & Bias Safeguards
    </span>
    <button onclick="window._dcToggle('dc-sub-pipeline')" class="text-gray-600 hover:text-gray-300 text-xs px-2 py-0.5 rounded border border-[#1e2d4a]">✕ close</button>
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
        <div class="text-[10px] text-gray-300 leading-relaxed mb-2">
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
        <div class="text-[10px] text-gray-300 leading-relaxed mb-2">
          yfinance 仅返回当前500只成分股。回测10年必须维护包含<strong class="text-blue-300">已退市、被收购、破产</strong>股票的历史Ticker映射表。
        </div>
        <div class="text-[10px] text-gray-400 leading-relaxed">
          历史标普500成员: <span class="text-white font-bold">~1,847</span>只<br>
          当前宇宙: <span class="text-white font-bold">500</span>只<br>
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
          ]).map(r=>`<li class="text-[10px] text-gray-400 flex gap-1.5 leading-snug"><span class="text-purple-400 flex-shrink-0 mt-0.5">•</span>${r}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- Data Sources table -->
    <div class="text-xs font-bold text-gray-400 uppercase mb-2">数据源状态 / Source Status</div>
    <div class="space-y-1.5">
    ${srcs.map(s=>`
      <div class="flex items-center gap-3 bg-[#0a0e1a] border border-[#1e2d4a] rounded-lg p-2.5">
        <div class="w-2 h-2 rounded-full flex-shrink-0 ${s.status==='live'||s.status==='connected'?'bg-emerald-400 animate-pulse':s.status==='delayed'?'bg-amber-400':'bg-gray-600'}"></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-white">${s.name}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded-full ${s.status==='live'?'bg-emerald-800 text-emerald-200':s.status==='delayed'?'bg-amber-800 text-amber-200':'bg-gray-700 text-gray-400'}">${s.status}</span>
            ${s.latency?`<span class="text-[9px] text-gray-500 font-mono">latency: ${s.latency}</span>`:''}
          </div>
          <div class="flex gap-4 mt-0.5">
            ${s.apiCode?`<span class="text-[10px] text-cyan-400 font-mono">${s.apiCode}</span>`:''}
            ${s.updateFreq?`<span class="text-[10px] text-gray-500">${s.updateFreq}</span>`:''}
            ${s.compliance?`<span class="text-[10px] text-gray-600 truncate">${s.compliance}</span>`:''}
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
    <h2 class="text-xl font-bold text-white flex items-center gap-2">
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
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="text-[10px] text-gray-500 uppercase mb-1">Total Trades</div>
    <div class="text-2xl font-bold text-white">${stats.totalTrades}</div>
    <div class="text-[10px] text-gray-500 mt-0.5">
      <span class="text-emerald-400">${stats.buys} Buy</span> · <span class="text-red-400">${stats.sells} Sell</span>
    </div>
  </div>
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="text-[10px] text-gray-500 uppercase mb-1">Open Positions</div>
    <div class="text-2xl font-bold text-cyan-400">${positions.length}</div>
    <div class="text-[10px] text-gray-500 mt-0.5">${stats.uniqueTickers} unique tickers</div>
  </div>
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="text-[10px] text-gray-500 uppercase mb-1">Realized P&L</div>
    <div class="text-2xl font-bold ${stats.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">
      ${formatCcy(stats.realizedPnl)}
    </div>
    <div class="text-[10px] text-gray-500 mt-0.5">Commissions: $${stats.commissions.toFixed(2)}</div>
  </div>
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-3">
    <div class="text-[10px] text-gray-500 uppercase mb-1">Total Buy Notional</div>
    <div class="text-2xl font-bold text-white">$${(stats.totalBuyNotional/1000).toFixed(1)}K</div>
    <div class="text-[10px] text-gray-500 mt-0.5">Sell: $${(stats.totalSellNotional/1000).toFixed(1)}K</div>
  </div>
</div>

<!-- ════ TABS ══════════════════════════════════════════════════════════ -->
<div class="flex gap-1 mb-4">
  ${[['journal','📋 交易记录 Journal'],['positions','📊 持仓汇总 Positions'],['analytics','📈 分析 Analytics']].map(([id,label])=>`
  <button onclick="window._tradeTab='${id}'; window._tradeRender()"
    class="px-4 py-1.5 rounded-lg text-sm transition-all ${activeTab===id ? 'bg-cyan-600 text-white font-semibold' : 'bg-[#0d1221] border border-[#1e2d4a] text-gray-400 hover:text-white'}">
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
    <div class="w-16 h-16 bg-[#0d1221] border border-[#1e2d4a] rounded-2xl flex items-center justify-center mb-4">
      <i class="fas fa-exchange-alt text-gray-600 text-2xl"></i>
    </div>
    <div class="text-gray-400 font-semibold mb-1">No trades yet</div>
    <div class="text-gray-600 text-sm mb-4">Click "添加交易 Add Trade" to log your first entry</div>
    <button onclick="window._tradeOpenForm()"
      class="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-all">
      <i class="fas fa-plus mr-2"></i>Add First Trade
    </button>
  </div>` : `
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead class="bg-[#0a0e1a]">
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
            return `<tr class="hover:bg-[#1a2540]/50 transition-colors">
              <td class="py-2 px-3 font-mono text-gray-400">${t.date}</td>
              <td class="py-2 px-3">
                <span class="font-bold text-white">${t.ticker.toUpperCase()}</span>
                ${t.exchange ? `<span class="text-[9px] text-gray-600 ml-1">${t.exchange}</span>` : ''}
              </td>
              <td class="py-2 px-3 text-center">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${t.side==='BUY'?'bg-emerald-500/20 text-emerald-300':'bg-red-500/20 text-red-300'}">${t.side}</span>
              </td>
              <td class="py-2 px-3 text-right font-mono text-gray-200">${parseFloat(t.qty).toLocaleString()}</td>
              <td class="py-2 px-3 text-right font-mono text-white font-semibold">$${parseFloat(t.price).toFixed(2)}</td>
              <td class="py-2 px-3 text-right font-mono text-gray-300">$${notional.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
              <td class="py-2 px-3 text-right font-mono text-gray-500">$${parseFloat(t.commission||0).toFixed(2)}</td>
              <td class="py-2 px-3 text-gray-400 text-[11px]">${t.strategy||'—'}</td>
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
    <i class="fas fa-layer-group text-gray-700 text-3xl mb-3"></i>
    <div class="text-gray-400">No open positions</div>
    <div class="text-gray-600 text-sm">Log buy trades to see your position book here</div>
  </div>` : `
  <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl overflow-hidden">
    <div class="px-4 py-3 border-b border-[#1e2d4a] flex items-center gap-2">
      <i class="fas fa-layer-group text-cyan-400 text-sm"></i>
      <span class="text-sm font-semibold text-white">Open Position Book</span>
      <span class="text-[10px] text-gray-500">avg cost = simple mean of all buy prices per ticker</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead class="bg-[#0a0e1a]">
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
            return `<tr class="hover:bg-[#1a2540]/50">
              <td class="py-3 px-4 font-bold text-white text-sm">${p.ticker}</td>
              <td class="py-3 px-4 text-right font-mono text-gray-200">${p.totalQty.toLocaleString('en-US',{maximumFractionDigits:4})}</td>
              <td class="py-3 px-4 text-right font-mono text-cyan-300">$${p.avgCost.toFixed(4)}</td>
              <td class="py-3 px-4 text-right font-mono text-white font-semibold">$${bv.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-1.5 bg-[#1a2540] rounded-full overflow-hidden max-w-[80px]">
                    <div class="h-full bg-cyan-500 rounded-full" style="width:${Math.min(wt,100)}%"></div>
                  </div>
                  <span class="text-gray-400 font-mono text-[10px] w-10 text-right">${wt.toFixed(1)}%</span>
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
    <i class="fas fa-chart-pie text-gray-700 text-3xl mb-3"></i>
    <div class="text-gray-400">Need at least 2 trades for analytics</div>
    <div class="text-gray-600 text-sm">Add more trades to see breakdown charts</div>
  </div>` : `
  <div class="grid grid-cols-2 gap-5">

    <!-- By Ticker -->
    <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-4">
      <div class="text-xs font-bold text-gray-400 uppercase mb-3">Notional by Ticker (Buys)</div>
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
          <span class="text-xs text-white font-semibold w-12 flex-shrink-0">${tk}</span>
          <div class="flex-1 h-2 bg-[#1a2540] rounded-full overflow-hidden">
            <div class="h-full bg-cyan-500 rounded-full transition-all" style="width:${(v/total*100).toFixed(1)}%"></div>
          </div>
          <span class="text-[10px] font-mono text-gray-400 w-24 text-right flex-shrink-0">$${v.toLocaleString('en-US',{maximumFractionDigits:0})} (${(v/total*100).toFixed(0)}%)</span>
        </div>`).join('');
      })()}
    </div>

    <!-- By Strategy -->
    <div class="bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-4">
      <div class="text-xs font-bold text-gray-400 uppercase mb-3">Trades by Strategy</div>
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
          <span class="text-[10px] text-gray-300 w-24 flex-shrink-0 truncate">${strat}</span>
          <div class="flex-1 h-2 bg-[#1a2540] rounded-full overflow-hidden">
            <div class="h-full ${COLORS[i%COLORS.length]} rounded-full" style="width:${(d.count/maxCount*100)}%"></div>
          </div>
          <span class="text-[10px] font-mono text-gray-500 w-14 text-right flex-shrink-0">${d.count} trades</span>
        </div>`).join('');
      })()}
    </div>

    <!-- Timeline: trades per day -->
    <div class="col-span-2 bg-[#0d1221] border border-[#1e2d4a] rounded-xl p-4">
      <div class="text-xs font-bold text-gray-400 uppercase mb-3">Activity Timeline</div>
      ${(()=>{
        const byDate = {};
        trades.forEach(t => {
          if (!byDate[t.date]) byDate[t.date] = { buy:0, sell:0 };
          t.side==='BUY' ? byDate[t.date].buy++ : byDate[t.date].sell++;
        });
        const sorted = Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0]));
        if (!sorted.length) return '<div class="text-gray-600 text-xs">No dates found</div>';
        const maxCount = Math.max(...sorted.map(([,d])=>d.buy+d.sell), 1);
        return `<div class="flex items-end gap-1 h-16">
          ${sorted.map(([date,d])=>`
          <div class="flex-1 flex flex-col items-center gap-0.5" title="${date}: ${d.buy} buy, ${d.sell} sell">
            <div class="w-full flex flex-col gap-0.5">
              <div class="bg-emerald-500 rounded-t" style="height:${(d.buy/(maxCount)*40)}px;min-height:${d.buy?'3px':'0'}"></div>
              <div class="bg-red-500 rounded-b" style="height:${(d.sell/(maxCount)*40)}px;min-height:${d.sell?'3px':'0'}"></div>
            </div>
            <div class="text-[8px] text-gray-600 transform -rotate-45 origin-top-left mt-1 truncate w-6">${date.slice(5)}</div>
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
  <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="window._tradeCloseForm()"></div>
  <div class="relative bg-[#0d1221] border border-[#1e2d4a] rounded-2xl w-full max-w-lg shadow-2xl">
    <div class="flex items-center justify-between px-5 py-4 border-b border-[#1e2d4a]">
      <span id="trade-modal-title" class="text-base font-bold text-white">添加交易 Add Trade</span>
      <button onclick="window._tradeCloseForm()" class="text-gray-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#1a2540] transition">
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
            class="w-full bg-[#0a0e1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
        </div>
        <!-- Side -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Side <span class="text-red-400">*</span></label>
          <div class="flex gap-2">
            <label class="flex-1 cursor-pointer">
              <input type="radio" name="trade-side" value="BUY" id="tf-buy" class="sr-only peer" required>
              <div class="peer-checked:bg-emerald-600 peer-checked:border-emerald-500 peer-checked:text-white
                          bg-[#0a0e1a] border border-[#1e2d4a] text-gray-400
                          rounded-lg py-2 text-center text-sm font-bold transition-all select-none">BUY</div>
            </label>
            <label class="flex-1 cursor-pointer">
              <input type="radio" name="trade-side" value="SELL" id="tf-sell" class="sr-only peer">
              <div class="peer-checked:bg-red-600 peer-checked:border-red-500 peer-checked:text-white
                          bg-[#0a0e1a] border border-[#1e2d4a] text-gray-400
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
            class="w-full bg-[#0a0e1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 uppercase">
        </div>
        <!-- Exchange -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Exchange</label>
          <select id="tf-exchange"
            class="w-full bg-[#0a0e1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white
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
            class="w-full bg-[#0a0e1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
        </div>
        <!-- Price -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Price (USD) <span class="text-red-400">*</span></label>
          <input id="tf-price" type="number" required min="0.0001" step="any" placeholder="150.00"
            class="w-full bg-[#0a0e1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- Commission -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Commission ($)</label>
          <input id="tf-commission" type="number" min="0" step="any" placeholder="1.00"
            class="w-full bg-[#0a0e1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
        </div>
        <!-- Strategy tag -->
        <div>
          <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Strategy Tag</label>
          <input id="tf-strategy" type="text" placeholder="e.g. BTD, Momentum"
            class="w-full bg-[#0a0e1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600
                   focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
        </div>
      </div>

      <!-- Notes -->
      <div>
        <label class="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Notes / Thesis</label>
        <textarea id="tf-notes" rows="2" placeholder="Entry rationale, catalyst, stop loss level…"
          class="w-full bg-[#0a0e1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none
                 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"></textarea>
      </div>

      <!-- Notional preview -->
      <div id="tf-notional-preview" class="hidden bg-[#0a0e1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm">
        <span class="text-gray-500">Notional: </span>
        <span id="tf-notional-val" class="text-white font-mono font-bold"></span>
      </div>

      <div class="flex gap-3 pt-1">
        <button type="button" onclick="window._tradeCloseForm()"
          class="flex-1 py-2.5 rounded-lg border border-[#1e2d4a] text-gray-400 hover:text-white hover:border-gray-500 transition text-sm">
          Cancel
        </button>
        <button type="submit"
          class="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition text-sm">
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

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  9. NEWS AGENT  — Institutional News Intelligence                    ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderNewsAgent(el) {
  el.innerHTML = `<div class="flex items-center justify-center h-32 text-gray-400">
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
    AI_Capex_Bubble:        { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   pill: 'bg-blue-500/20 text-blue-300' },
    Geopolitics_SupplyChain:{ bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400',    pill: 'bg-red-500/20 text-red-300'   },
    Macro_K_Shape:          { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400',  pill: 'bg-amber-500/20 text-amber-300'},
    Distressed_Credit_RE:   { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', pill: 'bg-purple-500/20 text-purple-300'},
    Commodities_Gold_Oil:   { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', pill: 'bg-yellow-500/20 text-yellow-300'},
  };
  const SENTIMENT_STYLE = {
    bullish: 'bg-emerald-500/20 text-emerald-300',
    bearish: 'bg-red-500/20 text-red-300',
    neutral: 'bg-gray-500/20 text-gray-400',
  };
  const URGENCY_STYLE = {
    high:   'bg-red-500/20 text-red-300 border border-red-500/40',
    medium: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    low:    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
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
             ${isActive ? 'ring-2 ring-offset-1 ring-offset-[#0a0e1a] ring-blue-400' : 'hover:brightness-110'}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <i class="${m.icon} ${c.text} text-lg"></i>
          <div>
            <div class="text-white font-semibold text-sm leading-tight">${m.label}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">${m.id}</div>
          </div>
        </div>
        <span class="${c.pill} text-xs px-2 py-0.5 rounded-full font-mono">${m.articleCount} art.</span>
      </div>
      <div class="text-[11px] text-gray-400 leading-snug mb-3">${m.description}</div>
      <!-- Sentiment bar -->
      <div class="mb-2">
        <div class="flex justify-between text-[10px] text-gray-500 mb-1">
          <span class="text-emerald-400">▲ ${sb.bullish} bull</span>
          <span class="text-gray-500">● ${sb.neutral} neut</span>
          <span class="text-red-400">▼ ${sb.bearish} bear</span>
        </div>
        <div class="h-1.5 rounded-full bg-[#1a2540] overflow-hidden flex">
          <div class="bg-emerald-500 h-full transition-all" style="width:${bullPct}%"></div>
          <div class="bg-gray-600 h-full transition-all" style="width:${(sb.neutral/total*100).toFixed(0)}%"></div>
          <div class="bg-red-500 h-full transition-all" style="width:${bearPct}%"></div>
        </div>
      </div>
      <!-- Boolean query chip -->
      <div class="mt-2 font-mono text-[9px] text-gray-600 bg-[#0d1221] rounded px-2 py-1 truncate" title="${m.query}">
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
    <tr class="${idx%2===0?'bg-[#0d1221]':'bg-[#0a0e1a]'} hover:bg-[#1a2540] transition-colors">
      <td class="px-3 py-2.5 whitespace-nowrap">
        <div class="text-[10px] font-mono text-gray-500">${a.date}</div>
        <div class="text-[10px] font-mono text-gray-600">${a.time}</div>
      </td>
      <td class="px-3 py-2.5">
        <span class="${c.pill} text-[10px] px-2 py-0.5 rounded-full">${a.mandate.replace(/_/g,' ')}</span>
      </td>
      <td class="px-3 py-2.5 max-w-xs">
        <div class="text-xs text-gray-200 leading-snug">${_naHighlight(a.title, a.mandate)}</div>
        <div class="text-[10px] text-gray-500 mt-0.5">${a.source}</div>
      </td>
      <td class="px-3 py-2.5 text-center">
        <span class="${sentStyle} text-[10px] px-2 py-0.5 rounded-full font-mono">${sentIcon} ${a.sentiment}</span>
      </td>
      <td class="px-3 py-2.5 text-center">
        <a href="${a.link}" class="text-blue-400 hover:text-blue-300 text-[10px]">
          <i class="fas fa-external-link-alt"></i>
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
      result = result.replace(re, '<mark class="bg-yellow-400/20 text-yellow-300 rounded px-0.5">$1</mark>');
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
        card.classList.add('ring-2','ring-offset-1','ring-offset-[#0a0e1a]','ring-blue-400');
      } else {
        card.classList.remove('ring-2','ring-offset-1','ring-offset-[#0a0e1a]','ring-blue-400');
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
          <span class="text-sm font-semibold text-white">${mandate?.label || h.mandate}</span>
        </div>
        <span class="${ug} text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">${h.urgency}</span>
      </div>
      <p class="text-xs text-gray-300 leading-relaxed mb-3">${h.summary}</p>
      <div class="border-t border-[#1e2d4a] pt-3">
        <div class="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Recommended Action</div>
        <div class="text-xs text-emerald-300 font-medium leading-snug">${h.action}</div>
      </div>
    </div>`;
  }

  // ── Python script reference card ───────────────────────────────────
  const pythonRefCard = `
  <div class="rounded-xl border border-[#1e2d4a] bg-[#0d1221] p-4">
    <div class="flex items-center gap-2 mb-3">
      <i class="fab fa-python text-yellow-400"></i>
      <span class="text-sm font-semibold text-white">Production Pipeline — <code class="text-cyan-400 text-xs">news_agent.py</code></span>
      <span class="ml-auto text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Data Layer #4</span>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-3">
      <div class="bg-[#0a0e1a] rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">Data Source</div>
        <div class="text-xs text-white">Google News RSS + Boolean Search</div>
        <div class="text-[10px] text-gray-500 mt-1">Zero cost · High signal/noise</div>
      </div>
      <div class="bg-[#0a0e1a] rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">Stack</div>
        <div class="text-xs text-white">feedparser · pandas · requests</div>
        <div class="text-[10px] text-gray-500 mt-1">pip install feedparser pandas</div>
      </div>
      <div class="bg-[#0a0e1a] rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">AI Brief Generation</div>
        <div class="text-xs text-white">Claude 3.5 Sonnet API</div>
        <div class="text-[10px] text-gray-500 mt-1">Mandate → structured action</div>
      </div>
      <div class="bg-[#0a0e1a] rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">Production Deploy</div>
        <div class="text-xs text-white">Cloudflare Worker Cron Trigger</div>
        <div class="text-[10px] text-gray-500 mt-1">→ D1 Storage → /api/news/*</div>
      </div>
    </div>
    <div class="bg-[#0a0e1a] rounded p-3 font-mono text-[10px] text-gray-400 leading-relaxed">
      <div class="text-emerald-400 mb-1"># news_agent.py — core fetch loop</div>
      <div class="text-gray-500">def fetch_mandate_news(days_back=1):</div>
      <div class="text-gray-400 ml-4">base = "https://news.google.com/rss/search?q="</div>
      <div class="text-gray-400 ml-4">for mandate_id, config in INVESTMENT_MANDATES.items():</div>
      <div class="text-gray-400 ml-8">url = base + urllib.parse.quote(config["query"])</div>
      <div class="text-gray-400 ml-8">feed = feedparser.parse(url)  <span class="text-cyan-400"># RSS → DataFrame</span></div>
      <div class="text-gray-400 ml-8">df = keyword_filter(feed, config["keywords"])</div>
      <div class="text-emerald-400 ml-4">return pd.concat(results)</div>
    </div>
  </div>`;

  // ── health status row ──────────────────────────────────────────────
  function healthRow(label, value, ok) {
    return `<div class="flex items-center justify-between py-1.5 border-b border-[#1e2d4a]">
      <span class="text-xs text-gray-400">${label}</span>
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
        <span class="text-[11px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full ml-1">4 Mandates</span>
      </h2>
      <p class="text-xs text-gray-500 mt-0.5">
        Boolean-filtered Google News RSS · ${articlesData.total} articles · Claude 3.5 Sonnet brief
      </p>
    </div>
    <!-- Agent health chip -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1.5 text-xs text-gray-400 bg-[#0d1221] border border-[#1e2d4a] rounded-lg px-3 py-1.5">
        <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
        <span>Last run: <span class="text-white font-mono">${new Date(healthData.lastRun).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span></span>
        <span class="text-gray-600">|</span>
        <span>Next: <span class="text-cyan-400 font-mono">${healthData.runFrequency.split('(')[0].trim()}</span></span>
      </div>
      <div class="flex gap-2 text-xs">
        <span class="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">▲ ${sb.bullish} Bull</span>
        <span class="bg-gray-500/20 text-gray-400 px-2 py-1 rounded">● ${sb.neutral} Neutral</span>
        <span class="bg-red-500/20 text-red-300 px-2 py-1 rounded">▼ ${sb.bearish} Bear</span>
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
      <div class="bg-[#0d1221] rounded-xl border border-[#1e2d4a] overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">
          <div class="flex items-center gap-2">
            <i class="fas fa-rss text-orange-400 text-sm"></i>
            <span class="text-sm font-semibold text-white">Article Feed</span>
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
            <thead class="bg-[#0a0e1a]">
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
      <div class="bg-[#0d1221] rounded-xl border border-[#1e2d4a] overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">
          <div class="flex items-center gap-2">
            <i class="fas fa-robot text-violet-400 text-sm"></i>
            <span class="text-sm font-semibold text-white">AI Morning Brief</span>
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
            <span class="text-sm font-semibold text-white">Overall Market Call</span>
          </div>
          <p class="text-xs text-amber-200 leading-relaxed">${briefData.marketCall}</p>
        </div>
      </div>

    </div><!-- /col-span-2 -->

    <!-- ── RIGHT 1/3: Health + Python Ref ──────────────────────────── -->
    <div class="space-y-4">

      <!-- Agent Health -->
      <div class="bg-[#0d1221] rounded-xl border border-[#1e2d4a] p-4">
        <div class="flex items-center gap-2 mb-3">
          <i class="fas fa-heartbeat text-emerald-400 text-sm"></i>
          <span class="text-sm font-semibold text-white">Agent Health</span>
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
      <div class="bg-[#0d1221] rounded-xl border border-[#1e2d4a] p-4">
        <div class="flex items-center gap-2 mb-3">
          <i class="fas fa-tasks text-blue-400 text-sm"></i>
          <span class="text-sm font-semibold text-white">Mandate Pipeline</span>
        </div>
        ${healthData.mandates.map(m => {
          const c = MANDATE_COLORS[m.id] || MANDATE_COLORS.Macro_K_Shape;
          return `<div class="flex items-center justify-between py-1.5 border-b border-[#1e2d4a]">
            <span class="text-xs ${c.text}">${m.label}</span>
            <span class="text-[10px] font-mono text-gray-400">${m.articleCount} art.</span>
          </div>`;
        }).join('')}
        <div class="mt-3 text-[10px] text-gray-600 font-mono leading-relaxed">
          Data: Google News RSS<br>
          Filter: Boolean + keyword<br>
          Storage: Cloudflare D1 (prod)
        </div>
      </div>

      <!-- Python Reference (collapsed by default) -->
      <div>
        <button onclick="document.getElementById('na-py-panel').classList.toggle('hidden')"
          class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#1e2d4a]
                 bg-[#0d1221] text-xs text-gray-400 hover:text-white hover:border-yellow-500/40 transition mb-2">
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
