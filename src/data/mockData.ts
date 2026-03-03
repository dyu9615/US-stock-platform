// ============================================================
// 量化交易平台 - 模拟数据中心
// ============================================================

export interface StockQuote {
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  turnover: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

export interface Strategy {
  id: string;
  name: string;
  type: 'idea' | 'factor' | 'trading' | 'model';
  typeLabel: string;
  status: 'running' | 'paused' | 'stopped' | 'backtesting';
  weight: number;
  pnl: number;
  pnlPct: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  capital: number;
  description: string;
  startDate: string;
}

export interface Position {
  code: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  weight: number;
  strategyId: string;
}

export interface Trade {
  id: string;
  time: string;
  code: string;
  name: string;
  direction: 'buy' | 'sell';
  quantity: number;
  price: number;
  amount: number;
  status: 'filled' | 'partial' | 'pending' | 'cancelled';
  strategyId: string;
  strategyName: string;
}

export interface BacktestResult {
  id: string;
  strategyName: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  annualReturn: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  status: 'running' | 'completed' | 'failed';
  navCurve: { date: string; nav: number; benchmark: number }[];
}

export interface PerformanceReport {
  totalAssets: number;
  totalPnl: number;
  totalPnlPct: number;
  dailyPnl: number;
  dailyPnlPct: number;
  annualReturn: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  navHistory: { date: string; nav: number; benchmark: number }[];
  factorAttribution: { factor: string; contribution: number; pct: number }[];
  sectorAllocation: { sector: string; weight: number; pnl: number }[];
}

// ---- 市场行情模拟数据 ----
export function generateQuotes(): StockQuote[] {
  const stocks = [
    { code: '600519', name: '贵州茅台', base: 1750 },
    { code: '000858', name: '五粮液', base: 152 },
    { code: '601318', name: '中国平安', base: 48.5 },
    { code: '000333', name: '美的集团', base: 58.2 },
    { code: '600036', name: '招商银行', base: 35.8 },
    { code: '002415', name: '海康威视', base: 29.6 },
    { code: '600900', name: '长江电力', base: 26.4 },
    { code: '000001', name: '平安银行', base: 10.2 },
    { code: '601166', name: '兴业银行', base: 19.8 },
    { code: '600276', name: '恒瑞医药', base: 42.1 },
    { code: '300750', name: '宁德时代', base: 198 },
    { code: '601012', name: '隆基绿能', base: 22.3 },
    { code: '000568', name: '泸州老窖', base: 148 },
    { code: '002594', name: '比亚迪', base: 285 },
    { code: '600887', name: '伊利股份', base: 25.4 },
  ];
  return stocks.map(s => {
    const changePct = (Math.random() - 0.48) * 6;
    const change = s.base * changePct / 100;
    const price = +(s.base + change).toFixed(2);
    return {
      code: s.code,
      name: s.name,
      price,
      change: +change.toFixed(2),
      changePct: +changePct.toFixed(2),
      volume: Math.floor(Math.random() * 5000000) + 500000,
      turnover: Math.floor(Math.random() * 2000000000) + 100000000,
      high: +(price * (1 + Math.random() * 0.02)).toFixed(2),
      low: +(price * (1 - Math.random() * 0.02)).toFixed(2),
      open: +(s.base * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2),
      prevClose: s.base,
    };
  });
}

// ---- 策略列表 ----
export const strategies: Strategy[] = [
  {
    id: 'stg001',
    name: '动量因子策略',
    type: 'factor',
    typeLabel: '因子驱动',
    status: 'running',
    weight: 25,
    pnl: 186420,
    pnlPct: 18.64,
    sharpe: 1.82,
    maxDrawdown: -8.3,
    winRate: 62.4,
    capital: 2000000,
    description: '基于12个月价格动量因子，月度调仓，持有A股中性化组合。超额收益来源于动量效应的持续性。',
    startDate: '2024-01-15',
  },
  {
    id: 'stg002',
    name: '反转因子策略',
    type: 'factor',
    typeLabel: '因子驱动',
    status: 'running',
    weight: 20,
    pnl: 94300,
    pnlPct: 9.43,
    sharpe: 1.41,
    maxDrawdown: -12.1,
    winRate: 58.9,
    capital: 1500000,
    description: '利用短期过度反应造成的均值回归，周度调仓，在市场震荡期表现突出。',
    startDate: '2024-02-01',
  },
  {
    id: 'stg003',
    name: '机器学习选股',
    type: 'model',
    typeLabel: '交易模型',
    status: 'running',
    weight: 30,
    pnl: 312500,
    pnlPct: 20.83,
    sharpe: 2.14,
    maxDrawdown: -6.8,
    winRate: 67.2,
    capital: 3000000,
    description: 'XGBoost + LSTM多模态模型，融合技术面、基本面、情绪面因子，月度调仓300支A股组合。',
    startDate: '2024-01-08',
  },
  {
    id: 'stg004',
    name: '配对交易策略',
    type: 'trading',
    typeLabel: '交易策略',
    status: 'running',
    weight: 15,
    pnl: 58900,
    pnlPct: 7.85,
    sharpe: 1.63,
    maxDrawdown: -4.2,
    winRate: 71.3,
    capital: 1000000,
    description: '基于协整关系的跨品种套利，重点覆盖银行、白酒、新能源板块内部配对。市场中性策略。',
    startDate: '2024-03-10',
  },
  {
    id: 'stg005',
    name: '日历效应策略',
    type: 'idea',
    typeLabel: '投资想法',
    status: 'paused',
    weight: 5,
    pnl: -12400,
    pnlPct: -2.48,
    sharpe: 0.31,
    maxDrawdown: -15.6,
    winRate: 44.8,
    capital: 500000,
    description: '基于月末效应和节前效应的轮动策略，当前业绩低于预期，已暂停优化中。',
    startDate: '2024-04-01',
  },
  {
    id: 'stg006',
    name: '趋势跟踪CTA',
    type: 'trading',
    typeLabel: '交易策略',
    status: 'stopped',
    weight: 5,
    pnl: 21600,
    pnlPct: 4.32,
    sharpe: 0.98,
    maxDrawdown: -18.4,
    winRate: 41.2,
    capital: 500000,
    description: '基于ATR突破的商品期货趋势跟踪，当前已停止运行，等待下一轮趋势行情。',
    startDate: '2024-05-20',
  },
];

// ---- 持仓数据 ----
export const positions: Position[] = [
  { code: '600519', name: '贵州茅台', quantity: 500, avgCost: 1620, currentPrice: 1750, marketValue: 875000, pnl: 65000, pnlPct: 8.02, weight: 12.5, strategyId: 'stg003' },
  { code: '300750', name: '宁德时代', quantity: 3000, avgCost: 185, currentPrice: 198, marketValue: 594000, pnl: 39000, pnlPct: 7.03, weight: 8.5, strategyId: 'stg001' },
  { code: '002594', name: '比亚迪', quantity: 2000, avgCost: 256, currentPrice: 285, marketValue: 570000, pnl: 58000, pnlPct: 11.33, weight: 8.1, strategyId: 'stg003' },
  { code: '601318', name: '中国平安', quantity: 8000, avgCost: 52, currentPrice: 48.5, marketValue: 388000, pnl: -28000, pnlPct: -6.73, weight: 5.5, strategyId: 'stg002' },
  { code: '000333', name: '美的集团', quantity: 6000, avgCost: 54.2, currentPrice: 58.2, marketValue: 349200, pnl: 24000, pnlPct: 7.38, weight: 5.0, strategyId: 'stg001' },
  { code: '600036', name: '招商银行', quantity: 8000, avgCost: 38.1, currentPrice: 35.8, marketValue: 286400, pnl: -18400, pnlPct: -6.04, weight: 4.1, strategyId: 'stg004' },
  { code: '002415', name: '海康威视', quantity: 8000, avgCost: 27.3, currentPrice: 29.6, marketValue: 236800, pnl: 18400, pnlPct: 8.42, weight: 3.4, strategyId: 'stg003' },
  { code: '600276', name: '恒瑞医药', quantity: 5000, avgCost: 44.8, currentPrice: 42.1, marketValue: 210500, pnl: -13500, pnlPct: -6.03, weight: 3.0, strategyId: 'stg002' },
  { code: '000858', name: '五粮液', quantity: 1200, avgCost: 138, currentPrice: 152, marketValue: 182400, pnl: 16800, pnlPct: 10.14, weight: 2.6, strategyId: 'stg004' },
  { code: '600900', name: '长江电力', quantity: 6000, avgCost: 24.8, currentPrice: 26.4, marketValue: 158400, pnl: 9600, pnlPct: 6.45, weight: 2.3, strategyId: 'stg001' },
];

// ---- 当日交易记录 ----
export const trades: Trade[] = [
  { id: 'T001', time: '09:31:22', code: '600519', name: '贵州茅台', direction: 'buy', quantity: 100, price: 1748.5, amount: 174850, status: 'filled', strategyId: 'stg003', strategyName: '机器学习选股' },
  { id: 'T002', time: '09:45:18', code: '300750', name: '宁德时代', direction: 'sell', quantity: 500, price: 197.8, amount: 98900, status: 'filled', strategyId: 'stg001', strategyName: '动量因子策略' },
  { id: 'T003', time: '10:12:33', code: '601318', name: '中国平安', direction: 'buy', quantity: 2000, price: 48.2, amount: 96400, status: 'filled', strategyId: 'stg002', strategyName: '反转因子策略' },
  { id: 'T004', time: '10:38:41', code: '002594', name: '比亚迪', direction: 'buy', quantity: 300, price: 283.5, amount: 85050, status: 'filled', strategyId: 'stg003', strategyName: '机器学习选股' },
  { id: 'T005', time: '11:02:15', code: '000333', name: '美的集团', direction: 'sell', quantity: 1000, price: 58.4, amount: 58400, status: 'filled', strategyId: 'stg001', strategyName: '动量因子策略' },
  { id: 'T006', time: '11:24:08', code: '600036', name: '招商银行', direction: 'buy', quantity: 3000, price: 35.6, amount: 106800, status: 'filled', strategyId: 'stg004', strategyName: '配对交易策略' },
  { id: 'T007', time: '13:05:52', code: '000858', name: '五粮液', direction: 'sell', quantity: 200, price: 152.5, amount: 30500, status: 'filled', strategyId: 'stg004', strategyName: '配对交易策略' },
  { id: 'T008', time: '13:45:30', code: '002415', name: '海康威视', direction: 'buy', quantity: 2000, price: 29.4, amount: 58800, status: 'filled', strategyId: 'stg003', strategyName: '机器学习选股' },
  { id: 'T009', time: '14:15:44', code: '600900', name: '长江电力', direction: 'buy', quantity: 2000, price: 26.3, amount: 52600, status: 'filled', strategyId: 'stg001', strategyName: '动量因子策略' },
  { id: 'T010', time: '14:52:18', code: '600276', name: '恒瑞医药', direction: 'buy', quantity: 1000, price: 41.8, amount: 41800, status: 'pending', strategyId: 'stg002', strategyName: '反转因子策略' },
];

// ---- 回测结果数据 ----
function genNavCurve(months: number, annualReturn: number, volatility: number): { date: string; nav: number; benchmark: number }[] {
  const points = [];
  let nav = 1.0;
  let benchmark = 1.0;
  const start = new Date('2024-01-01');
  for (let i = 0; i <= months * 20; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 1.5);
    const dailyReturn = annualReturn / 252 + (Math.random() - 0.5) * volatility / Math.sqrt(252);
    const benchReturn = 0.08 / 252 + (Math.random() - 0.5) * 0.18 / Math.sqrt(252);
    nav = nav * (1 + dailyReturn);
    benchmark = benchmark * (1 + benchReturn);
    points.push({
      date: d.toISOString().split('T')[0],
      nav: +nav.toFixed(4),
      benchmark: +benchmark.toFixed(4),
    });
  }
  return points;
}

