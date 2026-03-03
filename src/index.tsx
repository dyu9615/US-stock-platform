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
  mlModels, mlSignals, trainingRuns, regimeData,
  btdCoreResult, contrarianResult, mlEnhancedResult, nvdaEarningsResult,
  btdStrategySummary, dipEvents, mlDipModel, spyBars,
  // Institutional Data Center
  fundamentalUniverse, priceVolumeUniverse,
  currentMacroSnapshot, currentERPSnapshot,
  macroHistory, erpHistory, dataCenterHealth,
  // News Agent — Data Layer #4
  NEWS_MANDATES, simulatedNewsArticles, morningBrief, newsAgentHealth,
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

// ── API: Backtest (legacy mock) ────────────────────────────────────────────
app.get('/api/backtest', (c) => c.json(backtestResults))
app.get('/api/backtest/:id', (c) => {
  const bt = backtestResults.find(b => b.id === c.req.param('id'))
  return bt ? c.json(bt) : c.json({ error: 'Not found' }, 404)
})

// ── API: BTD Engine — Buy-the-Dip & Contrarian ─────────────────────────────
// Summary list of all 4 strategies
app.get('/api/btd/summary', (c) => c.json({
  total: btdStrategySummary.length,
  strategies: btdStrategySummary,
  dataSource: 'Synthetic 10Y SPY series (GBM + regime shocks + earnings jumps)',
  antiLookAhead: 'All signals use t-1 indicators; entries filled at t+1 open',
  antiSurvivorship: 'Single ETF instrument (SPY) — no delisting bias',
  biasWarnings: [
    'Synthetic data approximates but does not replicate actual SPY returns',
    'Transaction costs: 10bps commission + 5bps slippage (realistic for retail)',
    'No short selling implemented in current version',
    'ML score is edge-runtime RF proxy — production model requires scikit-learn server',
  ],
}))

// Individual full backtest result (includes navCurve + trades)
app.get('/api/btd/result/:id', (c) => {
  const id = c.req.param('id')
  const all = [btdCoreResult, contrarianResult, mlEnhancedResult, nvdaEarningsResult]
  const result = all.find(r => r.id === id || r.strategyId === id)
  if (!result) return c.json({ error: 'Backtest not found', available: all.map(r => r.id) }, 404)
  // Downsample navCurve to max 200 points for API response size
  const step = Math.max(1, Math.floor(result.navCurve.length / 200))
  return c.json({
    ...result,
    navCurve: result.navCurve.filter((_, i) => i % step === 0),
  })
})

// Compare all strategies side-by-side
app.get('/api/btd/compare', (c) => {
  const all = [btdCoreResult, contrarianResult, mlEnhancedResult, nvdaEarningsResult]
  return c.json({
    strategies: all.map(r => ({
      id: r.id, name: r.strategyName,
      ...r.metrics,
    })),
    benchmark: {
      name: 'SPY Buy & Hold',
      totalReturn: btdCoreResult.metrics.benchmarkReturn,
      annualReturn: +(Math.pow(1 + btdCoreResult.metrics.benchmarkReturn / 100, 1 / 10) - 1).toFixed(4) * 100,
    },
  })
})

// Dip event catalog (ML labeling dataset)
app.get('/api/btd/dip-events', (c) => {
  const limit  = parseInt(c.req.query('limit')  || '50')
  const trigger = c.req.query('trigger') || ''
  let events = [...dipEvents]
  if (trigger) events = events.filter(e => e.triggerType === trigger)
  // Sort by most recent
  events.sort((a, b) => b.date.localeCompare(a.date))
  return c.json({
    total: events.length,
    reboundRate: +(events.filter(e => e.reboundWithin5d).length / events.length * 100).toFixed(1),
    mlSignalRate: +(events.filter(e => e.signalFired).length / events.length * 100).toFixed(1),
    events: events.slice(0, limit),
  })
})

// ML model card for dip prediction
app.get('/api/btd/ml-model', (c) => c.json(mlDipModel))

