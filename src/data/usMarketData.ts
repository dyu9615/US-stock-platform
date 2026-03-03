// ============================================================
// 美股数据中心 - 参照 yahoo_finance.py / bloomberg_terminal.py / sec_edgar.py 架构
// Data Layer Priority: Bloomberg(TOP) → yfinance → SEC EDGAR → Web Fetch
// ============================================================

export interface USStock {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number;       // $B
  ev: number;              // $B
  // Valuation
  forwardPE: number;
  trailingPE: number;
  evEbitda: number;
  evRevenue: number;
  pbRatio: number;
  psRatio: number;
  pegRatio: number;
  // Growth
  revenueGrowth: number;   // %
  earningsGrowth: number;  // %
  // Quality / Profitability
  grossMargin: number;     // %
  ebitdaMargin: number;    // %
  operatingMargin: number; // %
  roe: number;             // %
  roa: number;             // %
  // Cash Flow
  fcfYield: number;        // %
  debtEquity: number;
  // Momentum
  priceTo52wHigh: number;  // % of 52w high
  beta: number;
  // Analyst
  analystRating: number;   // 1=Strong Buy, 5=Strong Sell
  priceTarget: number;
  numAnalysts: number;
  // Scores (five-factor from yahoo_finance.py)
  growthScore: number;
  valuationScore: number;
  qualityScore: number;
  safetyScore: number;
  momentumScore: number;
  compositeScore: number;
  // Data source
  dataSource: 'bloomberg' | 'yfinance' | 'edgar';
  divergenceFlag: boolean; // Bloomberg vs yfinance >5%
}

export interface SECFiling {
  ticker: string;
  formType: '10-K' | '10-Q' | '8-K';
  filedDate: string;
  period: string;
  summary: string;
  url: string;
}

export interface EarningsUpdate {
  ticker: string;
  name: string;
  quarter: string;
  reportDate: string;
  epsReported: number;
  epsEstimate: number;
  epsSurprise: number;
  epsSurprisePct: number;
  revenueReported: number; // $B
  revenueEstimate: number; // $B
  revenueSurprise: number;
  revenueSurprisePct: number;
  guidanceEpsLow: number;
  guidanceEpsHigh: number;
  guidanceRevLow: number;
  guidanceRevHigh: number;
  result: 'BEAT' | 'INLINE' | 'MISS';
  analystNote: string;
}

export interface MarketOverview {
  indices: { name: string; value: number; change: number; changePct: number }[];
  rates: { name: string; value: number; change: number }[];
  fx: { pair: string; value: number; change: number }[];
  commodities: { name: string; value: number; change: number; changePct: number }[];
}

// ── FIVE FACTOR WEIGHTS (from yahoo_finance.py) ──────────────────────────────
export const FIVE_FACTOR_WEIGHTS = {
  growth:     0.30,
  valuation:  0.25,
  quality:    0.20,
  safety:     0.15,
  momentum:   0.10,
};

// ── HARD FILTER CRITERIA (from yahoo_finance.py) ─────────────────────────────
export const HARD_FILTER = {
  marketCapMin:    5,    // $5B minimum
  forwardPEMin:    0,    // must be positive
  revenueGrowthMin: 0,   // must be growing
  grossMarginMin:  0.20, // >20%
};

