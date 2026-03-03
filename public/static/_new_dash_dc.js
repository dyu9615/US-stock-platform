// ║  1. DASHBOARD — Institutional Panic Monitor & Valuation Dashboard    ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderDashboard(el) {
  el.innerHTML = `<div class="text-gray-400 text-center py-10"><i class="fas fa-spinner fa-spin mr-2"></i>Loading institutional dashboard...</div>`

  const [overRes, dcRes] = await Promise.all([
    axios.get(`${API}/api/overview`),
    axios.get(`${API}/api/dc/dashboard`),
  ])
  const ov = overRes.data
  const dc = dcRes.data
  const macro = dc.macro
  const erp   = dc.erp
  const macroChart = dc.macroChart
  const erpChart   = dc.erpChart

  // Panic color helpers
  const panicColor = p => p >= 70 ? 'text-red-400' : p >= 45 ? 'text-orange-400' : p >= 20 ? 'text-amber-400' : 'text-emerald-400'
  const panicBg    = p => p >= 70 ? 'bg-red-900/30 border-red-600/30' : p >= 45 ? 'bg-orange-900/20 border-orange-600/30' : p >= 20 ? 'bg-amber-900/20 border-amber-600/30' : 'bg-emerald-900/10 border-emerald-700/20'
  const erpColor   = s => ({overvalued:'text-red-400',rich:'text-orange-400',fair:'text-amber-400',cheap:'text-emerald-400',deeply_cheap:'text-cyan-400'})[s] || 'text-gray-400'
  const hyColor    = s => ({normal:'text-emerald-400',caution:'text-amber-400',crisis:'text-red-400'})[s]
  const breadthColor = s => ({washout:'text-red-400',weak:'text-orange-400',neutral:'text-gray-300',strong:'text-emerald-400'})[s]
  const pcrLabel   = s => ({extreme_fear:'极度恐慌',fear:'恐惧',neutral:'中性',complacency:'自满'})[s]

  el.innerHTML = `
  <!-- TOP: System KPIs -->
  <div class="grid grid-cols-4 gap-3 mb-4">
    ${kpiCard('总资产', fmt.money(ov.totalAssets), `日盈亏 ${ov.dailyPnl>=0?'+':''}${fmt.money(ov.dailyPnl)}`, 'fas fa-building-columns', 'text-cyan-400')}
    ${kpiCard('总收益', `+${ov.totalPnlPct.toFixed(2)}%`, `累计 ${fmt.money(ov.totalPnl)}`, 'fas fa-chart-line', 'text-emerald-400')}
    ${kpiCard('运行策略', `${ov.runningStrategies}/${ov.totalStrategies}`, `${ov.openPositions}个持仓`, 'fas fa-brain', 'text-amber-400')}
    ${kpiCard('夏普/最大回撤', `${ov.sharpe}`, `MaxDD ${ov.maxDrawdown}%`, 'fas fa-balance-scale', 'text-purple-400')}
  </div>

  <!-- PANIC MONITOR ROW -->
  <div class="card p-4 mb-4 ${panicBg(macro.panicScore)}">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full ${macro.panicScore>=45?'bg-red-500/20 animate-pulse':'bg-emerald-500/10'} flex items-center justify-center">
          <i class="fas fa-heartbeat ${panicColor(macro.panicScore)} text-lg"></i>
        </div>
        <div>
          <div class="text-white font-bold text-sm">市场恐慌监控仪表盘 — Panic Monitor</div>
          <div class="text-[10px] text-gray-500">实时追踪流动性挤兑信号 · 数据源: CBOE · FRED · Bloomberg</div>
        </div>
      </div>
      <div class="text-right">
        <div class="text-[10px] text-gray-500">综合恐慌指数</div>
        <div class="text-3xl font-bold ${panicColor(macro.panicScore)}">${macro.panicScore}</div>
        <div class="text-xs font-semibold ${panicColor(macro.panicScore)}">${macro.panicLabel}</div>
      </div>
    </div>
    <div class="grid grid-cols-5 gap-3">
      <!-- VIX Term Structure -->
      <div class="bg-[#0a0e1a]/60 rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">VIX期限结构</div>
        <div class="text-lg font-bold ${macro.vixContango?'text-emerald-400':'text-red-400 animate-pulse'}">${macro.vix}</div>
        <div class="flex gap-1.5 text-[10px] mt-1">
          <span class="text-gray-500">VX1:</span><span class="text-gray-300">${macro.vx1}</span>
          <span class="text-gray-500">VX3:</span><span class="text-gray-300">${macro.vx3}</span>
        </div>
        <div class="mt-1.5 text-[10px] ${macro.vixContango?'text-emerald-500':'text-red-400'}">
          ${macro.vixContango ? '✓ 升水(Contango) — 正常' : '⚠ 贴水倒挂(Backwardation) — 极度恐慌'}
        </div>
        <div class="text-[9px] text-gray-600 mt-0.5">公式: VIX/VX1-1 = ${(macro.vixTermStructure*100).toFixed(1)}%</div>
      </div>
      <!-- HY OAS -->
      <div class="bg-[#0a0e1a]/60 rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">高收益债 OAS利差</div>
        <div class="text-lg font-bold ${hyColor(macro.hyOasSignal)}">${macro.hyOas} bps</div>
        <div class="text-[10px] mt-1 ${hyColor(macro.hyOasSignal)}">
          ${macro.hyOasSignal === 'normal' ? '✓ <400bps 正常' : macro.hyOasSignal === 'caution' ? '⚡ 400-800 警惕' : '🚨 >800 危机'}
        </div>
        <div class="text-[9px] text-gray-600 mt-0.5">FRED: BAMLH0A0HYM2</div>
        <div class="text-[9px] text-gray-600">假摔标准: OAS维持&lt;400</div>
      </div>
      <!-- Yield Curve -->
      <div class="bg-[#0a0e1a]/60 rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">收益率曲线</div>
        <div class="text-lg font-bold ${macro.yieldCurveInverted?'text-red-400':'text-emerald-400'}">${macro.yieldCurve} bps</div>
        <div class="flex gap-1 text-[10px] mt-1">
          <span class="text-gray-500">10Y:</span><span class="text-gray-300">${macro.usTreasury10y}%</span>
          <span class="text-gray-500">2Y:</span><span class="text-gray-300">${macro.usTreasury2y}%</span>
        </div>
        <div class="mt-1 text-[10px] ${macro.yieldCurveInverted?'text-red-400':'text-gray-400'}">
          ${macro.yieldCurveInverted ? '⚠ 倒挂 — 衰退预期' : '曲线正常'}
        </div>
        <div class="text-[9px] text-gray-600">FRED: DGS10-DGS2</div>
      </div>
      <!-- Market Breadth -->
      <div class="bg-[#0a0e1a]/60 rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">市场宽度 S5TH200X</div>
        <div class="text-lg font-bold ${breadthColor(macro.breadthSignal)}">${macro.pctAbove200ma}%</div>
        <div class="text-[10px] mt-1 ${breadthColor(macro.breadthSignal)}">
          ${macro.breadthSignal === 'washout' ? '🚨 Washout! <15% — 无差别抛售' : macro.breadthSignal === 'weak' ? '⚡ 偏弱 15-40%' : macro.breadthSignal === 'strong' ? '✓ 强势 >70%' : '中性 40-70%'}
        </div>
        <div class="text-[9px] text-gray-600 mt-0.5">500只成分股中%高于200日均</div>
      </div>
      <!-- Put/Call Ratio -->
      <div class="bg-[#0a0e1a]/60 rounded p-3">
        <div class="text-[10px] text-gray-500 mb-1">Put/Call Ratio</div>
        <div class="text-lg font-bold ${macro.putCallSignal==='extreme_fear'?'text-red-400':macro.putCallSignal==='fear'?'text-orange-400':'text-emerald-400'}">${macro.putCallRatio}</div>
        <div class="text-[10px] mt-1 ${macro.putCallSignal==='extreme_fear'?'text-red-400':'text-gray-400'}">
          ${pcrLabel(macro.putCallSignal)}
          ${macro.putCallRatio > 1.1 ? ' — 经典反向看多信号!' : ''}
        </div>
        <div class="text-[9px] text-gray-600 mt-0.5">CBOE · >1.1 = 极度恐慌反转</div>
      </div>
    </div>
  </div>

  <!-- ERP + VIX History row -->
  <div class="grid grid-cols-3 gap-4 mb-4">
    <!-- ERP Gauge -->
    <div class="card p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-semibold text-white">股权风险溢价 (ERP)</div>
        <span class="badge ${erp.erpSignal==='overvalued'?'badge-miss':erp.erpSignal==='cheap'||erp.erpSignal==='deeply_cheap'?'badge-beat':'badge-backtesting'} text-[10px]">
          ${erp.erpSignal.toUpperCase()}
        </span>
      </div>
      <div class="flex items-end gap-3 mb-2">
        <div class="text-3xl font-bold ${erpColor(erp.erpSignal)}">${erp.erp.toFixed(2)}%</div>
        <div class="text-xs text-gray-500 mb-1">EarningsYield(${erp.sp500EarningsYield}%) − 10Y(${erp.usTreasury10y}%)</div>
      </div>
      <!-- ERP Gauge bar -->
      <div class="relative h-3 rounded-full bg-gradient-to-r from-emerald-600 via-amber-500 to-red-600 mb-2">
        <div class="absolute top-0 w-3 h-3 rounded-full bg-white shadow border-2 border-gray-900 transform -translate-x-1/2"
          style="left:${Math.max(2, Math.min(98, 100 - Math.max(0, Math.min(6, erp.erp)) / 6 * 100))}%"></div>
      </div>
      <div class="flex justify-between text-[9px] text-gray-600 mb-2">
        <span>Overvalued (&lt;1%)</span><span>Fair (2-3.5%)</span><span>Cheap (&gt;5%)</span>
      </div>
      <div class="text-[10px] text-amber-300 leading-snug">${erp.erpNote}</div>
      <div class="mt-2 text-[9px] text-gray-600">S&P500 Forward P/E: ${erp.sp500ForwardPE}× · 历史分位: 第${erp.erpHistoricalPercentile}%</div>
    </div>

    <!-- VIX + HY Chart -->
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-1">VIX & HY利差 (252日)</div>
      <div class="text-[10px] text-gray-500 mb-2">恐慌指标历史走势 · 两次模拟危机区域</div>
      <div class="chart-wrap h-44"><canvas id="dashVixChart"></canvas></div>
    </div>

    <!-- ERP History chart -->
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-1">ERP历史 (252日)</div>
      <div class="text-[10px] text-gray-500 mb-2">股权风险溢价 · 绿线=健康阈值(3.5%)</div>
      <div class="chart-wrap h-44"><canvas id="dashErpChart"></canvas></div>
    </div>
  </div>

  <!-- Bottom: cheapest stocks + oversold alerts -->
  <div class="grid grid-cols-2 gap-4">
    <!-- Cheapest by EV/EBITDA -->
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">
        <i class="fas fa-tags mr-1 text-emerald-400"></i>
        估值洼地 — 最低 EV/Adj.EBITDA 分位数
      </div>
      <div class="space-y-2">
        ${dc.cheapestByEVEbitda.map(f=>`
        <div class="flex items-center gap-3 p-2 rounded bg-[#0d1630]">
          <div class="w-10 h-10 rounded-lg bg-emerald-900/30 flex items-center justify-center">
            <span class="text-xs font-bold text-emerald-400">${f.ticker}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-white">${f.name}</div>
            <div class="text-[10px] text-gray-500 truncate">${f.sector}</div>
          </div>
          <div class="text-right">
            <div class="text-sm font-bold text-emerald-400">${f.evEbitda.toFixed(1)}×</div>
            <div class="text-[10px] text-gray-500">P${f.evEbitdaPercentile}分位</div>
          </div>
          <div class="text-right">
            <div class="text-xs ${f.fcfYieldSignal==='high_attractive'?'text-emerald-400':'text-gray-300'}">${f.fcfYield.toFixed(1)}% FCF</div>
            <div class="text-[10px] ${f.netLeverageSignal==='danger'?'text-red-400':'text-gray-500'}">杠杆 ${f.netLeverage.toFixed(1)}×</div>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <!-- Oversold / Volume Alerts -->
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">
        <i class="fas fa-exclamation-triangle mr-1 text-amber-400"></i>
        量价异动 & 超卖信号
      </div>
      <div class="space-y-2">
        ${dc.topPriceVol.map(p=>`
        <div class="flex items-center gap-3 p-2 rounded bg-[#0d1630]">
          <div class="w-10 h-10 rounded-lg ${p.rsi14<30?'bg-red-900/30':p.rsi14<40?'bg-orange-900/20':'bg-amber-900/20'} flex items-center justify-center">
            <span class="text-xs font-bold ${p.rsi14<30?'text-red-400':p.rsi14<40?'text-orange-400':'text-amber-400'}">${p.ticker}</span>
          </div>
          <div class="flex-1">
            <div class="text-xs font-semibold text-white">${p.name}</div>
            <div class="flex gap-3 mt-0.5 text-[10px]">
              <span class="text-gray-500">RSI: <span class="${p.rsi14<30?'text-red-400':p.rsi14<40?'text-orange-400':'text-gray-300'}">${p.rsi14}</span></span>
              <span class="text-gray-500">Vol: <span class="text-amber-400">${p.volumeRatio.toFixed(2)}×</span></span>
              <span class="text-gray-500">ATR: <span class="text-gray-300">${p.atrPct.toFixed(1)}%</span></span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm font-semibold text-white">$${p.adjClose}</div>
            <div class="text-[10px] text-red-400">${p.drawdownFrom52w.toFixed(1)}% off high</div>
          </div>
          ${p.rsi14<30?`<div class="text-[9px] bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded">极度超卖</div>`:''}
          ${p.volumeRatio>2?`<div class="text-[9px] bg-amber-900/30 text-amber-300 px-1.5 py-0.5 rounded">放量×${p.volumeRatio.toFixed(1)}</div>`:''}
        </div>`).join('')}
      </div>
    </div>
  </div>
  `

  // Charts
  setTimeout(() => {
    // VIX + HY chart
    const vixCtx = document.getElementById('dashVixChart')?.getContext('2d')
    if (vixCtx) {
      if (charts.dashVix) charts.dashVix.destroy()
      const labels = macroChart.map(d => d.date.slice(5))
      charts.dashVix = new Chart(vixCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'VIX', data: macroChart.map(d=>d.vix),
              borderColor: '#f87171', borderWidth: 1.5, pointRadius: 0, tension: 0.3, yAxisID: 'y' },
            { label: 'HY OAS (bps/10)', data: macroChart.map(d=>d.hyOas/10),
              borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0, tension: 0.3,
              borderDash: [3,3], yAxisID: 'y' },
          ]
        },
        options: { ...chartOpts(''), plugins: { legend: { labels: { color:'#9ca3af', font:{size:9} } } },
          scales: { x:{display:false}, y:{grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#6b7280', font:{size:9}}} } }
      })
    }

    // ERP chart
    const erpCtx = document.getElementById('dashErpChart')?.getContext('2d')
    if (erpCtx) {
      if (charts.dashErp) charts.dashErp.destroy()
      const labels = erpChart.map(d => d.date.slice(5))
      charts.dashErp = new Chart(erpCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'ERP%', data: erpChart.map(d=>d.erp),
              borderColor: '#22d3ee', borderWidth: 2, pointRadius: 0, tension: 0.3,
              fill: { target: 'origin', above: 'rgba(34,211,238,0.08)', below: 'rgba(248,113,113,0.08)' } },
            { label: '3.5% 健康线', data: erpChart.map(_=>3.5),
              borderColor: '#22c55e', borderWidth: 1, borderDash: [4,3], pointRadius: 0 },
          ]
        },
        options: { ...chartOpts('ERP%'), plugins:{ legend:{labels:{color:'#9ca3af',font:{size:9}}} },
          scales: { x:{display:false}, y:{grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#6b7280',font:{size:9}}} } }
      })
    }
  }, 60)
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  2. INSTITUTIONAL DATA CENTER — 机构级底层数据中心                    ║
// ╚══════════════════════════════════════════════════════════════════════╝
async function renderDataCenter(el) {
  el.innerHTML = `<div class="text-gray-400 text-center py-10"><i class="fas fa-spinner fa-spin mr-2"></i>Loading institutional data center...</div>`

  const [macroRes, pvRes, fundRes, healthRes] = await Promise.all([
    axios.get(`${API}/api/dc/macro/history?limit=90`),
    axios.get(`${API}/api/dc/pricevol`),
    axios.get(`${API}/api/dc/fundamental?sort=evEbitdaPercentile`),
    axios.get(`${API}/api/dc/health`),
  ])
  const macroHist = macroRes.data.data
  const pvData    = pvRes.data.data
  const fundData  = fundRes.data.data
  const health    = healthRes.data

  const tabIds = ['macro','pricevol','fundamental','engineering']
  const tabLabels = ['I. 宏观流动性','II. 量价数据','III. 估值基本面','IV. 工程规范']

  el.innerHTML = `
  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <div>
      <div class="text-white font-bold text-base flex items-center gap-2">
        <i class="fas fa-server text-cyan-400"></i>
        机构级底层数据中心 — Institutional Data Center
      </div>
      <div class="text-xs text-gray-500 mt-0.5">取数口径严格对齐 Data Center.docx · 数据源优先级: Bloomberg → FRED → CBOE → yfinance → SEC EDGAR</div>
    </div>
    <div class="flex items-center gap-2 text-[10px]">
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-emerald-400"></div><span class="text-gray-400">Live</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-amber-400"></div><span class="text-gray-400">15min Delay</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-gray-500"></div><span class="text-gray-400">Mock/Demo</span>
      </div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex gap-1 mb-4 border-b border-[#1e2d4a] pb-0">
    ${tabIds.map((id,i)=>`<button id="dc-tab-${id}" onclick="dcTab('${id}')"
      class="tab-btn ${i===0?'active':''} text-xs px-3 py-1.5">${tabLabels[i]}</button>`).join('')}
  </div>

  <!-- TAB I: Macro / Liquidity -->
  <div id="dc-pane-macro">
    <div class="text-xs text-gray-500 mb-3 bg-[#0d1221] border border-blue-900/30 rounded p-2">
      <i class="fas fa-info-circle mr-1 text-blue-400"></i>
      <strong class="text-gray-300">取数口径说明:</strong>
      VIX期限结构 = VIX现货/VX1-1，贴水倒挂(>0)为极度恐慌信号 ·
      HY OAS via FRED BAMLH0A0HYM2 · 市场宽度 = S&P500中Close>200日SMA占比 ·
      Put/Call Ratio via CBOE
    </div>
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-2">VIX期限结构 & Put/Call Ratio</div>
        <div class="chart-wrap h-52"><canvas id="dcVixChart"></canvas></div>
      </div>
      <div class="card p-4">
        <div class="text-sm font-semibold text-white mb-2">HY利差 & 市场宽度</div>
        <div class="chart-wrap h-52"><canvas id="dcHyChart"></canvas></div>
      </div>
    </div>
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">宏观流动性日历 (近90日快照)</div>
      <div class="overflow-x-auto max-h-56 overflow-y-auto">
        <table class="data-table text-xs">
          <thead><tr>
            <th>日期</th><th>VIX</th><th>VX1</th><th>期限结构%</th>
            <th>HY OAS</th><th>10Y</th><th>2Y</th><th>曲线bps</th>
            <th>宽度%</th><th>P/C Ratio</th><th>恐慌分</th><th>信号</th>
          </tr></thead>
          <tbody>
            ${macroHist.slice().reverse().slice(0,40).map(m=>`<tr>
              <td class="font-mono text-gray-400">${m.date.slice(5)}</td>
              <td class="font-mono text-white">${m.vix}</td>
              <td class="font-mono text-gray-400">${m.vx1}</td>
              <td class="font-mono ${m.vixTermStructure>0?'text-red-400':'text-emerald-400'}">${(m.vixTermStructure*100).toFixed(1)}%</td>
              <td class="font-mono ${m.hyOasSignal==='normal'?'text-emerald-400':m.hyOasSignal==='caution'?'text-amber-400':'text-red-400'}">${m.hyOas}</td>
              <td class="font-mono text-gray-300">${m.usTreasury10y}%</td>
              <td class="font-mono text-gray-300">${m.usTreasury2y}%</td>
              <td class="font-mono ${m.yieldCurveInverted?'text-red-400':'text-gray-400'}">${m.yieldCurve}</td>
              <td class="font-mono ${m.breadthSignal==='washout'?'text-red-400':m.breadthSignal==='weak'?'text-orange-400':'text-gray-300'}">${m.pctAbove200ma}%</td>
              <td class="font-mono ${m.putCallSignal==='extreme_fear'?'text-red-400':m.putCallSignal==='fear'?'text-orange-400':'text-gray-400'}">${m.putCallRatio}</td>
              <td class="font-mono font-bold ${m.panicScore>=45?'text-red-400':m.panicScore>=20?'text-amber-400':'text-emerald-400'}">${m.panicScore}</td>
              <td><span class="badge ${m.panicLabel.includes('PANIC')?'badge-miss':m.panicLabel.includes('FEAR')?'badge-paused':'badge-validated'} text-[9px]">${m.panicLabel}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- TAB II: Price/Volume -->
  <div id="dc-pane-pricevol" class="hidden">
    <div class="text-xs text-gray-500 mb-3 bg-[#0d1221] border border-blue-900/30 rounded p-2">
      <i class="fas fa-info-circle mr-1 text-blue-400"></i>
      <strong class="text-gray-300">取数口径 — 避坑指南:</strong>
      <span class="text-red-400">务必使用前复权价(Adj Close)</span>，原始Raw Close在拆股当天会被误判为暴跌。
      成交量异常 = 当日量/20日均量，需<span class="text-amber-400">剔除四巫日(期权交割日)</span>异常放量。
      RSI使用前复权价格计算。ATR-14用于动态设置止损线。
    </div>
    <div class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="text-sm font-semibold text-white">量价数据表 — 前复权 Adj Close</div>
        <div class="text-[10px] text-gray-500">数据源: Yahoo Finance (yfinance) → Bloomberg 交叉验证 · 偏差>5%触发预警</div>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table text-xs">
          <thead><tr>
            <th>代码</th><th>前复权价</th><th>MA50</th><th>MA200</th>
            <th>成交量倍数</th><th>四巫旗帜</th><th>RSI-14</th><th>信号</th>
            <th>ATR-14</th><th>ATR%</th><th>52周高-偏离%</th><th>止损参考(-2ATR)</th>
          </tr></thead>
          <tbody>
            ${pvData.map(p=>`<tr>
              <td class="font-bold text-white">${p.ticker}</td>
              <td class="font-mono text-cyan-400 font-bold">$${p.adjClose}</td>
              <td class="font-mono ${p.adjClose>p.ma50?'text-emerald-400':'text-red-400'}">$${p.ma50}</td>
              <td class="font-mono ${p.adjClose>p.ma200?'text-emerald-400':'text-red-400'}">$${p.ma200}</td>
              <td class="font-mono font-bold ${p.volumeRatio>=2?'text-red-400':p.volumeRatio>=1.3?'text-amber-400':'text-gray-400'}">${p.volumeRatio.toFixed(2)}×</td>
              <td>${p.witchingDayFlag?'<span class="text-amber-400 text-[10px]">⚡ 剔除</span>':'<span class="text-gray-600">—</span>'}</td>
              <td class="font-mono font-bold ${p.rsi14<30?'text-red-400':p.rsi14<40?'text-orange-400':p.rsi14>70?'text-purple-400':'text-gray-300'}">${p.rsi14}</td>
              <td><span class="badge ${p.rsi14<30?'badge-miss':p.rsi14>70?'badge-live':'badge-validated'} text-[9px]">${p.rsiSignal.replace(/_/g,' ')}</span></td>
              <td class="font-mono text-gray-400">$${p.atr14.toFixed(2)}</td>
              <td class="font-mono text-gray-400">${p.atrPct.toFixed(1)}%</td>
              <td class="font-mono ${p.drawdownFrom52w<-20?'text-red-400':p.drawdownFrom52w<-10?'text-orange-400':'text-gray-400'}">${p.drawdownFrom52w.toFixed(1)}%</td>
              <td class="font-mono text-red-400">$${(p.adjClose - 2*p.atr14).toFixed(1)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="mt-3 text-[10px] text-gray-600">
        <i class="fas fa-exclamation-triangle mr-1 text-amber-500"></i>
        成交量≥2×20日均 = 机构洗盘信号 · 四巫日排除 · ATR止损 = 入场价 - 2×ATR(14) · RSI算法: 14日EWM平均涨跌幅比值
      </div>
    </div>
  </div>

  <!-- TAB III: Fundamental / GAAP-Adjusted -->
  <div id="dc-pane-fundamental" class="hidden">
    <div class="text-xs text-gray-500 mb-3 bg-[#0d1221] border border-amber-900/30 rounded p-2">
      <i class="fas fa-calculator mr-1 text-amber-400"></i>
      <strong class="text-amber-300">GAAP调整核心逻辑:</strong>
      EV = 总市值+有息负债+少数股东权益-现金 ·
      <span class="text-amber-400">Adj.EBITDA = 营业利润 + D&A + SBC(股权激励加回!)</span> ·
      FCF = OCF - CapEx - 资本化软件支出 ·
      净杠杆 = 净债务/Adj.EBITDA。SBC在TMT行业会严重扭曲GAAP净利润，必须使用调整后指标。
    </div>
    <!-- EV/EBITDA Percentile chart -->
    <div class="card p-4 mb-4">
      <div class="text-sm font-semibold text-white mb-3">EV/Adj.EBITDA 历史分位数排序 (越低越便宜)</div>
      <div class="chart-wrap h-48"><canvas id="dcFundChart"></canvas></div>
    </div>
    <!-- Fundamental table -->
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">机构级估值明细 — GAAP调整后</div>
      <div class="overflow-x-auto">
        <table class="data-table text-xs">
          <thead><tr>
            <th>代码</th>
            <th>市值($B)</th><th>EV($B)</th><th>EV公式注</th>
            <th>GAAP净利</th><th>D&A</th><th>SBC(加回)</th><th>Adj.EBITDA</th>
            <th>EV/EBITDA</th><th>历史%位</th>
            <th>FCF($B)</th><th>FCF收益率</th>
            <th>净杠杆</th><th>杠杆信号</th>
            <th>PIT合规</th>
          </tr></thead>
          <tbody>
            ${fundData.map(f=>`<tr>
              <td>
                <div class="font-bold text-white">${f.ticker}</div>
                <div class="text-[9px] text-gray-500 max-w-20 truncate">${f.sector.split('—')[0]}</div>
              </td>
              <td class="font-mono text-gray-300">${f.marketCap.toFixed(0)}</td>
              <td class="font-mono text-white font-semibold">${f.ev.toFixed(0)}</td>
              <td class="text-[9px] text-gray-600 max-w-32 truncate" title="${f.evNote}">${f.evNote.slice(0,28)}…</td>
              <td class="font-mono ${f.gaapNetIncome < f.adjustedEbitda*0.3 ? 'text-amber-400' : 'text-gray-300'}">${f.gaapNetIncome.toFixed(1)}</td>
              <td class="font-mono text-gray-400">${f.da.toFixed(1)}</td>
              <td class="font-mono text-cyan-400 font-bold">+${f.sbc.toFixed(1)}</td>
              <td class="font-mono text-emerald-400 font-bold">${f.adjustedEbitda.toFixed(1)}</td>
              <td class="font-mono font-bold ${f.evEbitda<18?'text-emerald-400':f.evEbitda<25?'text-amber-400':'text-red-400'}">${f.evEbitda.toFixed(1)}×</td>
              <td>
                <div class="flex items-center gap-1">
                  <div class="w-12 score-bar">
                    <div class="score-bar-fill ${f.evEbitdaPercentile<30?'bg-emerald-500':f.evEbitdaPercentile<60?'bg-amber-500':'bg-red-500'}" style="width:${f.evEbitdaPercentile}%"></div>
                  </div>
                  <span class="font-mono text-[10px] ${f.evEbitdaPercentile<30?'text-emerald-400':'text-gray-400'}">P${f.evEbitdaPercentile}</span>
                </div>
              </td>
              <td class="font-mono text-gray-300">${f.fcf.toFixed(1)}</td>
              <td class="font-mono ${f.fcfYieldSignal==='high_attractive'?'text-emerald-400':f.fcfYieldSignal==='negative'?'text-red-400':'text-gray-300'}">${f.fcfYield.toFixed(2)}%</td>
              <td class="font-mono ${f.netLeverage>3?'text-red-400':f.netLeverage>1?'text-amber-400':'text-emerald-400'}">${f.netLeverage.toFixed(2)}×</td>
              <td><span class="badge ${f.netLeverageSignal==='danger'?'badge-miss':f.netLeverageSignal==='watch'?'badge-paused':'badge-validated'} text-[9px]">${f.netLeverageSignal}</span></td>
              <td>${f.pitCompliant?'<span class="text-emerald-400 text-[10px]">✓ PIT</span>':'<span class="text-red-400 text-[10px]">✗ 未合规</span>'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="mt-3 text-[10px] text-gray-600 space-y-1">
        <div><i class="fas fa-exclamation-triangle mr-1 text-amber-500"></i><strong class="text-gray-400">SBC加回</strong>: 股权激励(SBC)是非现金GAAP费用，在TMT行业会严重低估真实经营利润。Adj.EBITDA将SBC全部加回，还原真实造血能力。</div>
        <div><i class="fas fa-exclamation-triangle mr-1 text-amber-500"></i><strong class="text-gray-400">FCF口径</strong>: FCF = OCF - CapEx - <span class="text-amber-400">资本化软件支出</span>(隐藏资本开支)。AMZN/MSFT存在大量资本化支出需特别关注。</div>
        <div><i class="fas fa-exclamation-triangle mr-1 text-amber-500"></i><strong class="text-gray-400">净杠杆>3.0×警戒</strong>: 风暴中面临债务违约高危企业，坚决不接飞刀。</div>
      </div>
    </div>
  </div>

  <!-- TAB IV: Engineering Specs -->
  <div id="dc-pane-engineering" class="hidden">
    <div class="grid grid-cols-2 gap-4 mb-4">
      <!-- PIT Architecture -->
      <div class="card p-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-blue-900/30 flex items-center justify-center">
            <i class="fas fa-clock text-blue-400"></i>
          </div>
          <div>
            <div class="text-sm font-semibold text-white">Point-in-Time (PIT) 架构</div>
            <div class="text-[10px] text-gray-500">回测生命线 — 防止未来函数作弊</div>
          </div>
          <span class="ml-auto badge ${health.pitArchitecture.enabled?'badge-live':'badge-miss'}">${health.pitArchitecture.enabled?'已启用':'未启用'}</span>
        </div>
        <div class="text-[11px] text-gray-300 leading-relaxed mb-3">${health.pitArchitecture.description}</div>
        <div class="bg-[#0a0e1a] rounded p-2 text-[10px] space-y-1">
          <div class="flex justify-between"><span class="text-gray-500">报告时滞:</span><span class="text-amber-400">${health.pitArchitecture.reportingLag}</span></div>
          <div class="text-red-400"><i class="fas fa-exclamation-triangle mr-1"></i>${health.pitArchitecture.riskNote}</div>
        </div>
      </div>
      <!-- Survivorship Bias -->
      <div class="card p-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-emerald-900/30 flex items-center justify-center">
            <i class="fas fa-filter text-emerald-400"></i>
          </div>
          <div>
            <div class="text-sm font-semibold text-white">幸存者偏差防控</div>
            <div class="text-[10px] text-gray-500">动态成分股追踪</div>
          </div>
          <span class="ml-auto badge ${health.survivorshipBias.mitigated?'badge-validated':'badge-miss'}">${health.survivorshipBias.mitigated?'已缓解':'存在风险'}</span>
        </div>
        <div class="text-[11px] text-gray-300 leading-relaxed mb-3">${health.survivorshipBias.method}</div>
        <div class="bg-[#0a0e1a] rounded p-2 text-[10px] grid grid-cols-2 gap-2">
          <div><span class="text-gray-500">当前成分股:</span><span class="text-white ml-1">${health.survivorshipBias.universeSize}</span></div>
          <div><span class="text-gray-500">历史Ticker数:</span><span class="text-cyan-400 ml-1">${health.survivorshipBias.historicalTickers}</span></div>
        </div>
      </div>
    </div>
    <!-- GAAP Adjustments -->
    <div class="card p-4 mb-4">
      <div class="flex items-center gap-2 mb-3">
        <i class="fas fa-calculator text-amber-400"></i>
        <div class="text-sm font-semibold text-white">GAAP调整项目清单</div>
        <span class="badge badge-validated ml-auto">已全部应用</span>
      </div>
      <div class="space-y-2">
        ${health.gaapAdjustments.items.map((item,i)=>`
        <div class="flex items-start gap-2 p-2 rounded bg-[#0d1630]">
          <div class="w-5 h-5 rounded-full bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span class="text-amber-400 text-[10px] font-bold">${i+1}</span>
          </div>
          <div class="text-[11px] text-gray-300">${item}</div>
        </div>`).join('')}
      </div>
    </div>
    <!-- Data Sources -->
    <div class="card p-4">
      <div class="text-sm font-semibold text-white mb-3">数据源优先级 & 合规状态</div>
      <div class="space-y-2">
        ${health.dataSources.map(src=>`
        <div class="flex items-center gap-3 p-2 rounded bg-[#0d1630]">
          <div class="w-2 h-2 rounded-full ${src.status==='live'?'bg-emerald-400':src.status==='delayed'?'bg-amber-400':'bg-gray-500'} flex-shrink-0"></div>
          <div class="flex-1">
            <div class="text-xs font-semibold text-white">${src.name}</div>
            <div class="text-[10px] text-gray-500">${src.compliance}</div>
          </div>
          <div class="text-right text-[10px]">
            <div class="text-gray-400">${src.apiCode || '—'}</div>
            <div class="text-gray-600">${src.latency} · ${src.updateFreq}</div>
          </div>
        </div>`).join('')}
      </div>
      <div class="mt-3 bg-[#0a0e1a] rounded p-3 text-[10px] text-gray-400 space-y-1">
        <div class="text-amber-400 font-semibold mb-1">Daily Data Pipeline 执行顺序:</div>
        <div>① Yahoo Finance: 大盘价格、VIX现货/期货、Put/Call Ratio、前复权价格</div>
        <div>② FRED API (免费): 10Y美债(DGS10)、HY利差(BAMLH0A0HYM2)</div>
        <div>③ 基本面API: Forward P/E、EV/Adj.EBITDA、自由现金流 (需Bloomberg或FactSet)</div>
        <div>④ 计算ERP = Forward Earnings Yield - 10Y Yield，更新看板</div>
        <div class="text-cyan-400 mt-1">Python示例: <code>yf.Ticker("^VIX").history(period="1d")["Close"].iloc[-1]</code></div>
        <div class="text-cyan-400"><code>fred = pdr.DataReader("BAMLH0A0HYM2","fred","2020-01-01")</code></div>
      </div>
    </div>
  </div>
  `

  // Charts
  setTimeout(() => {
    // VIX + PCR
    const vixCtx = document.getElementById('dcVixChart')?.getContext('2d')
    if (vixCtx) {
      if (charts.dcVix) charts.dcVix.destroy()
      const lbl = macroHist.map(d=>d.date.slice(5))
      charts.dcVix = new Chart(vixCtx, {
        type:'line',
        data: { labels: lbl, datasets: [
          { label:'VIX', data:macroHist.map(d=>d.vix), borderColor:'#f87171', borderWidth:2, pointRadius:0, tension:0.3 },
          { label:'P/C×10', data:macroHist.map(d=>d.putCallRatio*10), borderColor:'#a78bfa', borderWidth:1.5, pointRadius:0, tension:0.3, borderDash:[3,3] },
        ]},
        options: { ...chartOpts(''), plugins:{legend:{labels:{color:'#9ca3af',font:{size:9}}}}, scales:{x:{display:false}, y:{ticks:{color:'#6b7280',font:{size:9}},grid:{color:'rgba(255,255,255,0.04)'}}} }
      })
    }
    // HY + Breadth
    const hyCtx = document.getElementById('dcHyChart')?.getContext('2d')
    if (hyCtx) {
      if (charts.dcHy) charts.dcHy.destroy()
      const lbl = macroHist.map(d=>d.date.slice(5))
      charts.dcHy = new Chart(hyCtx, {
        type:'line',
        data: { labels: lbl, datasets: [
          { label:'HY OAS(bps)', data:macroHist.map(d=>d.hyOas), borderColor:'#f59e0b', borderWidth:2, pointRadius:0, tension:0.3, yAxisID:'y' },
          { label:'宽度%', data:macroHist.map(d=>d.pctAbove200ma), borderColor:'#22d3ee', borderWidth:1.5, pointRadius:0, tension:0.3, borderDash:[3,3], yAxisID:'y1' },
        ]},
        options: { ...chartOpts(''),
          plugins:{legend:{labels:{color:'#9ca3af',font:{size:9}}}},
          scales: {
            x:{display:false},
            y: {position:'left', ticks:{color:'#f59e0b',font:{size:9}},grid:{color:'rgba(255,255,255,0.04)'}},
            y1:{position:'right', ticks:{color:'#22d3ee',font:{size:9}},grid:{display:false}}
          }
        }
      })
    }
    // Fundamental percentile bar chart
    const fundCtx = document.getElementById('dcFundChart')?.getContext('2d')
    if (fundCtx && fundData) {
      if (charts.dcFund) charts.dcFund.destroy()
      const sorted = [...fundData].sort((a,b)=>a.evEbitdaPercentile-b.evEbitdaPercentile)
      charts.dcFund = new Chart(fundCtx, {
        type:'bar',
        data: {
          labels: sorted.map(f=>f.ticker),
          datasets: [
            { label:'EV/Adj.EBITDA 历史分位%', data:sorted.map(f=>f.evEbitdaPercentile),
              backgroundColor: sorted.map(f=>f.evEbitdaPercentile<30?'rgba(52,211,153,0.7)':f.evEbitdaPercentile<60?'rgba(251,191,36,0.7)':'rgba(248,113,113,0.7)') },
            { label:'EV/EBITDA倍数', data:sorted.map(f=>f.evEbitda),
              backgroundColor:'rgba(34,211,238,0.3)', type:'line', borderColor:'#22d3ee', borderWidth:2, pointRadius:3, yAxisID:'y1' }
          ]
        },
        options: {
          plugins:{legend:{labels:{color:'#9ca3af',font:{size:9}}}},
          scales: {
            x:{ticks:{color:'#9ca3af',font:{size:10}},grid:{display:false}},
            y:{title:{display:true,text:'分位数%',color:'#6b7280'},ticks:{color:'#6b7280',font:{size:9}},grid:{color:'rgba(255,255,255,0.04)'}},
            y1:{position:'right',title:{display:true,text:'EV/EBITDA×',color:'#6b7280'},ticks:{color:'#6b7280',font:{size:9}},grid:{display:false}},
          }
        }
      })
    }
  }, 60)
}

window.dcTab = function(id) {
  ['macro','pricevol','fundamental','engineering'].forEach(t => {
    document.getElementById(`dc-pane-${t}`)?.classList.toggle('hidden', t !== id)
    document.getElementById(`dc-tab-${t}`)?.classList.toggle('active', t === id)
  })
}