// SPY price series (for candlestick / indicator chart)
app.get('/api/btd/spy-bars', (c) => {
  const limit = parseInt(c.req.query('limit') || '252')  // default 1Y
  const bars = spyBars.slice(-limit).map(b => ({
    date: b.date, open: b.open, high: b.high, low: b.low, close: b.close,
    volume: b.volume, rsi14: b.rsi14, ma20: b.ma20, ma50: b.ma50,
    ma200: b.ma200, volumeRatio: b.volumeRatio, vix: b.vix,
    drawdownFromHigh: b.drawdownFromHigh,
  }))
  return c.json({ total: bars.length, bars })
})

// ── API: Performance ────────────────────────────────────────────────────────
app.get('/api/performance', (c) => c.json(generatePerformanceReport()))

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  INSTITUTIONAL DATA CENTER APIs                                         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── Section I: Macro / Liquidity / Sentiment ───────────────────────────────
app.get('/api/dc/macro/current', (c) => c.json(currentMacroSnapshot))
app.get('/api/dc/macro/history', (c) => {
  const limit = parseInt(c.req.query('limit') || '60')
  return c.json({ total: macroHistory.length, data: macroHistory.slice(-limit) })
})

// ── Section II: ERP (Equity Risk Premium) ─────────────────────────────────
app.get('/api/dc/erp/current', (c) => c.json(currentERPSnapshot))
app.get('/api/dc/erp/history', (c) => {
  const limit = parseInt(c.req.query('limit') || '60')
  return c.json({ total: erpHistory.length, data: erpHistory.slice(-limit) })
})

// ── Section III: Price / Volume Data ──────────────────────────────────────
app.get('/api/dc/pricevol', (c) => {
  const ticker = c.req.query('ticker')
  if (ticker) {
    const item = priceVolumeUniverse.find(p => p.ticker === ticker.toUpperCase())
    return item ? c.json(item) : c.json({ error: 'Not found' }, 404)
  }
  return c.json({ total: priceVolumeUniverse.length, data: priceVolumeUniverse })
})

// ── Section IV: Fundamental / GAAP-Adjusted Valuation ─────────────────────
app.get('/api/dc/fundamental', (c) => {
  const ticker = c.req.query('ticker')
  const sort   = c.req.query('sort') || 'evEbitdaPercentile'
  if (ticker) {
    const item = fundamentalUniverse.find(f => f.ticker === ticker.toUpperCase())
    return item ? c.json(item) : c.json({ error: 'Not found' }, 404)
  }
  const sorted = [...fundamentalUniverse].sort((a, b) => (a as any)[sort] - (b as any)[sort])
  return c.json({
    total: sorted.length,
    gaapAdjustmentNote: 'All EBITDA figures are Adjusted (SBC added back). FCF = OCF - CapEx - Capitalized Software.',
    data: sorted,
  })
})

// ── Section V: Data Center Health & Engineering ────────────────────────────
app.get('/api/dc/health', (c) => c.json(dataCenterHealth))

// ── Full Dashboard payload (single call for dashboard page) ───────────────
app.get('/api/dc/dashboard', (c) => {
  return c.json({
    macro:   currentMacroSnapshot,
    erp:     currentERPSnapshot,
    topPriceVol: priceVolumeUniverse.filter(p => p.volumeRatio > 1.2 || p.rsi14 < 40),
    cheapestByEVEbitda: [...fundamentalUniverse].sort((a,b) => a.evEbitda - b.evEbitda).slice(0, 4),
    health:  dataCenterHealth,
    macroChart: macroHistory.slice(-60),
    erpChart:   erpHistory.slice(-60),
  })
})

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  NEWS AGENT APIs  — Data Layer #4                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// GET /api/news/mandates — return all 4 investment mandates with metadata
app.get('/api/news/mandates', (c) => {
  return c.json({
    total: NEWS_MANDATES.length,
    mandates: NEWS_MANDATES.map(m => ({
      ...m,
      articleCount: simulatedNewsArticles.filter(a => a.mandate === m.id).length,
      sentimentBreakdown: {
        bullish: simulatedNewsArticles.filter(a => a.mandate === m.id && a.sentiment === 'bullish').length,
        bearish: simulatedNewsArticles.filter(a => a.mandate === m.id && a.sentiment === 'bearish').length,
        neutral: simulatedNewsArticles.filter(a => a.mandate === m.id && a.sentiment === 'neutral').length,
      },
    })),
  })
})

