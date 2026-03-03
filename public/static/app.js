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