export const backtestResults: BacktestResult[] = [
  {
    id: 'bt001',
    strategyName: '动量因子策略 v2.1',
    startDate: '2021-01-01',
    endDate: '2024-12-31',
    initialCapital: 1000000,
    finalCapital: 2164200,
    totalReturn: 116.42,
    annualReturn: 21.2,
    sharpe: 1.82,
    maxDrawdown: -18.3,
    winRate: 62.4,
    totalTrades: 1248,
    status: 'completed',
    navCurve: genNavCurve(48, 0.212, 0.22),
  },
  {
    id: 'bt002',
    strategyName: '机器学习选股 v3.0',
    startDate: '2022-01-01',
    endDate: '2024-12-31',
    initialCapital: 1000000,
    finalCapital: 1845600,
    totalReturn: 84.56,
    annualReturn: 23.1,
    sharpe: 2.14,
    maxDrawdown: -12.8,
    winRate: 67.2,
    totalTrades: 842,
    status: 'completed',
    navCurve: genNavCurve(36, 0.231, 0.16),
  },
  {
    id: 'bt003',
    strategyName: '配对交易新参数',
    startDate: '2023-01-01',
    endDate: '2024-12-31',
    initialCapital: 500000,
    finalCapital: 612400,
    totalReturn: 22.48,
    annualReturn: 10.8,
    sharpe: 1.63,
    maxDrawdown: -6.4,
    winRate: 71.3,
    totalTrades: 456,
    status: 'completed',
    navCurve: genNavCurve(24, 0.108, 0.10),
  },
  {
    id: 'bt004',
    strategyName: '高频因子挖掘实验',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    initialCapital: 1000000,
    finalCapital: 0,
    totalReturn: 0,
    annualReturn: 0,
    sharpe: 0,
    maxDrawdown: 0,
    winRate: 0,
    totalTrades: 0,
    status: 'running',
    navCurve: [],
  },
];