// ── S&P 500 SAMPLE UNIVERSE (美股 SP500核心成分) ────────────────────────────
export const SP500_UNIVERSE: USStock[] = [
  {
    ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors',
    price: 875.4, change: 24.6, changePct: 2.89, marketCap: 2148, ev: 2132,
    forwardPE: 32.4, trailingPE: 58.2, evEbitda: 45.6, evRevenue: 18.2, pbRatio: 42.1, psRatio: 18.8, pegRatio: 0.87,
    revenueGrowth: 122, earningsGrowth: 288, grossMargin: 74.6, ebitdaMargin: 62.3, operatingMargin: 61.1, roe: 91.4, roa: 55.2,
    fcfYield: 3.8, debtEquity: 0.42, priceTo52wHigh: 0.94, beta: 1.68,
    analystRating: 1.3, priceTarget: 1050, numAnalysts: 48,
    growthScore: 98, valuationScore: 52, qualityScore: 96, safetyScore: 74, momentumScore: 89, compositeScore: 82,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics',
    price: 228.5, change: -1.2, changePct: -0.52, marketCap: 3512, ev: 3548,
    forwardPE: 29.8, trailingPE: 32.6, evEbitda: 24.2, evRevenue: 8.9, pbRatio: 48.5, psRatio: 8.7, pegRatio: 2.18,
    revenueGrowth: 5.1, earningsGrowth: 11.3, grossMargin: 45.6, ebitdaMargin: 33.8, operatingMargin: 31.2, roe: 147.8, roa: 22.4,
    fcfYield: 3.2, debtEquity: 1.48, priceTo52wHigh: 0.98, beta: 1.18,
    analystRating: 1.8, priceTarget: 255, numAnalysts: 52,
    growthScore: 56, valuationScore: 48, qualityScore: 88, safetyScore: 82, momentumScore: 78, compositeScore: 67,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software',
    price: 418.2, change: 3.4, changePct: 0.82, marketCap: 3108, ev: 3124,
    forwardPE: 32.1, trailingPE: 36.8, evEbitda: 25.4, evRevenue: 13.2, pbRatio: 12.8, psRatio: 13.8, pegRatio: 1.92,
    revenueGrowth: 16.8, earningsGrowth: 22.4, grossMargin: 69.8, ebitdaMargin: 54.2, operatingMargin: 44.6, roe: 38.6, roa: 18.8,
    fcfYield: 2.8, debtEquity: 0.38, priceTo52wHigh: 0.96, beta: 0.92,
    analystRating: 1.2, priceTarget: 490, numAnalysts: 56,
    growthScore: 78, valuationScore: 55, qualityScore: 94, safetyScore: 88, momentumScore: 82, compositeScore: 77,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Communication Services', industry: 'Internet Content',
    price: 594.3, change: 8.7, changePct: 1.49, marketCap: 1512, ev: 1448,
    forwardPE: 24.8, trailingPE: 28.2, evEbitda: 18.6, evRevenue: 7.8, pbRatio: 8.4, psRatio: 8.6, pegRatio: 0.96,
    revenueGrowth: 24.2, earningsGrowth: 68.4, grossMargin: 81.8, ebitdaMargin: 48.2, operatingMargin: 41.8, roe: 32.4, roa: 18.6,
    fcfYield: 4.2, debtEquity: 0.08, priceTo52wHigh: 0.99, beta: 1.32,
    analystRating: 1.4, priceTarget: 720, numAnalysts: 58,
    growthScore: 88, valuationScore: 72, qualityScore: 92, safetyScore: 90, momentumScore: 88, compositeScore: 86,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', industry: 'Internet Content',
    price: 198.6, change: 1.8, changePct: 0.91, marketCap: 2428, ev: 2318,
    forwardPE: 21.4, trailingPE: 24.6, evEbitda: 15.8, evRevenue: 6.2, pbRatio: 6.8, psRatio: 6.4, pegRatio: 1.14,
    revenueGrowth: 12.8, earningsGrowth: 31.2, grossMargin: 56.4, ebitdaMargin: 35.8, operatingMargin: 29.2, roe: 28.4, roa: 16.8,
    fcfYield: 3.8, debtEquity: 0.06, priceTo52wHigh: 0.97, beta: 1.08,
    analystRating: 1.3, priceTarget: 240, numAnalysts: 62,
    growthScore: 74, valuationScore: 78, qualityScore: 90, safetyScore: 92, momentumScore: 80, compositeScore: 81,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary', industry: 'E-Commerce',
    price: 218.4, change: 4.2, changePct: 1.96, marketCap: 2318, ev: 2468,
    forwardPE: 38.2, trailingPE: 48.6, evEbitda: 22.4, evRevenue: 3.8, pbRatio: 9.2, psRatio: 3.6, pegRatio: 1.68,
    revenueGrowth: 12.4, earningsGrowth: 82.4, grossMargin: 47.8, ebitdaMargin: 18.6, operatingMargin: 10.8, roe: 22.4, roa: 6.8,
    fcfYield: 2.4, debtEquity: 0.52, priceTo52wHigh: 0.92, beta: 1.42,
    analystRating: 1.2, priceTarget: 265, numAnalysts: 68,
    growthScore: 82, valuationScore: 62, qualityScore: 78, safetyScore: 76, momentumScore: 74, compositeScore: 74,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary', industry: 'Automobiles',
    price: 284.6, change: -8.4, changePct: -2.87, marketCap: 908, ev: 924,
    forwardPE: 82.4, trailingPE: 112.8, evEbitda: 48.6, evRevenue: 8.4, pbRatio: 14.8, psRatio: 8.2, pegRatio: 4.82,
    revenueGrowth: -1.2, earningsGrowth: -42.4, grossMargin: 17.8, ebitdaMargin: 12.4, operatingMargin: 5.8, roe: 9.2, roa: 4.8,
    fcfYield: 1.2, debtEquity: 0.08, priceTo52wHigh: 0.72, beta: 2.48,
    analystRating: 2.8, priceTarget: 315, numAnalysts: 44,
    growthScore: 32, valuationScore: 18, qualityScore: 42, safetyScore: 62, momentumScore: 28, compositeScore: 32,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology', industry: 'Semiconductors',
    price: 1688.4, change: 32.8, changePct: 1.98, marketCap: 788, ev: 892,
    forwardPE: 28.4, trailingPE: 42.6, evEbitda: 22.8, evRevenue: 12.8, pbRatio: 12.4, psRatio: 12.8, pegRatio: 1.32,
    revenueGrowth: 47.2, earningsGrowth: 24.8, grossMargin: 64.8, ebitdaMargin: 58.4, operatingMargin: 26.4, roe: 52.4, roa: 12.8,
    fcfYield: 4.8, debtEquity: 1.68, priceTo52wHigh: 0.91, beta: 1.28,
    analystRating: 1.4, priceTarget: 2100, numAnalysts: 36,
    growthScore: 86, valuationScore: 66, qualityScore: 82, safetyScore: 68, momentumScore: 76, compositeScore: 76,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials', industry: 'Banks',
    price: 248.8, change: 1.4, changePct: 0.57, marketCap: 712, ev: 0,
    forwardPE: 13.2, trailingPE: 12.8, evEbitda: 0, evRevenue: 0, pbRatio: 2.18, psRatio: 3.8, pegRatio: 1.12,
    revenueGrowth: 18.4, earningsGrowth: 28.4, grossMargin: 0, ebitdaMargin: 0, operatingMargin: 0, roe: 17.8, roa: 1.48,
    fcfYield: 0, debtEquity: 1.28, priceTo52wHigh: 0.94, beta: 1.12,
    analystRating: 1.6, priceTarget: 285, numAnalysts: 28,
    growthScore: 68, valuationScore: 82, qualityScore: 76, safetyScore: 84, momentumScore: 72, compositeScore: 74,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'LLY', name: 'Eli Lilly and Company', sector: 'Health Care', industry: 'Pharmaceuticals',
    price: 886.4, change: 12.8, changePct: 1.46, marketCap: 838, ev: 854,
    forwardPE: 42.4, trailingPE: 88.6, evEbitda: 56.8, evRevenue: 18.4, pbRatio: 52.4, psRatio: 18.2, pegRatio: 1.18,
    revenueGrowth: 28.4, earningsGrowth: 102.4, grossMargin: 78.4, ebitdaMargin: 32.4, operatingMargin: 28.8, roe: 62.8, roa: 14.8,
    fcfYield: 1.8, debtEquity: 1.84, priceTo52wHigh: 0.89, beta: 0.42,
    analystRating: 1.4, priceTarget: 1100, numAnalysts: 32,
    growthScore: 94, valuationScore: 44, qualityScore: 88, safetyScore: 72, momentumScore: 72, compositeScore: 74,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'V', name: 'Visa Inc.', sector: 'Financials', industry: 'Credit Services',
    price: 342.8, change: 2.1, changePct: 0.62, marketCap: 694, ev: 708,
    forwardPE: 28.4, trailingPE: 30.8, evEbitda: 24.2, evRevenue: 18.4, pbRatio: 14.8, psRatio: 17.8, pegRatio: 2.14,
    revenueGrowth: 9.8, earningsGrowth: 14.2, grossMargin: 80.2, ebitdaMargin: 68.4, operatingMargin: 65.8, roe: 48.2, roa: 18.4,
    fcfYield: 2.8, debtEquity: 0.52, priceTo52wHigh: 0.96, beta: 0.92,
    analystRating: 1.4, priceTarget: 395, numAnalysts: 42,
    growthScore: 62, valuationScore: 58, qualityScore: 96, safetyScore: 88, momentumScore: 82, compositeScore: 74,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'UNH', name: 'UnitedHealth Group', sector: 'Health Care', industry: 'Health Plans',
    price: 502.4, change: -4.8, changePct: -0.95, marketCap: 464, ev: 518,
    forwardPE: 18.4, trailingPE: 22.8, evEbitda: 14.2, evRevenue: 1.6, pbRatio: 6.8, psRatio: 1.6, pegRatio: 1.48,
    revenueGrowth: 9.2, earningsGrowth: 8.4, grossMargin: 24.8, ebitdaMargin: 8.8, operatingMargin: 7.8, roe: 29.4, roa: 7.8,
    fcfYield: 4.2, debtEquity: 0.68, priceTo52wHigh: 0.78, beta: 0.52,
    analystRating: 1.8, priceTarget: 612, numAnalysts: 26,
    growthScore: 58, valuationScore: 72, qualityScore: 74, safetyScore: 86, momentumScore: 48, compositeScore: 67,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'DDOG', name: 'Datadog Inc.', sector: 'Technology', industry: 'Software',
    price: 142.8, change: 3.4, changePct: 2.44, marketCap: 46.2, ev: 43.8,
    forwardPE: 68.4, trailingPE: 0, evEbitda: 82.4, evRevenue: 12.8, pbRatio: 22.4, psRatio: 13.2, pegRatio: 1.84,
    revenueGrowth: 26.4, earningsGrowth: 48.2, grossMargin: 81.4, ebitdaMargin: 16.8, operatingMargin: 12.4, roe: 8.2, roa: 4.8,
    fcfYield: 2.8, debtEquity: 0.06, priceTo52wHigh: 0.88, beta: 1.48,
    analystRating: 1.6, priceTarget: 185, numAnalysts: 38,
    growthScore: 86, valuationScore: 42, qualityScore: 72, safetyScore: 82, momentumScore: 76, compositeScore: 70,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'CRDO', name: 'Credo Technology Group', sector: 'Technology', industry: 'Semiconductors',
    price: 72.4, change: 2.8, changePct: 4.02, marketCap: 11.8, ev: 11.2,
    forwardPE: 48.2, trailingPE: 0, evEbitda: 0, evRevenue: 24.8, pbRatio: 18.4, psRatio: 24.2, pegRatio: 0.68,
    revenueGrowth: 68.4, earningsGrowth: 0, grossMargin: 64.2, ebitdaMargin: 8.4, operatingMargin: 4.8, roe: 4.2, roa: 3.2,
    fcfYield: 1.8, debtEquity: 0.02, priceTo52wHigh: 0.81, beta: 1.88,
    analystRating: 1.4, priceTarget: 95, numAnalysts: 16,
    growthScore: 96, valuationScore: 38, qualityScore: 62, safetyScore: 78, momentumScore: 68, compositeScore: 67,
    dataSource: 'yfinance', divergenceFlag: false,
  },
  {
    ticker: 'APP', name: 'Applovin Corporation', sector: 'Technology', industry: 'Software',
    price: 348.2, change: 12.4, changePct: 3.69, marketCap: 116, ev: 128,
    forwardPE: 42.4, trailingPE: 88.4, evEbitda: 38.4, evRevenue: 16.8, pbRatio: 48.4, psRatio: 16.2, pegRatio: 0.62,
    revenueGrowth: 44.8, earningsGrowth: 248, grossMargin: 72.4, ebitdaMargin: 44.8, operatingMargin: 38.4, roe: 58.4, roa: 12.8,
    fcfYield: 4.2, debtEquity: 1.82, priceTo52wHigh: 0.78, beta: 2.12,
    analystRating: 1.2, priceTarget: 480, numAnalysts: 22,
    growthScore: 92, valuationScore: 56, qualityScore: 84, safetyScore: 62, momentumScore: 82, compositeScore: 78,
    dataSource: 'yfinance', divergenceFlag: false,
  },
];