// GET /api/news/articles?mandate=AI_Capex_Bubble&days=2&limit=20
app.get('/api/news/articles', (c) => {
  const mandate = c.req.query('mandate') || ''
  const days    = parseInt(c.req.query('days')  || '3')
  const limit   = parseInt(c.req.query('limit') || '50')
  const cutoff  = new Date(Date.now() - days * 86_400_000).toISOString()

  let articles = [...simulatedNewsArticles]
  if (mandate) articles = articles.filter(a => a.mandate === mandate)
  // Filter by recency
  articles = articles.filter(a => `${a.date}T${a.time}` >= cutoff.slice(0, 19))
  // Sort newest first
  articles.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))

  return c.json({
    total: articles.length,
    mandate: mandate || 'ALL',
    days,
    generatedAt: new Date().toISOString(),
    sentimentBreakdown: {
      bullish: articles.filter(a => a.sentiment === 'bullish').length,
      bearish: articles.filter(a => a.sentiment === 'bearish').length,
      neutral: articles.filter(a => a.sentiment === 'neutral').length,
    },
    articles: articles.slice(0, limit),
  })
})

// GET /api/news/brief — AI-generated morning brief (simulated Claude 3.5 Sonnet)
app.get('/api/news/brief', (c) => c.json(morningBrief))

// GET /api/news/health — agent run schedule + pipeline metadata
app.get('/api/news/health', (c) => {
  return c.json({
    ...newsAgentHealth,
    mandates: NEWS_MANDATES.map(m => ({
      id: m.id, label: m.label,
      articleCount: simulatedNewsArticles.filter(a => a.mandate === m.id).length,
      query: m.query,
    })),
    dataSource: 'Google News RSS (production) / Simulated articles (sandbox)',
    implementation: 'news_agent.py — feedparser + Boolean URL encoding. Zero cost, institutional-grade filtering.',
  })
})

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  LIVE DATA PROXY — forwards to Python data microservice (port 3001)     ║
// ║  Layer 1: Yahoo Finance real data  |  Layer 2: FactSet cross-validation ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const DATA_SVC = 'http://localhost:3001'

