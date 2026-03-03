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
// ║  1. DASHBOARD                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderDashboard(el) {
  const [overRes, perfRes, mktRes] = await Promise.all([
    axios.get(`${API}/api/overview`),
    axios.get(`${API}/api/performance`),
    axios.get(`${API}/api/us/market-overview`),
  ])
  const o = overRes.data, p = perfRes.data, m = mktRes.data
  const recentNav = p.navHistory.slice(-90)

  el.innerHTML = `
  <!-- KPI ROW -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    ${kpiCard('总资产', fmt.money(o.totalAssets), '', 'fas fa-wallet', 'text-cyan-400')}
    ${kpiCard('总收益', fmt.money(o.totalPnl), fmt.pct(o.totalPnlPct), 'fas fa-chart-line', o.totalPnl>=0?'text-emerald-400':'text-red-400')}
    ${kpiCard('今日盈亏', fmt.money(o.dailyPnl), fmt.pct(o.dailyPnlPct), 'fas fa-calendar-day', o.dailyPnl>=0?'text-emerald-400':'text-red-400')}
    ${kpiCard('夏普比率', fmt.dec(o.sharpe), `最大回撤 ${o.maxDrawdown.toFixed(1)}%`, 'fas fa-balance-scale', 'text-amber-400')}
  </div>

  <!-- NAV CHART + MARKET -->
  <div class="grid grid-cols-3 gap-4 mb-6">
    <div class="col-span-2 card p-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <div class="text-sm font-semibold text-white">净值走势</div>
          <div class="text-xs text-gray-500">组合净值 vs S&P 500 Benchmark</div>
        </div>
        <div class="flex gap-3 text-xs">
          <span class="flex items-center gap-1"><span class="w-3 h-1 bg-cyan-400 rounded inline-block"></span>组合净值</span>
          <span class="flex items-center gap-1"><span class="w-3 h-1 bg-gray-500 rounded inline-block"></span>Benchmark</span>
        </div>
      </div>
      <div class="chart-wrap h-48"><canvas id="navChart"></canvas></div>
    </div>
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">策略状态</div>
      <div class="space-y-2 mb-4">
        ${[['运行中','running','emerald'],[' 暂停','paused','amber'],['已停止','stopped','gray']].map(([label,status,color])=>`
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-400 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-${color}-400"></span>${label}
          </span>
          <span class="text-sm font-semibold text-white">${window._strategies?.filter(s=>s.status===status).length||'—'}</span>
        </div>`).join('')}
      </div>
      <div class="text-xs text-gray-500 mb-2">今日交易量</div>
      <div class="text-2xl font-bold text-white">${o.todayTrades}</div>
      <div class="text-xs text-gray-500 mt-3 mb-1">持仓数量</div>
      <div class="text-2xl font-bold text-white">${o.openPositions}</div>
    </div>
  </div>

  <!-- MARKET OVERVIEW + STRATEGY TABLE -->
  <div class="grid grid-cols-3 gap-4 mb-6">
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <i class="fas fa-globe text-cyan-400"></i> 美股市场概览
      </div>
      <div class="space-y-2">
        ${m.indices.map(i=>`
        <div class="flex items-center justify-between py-1.5 border-b border-[#111827] last:border-0">
          <span class="text-xs text-gray-400">${i.name}</span>
          <div class="text-right">
            <div class="text-xs font-mono text-white">${i.value.toLocaleString()}</div>
            <div class="text-[10px] ${i.changePct>=0?'text-emerald-400':'text-red-400'}">${fmt.pct(i.changePct)}</div>
          </div>
        </div>`).join('')}
      </div>
    </div>
    <div class="col-span-2 card p-4">
      <div class="text-sm font-semibold text-white mb-3">策略表现概览</div>
      <div class="overflow-auto max-h-52">
        <table class="data-table"><thead><tr>
          <th>策略名称</th><th>状态</th><th>权重</th><th>收益</th><th>夏普</th><th>胜率</th>
        </tr></thead><tbody id="dashStratTable"></tbody></table>
      </div>
    </div>
  </div>

  <!-- FACTOR ATTRIBUTION + RATES -->
  <div class="grid grid-cols-2 gap-4">
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">收益归因 (Bloomberg PE风格)</div>
      <div class="chart-wrap h-48"><canvas id="attrChart"></canvas></div>
    </div>
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <i class="fas fa-landmark text-amber-400"></i> 利率 & FX
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <div class="text-[10px] text-gray-500 uppercase mb-1">利率</div>
          ${m.rates.slice(0,4).map(r=>`
          <div class="flex justify-between text-xs py-1 border-b border-[#111827]">
            <span class="text-gray-400">${r.name}</span>
            <span class="font-mono text-white">${r.value}${r.value>10?'bp':'%'}</span>
          </div>`).join('')}
        </div>
        <div>
          <div class="text-[10px] text-gray-500 uppercase mb-1">外汇 & 商品</div>
          ${m.fx.slice(0,3).map(f=>`
          <div class="flex justify-between text-xs py-1 border-b border-[#111827]">
            <span class="text-gray-400">${f.pair}</span>
            <span class="font-mono ${f.change>=0?'text-emerald-400':'text-red-400'}">${f.value.toFixed(4)}</span>
          </div>`).join('')}
          ${m.commodities.slice(0,1).map(c=>`
          <div class="flex justify-between text-xs py-1">
            <span class="text-gray-400">${c.name}</span>
            <span class="font-mono text-amber-400">$${c.value.toLocaleString()}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`

  // Load strategy data
  const { data: strategies } = await axios.get(`${API}/api/strategies`)
  window._strategies = strategies
  const tbody = document.getElementById('dashStratTable')
  if (tbody) tbody.innerHTML = strategies.map(s => `<tr>
    <td class="text-white font-medium">${s.name}</td>
    <td><span class="badge badge-${s.status}">${s.status}</span></td>
    <td class="text-gray-300">${s.weight}%</td>
    <td class="font-mono ${s.pnl>=0?'pos':'neg'}">${fmt.pct(s.pnlPct)}</td>
    <td class="text-amber-400">${s.sharpe.toFixed(2)}</td>
    <td class="text-gray-300">${s.winRate.toFixed(1)}%</td>
  </tr>`).join('')

  // NAV Chart
  const navCtx = document.getElementById('navChart')?.getContext('2d')
  if (navCtx) {
    const labels = recentNav.filter((_,i)=>i%3===0).map(d=>d.date.slice(5))
    const navData = recentNav.filter((_,i)=>i%3===0).map(d=>d.nav)
    const bData = recentNav.filter((_,i)=>i%3===0).map(d=>d.benchmark)
    charts.nav = new Chart(navCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label:'组合净值', data: navData, borderColor:'#22d3ee', borderWidth:2, pointRadius:0, fill: { target:'origin', above:'rgba(34,211,238,0.06)' }, tension:0.4 },
          { label:'Benchmark', data: bData, borderColor:'#4b5563', borderWidth:1.5, pointRadius:0, borderDash:[4,4], tension:0.4 },
        ]
      },
      options: chartOpts('净值')
    })
  }

  // Attribution Chart
  const attrCtx = document.getElementById('attrChart')?.getContext('2d')
  if (attrCtx && p.factorAttribution) {
    const pos = p.factorAttribution.filter(f=>f.contribution>=0)
    const neg = p.factorAttribution.filter(f=>f.contribution<0)
    charts.attr = new Chart(attrCtx, {
      type: 'bar',
      data: {
        labels: p.factorAttribution.map(f=>f.factor),
        datasets: [{
          data: p.factorAttribution.map(f=>f.contribution/1000),
          backgroundColor: p.factorAttribution.map(f=>f.contribution>=0?'rgba(16,185,129,0.7)':'rgba(239,68,68,0.7)'),
          borderRadius: 4,
        }]
      },
      options: { ...chartOpts('收益 ($K)'), plugins:{ legend:{ display:false } } }
    })
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  2. DATA CENTER                                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderDataCenter(el) {
  const [mktRes, quotesRes, earningsRes, filingsRes] = await Promise.all([
    axios.get(`${API}/api/us/market-overview`),
    axios.get(`${API}/api/market/quotes`),
    axios.get(`${API}/api/us/earnings`),
    axios.get(`${API}/api/us/filings`),
  ])
  const m = mktRes.data, q = quotesRes.data, earnings = earningsRes.data, filings = filingsRes.data

  el.innerHTML = `
  <!-- DATA SOURCE WATERFALL -->
  <div class="bbg-alert mb-4 flex items-center gap-3">
    <i class="fas fa-info-circle text-yellow-400"></i>
    <span class="font-semibold">数据源优先级 (Bloomberg Waterfall)：</span>
    <span class="text-gray-300 text-xs">① Bloomberg Terminal (BLPAPI)</span>
    <i class="fas fa-arrow-right text-gray-600"></i>
    <span class="text-gray-300 text-xs">② yfinance (交叉验证)</span>
    <i class="fas fa-arrow-right text-gray-600"></i>
    <span class="text-gray-300 text-xs">③ SEC EDGAR (XBRL)</span>
    <i class="fas fa-arrow-right text-gray-600"></i>
    <span class="text-gray-300 text-xs">④ Web Fetch</span>
    <span class="ml-auto text-[10px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded">偏差>5%时发出⚠️预警</span>
  </div>

  <!-- TABS -->
  <div class="flex gap-2 mb-4">
    ${['market','earnings','filings','quotes'].map((t,i)=>
      `<button class="tab-btn ${i===0?'active':''}" onclick="dcTab('${t}',this)">${{market:'🌐 市场总览',earnings:'📊 财报追踪',filings:'📋 SEC归档',quotes:'💹 行情报价'}[t]}</button>`
    ).join('')}
  </div>

  <div id="dc-market">
    <div class="grid grid-cols-4 gap-4 mb-5">
      ${m.indices.map(i=>`
      <div class="kpi-card">
        <div class="text-xs text-gray-500 mb-1">${i.name}</div>
        <div class="text-xl font-bold font-mono text-white">${i.value.toLocaleString()}</div>
        <div class="text-sm ${i.changePct>=0?'text-emerald-400':'text-red-400'} font-medium">${fmt.pct(i.changePct)}</div>
        <div class="text-xs text-gray-600">${i.change>=0?'+':''}${i.change.toFixed(1)} pts</div>
      </div>`).join('')}
    </div>
    <div class="grid grid-cols-3 gap-4">
      <div class="card p-4">
        <div class="text-xs font-semibold text-gray-400 uppercase mb-3">利率曲线</div>
        ${m.rates.map(r=>`
        <div class="flex justify-between items-center py-2 border-b border-[#111827] last:border-0">
          <span class="text-xs text-gray-400">${r.name}</span>
          <div class="text-right">
            <span class="font-mono text-sm text-white">${typeof r.value==='number'&&r.value>10?r.value+'bp':r.value+'%'}</span>
            <span class="text-xs ml-2 ${r.change>=0?'text-emerald-400':'text-red-400'}">${r.change>=0?'+':''}${r.change}</span>
          </div>
        </div>`).join('')}
      </div>
      <div class="card p-4">
        <div class="text-xs font-semibold text-gray-400 uppercase mb-3">主要货币对</div>
        ${m.fx.map(f=>`
        <div class="flex justify-between items-center py-2 border-b border-[#111827] last:border-0">
          <span class="text-xs text-gray-400">${f.pair}</span>
          <div class="text-right">
            <span class="font-mono text-sm text-white">${f.value.toFixed(4)}</span>
            <span class="text-xs ml-2 ${f.change>=0?'text-emerald-400':'text-red-400'}">${f.change>=0?'+':''}${f.change.toFixed(4)}</span>
          </div>
        </div>`).join('')}
      </div>
      <div class="card p-4">
        <div class="text-xs font-semibold text-gray-400 uppercase mb-3">大宗商品</div>
        ${m.commodities.map(c=>`
        <div class="flex justify-between items-center py-2 border-b border-[#111827] last:border-0">
          <span class="text-xs text-gray-400">${c.name}</span>
          <div class="text-right">
            <span class="font-mono text-sm text-white">$${c.value.toLocaleString()}</span>
            <span class="text-xs ml-2 ${c.changePct>=0?'text-emerald-400':'text-red-400'}">${fmt.pct(c.changePct)}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <div id="dc-earnings" class="hidden">
    <div class="card overflow-hidden">
      <div class="px-4 py-3 border-b border-[#1e2d4a] flex items-center justify-between">
        <div class="text-sm font-semibold text-white">财报追踪 — EPS & Revenue Beat/Miss (Bloomberg风格)</div>
        <div class="text-xs text-gray-500">数据源: SEC EDGAR 8-K + yfinance consensus</div>
      </div>
      <div class="overflow-auto">
        <table class="data-table"><thead><tr>
          <th>股票</th><th>季度</th><th>EPS实际</th><th>EPS预期</th><th>超预期%</th>
          <th>收入实际($B)</th><th>收入超预期%</th><th>指引EPS</th><th>结果</th><th>分析师观点</th>
        </tr></thead><tbody>
          ${earnings.map(e=>`<tr>
            <td><span class="font-bold text-white">${e.ticker}</span><div class="text-[10px] text-gray-500">${e.name}</div></td>
            <td class="text-gray-300 text-[11px]">${e.quarter}<br><span class="text-gray-600">${e.reportDate}</span></td>
            <td class="font-mono text-white">$${e.epsReported.toFixed(2)}</td>
            <td class="font-mono text-gray-400">$${e.epsEstimate.toFixed(2)}</td>
            <td class="font-mono font-bold ${e.epsSurprisePct>=5?'text-emerald-400':e.epsSurprisePct>=-2?'text-amber-400':'text-red-400'}">${e.epsSurprisePct>=0?'+':''}${e.epsSurprisePct.toFixed(1)}%</td>
            <td class="font-mono text-white">$${e.revenueReported.toFixed(1)}B</td>
            <td class="font-mono ${e.revenueSurprisePct>=0?'text-emerald-400':'text-red-400'}">${e.revenueSurprisePct>=0?'+':''}${e.revenueSurprisePct.toFixed(1)}%</td>
            <td class="text-[11px] text-gray-400">$${e.guidanceEpsLow.toFixed(2)}-${e.guidanceEpsHigh.toFixed(2)}</td>
            <td><span class="badge badge-${e.result.toLowerCase()}">${e.result}</span></td>
            <td class="text-[10px] text-gray-400 max-w-xs">${e.analystNote.slice(0,80)}...</td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  </div>

  <div id="dc-filings" class="hidden">
    <div class="card overflow-hidden">
      <div class="px-4 py-3 border-b border-[#1e2d4a] flex justify-between items-center">
        <div class="text-sm font-semibold text-white">SEC EDGAR 官方申报文件</div>
        <div class="text-xs text-gray-500">XBRL结构化数据 · 10-K / 10-Q / 8-K</div>
      </div>
      <div class="overflow-auto">
        <table class="data-table"><thead><tr>
          <th>股票</th><th>类型</th><th>申报日期</th><th>报告期</th><th>摘要</th><th>链接</th>
        </tr></thead><tbody>
          ${filings.map(f=>`<tr>
            <td class="font-bold text-white">${f.ticker}</td>
            <td><span class="badge ${f.formType==='10-K'?'badge-live':f.formType==='8-K'?'badge-beat':'badge-backtesting'}">${f.formType}</span></td>
            <td class="font-mono text-gray-400 text-xs">${f.filedDate}</td>
            <td class="text-gray-300 text-xs">${f.period}</td>
            <td class="text-[11px] text-gray-400 max-w-sm">${f.summary.slice(0,100)}...</td>
            <td><a href="${f.url}" target="_blank" class="text-cyan-400 hover:text-cyan-300 text-xs"><i class="fas fa-external-link-alt"></i></a></td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  </div>

  <div id="dc-quotes" class="hidden">
    <div class="card overflow-hidden">
      <div class="px-4 py-3 border-b border-[#1e2d4a]">
        <div class="text-sm font-semibold text-white">A股行情报价 (模拟数据)</div>
      </div>
      <div class="overflow-auto">
        <table class="data-table"><thead><tr>
          <th>代码</th><th>名称</th><th>最新价</th><th>涨跌额</th><th>涨跌幅</th><th>成交量</th><th>成交额</th>
        </tr></thead><tbody>
          ${q.map(s=>`<tr>
            <td class="font-mono text-gray-400 text-xs">${s.code}</td>
            <td class="font-semibold text-white">${s.name}</td>
            <td class="font-mono text-white font-bold">¥${s.price.toFixed(2)}</td>
            <td class="font-mono ${s.change>=0?'text-emerald-400':'text-red-400'}">${s.change>=0?'+':''}${s.change.toFixed(2)}</td>
            <td class="font-mono font-bold ${s.changePct>=0?'text-emerald-400':'text-red-400'}">${fmt.pct(s.changePct)}</td>
            <td class="font-mono text-gray-400 text-xs">${(s.volume/10000).toFixed(0)}万</td>
            <td class="font-mono text-gray-400 text-xs">${(s.turnover/1e8).toFixed(2)}亿</td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  </div>`
}

window.dcTab = function(tab, btn) {
  ['market','earnings','filings','quotes'].forEach(t => {
    const el = document.getElementById(`dc-${t}`)
    if (el) el.classList.toggle('hidden', t !== tab)
  })
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
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
async function renderBacktest(el) {
  const { data } = await axios.get(`${API}/api/backtest`)
  const results = data.filter(r => r.status === 'completed')

  el.innerHTML = `
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
    ${results.map(r=>`
    <div class="kpi-card cursor-pointer hover:border-cyan-500/30 transition" onclick="loadBtChart('${r.id}')">
      <div class="text-xs text-gray-500 mb-1 truncate">${r.strategyName}</div>
      <div class="text-2xl font-bold ${r.totalReturn>=0?'text-emerald-400':'text-red-400'}">+${r.totalReturn.toFixed(1)}%</div>
      <div class="text-xs text-gray-400 mt-1">${r.startDate} → ${r.endDate}</div>
      <div class="grid grid-cols-2 gap-1 mt-2 text-[11px]">
        <div>夏普: <span class="text-amber-400">${r.sharpe.toFixed(2)}</span></div>
        <div>回撤: <span class="text-red-400">${r.maxDrawdown.toFixed(1)}%</span></div>
        <div>年化: <span class="text-cyan-400">${r.annualReturn.toFixed(1)}%</span></div>
        <div>胜率: <span class="text-gray-300">${r.winRate.toFixed(1)}%</span></div>
      </div>
    </div>`).join('')}
    <div class="kpi-card border-dashed border-amber-600/30 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#1a2540] transition">
      <div class="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
        <i class="fas fa-spinner fa-spin text-amber-400"></i>
      </div>
      <div class="text-xs text-amber-400">回测运行中</div>
      <div class="text-[10px] text-gray-500">高频因子挖掘实验</div>
    </div>
  </div>

  <div class="card p-4">
    <div class="flex items-center justify-between mb-4">
      <div class="text-sm font-semibold text-white">回测净值曲线</div>
      <div class="flex gap-2 text-xs">
        ${results.map(r=>`<button class="tab-btn" onclick="loadBtChart('${r.id}',this)">${r.strategyName.slice(0,10)}</button>`).join('')}
      </div>
    </div>
    <div class="chart-wrap h-64"><canvas id="btChart"></canvas></div>
  </div>

  <div class="card p-4 mt-4">
    <div class="text-sm font-semibold text-white mb-3">回测结果对比</div>
    <table class="data-table"><thead><tr>
      <th>策略名称</th><th>测试区间</th><th>初始资金</th><th>期末资金</th><th>总收益</th>
      <th>年化收益</th><th>夏普比率</th><th>最大回撤</th><th>胜率</th><th>交易次数</th>
    </tr></thead><tbody>
      ${results.map(r=>`<tr>
        <td class="font-semibold text-white">${r.strategyName}</td>
        <td class="text-xs text-gray-400">${r.startDate}~${r.endDate}</td>
        <td class="font-mono text-gray-400">${fmt.money(r.initialCapital)}</td>
        <td class="font-mono text-white">${fmt.money(r.finalCapital)}</td>
        <td class="font-mono font-bold text-emerald-400">+${r.totalReturn.toFixed(1)}%</td>
        <td class="font-mono text-cyan-400">${r.annualReturn.toFixed(1)}%</td>
        <td class="font-mono text-amber-400">${r.sharpe.toFixed(2)}</td>
        <td class="font-mono text-red-400">${r.maxDrawdown.toFixed(1)}%</td>
        <td class="font-mono text-gray-300">${r.winRate.toFixed(1)}%</td>
        <td class="font-mono text-gray-400">${r.totalTrades}</td>
      </tr>`).join('')}
    </tbody></table>
  </div>`

  if (results[0]) loadBtChart(results[0].id)
}

window.loadBtChart = async function(id, btn) {
  if (btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  }
  const { data: bt } = await axios.get(`${API}/api/backtest/${id}`)
  const step = Math.max(1, Math.floor(bt.navCurve.length / 80))
  const pts = bt.navCurve.filter((_,i)=>i%step===0)
  const ctx = document.getElementById('btChart')?.getContext('2d')
  if (!ctx) return
  if (charts.bt) charts.bt.destroy()
  charts.bt = new Chart(ctx, {
    type: 'line',
    data: {
      labels: pts.map(p=>p.date.slice(5)),
      datasets: [
        { label: bt.strategyName, data: pts.map(p=>p.nav), borderColor:'#22d3ee', borderWidth:2, pointRadius:0, fill:{target:'origin',above:'rgba(34,211,238,0.06)'}, tension:0.3 },
        { label: 'S&P 500', data: pts.map(p=>p.benchmark), borderColor:'#6b7280', borderWidth:1.5, pointRadius:0, borderDash:[4,4], tension:0.3 },
      ]
    },
    options: chartOpts('净值')
  })
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
