import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import {
  generateQuotes, strategies, positions, trades,
  backtestResults, generatePerformanceReport
} from './data/mockData'
import {
  SP500_UNIVERSE, recentFilings, earningsUpdates,
  marketOverview, factorResearchPapers, aiExtractedStrategies,
  FIVE_FACTOR_WEIGHTS, HARD_FILTER,
  mlModels, mlSignals, trainingRuns, regimeData
} from './data/usMarketData'

const app = new Hono()
app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))

// ── API: System Overview ───────────────────────────────────────────────────
app.get('/api/overview', (c) => {
  const perf = generatePerformanceReport()
  const runningStrategies = strategies.filter(s => s.status === 'running').length
  const totalPnl = strategies.reduce((sum, s) => sum + s.pnl, 0)
  return c.json({
    totalAssets: perf.totalAssets,
    totalPnl,
    totalPnlPct: (totalPnl / (perf.totalAssets - totalPnl)) * 100,
    dailyPnl: perf.dailyPnl,
    dailyPnlPct: perf.dailyPnlPct,
    runningStrategies,
    totalStrategies: strategies.length,
    openPositions: positions.length,
    todayTrades: trades.length,
    sharpe: perf.sharpe,
    maxDrawdown: perf.maxDrawdown,
    marketStatus: 'OPEN',
    lastUpdate: new Date().toISOString(),
  })
})

// ── API: Market Data ────────────────────────────────────────────────────────
app.get('/api/market/quotes', (c) => c.json(generateQuotes()))
app.get('/api/market/overview', (c) => c.json(marketOverview))

// ── API: US Market (五因子筛选) ─────────────────────────────────────────────
app.get('/api/us/screener', (c) => {
  const sort = c.req.query('sort') || 'compositeScore'
  const sector = c.req.query('sector') || ''
  const minScore = parseFloat(c.req.query('minScore') || '0')
  let results = [...SP500_UNIVERSE]
  // Apply hard filters
  results = results.filter(s =>
    s.marketCap >= HARD_FILTER.marketCapMin &&
    s.revenueGrowth >= HARD_FILTER.revenueGrowthMin * 100 &&
    s.grossMargin >= HARD_FILTER.grossMarginMin * 100 &&
    s.compositeScore >= minScore
  )
  if (sector) results = results.filter(s => s.sector === sector)
  results.sort((a, b) => (b as any)[sort] - (a as any)[sort])
  return c.json({
    total: results.length,
    fiveFactorWeights: FIVE_FACTOR_WEIGHTS,
    hardFilter: HARD_FILTER,
    dataSourcePriority: ['Bloomberg(TOP)', 'yfinance', 'SEC EDGAR', 'Web Fetch'],
    stocks: results,
  })
})

app.get('/api/us/stock/:ticker', (c) => {
  const ticker = c.req.param('ticker').toUpperCase()
  const stock = SP500_UNIVERSE.find(s => s.ticker === ticker)
  if (!stock) return c.json({ error: 'Ticker not found' }, 404)
  const filings = recentFilings.filter(f => f.ticker === ticker)
  const earnings = earningsUpdates.filter(e => e.ticker === ticker)
  return c.json({ stock, filings, earnings })
})

app.get('/api/us/earnings', (c) => c.json(earningsUpdates))
app.get('/api/us/filings', (c) => c.json(recentFilings))
app.get('/api/us/market-overview', (c) => c.json(marketOverview))

// ── API: Strategies ─────────────────────────────────────────────────────────
app.get('/api/strategies', (c) => c.json(strategies))
app.get('/api/strategies/:id', (c) => {
  const stg = strategies.find(s => s.id === c.req.param('id'))
  return stg ? c.json(stg) : c.json({ error: 'Not found' }, 404)
})

// ── API: Research Papers (因子研究论文库) ────────────────────────────────────
app.get('/api/research/papers', (c) => {
  const tag = c.req.query('tag') || ''
  let papers = factorResearchPapers
  if (tag) papers = papers.filter(p => p.tags.some(t => t.toLowerCase().includes(tag.toLowerCase())))
  return c.json({ total: papers.length, papers })
})

app.get('/api/research/ai-strategies', (c) => {
  const status = c.req.query('status') || ''
  let stgs = aiExtractedStrategies
  if (status) stgs = stgs.filter(s => s.status === status)
  return c.json({ total: stgs.length, strategies: stgs })
})

// ── API: ML for Finance ──────────────────────────────────────────────────────
app.get('/api/ml/models', (c) => c.json({ total: mlModels.length, models: mlModels }))
app.get('/api/ml/models/:id', (c) => {
  const m = mlModels.find(m => m.id === c.req.param('id'))
  return m ? c.json(m) : c.json({ error: 'Not found' }, 404)
})
app.get('/api/ml/signals', (c) => {
  const strength = c.req.query('strength') || ''
  let sigs = mlSignals
  if (strength) sigs = sigs.filter(s => s.signalStrength === strength)
  return c.json({ total: sigs.length, signals: sigs, generatedAt: new Date().toISOString() })
})
app.get('/api/ml/training', (c) => c.json({ total: trainingRuns.length, runs: trainingRuns }))
app.get('/api/ml/training/:id', (c) => {
  const r = trainingRuns.find(r => r.id === c.req.param('id'))
  return r ? c.json(r) : c.json({ error: 'Not found' }, 404)
})
app.get('/api/ml/regime', (c) => c.json(regimeData))