async function proxyFetch(url: string): Promise<Response> {
  const resp = await fetch(url)
  const body = await resp.text()
  return new Response(body, {
    status: resp.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Real Yahoo Finance quote ────────────────────────────────────────────────
app.get('/api/live/quote/:ticker', async (c) => {
  try {
    return proxyFetch(`${DATA_SVC}/api/yf/quote/${c.req.param('ticker')}`)
  } catch(e: any) {
    return c.json({ error: e.message, source: 'data_service_unavailable' }, 503)
  }
})

// ── Live screener universe (real YF data + 5-factor scoring) ────────────────
app.get('/api/live/screener', async (c) => {
  const tickers = c.req.query('tickers') || ''
  try {
    const url = tickers
      ? `${DATA_SVC}/api/yf/screener?tickers=${tickers}`
      : `${DATA_SVC}/api/yf/screener`
    return proxyFetch(url)
  } catch(e: any) {
    return c.json({ error: e.message, source: 'data_service_unavailable', stocks: [] }, 503)
  }
})

// ── Full audit-grade deep analysis (EV / Adj.EBITDA / FCF / Net Leverage) ──
app.get('/api/live/deep/:ticker', async (c) => {
  try {
    return proxyFetch(`${DATA_SVC}/api/yf/deep/${c.req.param('ticker')}`)
  } catch(e: any) {
    return c.json({ error: e.message, source: 'data_service_unavailable' }, 503)
  }
})

// ── Quarterly financials (P&L / Balance / Cash flow) ───────────────────────
app.get('/api/live/financials/:ticker', async (c) => {
  try {
    return proxyFetch(`${DATA_SVC}/api/yf/financials/${c.req.param('ticker')}`)
  } catch(e: any) {
    return c.json({ error: e.message, source: 'data_service_unavailable' }, 503)
  }
})

// ── 1-year price history + OHLCV ────────────────────────────────────────────
app.get('/api/live/history/:ticker', async (c) => {
  const period = c.req.query('period') || '1y'
  const interval = c.req.query('interval') || '1d'
  try {
    return proxyFetch(`${DATA_SVC}/api/yf/history/${c.req.param('ticker')}?period=${period}&interval=${interval}`)
  } catch(e: any) {
    return c.json({ error: e.message, source: 'data_service_unavailable' }, 503)
  }
})

// ── Analyst upgrades/downgrades ──────────────────────────────────────────────
app.get('/api/live/analyst/:ticker', async (c) => {
  try {
    return proxyFetch(`${DATA_SVC}/api/yf/analyst/${c.req.param('ticker')}`)
  } catch(e: any) {
    return c.json({ error: e.message, source: 'data_service_unavailable' }, 503)
  }
})

// ── Real macro data (VIX, Treasury yields) ──────────────────────────────────
app.get('/api/live/macro', async (c) => {
  try {
    return proxyFetch(`${DATA_SVC}/api/yf/macro`)
  } catch(e: any) {
    return c.json({ error: e.message, source: 'data_service_unavailable' }, 503)
  }
})

// ── FactSet NTM consensus estimates (MUST be before wildcard :ticker route) ──
app.get('/api/live/factset/consensus/:ticker', async (c) => {
  try {
    return proxyFetch(`${DATA_SVC}/api/factset/consensus/${c.req.param('ticker')}`)
  } catch(e: any) {
    return c.json({ error: e.message }, 503)
  }
})

// ── FactSet + YF cross-validation with >1% divergence flags ─────────────────
app.get('/api/live/factset/crossvalidate/:ticker', async (c) => {
  try {
    return proxyFetch(`${DATA_SVC}/api/factset/crossvalidate/${c.req.param('ticker')}`)
  } catch(e: any) {
    return c.json({ error: e.message }, 503)
  }
})

// ── FactSet ML training data ──────────────────────────────────────────────────
app.get('/api/live/factset/ml-data/:ticker', async (c) => {
  const years = c.req.query('years') || '3'
  try {
    return proxyFetch(`${DATA_SVC}/api/factset/ml-data/${c.req.param('ticker')}?years=${years}`)
  } catch(e: any) {
    return c.json({ error: e.message }, 503)
  }
})

// ── FactSet Fundamentals API (Company financial data) ─────────────────────────
app.get('/api/live/factset/fundamentals/:ticker', async (c) => {
  const periodicity = c.req.query('periodicity') || 'QTR'
  const periods = c.req.query('periods') || '8'
  try {
    return proxyFetch(`${DATA_SVC}/api/factset/fundamentals/${c.req.param('ticker')}?periodicity=${periodicity}&periods=${periods}`)
  } catch(e: any) {
    return c.json({ error: e.message }, 503)
  }
})

// ── FactSet News API (Headlines) ──────────────────────────────────────────────
app.get('/api/live/factset/news', async (c) => {
  const ticker   = c.req.query('ticker') || ''
  const category = c.req.query('category') || 'all'
  const limit    = c.req.query('limit') || '20'
  try {
    return proxyFetch(`${DATA_SVC}/api/factset/news/headlines?ticker=${ticker}&category=${category}&limit=${limit}`)
  } catch(e: any) {
    return c.json({ error: e.message, headlines: [] }, 503)
  }
})

// ── FactSet Concordance API (Entity match) ────────────────────────────────────
app.get('/api/live/factset/concordance', async (c) => {
  const name   = c.req.query('name') || ''
  const ticker = c.req.query('ticker') || ''
  try {
    return proxyFetch(`${DATA_SVC}/api/factset/concordance/entity?name=${encodeURIComponent(name)}&ticker=${ticker}`)
  } catch(e: any) {
    return c.json({ error: e.message }, 503)
  }
})

// ── FactSet Universal Screening API ──────────────────────────────────────────
app.get('/api/live/factset/screening', async (c) => {
  const screen   = c.req.query('screen') || 'value'
  const universe = c.req.query('universe') || 'SP500'
  const limit    = c.req.query('limit') || '50'
  try {
    return proxyFetch(`${DATA_SVC}/api/factset/screening/run?screen=${screen}&universe=${universe}&limit=${limit}`)
  } catch(e: any) {
    return c.json({ error: e.message, stocks: [] }, 503)
  }
})

// ── FactSet Security Intelligence API ────────────────────────────────────────
app.get('/api/live/factset/security-intel/:ticker', async (c) => {
  const outputType = c.req.query('outputType') || 'full'
  try {
    return proxyFetch(`${DATA_SVC}/api/factset/security-intel/${c.req.param('ticker')}?outputType=${outputType}`)
  } catch(e: any) {
    return c.json({ error: e.message }, 503)
  }
})

// ── FactSet Estimates — Rolling consensus ──────────────────────────────────────
app.get('/api/live/factset/estimates/rolling/:ticker', async (c) => {
  const period = c.req.query('period') || 'NTM'
  try {
    return proxyFetch(`${DATA_SVC}/api/factset/estimates/rolling/${c.req.param('ticker')}?period=${period}`)
  } catch(e: any) {
    return c.json({ error: e.message }, 503)
  }
})

// ── FactSet Estimates — Earnings surprise history ─────────────────────────────
app.get('/api/live/factset/estimates/surprise/:ticker', async (c) => {
  const periods = c.req.query('periods') || '8'
  try {
    return proxyFetch(`${DATA_SVC}/api/factset/estimates/surprise/${c.req.param('ticker')}?periods=${periods}`)
  } catch(e: any) {
    return c.json({ error: e.message }, 503)
  }
})

// ── FactSet ticker validate (wildcard — keep LAST among factset routes) ───────
app.get('/api/live/factset/:ticker', async (c) => {
  try {
    return proxyFetch(`${DATA_SVC}/api/factset/validate/${c.req.param('ticker')}`)
  } catch(e: any) {
    return c.json({ error: e.message, source: 'data_service_unavailable' }, 503)
  }
})

// ── Live news (Yahoo Finance + FactSet + Global + Congress) ──────────────────
app.get('/api/live/news', async (c) => {
  const cat = c.req.query('category') || 'all'
  const limit = c.req.query('limit') || '50'
  try {
    return proxyFetch(`${DATA_SVC}/api/news/live?category=${cat}&limit=${limit}`)
  } catch(e: any) {
    return c.json({ error: e.message, articles: [] }, 503)
  }
})

// ── News for specific ticker ──────────────────────────────────────────────────
app.get('/api/live/news/ticker/:ticker', async (c) => {
  try {
    return proxyFetch(`${DATA_SVC}/api/news/ticker/${c.req.param('ticker')}`)
  } catch(e: any) {
    return c.json({ error: e.message, articles: [] }, 503)
  }
})

// ── Data service health ───────────────────────────────────────────────────────
app.get('/api/live/health', async (c) => {
  try {
    return proxyFetch(`${DATA_SVC}/api/health`)
  } catch(e: any) {
    return c.json({ status: 'offline', error: e.message }, 503)
  }
})

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
<body class="font-sans" style="background:#f5f6fa;color:#111827">

<!-- SIDEBAR -->
<div id="sidebar" class="fixed left-0 top-0 h-full w-60 z-50 flex flex-col" style="background:#ffffff;border-right:1px solid #e2e4ec;box-shadow:2px 0 8px rgba(0,0,0,0.05)">
  <div class="px-5 py-4" style="border-bottom:1px solid #e2e4ec">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-lg flex items-center justify-center" style="background:linear-gradient(135deg,#4f46e5,#2563eb)">
        <i class="fas fa-chart-line text-white text-sm"></i>
      </div>
      <div>
        <div class="font-bold text-sm tracking-wide" style="color:#111827">QuantAlpha</div>
        <div class="text-[10px]" style="color:#6b7280">机构量化平台</div>
      </div>
    </div>
  </div>
  <nav class="flex-1 py-3 overflow-y-auto">
    <div class="px-3 mb-1">
      <p class="text-[10px] uppercase tracking-widest px-2 mb-2" style="color:#9ca3af;letter-spacing:0.08em">核心模块</p>
      ${navItems().map(n => `
      <button onclick="navigate('${n.id}')" id="nav-${n.id}"
        class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all" style="color:#6b7280">
        <i class="${n.icon} w-4 text-center text-sm"></i>
        <span class="text-sm">${n.label}</span>
        ${n.badge ? `<span class="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold" style="background:#eff6ff;color:#4f46e5">${n.badge}</span>` : ''}
      </button>`).join('')}
    </div>
  </nav>
  <div class="px-5 py-3" style="border-top:1px solid #e2e4ec">
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full animate-pulse" style="background:#059669"></div>
      <span class="text-[11px]" style="color:#6b7280">市场开盘中</span>
      <span id="clock" class="ml-auto text-[11px] font-mono" style="color:#9ca3af"></span>
    </div>
    <div class="mt-1.5 text-[10px]" style="color:#9ca3af">Yahoo Finance · FRED · CBOE · FactSet</div>
  </div>
</div>

<!-- MAIN CONTENT -->
<div class="ml-60 min-h-screen" style="background:#f5f6fa">
  <!-- TOP BAR -->
  <div class="sticky top-0 z-40 px-6 py-3 flex items-center gap-4" style="background:rgba(255,255,255,0.95);backdrop-filter:blur(8px);border-bottom:1px solid #e2e4ec;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
    <div id="page-title" class="font-semibold text-base" style="color:#1e2440">总控台 — 机构市场监控</div>
    <div class="ml-auto flex items-center gap-3">
      <div id="market-ticker" class="flex gap-4 text-xs"></div>
      <button onclick="refreshAll()" class="px-3 py-1.5 rounded-lg text-xs font-medium transition" style="background:#eff6ff;border:1px solid #bfdbfe;color:#2563eb">
        <i class="fas fa-sync-alt mr-1"></i>刷新
      </button>
    </div>
  </div>

  <!-- PAGE CONTENT -->
  <div id="page-content" class="p-6">
    <div class="text-center py-20" style="color:#9ca3af">加载中...</div>
  </div>
</div>
<script src="/static/app.js"></script>
</body>
</html>`)
})

function navItems() {
  return [
    { id: 'dashboard',   icon: 'fas fa-th-large',      label: '总控台',     badge: '' },
    { id: 'datacenter',  icon: 'fas fa-database',       label: '数据中心',   badge: 'US' },
    { id: 'screener',    icon: 'fas fa-filter',         label: '五因子筛选', badge: 'AI' },
    { id: 'stockanalysis', icon: 'fas fa-microscope',    label: '个股深度', badge: 'LIVE' },
    { id: 'strategies',  icon: 'fas fa-brain',          label: '策略管理',   badge: '' },
    { id: 'mlfinance',   icon: 'fas fa-robot',          label: '机器学习',   badge: 'NEW' },
    { id: 'newsagent',   icon: 'fas fa-newspaper',      label: '新闻情报',   badge: '6M' },
    { id: 'research',    icon: 'fas fa-flask',          label: '研究论文库', badge: '4' },
    { id: 'trading',     icon: 'fas fa-exchange-alt',   label: '交易模块',   badge: '' },
    { id: 'backtest',    icon: 'fas fa-history',        label: '回测平台',   badge: '' },
    { id: 'performance', icon: 'fas fa-chart-bar',      label: '业绩分析',   badge: '' },
  ]
}

export default app