// ---- 业绩分析数据 ----
export function generatePerformanceReport(): PerformanceReport {
  const navHistory = [];
  let nav = 1.0;
  let benchmark = 1.0;
  const start = new Date('2024-01-01');
  const today = new Date('2026-03-03');
  let d = new Date(start);
  while (d <= today) {
    const dailyReturn = 0.18 / 252 + (Math.random() - 0.48) * 0.15 / Math.sqrt(252);
    const benchReturn = 0.08 / 252 + (Math.random() - 0.5) * 0.18 / Math.sqrt(252);
    nav = nav * (1 + dailyReturn);
    benchmark = benchmark * (1 + benchReturn);
    navHistory.push({
      date: d.toISOString().split('T')[0],
      nav: +nav.toFixed(4),
      benchmark: +benchmark.toFixed(4),
    });
    d.setDate(d.getDate() + 1);
    // skip weekends
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
  }
  return {
    totalAssets: 8500000,
    totalPnl: 661220,
    totalPnlPct: 8.43,
    dailyPnl: 24680,
    dailyPnlPct: 0.29,
    annualReturn: 18.6,
    sharpe: 1.74,
    maxDrawdown: -9.2,
    winRate: 63.8,
    navHistory,
    factorAttribution: [
      { factor: '动量因子', contribution: 186420, pct: 28.2 },
      { factor: 'ML模型', contribution: 312500, pct: 47.2 },
      { factor: '反转因子', contribution: 94300, pct: 14.3 },
      { factor: '配对套利', contribution: 58900, pct: 8.9 },
      { factor: '交易成本', contribution: -24800, pct: -3.7 },
      { factor: '其他', contribution: 33900, pct: 5.1 },
    ],
    sectorAllocation: [
      { sector: '白酒', weight: 18.5, pnl: 94200 },
      { sector: '新能源', weight: 16.3, pnl: 118400 },
      { sector: '金融', weight: 14.2, pnl: -8200 },
      { sector: '医药', weight: 12.1, pnl: -13500 },
      { sector: '科技', weight: 10.8, pnl: 42600 },
      { sector: '消费', weight: 9.6, pnl: 28300 },
      { sector: '工业', weight: 8.4, pnl: 18200 },
      { sector: '其他', weight: 10.1, pnl: 12400 },
    ],
  };
}