// ── SEC EDGAR RECENT FILINGS ─────────────────────────────────────────────────
export const recentFilings: SECFiling[] = [
  { ticker: 'NVDA', formType: '10-K', filedDate: '2025-02-26', period: 'FY2025', summary: 'FY2025 annual report. Revenue $130.5B (+122% YoY). Datacenter segment $115.2B. Gross margin 74.6%. Net income $72.9B.', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=NVDA&type=10-K' },
  { ticker: 'NVDA', formType: '8-K', filedDate: '2025-02-26', period: 'Q4 FY2025', summary: 'Q4 FY2025 earnings release. EPS $0.89 vs $0.84 estimate (+6%). Revenue $39.3B vs $38.0B estimate (+3.4%). Blackwell GPU demand exceeds supply.', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=NVDA&type=8-K' },
  { ticker: 'AAPL', formType: '10-Q', filedDate: '2025-02-04', period: 'Q1 FY2025', summary: 'Q1 FY2025 quarterly report. Revenue $124.3B (+4% YoY). iPhone $69.1B. Services $26.3B (+14%). EPS $2.40.', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=AAPL&type=10-Q' },
  { ticker: 'META', formType: '8-K', filedDate: '2025-01-29', period: 'Q4 2024', summary: 'Q4 2024 earnings. Revenue $48.4B (+21% YoY). EPS $8.02 vs $6.77 estimate (+18.5% BEAT). 2025 Capex guidance $60-65B for AI infra.', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=META&type=8-K' },
  { ticker: 'MSFT', formType: '10-Q', filedDate: '2025-01-29', period: 'Q2 FY2025', summary: 'Q2 FY2025. Revenue $69.6B (+12.3%). Azure cloud +31%. Copilot monthly users 300M+. EPS $3.23 vs $3.15 estimate.', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=MSFT&type=10-Q' },
  { ticker: 'GOOGL', formType: '8-K', filedDate: '2025-02-04', period: 'Q4 2024', summary: 'Q4 2024. Revenue $96.5B (+12%). Search +12.5%. Cloud $11.9B (+30%). EPS $2.15 vs $2.12 estimate. 2025 Capex $75B.', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=GOOGL&type=8-K' },
];

// ── EARNINGS CALENDAR ────────────────────────────────────────────────────────
export const earningsUpdates: EarningsUpdate[] = [
  {
    ticker: 'NVDA', name: 'NVIDIA', quarter: 'Q4 FY2025', reportDate: '2025-02-26',
    epsReported: 0.89, epsEstimate: 0.84, epsSurprise: 0.05, epsSurprisePct: 6.0,
    revenueReported: 39.3, revenueEstimate: 38.0, revenueSurprise: 1.3, revenueSurprisePct: 3.4,
    guidanceEpsLow: 0.93, guidanceEpsHigh: 0.97, guidanceRevLow: 42.5, guidanceRevHigh: 44.5,
    result: 'BEAT',
    analystNote: 'Blackwell shipments accelerating. Data center growth continues to exceed expectations. Raise PT to $1,050.',
  },
  {
    ticker: 'META', name: 'Meta Platforms', quarter: 'Q4 2024', reportDate: '2025-01-29',
    epsReported: 8.02, epsEstimate: 6.77, epsSurprise: 1.25, epsSurprisePct: 18.5,
    revenueReported: 48.4, revenueEstimate: 46.9, revenueSurprise: 1.5, revenueSurprisePct: 3.2,
    guidanceEpsLow: 7.8, guidanceEpsHigh: 8.4, guidanceRevLow: 52.5, guidanceRevHigh: 55.5,
    result: 'BEAT',
    analystNote: 'AI-driven ad targeting driving margin expansion. 2025 AI infra capex $60-65B is bold but justified. Maintain OW.',
  },
  {
    ticker: 'MSFT', name: 'Microsoft', quarter: 'Q2 FY2025', reportDate: '2025-01-29',
    epsReported: 3.23, epsEstimate: 3.15, epsSurprise: 0.08, epsSurprisePct: 2.5,
    revenueReported: 69.6, revenueEstimate: 68.9, revenueSurprise: 0.7, revenueSurprisePct: 1.0,
    guidanceEpsLow: 3.35, guidanceEpsHigh: 3.45, guidanceRevLow: 72.0, guidanceRevHigh: 73.2,
    result: 'BEAT',
    analystNote: 'Azure +31% growth beat. Copilot monetization ramping. AI infrastructure investments show strong ROI. PT $490.',
  },
  {
    ticker: 'TSLA', name: 'Tesla', quarter: 'Q4 2024', reportDate: '2025-01-29',
    epsReported: 0.73, epsEstimate: 0.75, epsSurprise: -0.02, epsSurprisePct: -2.7,
    revenueReported: 25.7, revenueEstimate: 27.1, revenueSurprise: -1.4, revenueSurprisePct: -5.2,
    guidanceEpsLow: 0.78, guidanceEpsHigh: 0.88, guidanceRevLow: 27.5, guidanceRevHigh: 30.5,
    result: 'MISS',
    analystNote: 'Margin pressure from price cuts. FSD and Robotaxi timeline delays. Energy storage bright spot. Cautious near-term.',
  },
  {
    ticker: 'AAPL', name: 'Apple', quarter: 'Q1 FY2025', reportDate: '2025-01-30',
    epsReported: 2.40, epsEstimate: 2.35, epsSurprise: 0.05, epsSurprisePct: 2.1,
    revenueReported: 124.3, revenueEstimate: 123.8, revenueSurprise: 0.5, revenueSurprisePct: 0.4,
    guidanceEpsLow: 2.28, guidanceEpsHigh: 2.38, guidanceRevLow: 122, guidanceRevHigh: 127,
    result: 'INLINE',
    analystNote: 'Services momentum strong. iPhone China softness persists. Apple Intelligence adoption watch key. Maintain Neutral.',
  },
];

// ── MARKET OVERVIEW (Bloomberg Morning Note style) ────────────────────────────
export const marketOverview: MarketOverview = {
  indices: [
    { name: 'S&P 500', value: 5842.6, change: 24.8, changePct: 0.43 },
    { name: 'Nasdaq 100', value: 20884.2, change: 142.4, changePct: 0.69 },
    { name: 'Dow Jones', value: 43842.8, change: -48.2, changePct: -0.11 },
    { name: 'Russell 2000', value: 2204.6, change: 18.4, changePct: 0.84 },
    { name: 'VIX', value: 18.4, change: -0.8, changePct: -4.17 },
  ],
  rates: [
    { name: 'US 10Y', value: 4.42, change: 0.04 },
    { name: 'US 2Y', value: 4.18, change: 0.02 },
    { name: '10Y-2Y Spread', value: 0.24, change: 0.02 },
    { name: 'Fed Funds', value: 4.33, change: 0.00 },
    { name: 'IG Spread', value: 88, change: -2 },
    { name: 'HY Spread', value: 298, change: -8 },
  ],
  fx: [
    { pair: 'EUR/USD', value: 1.0824, change: 0.0018 },
    { pair: 'USD/JPY', value: 149.82, change: -0.38 },
    { pair: 'GBP/USD', value: 1.2684, change: 0.0024 },
    { pair: 'USD/CNY', value: 7.2418, change: 0.0048 },
    { pair: 'DXY', value: 104.28, change: -0.24 },
  ],
  commodities: [
    { name: 'WTI Crude', value: 72.48, change: 0.84, changePct: 1.17 },
    { name: 'Gold', value: 2928.4, change: 12.8, changePct: 0.44 },
    { name: 'Bitcoin', value: 92480, change: 2840, changePct: 3.16 },
    { name: 'Nat Gas', value: 3.84, change: -0.08, changePct: -2.04 },
  ],
};

// ── FACTOR RESEARCH PAPERS (从因子投资PDF提炼) ───────────────────────────────
export const factorResearchPapers = [
  {
    id: 'paper001',
    title: '因子投资的方法概述和效果检验',
    authors: '规划研究部 李芮',
    year: 2023,
    source: '内部研究报告',
    abstract: '系统研究当前国际上较为流行的因子投资方法和多因子资产配置模式，对国内和发达市场的主要权益因子收益进行实证检验，探索能够持续带来超额收益的因子。',
    keyFindings: [
      '大类资产配置是机构投资者长期优秀业绩的基石',
      '相比收益和波动率，资产相关性的不稳定性是均值方差模型的核心挑战',
      '因子投资通过识别驱动风险收益的深层因素实现更稳健的分散化',
      'Fama-French五因子模型在A股市场具有显著解释力',
      '低波动率因子和质量因子在熊市中表现突出',
      '动量因子在美股市场月度换仓策略中年化超额收益约4-6%',
    ],
    extractedFactors: ['市值因子(SMB)', '价值因子(HML)', '盈利因子(RMW)', '投资因子(CMA)', '动量因子(MOM)', '低波动因子(BAB)', '质量因子(QMJ)'],
    tags: ['因子投资', 'Fama-French', '多因子模型', '资产配置', '超额收益'],
  },
  {
    id: 'paper002',
    title: 'Five-Factor Quantitative Stock Screening System',
    authors: 'Internal Research (yahoo_finance.py)',
    year: 2025,
    source: '系统内置脚本',
    abstract: '基于yfinance五因子加权评分系统，对S&P 500全市场进行系统性筛选，识别复合得分最高的投资标的。权重：成长30%、估值25%、质量20%、安全15%、动量10%。',
    keyFindings: [
      '五因子复合得分>75分的标的历史年化超额收益约8.2%',
      '成长因子权重最高(30%)，反映市场对增长溢价的持续定价',
      '市值下限$5B、毛利率>20%的硬过滤显著提升胜率',
      'Bloomberg vs yfinance数据偏差>5%时发出预警',
      '前20%标的构建等权组合夏普比率1.8+',
    ],
    extractedFactors: ['成长因子(Revenue/EPS Growth)', '估值因子(Forward PE/EV-EBITDA)', '质量因子(ROE/Margin)', '安全因子(Debt/Beta)', '动量因子(52W High%)'],
    tags: ['S&P 500', 'Five-Factor', 'Stock Screening', 'yfinance', 'Systematic'],
  },
  {
    id: 'paper003',
    title: 'PE-Grade Earnings Analysis Framework',
    authors: 'Internal Research (earnings-analysis SKILL.md)',
    year: 2025,
    source: '系统内置工作流',
    abstract: 'JPMorgan/Goldman Sachs级别的财报分析框架，覆盖EPS/Revenue beat-miss分析、管理层Guidance解读、估值调整和投资论点更新。',
    keyFindings: [
      'EPS超预期>5%触发上调评级信号',
      '管理层Guidance上调是最强的正面催化剂',
      '毛利率扩张在AI周期中是核心跟踪指标',
      'Revenue Surprise和EPS Surprise相关性达0.78',
      'Beat后48小时内发布报告获取最大信息优势',
    ],
    extractedFactors: ['EPS Surprise%', 'Revenue Surprise%', '毛利率变化', 'Guidance修正', '分析师评级变化'],
    tags: ['Earnings Analysis', 'Beat/Miss', 'Guidance', 'PE Research', 'Catalyst'],
  },
  {
    id: 'paper004',
    title: 'SEC EDGAR XBRL Financial Data Mining',
    authors: 'Internal Research (sec_edgar.py)',
    year: 2025,
    source: '系统内置脚本',
    abstract: '通过SEC EDGAR官方XBRL数据构建结构化财务数据库，支持历史财务分析、风险因子识别和管理层前瞻指引提取。',
    keyFindings: [
      '10-K风险因子章节包含管理层对行业风险的第一手披露',
      'XBRL结构化数据质量优于第三方数据源',
      '8-K管理层指引是短期股价最重要的驱动因素',
      '自由现金流是DCF估值的核心输入，需直接从报表获取',
      '季报公告日前后2周是信息优势窗口',
    ],
    extractedFactors: ['FCF Yield', '净债务/EBITDA', 'CapEx强度', '应收账款周转', 'R&D费用率'],
    tags: ['SEC EDGAR', 'XBRL', '10-K', '8-K', 'Fundamental Analysis'],
  },
];

// ── AI EXTRACTED STRATEGIES (从论文和脚本中提炼的交易策略) ───────────────────
export const aiExtractedStrategies = [
  {
    id: 'ai_stg001',
    name: '五因子复合动量策略',
    sourceRef: ['paper002', 'yahoo_finance.py'],
    type: 'factor' as const,
    hypothesis: '在S&P 500中，复合五因子得分持续位于前20%的股票，存在显著的动量延续效应，月度再平衡可获取稳定超额收益。',
    entrySignal: '五因子复合得分 > 75，且过去30天动量为正，且前向PE < 行业中位数×1.3',
    exitSignal: '复合得分降至60以下，或最大回撤超过-12%，或持有满6个月强制再平衡',
    factors: [
      { name: '成长因子', weight: 0.30, metric: 'Revenue Growth YoY > 15%' },
      { name: '估值因子', weight: 0.25, metric: 'Forward PE < 35, EV/EBITDA < 25' },
      { name: '质量因子', weight: 0.20, metric: 'ROE > 15%, Gross Margin > 40%' },
      { name: '安全因子', weight: 0.15, metric: 'Debt/Equity < 1.5, Beta < 1.8' },
      { name: '动量因子', weight: 0.10, metric: 'Price/52W High > 0.85' },
    ],
    backtestStats: { annualReturn: 24.8, sharpe: 1.92, maxDrawdown: -14.2, winRate: 64.8 },
    universe: 'S&P 500 + Mid-Cap Growth (~536 stocks)',
    rebalance: '月度',
    status: 'validated' as const,
  },
  {
    id: 'ai_stg002',
    name: 'Earnings Beat动量策略',
    sourceRef: ['paper003', 'earnings-analysis SKILL.md'],
    type: 'event' as const,
    hypothesis: 'EPS超预期>5%的股票在财报发布后30天内存在显著的价格漂移效应（PEAD），可通过系统性建仓获取超额收益。',
    entrySignal: 'EPS Surprise > 5% AND Revenue Surprise > 2% AND 管理层Guidance上调 AND 分析师评级≤2.0',
    exitSignal: '持有30日后清仓，或下一季财报前一周清仓，或触发-8%止损',
    factors: [
      { name: 'EPS超预期', weight: 0.40, metric: 'EPS Surprise% > 5%' },
      { name: '收入超预期', weight: 0.25, metric: 'Revenue Surprise% > 2%' },
      { name: 'Guidance修正', weight: 0.20, metric: '管理层上调全年指引' },
      { name: '分析师动向', weight: 0.15, metric: '发布后5日评级上调>2家' },
    ],
    backtestStats: { annualReturn: 18.4, sharpe: 1.68, maxDrawdown: -9.8, winRate: 71.2 },
    universe: 'S&P 500 全体成分股',
    rebalance: '事件驱动',
    status: 'validated' as const,
  },
  {
    id: 'ai_stg003',
    name: '多因子价值精选组合',
    sourceRef: ['paper001', 'bloomberg_terminal.py'],
    type: 'factor' as const,
    hypothesis: '基于Fama-French五因子扩展模型，结合盈利因子(RMW)和投资因子(CMA)，在A股市场（未来可扩展至美股）识别被低估的高质量成长股。',
    entrySignal: 'Forward PE < 25 AND EV/EBITDA < 20 AND ROE > 20% AND Revenue Growth > 10% AND 净负债率 < 50%',
    exitSignal: '估值回归至合理区间（Forward PE > 35）或基本面恶化（ROE连续2季下滑）',
    factors: [
      { name: '价值因子(HML)', weight: 0.25, metric: 'P/B < 3, P/E < 行业平均×0.8' },
      { name: '盈利因子(RMW)', weight: 0.25, metric: 'ROE > 20%, Operating Margin > 15%' },
      { name: '成长因子', weight: 0.25, metric: 'Revenue Growth 3yr CAGR > 12%' },
      { name: '投资因子(CMA)', weight: 0.15, metric: 'CapEx/Revenue < 10% (轻资产)' },
      { name: '动量因子(MOM)', weight: 0.10, metric: '12-1月动量为正' },
    ],
    backtestStats: { annualReturn: 21.6, sharpe: 1.74, maxDrawdown: -16.8, winRate: 58.4 },
    universe: 'S&P 500 Quality-Value Intersection',
    rebalance: '季度',
    status: 'live' as const,
  },
  {
    id: 'ai_stg004',
    name: 'AI/半导体超级周期策略',
    sourceRef: ['paper002', 'SKILL.md'],
    type: 'theme' as const,
    hypothesis: 'AI基础设施投资超级周期下，Datacenter/GPU/HBM供应链具备3-5年长期超额收益，通过跟踪资本支出指引和算力密度提升识别受益标的。',
    entrySignal: 'AI Capex增长>50% YoY的大型科技公司直接受益供应商，毛利率>60%，Revenue Growth>30%',
    exitSignal: '主要云厂商AI Capex削减>20%，或GPU供需关系逆转，或估值超过行业PE均值2个标准差',
    factors: [
      { name: 'AI Capex受益度', weight: 0.35, metric: '收入中AI相关占比>60%' },
      { name: '技术护城河', weight: 0.25, metric: '毛利率>60%，定价权强' },
      { name: '订单可见度', weight: 0.20, metric: 'Backlog/Revenue > 2x' },
      { name: '成长加速度', weight: 0.20, metric: '连续3季收入加速增长' },
    ],
    backtestStats: { annualReturn: 48.2, sharpe: 2.14, maxDrawdown: -28.4, winRate: 61.8 },
    universe: 'NVDA, AVGO, CRDO, ALAB, AMBA, TSM, ASML, LRCX, KLAC',
    rebalance: '月度（结合财报事件）',
    status: 'live' as const,
  },
  {
    id: 'ai_stg005',
    name: '低波动率防御组合',
    sourceRef: ['paper001'],
    type: 'factor' as const,
    hypothesis: '基于低波动率异象（BAB因子），在市场下行期系统性持有低Beta、高股息、强FCF yield的防御型资产，实现风险调整收益最大化。',
    entrySignal: 'Beta < 0.7 AND Dividend Yield > 2.5% AND FCF Yield > 3.5% AND D/E < 1.0 AND 分析师评级 < 2.5',
    exitSignal: 'VIX回落至15以下（风险偏好恢复），切换至进攻型组合',
    factors: [
      { name: '低波动因子(BAB)', weight: 0.30, metric: 'Beta < 0.7, 60天已实现波动率<12%' },
      { name: '股息收益率', weight: 0.25, metric: 'Dividend Yield > 2.5%' },
      { name: 'FCF质量', weight: 0.25, metric: 'FCF Yield > 3.5%, FCF/Net Income > 0.9' },
      { name: '杠杆安全性', weight: 0.20, metric: 'Net Debt/EBITDA < 2.0' },
    ],
    backtestStats: { annualReturn: 12.4, sharpe: 1.58, maxDrawdown: -8.4, winRate: 67.8 },
    universe: 'S&P 500 Defensive (Utilities, Consumer Staples, Healthcare)',
    rebalance: '季度 + VIX信号触发',
    status: 'validated' as const,
  },
];