// ── API: Positions ──────────────────────────────────────────────────────────
app.get('/api/positions', (c) => c.json(positions))

// ── API: Trades ─────────────────────────────────────────────────────────────
app.get('/api/trades', (c) => {
  const strategyId = c.req.query('strategyId') || ''
  const filtered = strategyId ? trades.filter(t => t.strategyId === strategyId) : trades
  return c.json(filtered)
})

// ── API: Backtest ───────────────────────────────────────────────────────────
app.get('/api/backtest', (c) => c.json(backtestResults))
app.get('/api/backtest/:id', (c) => {
  const bt = backtestResults.find(b => b.id === c.req.param('id'))
  return bt ? c.json(bt) : c.json({ error: 'Not found' }, 404)
})

// ── API: Performance ────────────────────────────────────────────────────────
app.get('/api/performance', (c) => c.json(generatePerformanceReport()))

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QuantAlpha — 量化交易平台</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<link rel="stylesheet" href="/static/styles.css">
</head>
<body class="bg-[#0a0e1a] text-gray-200 font-sans">

<!-- SIDEBAR -->
<div id="sidebar" class="fixed left-0 top-0 h-full w-60 bg-[#0d1221] border-r border-[#1e2d4a] z-50 flex flex-col">
  <div class="px-5 py-4 border-b border-[#1e2d4a]">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
        <i class="fas fa-chart-line text-white text-sm"></i>
      </div>
      <div>
        <div class="text-white font-bold text-sm tracking-wide">QuantAlpha</div>
        <div class="text-[10px] text-cyan-400">US Equity · Quant Platform</div>
      </div>
    </div>
  </div>
  <nav class="flex-1 py-4 overflow-y-auto">
    <div class="px-3 mb-2">
      <p class="text-[10px] text-gray-500 uppercase tracking-widest px-2 mb-1">核心模块</p>
      ${navItems().map(n => `
      <button onclick="navigate('${n.id}')" id="nav-${n.id}"
        class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all text-gray-400 hover:text-white hover:bg-[#1a2540]">
        <i class="${n.icon} w-4 text-center"></i>
        <span>${n.label}</span>
        ${n.badge ? `<span class="ml-auto text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full">${n.badge}</span>` : ''}
      </button>`).join('')}
    </div>
  </nav>
  <div class="px-5 py-3 border-t border-[#1e2d4a]">
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
      <span class="text-[11px] text-gray-400">市场开盘中</span>
      <span id="clock" class="ml-auto text-[11px] text-gray-500"></span>
    </div>
    <div class="mt-2 text-[10px] text-gray-600">Data: Bloomberg → yfinance → EDGAR</div>
  </div>
</div>

<!-- MAIN CONTENT -->
<div class="ml-60 min-h-screen">
  <!-- TOP BAR -->
  <div class="sticky top-0 z-40 bg-[#0a0e1a]/95 backdrop-blur border-b border-[#1e2d4a] px-6 py-3 flex items-center gap-4">
    <div id="page-title" class="text-white font-semibold text-lg">总控台 Dashboard</div>
    <div class="ml-auto flex items-center gap-3">
      <div id="market-ticker" class="flex gap-4 text-xs"></div>
      <button onclick="refreshAll()" class="px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded text-xs hover:bg-blue-600/30 transition">
        <i class="fas fa-sync-alt mr-1"></i>刷新
      </button>
    </div>
  </div>

  <!-- PAGE CONTENT -->
  <div id="page-content" class="p-6">
    <div class="text-gray-400 text-center py-20">加载中...</div>
  </div>
</div>

<script src="/static/app.js"></script>
</body>
</html>`)
})

function navItems() {
  return [
    { id: 'dashboard',   icon: 'fas fa-th-large',      label: '总控台 Dashboard',   badge: '' },
    { id: 'datacenter',  icon: 'fas fa-database',       label: '数据中心',           badge: 'US' },
    { id: 'screener',    icon: 'fas fa-filter',         label: '五因子筛选',          badge: 'AI' },
    { id: 'strategies',  icon: 'fas fa-brain',          label: '策略管理',           badge: '' },
    { id: 'mlfinance',   icon: 'fas fa-robot',          label: 'ML for Finance',     badge: 'NEW' },
    { id: 'research',    icon: 'fas fa-flask',          label: '研究论文库',          badge: '4' },
    { id: 'trading',     icon: 'fas fa-exchange-alt',   label: '交易模块',           badge: '' },
    { id: 'backtest',    icon: 'fas fa-history',        label: '回测平台',           badge: '' },
    { id: 'performance', icon: 'fas fa-chart-bar',      label: '业绩分析',           badge: '' },
  ]
}

export default app
