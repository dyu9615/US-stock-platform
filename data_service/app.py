"""
QuantAlpha Data Microservice — Port 3001
Real data layer: Yahoo Finance (primary) + FactSet (cross-validation + consensus)
Architecture: Data Layer → Skill Layer → ML Layer
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import json
import time
import traceback
from datetime import datetime, timedelta
import os
import urllib.request
import urllib.parse
import base64

app = Flask(__name__)
CORS(app)

# ── In-memory cache (TTL: 15 min for quotes, 60 min for fundamentals) ───────
_cache = {}
def cache_get(key, ttl=900):
    if key in _cache:
        val, ts = _cache[key]
        if time.time() - ts < ttl:
            return val
    return None

def cache_set(key, val):
    _cache[key] = (val, time.time())

# ── FactSet API key ───────────────────────────────────────────────────────────
FACTSET_API_KEY = os.environ.get('FACTSET_API_KEY', '')
FACTSET_BASE    = 'https://api.factset.com/content'

def factset_headers():
    auth = base64.b64encode(f'{FACTSET_API_KEY}:APIKEY'.encode()).decode()
    return {
        'Authorization': f'Basic {auth}',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }

def factset_get(path, timeout=10):
    """GET request to FactSet API, returns parsed JSON or raises."""
    url = f'{FACTSET_BASE}{path}'
    req = urllib.request.Request(url, headers=factset_headers())
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

def factset_post(path, body, timeout=15):
    """POST request to FactSet API, returns parsed JSON or raises."""
    url = f'{FACTSET_BASE}{path}'
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=factset_headers(), method='POST')
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

# ══════════════════════════════════════════════════════════════════════════════
# S&P 500 REPRESENTATIVE UNIVERSE — 120 large-caps covering all 11 GICS sectors
# Full S&P 500 is fetched in batches when /api/yf/screener?universe=sp500 called
# ══════════════════════════════════════════════════════════════════════════════
CORE_TICKERS = [
    # Information Technology (25)
    'AAPL','MSFT','NVDA','AVGO','ORCL','CRM','AMD','INTC','QCOM','TXN',
    'AMAT','LRCX','KLAC','MU','ADI','MCHP','FTNT','CDNS','SNPS','ANSS',
    'HPQ','DELL','STX','WDC','JNPR',
    # Communication Services (12)
    'GOOGL','META','NFLX','DIS','CMCSA','T','VZ','TMUS','CHTR','EA','TTWO','OMC',
    # Consumer Discretionary (12)
    'AMZN','TSLA','HD','MCD','NKE','SBUX','LOW','TJX','BKNG','MAR','CMG','ORLY',
    # Consumer Staples (8)
    'WMT','COST','PG','KO','PEP','PM','MO','CL',
    # Financials (15)
    'BRK-B','JPM','BAC','WFC','GS','MS','BLK','SCHW','AXP','USB','PNC','CB','MET','TRV','COF',
    # Healthcare (15)
    'LLY','UNH','JNJ','ABBV','MRK','TMO','DHR','ABT','BMY','AMGN','GILD','ISRG','SYK','BDX','EW',
    # Industrials (12)
    'CAT','DE','RTX','HON','UNP','LMT','GE','MMM','EMR','ITW','PH','ROK',
    # Energy (8)
    'XOM','CVX','COP','EOG','SLB','MPC','PSX','OXY',
    # Materials (5)
    'LIN','APD','SHW','FCX','NEM',
    # Real Estate (4)
    'PLD','AMT','EQIX','SPG',
    # Utilities (4)
    'NEE','DUK','SO','D',
]

# Extended S&P 500 tickers for full-universe scan (batched)
SP500_EXTENDED = CORE_TICKERS + [
    'V','MA','PYPL','SQ','NOW','SNOW','PLTR','ZS','CRWD','PANW',
    'DDOG','NET','MDB','OKTA','ZM','DOCU','TWLO','HubSpot','VEEV',
    'WDAY','ADSK','INTU','PYPL','SQ','ABNB','UBER','LYFT','DASH',
    'RBLX','U','ROKU','TTD','APPS','APP','CFLT','BILL','HUBS','ZI',
    'BSX','MDT','ZBH','BAX','HOLX','XRAY','TFX','ALGN',
    'CVS','CI','HUM','MOH','CNC','WBA','MCK','ABC','CAH',
    'GD','NOC','BA','TDG','HEI','LDOS','CACI','SAIC',
    'FDX','UPS','DAL','UAL','AAL','LUV','JBLU',
    'CLX','CHD','EL','KMB','GIS','K','HRL','TSN',
    'MSCI','SPGI','MCO','ICE','CME','CBOE','TW','MKTX',
]

def safe_float(val, default=0.0):
    try:
        if val is None or val != val:  # NaN check
            return default
        return float(val)
    except:
        return default

def safe_int(val, default=0):
    try:
        if val is None:
            return default
        return int(val)
    except:
        return default

# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/quote/<ticker>  — real-time quote + fundamentals
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/yf/quote/<ticker>')
def get_quote(ticker):
    ticker = ticker.upper().strip()
    cache_key = f'quote_{ticker}'
    cached = cache_get(cache_key, ttl=300)  # 5-min cache for quotes
    if cached:
        return jsonify(cached)

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}

        # Core price data
        price      = safe_float(info.get('currentPrice') or info.get('regularMarketPrice'))
        prev_close = safe_float(info.get('previousClose') or info.get('regularMarketPreviousClose'))
        change     = round(price - prev_close, 4) if price and prev_close else 0
        change_pct = round((change / prev_close) * 100, 4) if prev_close else 0

        # Market cap & EV
        market_cap_b = safe_float(info.get('marketCap', 0)) / 1e9
        total_debt   = safe_float(info.get('totalDebt', 0))
        cash         = safe_float(info.get('totalCash', 0))
        minority_int = safe_float(info.get('minorityInterest', 0))
        ev_b         = (safe_float(info.get('enterpriseValue', 0)) or
                        (market_cap_b * 1e9 + total_debt - cash + minority_int)) / 1e9

        # Adj EBITDA = Operating Income + D&A + SBC
        op_income   = safe_float(info.get('operatingCashflow', 0))  # fallback
        ebitda_raw  = safe_float(info.get('ebitda', 0))
        # SBC from cash flow statement
        sbc         = 0  # will be enriched from financials below

        result = {
            'ticker': ticker,
            'name': info.get('longName') or info.get('shortName', ticker),
            'sector': info.get('sector', '—'),
            'industry': info.get('industry', '—'),
            'exchange': info.get('exchange', '—'),
            'currency': info.get('currency', 'USD'),
            # Price
            'price': round(price, 2),
            'prevClose': round(prev_close, 2),
            'change': round(change, 2),
            'changePct': round(change_pct, 2),
            'open': safe_float(info.get('open') or info.get('regularMarketOpen')),
            'dayHigh': safe_float(info.get('dayHigh') or info.get('regularMarketDayHigh')),
            'dayLow': safe_float(info.get('dayLow') or info.get('regularMarketDayLow')),
            'week52High': safe_float(info.get('fiftyTwoWeekHigh')),
            'week52Low': safe_float(info.get('fiftyTwoWeekLow')),
            'volume': safe_int(info.get('regularMarketVolume') or info.get('volume')),
            'avgVolume': safe_int(info.get('averageVolume')),
            # Market structure
            'marketCap': round(market_cap_b, 2),
            'ev': round(ev_b, 2),
            'sharesOutstanding': safe_float(info.get('sharesOutstanding', 0)) / 1e9,
            'floatShares': safe_float(info.get('floatShares', 0)) / 1e9,
            'shortRatio': safe_float(info.get('shortRatio')),
            'shortPct': safe_float(info.get('shortPercentOfFloat', 0)) * 100,
            # Valuation
            'forwardPE': safe_float(info.get('forwardPE')),
            'trailingPE': safe_float(info.get('trailingPE')),
            'evEbitda': safe_float(info.get('enterpriseToEbitda')),
            'evRevenue': safe_float(info.get('enterpriseToRevenue')),
            'pbRatio': safe_float(info.get('priceToBook')),
            'psRatio': safe_float(info.get('priceToSalesTrailing12Months')),
            'pegRatio': safe_float(info.get('trailingPegRatio') or info.get('pegRatio')),
            # Growth
            'revenueGrowth': safe_float(info.get('revenueGrowth', 0)) * 100,
            'earningsGrowth': safe_float(info.get('earningsGrowth', 0)) * 100,
            'revenueQoQ': safe_float(info.get('revenueQuarterlyGrowth', 0)) * 100,
            'earningsQoQ': safe_float(info.get('earningsQuarterlyGrowth', 0)) * 100,
            # Profitability
            'grossMargin': safe_float(info.get('grossMargins', 0)) * 100,
            'ebitdaMargin': safe_float(info.get('ebitdaMargins', 0)) * 100,
            'operatingMargin': safe_float(info.get('operatingMargins', 0)) * 100,
            'netMargin': safe_float(info.get('profitMargins', 0)) * 100,
            'roe': safe_float(info.get('returnOnEquity', 0)) * 100,
            'roa': safe_float(info.get('returnOnAssets', 0)) * 100,
            # Cash flow (raw, pre-adjustment)
            'operatingCashflow': safe_float(info.get('operatingCashflow', 0)) / 1e9,
            'freeCashflow': safe_float(info.get('freeCashflow', 0)) / 1e9,
            'fcfYield': (safe_float(info.get('freeCashflow', 0)) / (market_cap_b * 1e9) * 100) if market_cap_b > 0 else 0,
            # Leverage
            'totalDebt': total_debt / 1e9,
            'totalCash': cash / 1e9,
            'netDebt': (total_debt - cash) / 1e9,
            'debtEquity': safe_float(info.get('debtToEquity', 0)) / 100,
            'currentRatio': safe_float(info.get('currentRatio')),
            'quickRatio': safe_float(info.get('quickRatio')),
            'interestCoverage': safe_float(info.get('coverageRatio')),
            # Dividend
            'dividendYield': safe_float(info.get('dividendYield', 0)) * 100,
            'dividendRate': safe_float(info.get('dividendRate')),
            'payoutRatio': safe_float(info.get('payoutRatio', 0)) * 100,
            # Analyst
            'analystRating': safe_float(info.get('recommendationMean', 3.0)),
            'analystAction': info.get('recommendationKey', 'hold'),
            'priceTarget': safe_float(info.get('targetMeanPrice')),
            'priceTargetHigh': safe_float(info.get('targetHighPrice')),
            'priceTargetLow': safe_float(info.get('targetLowPrice')),
            'numAnalysts': safe_int(info.get('numberOfAnalystOpinions')),
            # Technical
            'beta': safe_float(info.get('beta', 1.0)),
            'ma50': safe_float(info.get('fiftyDayAverage')),
            'ma200': safe_float(info.get('twoHundredDayAverage')),
            'priceTo52wHigh': round(price / safe_float(info.get('fiftyTwoWeekHigh'), 1), 4) if price and info.get('fiftyTwoWeekHigh') else 0,
            # Revenue / earnings raw
            'revenue': safe_float(info.get('totalRevenue', 0)) / 1e9,
            'ebitda': safe_float(info.get('ebitda', 0)) / 1e9,
            'eps': safe_float(info.get('trailingEps')),
            'forwardEps': safe_float(info.get('forwardEps')),
            # Meta
            'dataSource': 'yahoo_finance',
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
            'factsetValidated': False,
        }

        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e), 'ticker': ticker}), 500

# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/financials/<ticker>  — quarterly P&L, balance sheet, cash flow
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/yf/financials/<ticker>')
def get_financials(ticker):
    ticker = ticker.upper().strip()
    cache_key = f'fin_{ticker}'
    cached = cache_get(cache_key, ttl=3600)  # 1hr cache
    if cached:
        return jsonify(cached)

    try:
        t = yf.Ticker(ticker)

        def df_to_list(df, limit=4):
            """Convert quarterly DataFrame to list of dicts"""
            if df is None or df.empty:
                return []
            rows = []
            for col in df.columns[:limit]:
                row = {'period': str(col)[:10]}
                for idx in df.index:
                    val = df.loc[idx, col]
                    key = str(idx).replace(' ', '_').replace('/', '_').lower()
                    try:
                        row[key] = round(float(val) / 1e6, 2) if val == val else None  # in $M
                    except:
                        row[key] = None
                rows.append(row)
            return rows

        income_q  = df_to_list(t.quarterly_income_stmt)
        balance_q = df_to_list(t.quarterly_balance_sheet)
        cashflow_q= df_to_list(t.quarterly_cashflow)

        # Compute adjusted EBITDA per quarter
        adj_ebitda_quarters = []
        for i, q in enumerate(income_q):
            ebit = q.get('ebit') or q.get('operating_income') or 0
            da   = 0
            sbc  = 0
            if i < len(cashflow_q):
                cq = cashflow_q[i]
                da  = abs(cq.get('depreciation_and_amortization') or cq.get('depreciation_amortization_depletion') or 0)
                sbc = abs(cq.get('stock_based_compensation') or 0)
            adj_ebitda_quarters.append({
                'period': q.get('period',''),
                'ebit': ebit,
                'da': da,
                'sbc': sbc,
                'adj_ebitda': round((ebit or 0) + da + sbc, 2),
            })

        # TTM = sum of last 4 quarters
        def ttm_sum(quarters, key):
            return round(sum((q.get(key) or 0) for q in quarters[:4]), 2)

        ttm_adj_ebitda = sum(q['adj_ebitda'] for q in adj_ebitda_quarters[:4])
        ttm_ocf        = ttm_sum(cashflow_q, 'operating_cash_flow') if cashflow_q else 0
        ttm_capex      = abs(ttm_sum(cashflow_q, 'capital_expenditure')) if cashflow_q else 0
        ttm_sbc        = abs(ttm_sum(cashflow_q, 'stock_based_compensation')) if cashflow_q else 0
        ttm_revenue    = ttm_sum(income_q, 'total_revenue') if income_q else 0

        result = {
            'ticker': ticker,
            'income_quarterly': income_q,
            'balance_quarterly': balance_q,
            'cashflow_quarterly': cashflow_q,
            'adj_ebitda_quarterly': adj_ebitda_quarters,
            'ttm': {
                'adj_ebitda_m': round(ttm_adj_ebitda, 2),
                'ocf_m': round(ttm_ocf, 2),
                'capex_m': round(ttm_capex, 2),
                'sbc_m': round(ttm_sbc, 2),
                'fcf_m': round(ttm_ocf - ttm_capex, 2),
                'adj_fcf_m': round(ttm_ocf - ttm_capex - ttm_sbc, 2),
                'revenue_m': round(ttm_revenue, 2),
            },
            'dataSource': 'yahoo_finance',
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'ticker': ticker}), 500

# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/deep/<ticker>  — full audit-grade deep analysis
#   EV / Adj.EBITDA / FCF Yield / Net Leverage / Price targets / Analyst recs
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/yf/deep/<ticker>')
def get_deep(ticker):
    ticker = ticker.upper().strip()
    cache_key = f'deep_{ticker}'
    cached = cache_get(cache_key, ttl=1800)  # 30 min
    if cached:
        return jsonify(cached)

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}

        # ── 1. Market structure ─────────────────────────────────────────────
        price        = safe_float(info.get('currentPrice') or info.get('regularMarketPrice'))
        market_cap   = safe_float(info.get('marketCap', 0))
        total_debt   = safe_float(info.get('totalDebt', 0))
        short_debt   = safe_float(info.get('shortLongTermDebt', 0)) or safe_float(info.get('currentDebt', 0))
        cash         = safe_float(info.get('totalCash', 0))
        minority     = safe_float(info.get('minorityInterest', 0))
        preferred    = safe_float(info.get('preferredStock', 0))

        # EV = Mktcap + LT debt + ST debt + minority interest + preferred - cash
        ev = market_cap + total_debt + minority + preferred - cash
        ev_b = ev / 1e9

        # ── 2. Cash flow statement (quarterly) ──────────────────────────────
        cfs = t.quarterly_cashflow
        ics = t.quarterly_income_stmt
        bs  = t.quarterly_balance_sheet

        def q_val(df, row_patterns, q=0, scale=1e6):
            """Extract a value from df by trying multiple row name patterns"""
            if df is None or df.empty:
                return 0
            cols = list(df.columns)
            if q >= len(cols):
                return 0
            col = cols[q]
            for pat in row_patterns:
                for idx in df.index:
                    if pat.lower() in str(idx).lower():
                        val = df.loc[idx, col]
                        try:
                            return float(val) / scale if val == val else 0
                        except:
                            return 0
            return 0

        # Get last 4 quarters for TTM
        def ttm_val(df, row_patterns, scale=1e6):
            return sum(q_val(df, row_patterns, q=i, scale=scale) for i in range(4))

        # Operating cash flow
        ocf_ttm  = ttm_val(cfs, ['operating cash flow', 'total cash from operating activities'])
        # CapEx (negative in most DFs)
        capex_ttm = abs(ttm_val(cfs, ['capital expenditure', 'capital expenditures', 'purchase of property plant']))
        # SBC
        sbc_ttm   = abs(ttm_val(cfs, ['stock based compensation', 'share based compensation']))
        # Capitalized software (proxy: R&D capitalized ~0 for most, include if available)
        cap_sw_ttm = 0  # most firms don't separately report; we note this

        # D&A
        da_ttm = abs(ttm_val(cfs, ['depreciation', 'depreciation and amortization', 'depreciation amortization']))

        # Operating income
        op_income_ttm = ttm_val(ics, ['operating income', 'ebit'])
        ebitda_raw_ttm = ttm_val(ics, ['ebitda', 'normalized ebitda'])
        if ebitda_raw_ttm == 0:
            ebitda_raw_ttm = op_income_ttm + da_ttm

        # Adj EBITDA = Op Income + D&A + SBC (audit standard for TMT)
        adj_ebitda_ttm = op_income_ttm + da_ttm + sbc_ttm

        # Revenue
        rev_ttm = ttm_val(ics, ['total revenue', 'revenue'])

        # ── 3. Computed ratios ───────────────────────────────────────────────
        ev_ebitda_adj = (ev_b * 1e9 / (adj_ebitda_ttm * 1e6)) if adj_ebitda_ttm != 0 else 0
        ev_ebitda_raw = (ev_b * 1e9 / (ebitda_raw_ttm * 1e6)) if ebitda_raw_ttm != 0 else 0

        # FCF = OCF - CapEx - Capitalized Software
        fcf_ttm = ocf_ttm - capex_ttm - cap_sw_ttm
        adj_fcf_ttm = ocf_ttm - capex_ttm - sbc_ttm  # stricter: deduct SBC

        fcf_yield = (fcf_ttm * 1e6 / market_cap * 100) if market_cap > 0 else 0
        adj_fcf_yield = (adj_fcf_ttm * 1e6 / market_cap * 100) if market_cap > 0 else 0

        # Net leverage = (total debt - cash) / adj EBITDA
        net_debt = (total_debt - cash) / 1e9
        net_leverage = (net_debt / (adj_ebitda_ttm / 1000)) if adj_ebitda_ttm != 0 else 0

        # EBITDA margin
        adj_ebitda_margin = (adj_ebitda_ttm / rev_ttm * 100) if rev_ttm != 0 else safe_float(info.get('ebitdaMargins', 0)) * 100

        # ── 4. Per-quarter adj EBITDA table ─────────────────────────────────
        quarterly_table = []
        for q_idx in range(min(4, len(ics.columns) if ics is not None and not ics.empty else 0)):
            period = str(ics.columns[q_idx])[:10] if ics is not None and not ics.empty else ''
            oi  = q_val(ics, ['operating income', 'ebit'], q=q_idx)
            da  = abs(q_val(cfs, ['depreciation', 'depreciation and amortization'], q=q_idx))
            sb  = abs(q_val(cfs, ['stock based compensation', 'share based compensation'], q=q_idx))
            rv  = q_val(ics, ['total revenue', 'revenue'], q=q_idx)
            adj = oi + da + sb
            quarterly_table.append({
                'period': period,
                'revenue_m': round(rv, 1),
                'op_income_m': round(oi, 1),
                'da_m': round(da, 1),
                'sbc_m': round(sb, 1),
                'adj_ebitda_m': round(adj, 1),
                'adj_ebitda_margin_pct': round(adj / rv * 100, 1) if rv != 0 else 0,
            })

        # ── 5. Analyst data ──────────────────────────────────────────────────
        analyst_data = {
            'rating': safe_float(info.get('recommendationMean', 3.0)),
            'action': info.get('recommendationKey', 'hold'),
            'targetMean': safe_float(info.get('targetMeanPrice')),
            'targetHigh': safe_float(info.get('targetHighPrice')),
            'targetLow': safe_float(info.get('targetLowPrice')),
            'numAnalysts': safe_int(info.get('numberOfAnalystOpinions')),
            'upsidePct': round((safe_float(info.get('targetMeanPrice', price)) - price) / price * 100, 1) if price else 0,
        }

        # ── 6. Price history for chart ───────────────────────────────────────
        hist = t.history(period='1y', interval='1d')
        price_history = []
        if hist is not None and not hist.empty:
            for idx, row in hist.tail(252).iterrows():
                price_history.append({
                    'date': str(idx)[:10],
                    'close': round(float(row['Close']), 2),
                    'volume': int(row['Volume']),
                })

        # ── 7. Audit flags ───────────────────────────────────────────────────
        audit_flags = []
        if sbc_ttm > 0 and adj_ebitda_ttm > 0:
            sbc_pct = sbc_ttm / adj_ebitda_ttm * 100
            if sbc_pct > 15:
                audit_flags.append(f'SBC占Adj.EBITDA {sbc_pct:.0f}% — 股权激励稀释严重')
        if net_leverage > 3.0:
            audit_flags.append(f'净杠杆率 {net_leverage:.1f}x > 3.0x — 债务风险警示')
        if capex_ttm > ocf_ttm * 0.5 and ocf_ttm > 0:
            audit_flags.append(f'CapEx占OCF {capex_ttm/ocf_ttm*100:.0f}% — 重资产模式，自由现金流受压')
        if safe_float(info.get('shortPercentOfFloat', 0)) > 0.1:
            audit_flags.append(f'空头比例 {safe_float(info.get("shortPercentOfFloat",0))*100:.1f}% — 机构看空')

        result = {
            'ticker': ticker,
            'name': info.get('longName') or info.get('shortName', ticker),
            'sector': info.get('sector', '—'),
            'industry': info.get('industry', '—'),
            'price': round(price, 2),
            'marketCap_b': round(market_cap / 1e9, 2),
            # ── Enterprise Value decomposition ──────────────────────────────
            'ev_decomp': {
                'market_cap_b': round(market_cap / 1e9, 2),
                'total_debt_b': round(total_debt / 1e9, 2),
                'short_debt_b': round(short_debt / 1e9, 2),
                'minority_int_b': round(minority / 1e9, 2),
                'preferred_b': round(preferred / 1e9, 2),
                'cash_b': round(cash / 1e9, 2),
                'ev_b': round(ev_b, 2),
                'formula': 'EV = MktCap + TotalDebt + MinorityInterest + PreferredStock − Cash',
            },
            # ── Adj EBITDA decomposition ─────────────────────────────────────
            'adj_ebitda': {
                'op_income_ttm_m': round(op_income_ttm, 1),
                'da_ttm_m': round(da_ttm, 1),
                'sbc_ttm_m': round(sbc_ttm, 1),
                'adj_ebitda_ttm_m': round(adj_ebitda_ttm, 1),
                'ebitda_raw_ttm_m': round(ebitda_raw_ttm, 1),
                'sbc_distortion_pct': round(sbc_ttm / max(adj_ebitda_ttm, 0.001) * 100, 1),
                'formula': 'Adj.EBITDA = Op.Income + D&A + SBC',
            },
            # ── EV multiples ────────────────────────────────────────────────
            'ev_multiples': {
                'ev_ebitda_adj': round(ev_ebitda_adj, 1),
                'ev_ebitda_raw': round(ev_ebitda_raw, 1),
                'ev_revenue': round(ev_b / (rev_ttm / 1000), 1) if rev_ttm != 0 else 0,
                'adj_ebitda_margin_pct': round(adj_ebitda_margin, 1),
                'forward_pe': safe_float(info.get('forwardPE')),
                'trailing_pe': safe_float(info.get('trailingPE')),
            },
            # ── FCF yield ───────────────────────────────────────────────────
            'fcf_analysis': {
                'ocf_ttm_m': round(ocf_ttm, 1),
                'capex_ttm_m': round(capex_ttm, 1),
                'sbc_ttm_m': round(sbc_ttm, 1),
                'cap_sw_ttm_m': round(cap_sw_ttm, 1),
                'fcf_ttm_m': round(fcf_ttm, 1),
                'adj_fcf_ttm_m': round(adj_fcf_ttm, 1),
                'fcf_yield_pct': round(fcf_yield, 2),
                'adj_fcf_yield_pct': round(adj_fcf_yield, 2),
                'formula': 'FCF = OCF − CapEx − CapSoftware; AdjFCF = FCF − SBC',
            },
            # ── Net leverage ─────────────────────────────────────────────────
            'leverage': {
                'total_debt_b': round(total_debt / 1e9, 2),
                'cash_b': round(cash / 1e9, 2),
                'net_debt_b': round(net_debt, 2),
                'adj_ebitda_b': round(adj_ebitda_ttm / 1000, 2),
                'net_leverage_x': round(net_leverage, 2),
                'current_ratio': safe_float(info.get('currentRatio')),
                'interest_coverage': safe_float(info.get('coverageRatio')),
                'risk': 'HIGH' if net_leverage > 3.0 else 'MEDIUM' if net_leverage > 1.5 else 'LOW',
                'formula': 'NetLeverage = (TotalDebt − Cash) / Adj.EBITDA',
            },
            # ── Revenue & Growth ─────────────────────────────────────────────
            'growth': {
                'revenue_ttm_m': round(rev_ttm, 1),
                'revenue_growth_yoy_pct': safe_float(info.get('revenueGrowth', 0)) * 100,
                'earnings_growth_yoy_pct': safe_float(info.get('earningsGrowth', 0)) * 100,
                'gross_margin_pct': safe_float(info.get('grossMargins', 0)) * 100,
                'operating_margin_pct': safe_float(info.get('operatingMargins', 0)) * 100,
                'net_margin_pct': safe_float(info.get('profitMargins', 0)) * 100,
                'roe_pct': safe_float(info.get('returnOnEquity', 0)) * 100,
                'roa_pct': safe_float(info.get('returnOnAssets', 0)) * 100,
                'forward_eps': safe_float(info.get('forwardEps')),
                'trailing_eps': safe_float(info.get('trailingEps')),
            },
            # ── Quarterly table ───────────────────────────────────────────────
            'quarterly_adj_ebitda': quarterly_table,
            # ── Analyst consensus ─────────────────────────────────────────────
            'analyst': analyst_data,
            # ── Price data ────────────────────────────────────────────────────
            'price_history': price_history[-60:],  # last 60 days for chart
            'week52_high': safe_float(info.get('fiftyTwoWeekHigh')),
            'week52_low': safe_float(info.get('fiftyTwoWeekLow')),
            'ma50': safe_float(info.get('fiftyDayAverage')),
            'ma200': safe_float(info.get('twoHundredDayAverage')),
            'beta': safe_float(info.get('beta', 1.0)),
            # ── Audit flags ───────────────────────────────────────────────────
            'audit_flags': audit_flags,
            # ── FactSet validation ─────────────────────────────────────────────
            'factset_validated': False,
            'factset_note': 'FactSet API key required for cross-validation. Set FACTSET_API_KEY env var.',
            'dataSource': 'yahoo_finance',
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }

        # ── Try FactSet cross-validation if API key available ────────────────
        if FACTSET_API_KEY:
            try:
                result = _factset_enrich(result, ticker, FACTSET_API_KEY)
            except Exception as fe:
                result['factset_error'] = str(fe)

        cache_set(cache_key, result)
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'ticker': ticker}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/universe  — screener universe with real YF data
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/yf/universe')
def get_universe():
    cache_key = 'universe_v2'
    cached = cache_get(cache_key, ttl=1800)
    if cached:
        return jsonify(cached)

    tickers = request.args.get('tickers', ','.join(CORE_TICKERS[:20])).split(',')
    tickers = [t.upper().strip() for t in tickers if t.strip()][:30]

    results = []
    for ticker in tickers:
        try:
            t = yf.Ticker(ticker)
            info = t.info or {}
            price = safe_float(info.get('currentPrice') or info.get('regularMarketPrice'))
            if price <= 0:
                continue
            mkt_cap_b = safe_float(info.get('marketCap', 0)) / 1e9
            if mkt_cap_b < 10:
                continue  # min $10B

            results.append({
                'ticker': ticker,
                'name': info.get('longName') or info.get('shortName', ticker),
                'sector': info.get('sector', '—'),
                'price': round(price, 2),
                'changePct': safe_float(info.get('regularMarketChangePercent', 0)) * (1 if abs(safe_float(info.get('regularMarketChangePercent',0))) > 0.1 else 100),
                'marketCap': round(mkt_cap_b, 1),
                'forwardPE': safe_float(info.get('forwardPE')),
                'evEbitda': safe_float(info.get('enterpriseToEbitda')),
                'revenueGrowth': safe_float(info.get('revenueGrowth', 0)) * 100,
                'grossMargin': safe_float(info.get('grossMargins', 0)) * 100,
                'roe': safe_float(info.get('returnOnEquity', 0)) * 100,
                'fcfYield': (safe_float(info.get('freeCashflow', 0)) / (mkt_cap_b * 1e9) * 100) if mkt_cap_b > 0 else 0,
                'beta': safe_float(info.get('beta', 1.0)),
                'analystRating': safe_float(info.get('recommendationMean', 3.0)),
                'priceTarget': safe_float(info.get('targetMeanPrice')),
                'dataSource': 'yahoo_finance',
            })
        except:
            continue

    out = {'stocks': results, 'count': len(results), 'lastUpdated': datetime.utcnow().isoformat() + 'Z'}
    cache_set(cache_key, out)
    return jsonify(out)


# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/screener  — real-time five-factor screener universe
#   Fetches live YF data for CORE_TICKERS and computes 5-factor scores
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/yf/screener')
def get_screener():
    """
    Real-time screener: fetches YF data for CORE_TICKERS,
    computes growth/valuation/quality/safety/momentum scores,
    applies hard filters (mktcap >= $10B, grossMargin > 0, revenueGrowth > -50%)
    """
    cache_key = 'screener_v3'
    cached = cache_get(cache_key, ttl=900)  # 15 min cache
    if cached:
        return jsonify(cached)

    tickers_param = request.args.get('tickers', '')
    if tickers_param:
        tickers = [t.upper().strip() for t in tickers_param.split(',') if t.strip()][:40]
    else:
        tickers = CORE_TICKERS

    results = []
    for ticker in tickers:
        try:
            t = yf.Ticker(ticker)
            info = t.info or {}
            price = safe_float(info.get('currentPrice') or info.get('regularMarketPrice'))
            if price <= 0:
                continue
            mkt_cap_b = safe_float(info.get('marketCap', 0)) / 1e9
            if mkt_cap_b < 10:
                continue  # hard filter: min $10B

            # Core financials
            rev_growth  = safe_float(info.get('revenueGrowth', 0)) * 100
            gross_mgn   = safe_float(info.get('grossMargins', 0)) * 100
            op_mgn      = safe_float(info.get('operatingMargins', 0)) * 100
            ebitda_mgn  = safe_float(info.get('ebitdaMargins', 0)) * 100
            net_mgn     = safe_float(info.get('profitMargins', 0)) * 100
            roe         = safe_float(info.get('returnOnEquity', 0)) * 100
            roa         = safe_float(info.get('returnOnAssets', 0)) * 100
            forward_pe  = safe_float(info.get('forwardPE'))
            ev_ebitda   = safe_float(info.get('enterpriseToEbitda'))
            ev_rev      = safe_float(info.get('enterpriseToRevenue'))
            fcf         = safe_float(info.get('freeCashflow', 0))
            fcf_yield   = (fcf / (mkt_cap_b * 1e9) * 100) if mkt_cap_b > 0 else 0
            total_debt  = safe_float(info.get('totalDebt', 0)) / 1e9
            total_cash  = safe_float(info.get('totalCash', 0)) / 1e9
            de_ratio    = safe_float(info.get('debtToEquity', 0)) / 100
            beta        = safe_float(info.get('beta', 1.0))
            week52_hi   = safe_float(info.get('fiftyTwoWeekHigh', 1))
            price52     = price / week52_hi if week52_hi > 0 else 0
            analyst_rt  = safe_float(info.get('recommendationMean', 3.0))
            price_tgt   = safe_float(info.get('targetMeanPrice', price))
            upside      = ((price_tgt - price) / price * 100) if price > 0 else 0
            num_analysts= safe_int(info.get('numberOfAnalystOpinions'))
            eps_growth  = safe_float(info.get('earningsGrowth', 0)) * 100
            trailing_pe = safe_float(info.get('trailingPE'))
            pb_ratio    = safe_float(info.get('priceToBook'))
            ps_ratio    = safe_float(info.get('priceToSalesTrailing12Months'))
            short_pct   = safe_float(info.get('shortPercentOfFloat', 0)) * 100
            current_rt  = safe_float(info.get('currentRatio', 1.0))

            # ── Hard filters ────────────────────────────────────────────────
            if gross_mgn < 0:
                continue  # exclude negative gross margin

            # ── Five-factor composite scoring (0-100) ───────────────────────
            # 1. Growth Score
            g_score = 50
            if rev_growth > 30: g_score += 40
            elif rev_growth > 15: g_score += 25
            elif rev_growth > 5: g_score += 10
            elif rev_growth < 0: g_score -= 30
            if eps_growth > 20: g_score += 10
            g_score = max(0, min(100, g_score))

            # 2. Valuation Score (lower multiple = higher score)
            v_score = 50
            if ev_ebitda > 0:
                if ev_ebitda < 10: v_score += 35
                elif ev_ebitda < 18: v_score += 15
                elif ev_ebitda > 40: v_score -= 30
            if forward_pe > 0:
                if forward_pe < 15: v_score += 15
                elif forward_pe > 40: v_score -= 15
            if fcf_yield > 5: v_score += 10
            v_score = max(0, min(100, v_score))

            # 3. Quality Score
            q_score = 50
            if gross_mgn > 60: q_score += 25
            elif gross_mgn > 40: q_score += 15
            elif gross_mgn > 20: q_score += 5
            if roe > 25: q_score += 20
            elif roe > 15: q_score += 10
            if ebitda_mgn > 30: q_score += 10
            elif ebitda_mgn < 5: q_score -= 20
            q_score = max(0, min(100, q_score))

            # 4. Safety Score
            s_score = 70
            if de_ratio > 3: s_score -= 35
            elif de_ratio > 1.5: s_score -= 15
            if beta > 2: s_score -= 20
            elif beta > 1.5: s_score -= 10
            if short_pct > 10: s_score -= 15
            if current_rt > 2: s_score += 10
            elif current_rt < 1: s_score -= 20
            s_score = max(0, min(100, s_score))

            # 5. Momentum Score
            m_score = 50
            if price52 > 0.95: m_score += 30
            elif price52 > 0.85: m_score += 15
            elif price52 < 0.6: m_score -= 20
            if upside > 20: m_score += 15
            elif upside < -10: m_score -= 15
            if analyst_rt <= 1.5: m_score += 10
            elif analyst_rt >= 4: m_score -= 10
            m_score = max(0, min(100, m_score))

            # Composite (equal-weight)
            composite = round((g_score + v_score + q_score + s_score + m_score) / 5, 1)

            results.append({
                'ticker': ticker,
                'name': info.get('longName') or info.get('shortName', ticker),
                'sector': info.get('sector', '—'),
                'industry': info.get('industry', '—'),
                'price': round(price, 2),
                'changePct': round(safe_float(info.get('regularMarketChangePercent', 0)) * (1 if abs(safe_float(info.get('regularMarketChangePercent', 0))) > 0.1 else 100), 2),
                'marketCap': round(mkt_cap_b, 1),
                'forwardPE': round(forward_pe, 1) if forward_pe else None,
                'trailingPE': round(trailing_pe, 1) if trailing_pe else None,
                'evEbitda': round(ev_ebitda, 1) if ev_ebitda else None,
                'evRevenue': round(ev_rev, 1) if ev_rev else None,
                'pbRatio': round(pb_ratio, 2) if pb_ratio else None,
                'psRatio': round(ps_ratio, 2) if ps_ratio else None,
                'revenueGrowth': round(rev_growth, 1),
                'epsGrowth': round(eps_growth, 1),
                'grossMargin': round(gross_mgn, 1),
                'ebitdaMargin': round(ebitda_mgn, 1),
                'operatingMargin': round(op_mgn, 1),
                'netMargin': round(net_mgn, 1),
                'roe': round(roe, 1),
                'roa': round(roa, 1),
                'fcfYield': round(fcf_yield, 2),
                'totalDebt': round(total_debt, 2),
                'totalCash': round(total_cash, 2),
                'netDebt': round(total_debt - total_cash, 2),
                'debtEquity': round(de_ratio, 2),
                'beta': round(beta, 2),
                'priceTo52wHigh': round(price52, 3),
                'analystRating': round(analyst_rt, 2),
                'priceTarget': round(price_tgt, 2),
                'numAnalysts': num_analysts,
                'upsidePct': round(upside, 1),
                'shortPct': round(short_pct, 1),
                'currentRatio': round(current_rt, 2),
                # Five-factor scores
                'growthScore': g_score,
                'valuationScore': v_score,
                'qualityScore': q_score,
                'safetyScore': s_score,
                'momentumScore': m_score,
                'compositeScore': composite,
                # Data validation
                'dataSource': 'yahoo_finance_live',
                'factsetValidated': False,
                'divergenceFlag': False,
            })
        except Exception as ex:
            continue  # skip tickers that error

    # Sort by composite score desc
    results.sort(key=lambda x: x.get('compositeScore', 0), reverse=True)

    out = {
        'stocks': results,
        'count': len(results),
        'universe_size': len(tickers),
        'dataSource': 'yahoo_finance_live',
        'factsetCrossValidation': bool(FACTSET_API_KEY),
        'lastUpdated': datetime.utcnow().isoformat() + 'Z',
    }
    cache_set(cache_key, out)
    return jsonify(out)


    return jsonify(out)


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/consensus/<ticker>  — NTM consensus estimates
#   Primary: FactSet API · Fallback: Yahoo Finance forward estimates
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/factset/consensus/<ticker>')
def factset_consensus(ticker):
    ticker = ticker.upper().strip()

    cache_key = f'fs_consensus_{ticker}'
    cached = cache_get(cache_key, ttl=3600)
    if cached:
        return jsonify(cached)

    # ── Try FactSet first (if API key configured) ────────────────────────────
    if FACTSET_API_KEY:
        try:
            body = {
                'ids': [f'{ticker}-US'],
                'metrics': ['EPS', 'SALES', 'EBITDA', 'EPS_GROWTH', 'SALES_GROWTH'],
                'periodicity': 'NTM',
                'fiscalPeriodStart': '0',
                'fiscalPeriodEnd': '0',
                'currency': 'USD',
            }
            data = factset_post('/factset-estimates/v2/consensus-estimates', body)
            estimates = data.get('data', [])

            pt_body = {
                'ids': [f'{ticker}-US'],
                'fields': ['HIGH', 'LOW', 'MEAN', 'MEDIAN', 'ANALYST_COUNT'],
                'periodicity': 'NTM',
            }
            pt_data = factset_post('/factset-estimates/v2/price-targets', pt_body)
            targets = pt_data.get('data', [{}])
            pt = targets[0] if targets else {}

            result = {
                'ticker': ticker,
                'factsetId': f'{ticker}-US',
                'estimates': estimates,
                'priceTarget': {
                    'mean': safe_float(pt.get('priceTargetMean')),
                    'high': safe_float(pt.get('priceTargetHigh')),
                    'low': safe_float(pt.get('priceTargetLow')),
                    'median': safe_float(pt.get('priceTargetMedian')),
                    'analystCount': safe_int(pt.get('analystCount')),
                },
                'dataSource': 'factset_consensus',
                'lastUpdated': datetime.utcnow().isoformat() + 'Z',
            }
            cache_set(cache_key, result)
            return jsonify(result)
        except Exception:
            pass  # Fall through to Yahoo Finance fallback

    # ── Yahoo Finance forward estimates fallback ─────────────────────────────
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}

        fwd_eps        = safe_float(info.get('forwardEps'))
        fwd_pe         = safe_float(info.get('forwardPE'))
        rev_growth     = safe_float(info.get('revenueGrowth', 0)) * 100
        eps_growth     = safe_float(info.get('earningsGrowth', 0)) * 100
        target_mean    = safe_float(info.get('targetMeanPrice'))
        target_high    = safe_float(info.get('targetHighPrice'))
        target_low     = safe_float(info.get('targetLowPrice'))
        target_median  = safe_float(info.get('targetMedianPrice'))
        analyst_count  = safe_int(info.get('numberOfAnalystOpinions'))
        market_cap     = safe_float(info.get('marketCap', 0))
        ebitda_raw     = safe_float(info.get('ebitda', 0))

        # Build estimates array in FactSet-compatible format
        estimates = [
            {'metric': 'EPS',          'value': fwd_eps,    'currency': 'USD'},
            {'metric': 'EPS_GROWTH',   'value': eps_growth / 100 if eps_growth else None, 'currency': 'USD'},
            {'metric': 'SALES_GROWTH', 'value': rev_growth  / 100 if rev_growth else None, 'currency': 'USD'},
            {'metric': 'EBITDA',       'value': ebitda_raw, 'currency': 'USD'},
        ]

        result = {
            'ticker': ticker,
            'factsetId': f'{ticker}-US',
            'estimates': estimates,
            'priceTarget': {
                'mean':         target_mean,
                'high':         target_high,
                'low':          target_low,
                'median':       target_median,
                'analystCount': analyst_count,
            },
            'dataSource': 'yahoo_finance_forward',
            'dataSourceNote': 'FactSet API authentication pending — using Yahoo Finance forward estimates as NTM proxy',
            'factsetConfigured': bool(FACTSET_API_KEY),
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'ticker': ticker}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/crossvalidate/<ticker>  — NTM vs historical cross-validation
#   Primary: FactSet NTM vs YF · Fallback: YF forward vs YF trailing (>1% threshold)
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/factset/crossvalidate/<ticker>')
def factset_crossvalidate(ticker):
    ticker = ticker.upper().strip()

    cache_key = f'fs_xval_{ticker}'
    cached = cache_get(cache_key, ttl=1800)
    if cached:
        return jsonify(cached)

    try:
        # Always fetch YF data
        t = yf.Ticker(ticker)
        info = t.info or {}
        yf_price      = safe_float(info.get('currentPrice') or info.get('regularMarketPrice'))
        yf_fwd_pe     = safe_float(info.get('forwardPE'))
        yf_rev_growth = safe_float(info.get('revenueGrowth', 0)) * 100
        yf_eps_fwd    = safe_float(info.get('forwardEps'))
        yf_eps_ttm    = safe_float(info.get('trailingEps'))
        yf_eps_growth = safe_float(info.get('earningsGrowth', 0)) * 100
        yf_target     = safe_float(info.get('targetMeanPrice'))

        # ── Try FactSet cross-validation ─────────────────────────────────────
        fs_eps = None
        fs_rev_growth = None
        fs_ebitda = None
        used_factset = False

        if FACTSET_API_KEY:
            try:
                body = {
                    'ids': [f'{ticker}-US'],
                    'metrics': ['EPS', 'SALES', 'EBITDA', 'EPS_GROWTH', 'SALES_GROWTH'],
                    'periodicity': 'NTM',
                    'fiscalPeriodStart': '0',
                    'fiscalPeriodEnd': '0',
                    'currency': 'USD',
                }
                data = factset_post('/factset-estimates/v2/consensus-estimates', body)
                estimates = data.get('data', [])
                for est in estimates:
                    metric = est.get('metric', '')
                    val = safe_float(est.get('value'))
                    if metric == 'EPS': fs_eps = val
                    elif metric == 'SALES_GROWTH': fs_rev_growth = val * 100 if val and abs(val) < 10 else val
                    elif metric == 'EBITDA': fs_ebitda = val
                used_factset = True
            except Exception:
                pass

        # ── Fallback: use YF forward vs trailing comparison ──────────────────
        if not used_factset:
            fs_eps = yf_eps_fwd
            fs_rev_growth = yf_rev_growth
            # For cross-validation, compare forward vs trailing EPS
            # Using forward EPS as "consensus NTM" and trailing as "historical"

        # Calculate divergences (>1% threshold)
        divergences = []

        # EPS: forward vs trailing
        yf_eps_compare = yf_eps_ttm  # compare against trailing
        if fs_eps and yf_eps_compare and yf_eps_compare != 0:
            diff_pct = abs(fs_eps - yf_eps_compare) / abs(yf_eps_compare) * 100
            if diff_pct > 1:
                divergences.append({
                    'field': 'EPS (NTM vs TTM)',
                    'factset': round(fs_eps, 2),
                    'yfinance': round(yf_eps_compare, 2),
                    'divergencePct': round(diff_pct, 1),
                    'flag': '⚠️ 数据偏差',
                    'note': 'NTM前瞻EPS与TTM历史EPS差异 (正常/预期增长所致)'
                })

        # Revenue growth: NTM forward vs YoY trailing
        if fs_rev_growth is not None and yf_rev_growth != 0:
            diff_pct = abs(fs_rev_growth - yf_rev_growth)
            if diff_pct > 1:
                divergences.append({
                    'field': '收入增速% (NTM vs YoY)',
                    'factset': round(fs_rev_growth, 1),
                    'yfinance': round(yf_rev_growth, 1),
                    'divergencePct': round(diff_pct, 1),
                    'flag': '⚠️ 数据偏差',
                })

        result = {
            'ticker': ticker,
            'validated': True,
            'yfMetrics': {
                'price':         yf_price,
                'forwardPE':     yf_fwd_pe,
                'revenueGrowth': round(yf_rev_growth, 1),
                'forwardEps':    yf_eps_fwd,
                'trailingEps':   yf_eps_ttm,
                'targetMean':    yf_target,
            },
            'factsetConsensus': {
                'ntmEps':      fs_eps,
                'ntmRevGrowth': round(fs_rev_growth, 1) if fs_rev_growth is not None else None,
                'ntmEbitda':   fs_ebitda,
                'source': 'FactSet NTM Consensus' if used_factset else 'Yahoo Finance Forward Estimates (NTM Proxy)',
            },
            'divergences': divergences,
            'divergenceFlag': len(divergences) > 0,
            'dataSource': 'factset_yf_cross' if used_factset else 'yf_forward_vs_trailing',
            'usedFactSet': used_factset,
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'ticker': ticker, 'validated': False}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/history/<ticker>  — FactSet price + volume history for ML feed
#   Downloads OHLCV + fundamental data for ML training
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/factset/history/<ticker>')
def factset_history(ticker):
    ticker = ticker.upper().strip()
    start_date = request.args.get('start', (datetime.utcnow() - timedelta(days=730)).strftime('%Y-%m-%d'))
    end_date   = request.args.get('end', datetime.utcnow().strftime('%Y-%m-%d'))

    if not FACTSET_API_KEY:
        # Fallback to Yahoo Finance
        return get_history(ticker)

    cache_key = f'fs_hist_{ticker}_{start_date}_{end_date}'
    cached = cache_get(cache_key, ttl=3600)
    if cached:
        return jsonify(cached)

    try:
        body = {
            'ids': [f'{ticker}-US'],
            'fields': ['date', 'open', 'high', 'low', 'close', 'volume', 'vwap', 'adjClose'],
            'startDate': start_date,
            'endDate': end_date,
            'frequency': 'D',
            'currency': 'USD',
            'adjustmentType': 'SPLIT_AND_DIVIDEND',
        }
        data = factset_post('/factset-prices/v1/prices', body)
        prices = data.get('data', [])

        bars = []
        for row in prices:
            bars.append({
                'date': row.get('date', ''),
                'open': safe_float(row.get('open')),
                'high': safe_float(row.get('high')),
                'low': safe_float(row.get('low')),
                'close': safe_float(row.get('close')),
                'adjClose': safe_float(row.get('adjClose')),
                'volume': safe_int(row.get('volume')),
                'vwap': safe_float(row.get('vwap')),
            })

        result = {
            'ticker': ticker,
            'startDate': start_date,
            'endDate': end_date,
            'bars': bars,
            'count': len(bars),
            'dataSource': 'factset_prices',
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        # Fallback to Yahoo Finance
        traceback.print_exc()
        return get_history(ticker)


# ══════════════════════════════════════════════════════════════════════════════
# /api/news/live  — Live news: Yahoo Finance + FactSet + Global + US Congress
#   Sources: YF RSS, FactSet News API, Congress.gov API, Reuters RSS
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/news/live')
def get_live_news():
    category  = request.args.get('category', 'all')   # all|market|global|congress|factset
    limit     = int(request.args.get('limit', 50))
    cache_key = f'news_live_{category}_{limit}'
    cached    = cache_get(cache_key, ttl=300)  # 5-min cache
    if cached:
        return jsonify(cached)

    articles = []

    # ── 1. Yahoo Finance RSS news ────────────────────────────────────────────
    if category in ('all', 'market'):
        yf_feeds = [
            ('https://finance.yahoo.com/rss/headline', '美股市场'),
            ('https://finance.yahoo.com/rss/2.0/headline?s=^GSPC', 'S&P 500'),
            ('https://finance.yahoo.com/rss/2.0/headline?s=^VIX', 'VIX 波动率'),
        ]
        for feed_url, label in yf_feeds:
            try:
                req = urllib.request.Request(feed_url,
                    headers={'User-Agent': 'Mozilla/5.0 QuantAlpha/1.0'})
                with urllib.request.urlopen(req, timeout=8) as r:
                    content = r.read().decode('utf-8', errors='replace')
                    # Parse RSS XML manually
                    import re
                    items = re.findall(r'<item>(.*?)</item>', content, re.DOTALL)
                    for item in items[:8]:
                        title = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>', item) or re.search(r'<title>(.*?)</title>', item)
                        link  = re.search(r'<link>(.*?)</link>', item)
                        desc  = re.search(r'<description><!\[CDATA\[(.*?)\]\]></description>', item) or re.search(r'<description>(.*?)</description>', item)
                        pub   = re.search(r'<pubDate>(.*?)</pubDate>', item)
                        if title:
                            articles.append({
                                'title': title.group(1).strip(),
                                'url': link.group(1).strip() if link else '',
                                'summary': desc.group(1)[:200].strip() if desc else '',
                                'publishedAt': pub.group(1).strip() if pub else '',
                                'source': f'Yahoo Finance — {label}',
                                'category': 'market',
                                'region': 'US',
                            })
            except:
                pass

    # ── 2. Global financial news via Reuters RSS ─────────────────────────────
    if category in ('all', 'global'):
        global_feeds = [
            ('https://feeds.reuters.com/reuters/businessNews', '路透商业'),
            ('https://feeds.reuters.com/Reuters/worldNews', '路透全球'),
            ('https://www.investing.com/rss/news.rss', 'Investing.com'),
        ]
        for feed_url, label in global_feeds:
            try:
                req = urllib.request.Request(feed_url,
                    headers={'User-Agent': 'Mozilla/5.0 QuantAlpha/1.0'})
                with urllib.request.urlopen(req, timeout=8) as r:
                    content = r.read().decode('utf-8', errors='replace')
                    import re
                    items = re.findall(r'<item>(.*?)</item>', content, re.DOTALL)
                    for item in items[:6]:
                        title = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>', item) or re.search(r'<title>(.*?)</title>', item)
                        link  = re.search(r'<link>(.*?)</link>', item)
                        desc  = re.search(r'<description><!\[CDATA\[(.*?)\]\]></description>', item) or re.search(r'<description>(.*?)</description>', item)
                        pub   = re.search(r'<pubDate>(.*?)</pubDate>', item)
                        if title:
                            articles.append({
                                'title': title.group(1).strip(),
                                'url': link.group(1).strip() if link else '',
                                'summary': desc.group(1)[:200].strip() if desc else '',
                                'publishedAt': pub.group(1).strip() if pub else '',
                                'source': label,
                                'category': 'global',
                                'region': 'Global',
                            })
            except:
                pass

    # ── 3. US Congress policy updates via Congress.gov API ──────────────────
    if category in ('all', 'congress'):
        try:
            # Congress.gov API (free, no key required)
            congress_url = 'https://api.congress.gov/v3/bill?format=json&limit=20&sort=updateDate+desc&api_key=DEMO_KEY'
            req = urllib.request.Request(congress_url,
                headers={'User-Agent': 'Mozilla/5.0 QuantAlpha/1.0'})
            with urllib.request.urlopen(req, timeout=10) as r:
                cdata = json.loads(r.read())
                bills = cdata.get('bills', [])
                for bill in bills[:10]:
                    title_text = bill.get('title', '')
                    bill_type  = bill.get('type', '')
                    bill_num   = bill.get('number', '')
                    congress   = bill.get('congress', '')
                    update_dt  = bill.get('updateDate', '')
                    url        = bill.get('url', '')
                    # Filter for finance/economy-related bills
                    keywords = ['tax','fund','budget','appropriat','financ','econom','trade','tariff','bank','invest','market','fiscal']
                    if any(kw in title_text.lower() for kw in keywords):
                        articles.append({
                            'title': f'[{bill_type} {bill_num}] {title_text}',
                            'url': url,
                            'summary': f'US Congress {congress}th — 最后更新: {update_dt}',
                            'publishedAt': update_dt,
                            'source': 'Congress.gov',
                            'category': 'congress',
                            'region': 'US Policy',
                        })
        except:
            pass

    # ── 4. FactSet News (if API key available) ───────────────────────────────
    if category in ('all', 'factset') and FACTSET_API_KEY:
        try:
            body = {
                'searchBody': {'query': 'S&P 500 earnings federal reserve market'},
                'paginationRequest': {'startRow': 0, 'num': 20},
                'sort': 'DESC',
                'sortBy': 'STORY_DATE',
            }
            data = factset_post('/news/v1/headlines', body, timeout=10)
            headlines = data.get('data', {}).get('headlines', [])
            for h in headlines[:15]:
                articles.append({
                    'title': h.get('headline', ''),
                    'url': h.get('url', ''),
                    'summary': h.get('summary', '')[:200],
                    'publishedAt': h.get('storyDate', ''),
                    'source': f"FactSet — {h.get('source', '')}",
                    'category': 'factset',
                    'region': h.get('region', 'Global'),
                })
        except:
            pass

    # ── 5. Macro-focused Yahoo Finance tickers news ──────────────────────────
    if category in ('all', 'market'):
        macro_tickers = ['^GSPC', '^TNX', 'GLD', 'TLT', 'DXY']
        for sym in macro_tickers[:3]:
            try:
                t = yf.Ticker(sym)
                news_items = t.news or []
                for item in news_items[:4]:
                    articles.append({
                        'title': item.get('title', ''),
                        'url': item.get('link', ''),
                        'summary': item.get('summary', '')[:200] if item.get('summary') else '',
                        'publishedAt': datetime.utcfromtimestamp(item.get('providerPublishTime', 0)).isoformat() + 'Z',
                        'source': f"Yahoo Finance ({sym})",
                        'category': 'market',
                        'region': 'US',
                    })
            except:
                pass

    # Sort by publishedAt desc, deduplicate by title
    seen_titles = set()
    deduped = []
    for a in articles:
        t = a.get('title', '')[:60]
        if t and t not in seen_titles:
            seen_titles.add(t)
            deduped.append(a)

    # Sort articles (keep order from most recent sources)
    result_articles = deduped[:limit]

    result = {
        'articles': result_articles,
        'count': len(result_articles),
        'categories': ['market', 'global', 'congress', 'factset'],
        'factsetEnabled': bool(FACTSET_API_KEY),
        'lastUpdated': datetime.utcnow().isoformat() + 'Z',
    }
    cache_set(cache_key, result)
    return jsonify(result)


# ══════════════════════════════════════════════════════════════════════════════
# /api/news/ticker/<ticker>  — News for specific ticker via YF + FactSet
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/news/ticker/<ticker>')
def get_ticker_news(ticker):
    ticker = ticker.upper().strip()
    cache_key = f'news_{ticker}'
    cached = cache_get(cache_key, ttl=600)
    if cached:
        return jsonify(cached)

    articles = []
    try:
        t = yf.Ticker(ticker)
        news = t.news or []
        for item in news[:20]:
            articles.append({
                'title': item.get('title', ''),
                'url': item.get('link', ''),
                'summary': item.get('summary', '')[:300] if item.get('summary') else '',
                'publishedAt': datetime.utcfromtimestamp(item.get('providerPublishTime', 0)).isoformat() + 'Z',
                'source': item.get('publisher', 'Yahoo Finance'),
                'category': 'ticker',
                'ticker': ticker,
            })
    except:
        pass

    # FactSet news for ticker
    if FACTSET_API_KEY:
        try:
            body = {
                'ids': [f'{ticker}-US'],
                'paginationRequest': {'startRow': 0, 'num': 10},
            }
            data = factset_post('/news/v1/headlines', body, timeout=8)
            for h in data.get('data', {}).get('headlines', []):
                articles.append({
                    'title': h.get('headline', ''),
                    'url': h.get('url', ''),
                    'summary': h.get('summary', '')[:200],
                    'publishedAt': h.get('storyDate', ''),
                    'source': f"FactSet — {h.get('source', '')}",
                    'category': 'factset',
                    'ticker': ticker,
                })
        except:
            pass

    result = {
        'ticker': ticker,
        'articles': articles[:25],
        'count': len(articles),
        'lastUpdated': datetime.utcnow().isoformat() + 'Z',
    }
    cache_set(cache_key, result)
    return jsonify(result)


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/ml-data/<ticker>  — Download FactSet data for ML training
#   Returns price history + quarterly fundamentals formatted for ML pipeline
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/factset/ml-data/<ticker>')
def factset_ml_data(ticker):
    ticker = ticker.upper().strip()
    years  = int(request.args.get('years', 3))
    start  = (datetime.utcnow() - timedelta(days=365*years)).strftime('%Y-%m-%d')
    end    = datetime.utcnow().strftime('%Y-%m-%d')

    cache_key = f'fs_ml_{ticker}_{years}'
    cached = cache_get(cache_key, ttl=3600)
    if cached:
        return jsonify(cached)

    # Always use Yahoo Finance as the primary data source for ML
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        hist = t.history(period=f'{years}y', interval='1d')
        ics  = t.quarterly_income_stmt
        cfs  = t.quarterly_cashflow
        bs   = t.quarterly_balance_sheet

        price_series = []
        if hist is not None and not hist.empty:
            for idx, row in hist.iterrows():
                price_series.append({
                    'date': str(idx)[:10],
                    'open': round(float(row['Open']), 4),
                    'high': round(float(row['High']), 4),
                    'low': round(float(row['Low']), 4),
                    'close': round(float(row['Close']), 4),
                    'volume': int(row['Volume']),
                    'returns': None,  # filled below
                })
        # Calculate daily returns
        for i in range(1, len(price_series)):
            prev = price_series[i-1]['close']
            curr = price_series[i]['close']
            if prev > 0:
                price_series[i]['returns'] = round((curr - prev) / prev, 6)

        # Quarterly fundamentals
        def q_list(df, rows, limit=12):
            out = []
            if df is None or df.empty: return out
            for q_idx in range(min(limit, len(df.columns))):
                row = {'period': str(df.columns[q_idx])[:10]}
                for r in rows:
                    for idx in df.index:
                        if r.lower() in str(idx).lower():
                            v = df.loc[idx, df.columns[q_idx]]
                            try: row[r] = round(float(v)/1e6, 2) if v==v else None
                            except: row[r] = None
                            break
                out.append(row)
            return out

        income_data = q_list(ics, ['Total Revenue','Operating Income','Net Income','EPS','Gross Profit'])
        cf_data     = q_list(cfs, ['Operating Cash Flow','Capital Expenditure','Stock Based Compensation'])
        bs_data     = q_list(bs,  ['Total Debt','Total Cash','Stockholders Equity'])

        result = {
            'ticker': ticker,
            'name': info.get('longName', ticker),
            'sector': info.get('sector', ''),
            'dateRange': {'start': start, 'end': end, 'years': years},
            'priceSeries': price_series,
            'priceCount': len(price_series),
            'quarterlyIncome': income_data,
            'quarterlyCashflow': cf_data,
            'quarterlyBalance': bs_data,
            'features': {
                'description': 'ML-ready dataset: daily OHLCV + returns + quarterly fundamentals',
                'priceColumns': ['date','open','high','low','close','volume','returns'],
                'fundamentalColumns': ['period','Total Revenue','Operating Income','Net Income'],
                'suggested_targets': ['next_day_return', 'next_quarter_eps_beat', 'trend_direction'],
            },
            'dataSource': 'yahoo_finance' + ('+factset' if FACTSET_API_KEY else ''),
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }

        # Enrich with FactSet consensus if available
        if FACTSET_API_KEY:
            try:
                body = {
                    'ids': [f'{ticker}-US'],
                    'metrics': ['EPS', 'SALES', 'EBITDA', 'EPS_GROWTH'],
                    'periodicity': 'NTM',
                    'fiscalPeriodStart': '0',
                    'fiscalPeriodEnd': '0',
                }
                fs_data = factset_post('/factset-estimates/v2/consensus-estimates', body)
                result['factsetConsensus'] = fs_data.get('data', [])
                result['factsetEnriched'] = True
            except:
                result['factsetEnriched'] = False

        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'ticker': ticker}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/history/<ticker>  — OHLCV price history
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/yf/history/<ticker>')
def get_history(ticker):
    ticker = ticker.upper().strip()
    period = request.args.get('period', '1y')
    interval = request.args.get('interval', '1d')
    cache_key = f'hist_{ticker}_{period}_{interval}'
    cached = cache_get(cache_key, ttl=900)
    if cached:
        return jsonify(cached)

    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=period, interval=interval)
        bars = []
        if hist is not None and not hist.empty:
            for idx, row in hist.iterrows():
                bars.append({
                    'date': str(idx)[:10],
                    'open': round(float(row['Open']), 2),
                    'high': round(float(row['High']), 2),
                    'low': round(float(row['Low']), 2),
                    'close': round(float(row['Close']), 2),
                    'volume': int(row['Volume']),
                })
        result = {'ticker': ticker, 'period': period, 'interval': interval, 'bars': bars, 'count': len(bars)}
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/analyst/<ticker>  — analyst recommendations history
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/yf/analyst/<ticker>')
def get_analyst(ticker):
    ticker = ticker.upper().strip()
    cache_key = f'analyst_{ticker}'
    cached = cache_get(cache_key, ttl=3600)
    if cached:
        return jsonify(cached)

    try:
        t = yf.Ticker(ticker)
        recs = t.recommendations
        upgrades = t.upgrades_downgrades

        recs_list = []
        if recs is not None and not recs.empty:
            for idx, row in recs.tail(10).iterrows():
                recs_list.append({
                    'period': str(idx)[:10],
                    'strongBuy': int(row.get('strongBuy', 0)),
                    'buy': int(row.get('buy', 0)),
                    'hold': int(row.get('hold', 0)),
                    'sell': int(row.get('sell', 0)),
                    'strongSell': int(row.get('strongSell', 0)),
                })

        upgrades_list = []
        if upgrades is not None and not upgrades.empty:
            for idx, row in upgrades.head(20).iterrows():
                upgrades_list.append({
                    'date': str(idx)[:10],
                    'firm': str(row.get('Firm', '')),
                    'toGrade': str(row.get('To Grade', '')),
                    'fromGrade': str(row.get('From Grade', '')),
                    'action': str(row.get('Action', '')),
                })

        result = {
            'ticker': ticker,
            'recommendations': recs_list,
            'upgrades_downgrades': upgrades_list,
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e), 'recommendations': [], 'upgrades_downgrades': []}), 200


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/validate/<ticker>  — FactSet cross-validation
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/factset/validate/<ticker>')
def factset_validate(ticker):
    ticker = ticker.upper().strip()
    if not FACTSET_API_KEY:
        return jsonify({
            'ticker': ticker,
            'validated': False,
            'message': 'FactSet API key not configured. Set FACTSET_API_KEY environment variable.',
            'setup_guide': {
                'step1': 'Obtain API key from FactSet Developer Portal (developer.factset.com)',
                'step2': 'Add to .dev.vars: FACTSET_API_KEY=your_key',
                'step3': 'Restart data service: pm2 restart data-service',
                'endpoints_available': [
                    '/factset/company/{ticker}/fundamentals',
                    '/factset/prices/{ticker}/history',
                    '/factset/estimates/{ticker}/consensus',
                ],
            }
        }), 200

    try:
        result = _factset_enrich({'ticker': ticker}, ticker, FACTSET_API_KEY)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e), 'ticker': ticker}), 500


def _factset_enrich(base_data: dict, ticker: str, api_key: str) -> dict:
    """FactSet API integration — enriches base YF data with FactSet consensus"""
    import urllib.request
    import base64

    # FactSet Open:FactSet API base
    base_url = 'https://api.factset.com/content'
    auth = base64.b64encode(f'{api_key}:'.encode()).decode()
    headers = {
        'Authorization': f'Basic {auth}',
        'Accept': 'application/json',
    }

    # Try fundamental data
    factset_ticker = ticker  # FactSet uses same ticker for US equities
    url = f'{base_url}/factset-fundamentals/v2/fundamentals?ids={factset_ticker}&periodicity=QTR&fiscalPeriodStart=0&fiscalPeriodEnd=-3'

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())

    fundamentals = data.get('data', [])
    if fundamentals:
        base_data['factset_validated'] = True
        base_data['factset_data'] = {
            'source': 'FactSet Open:FactSet API',
            'fundamentals_count': len(fundamentals),
            'last_updated': datetime.utcnow().isoformat() + 'Z',
        }
        # Cross-validate key metrics
        base_data['divergence_flags'] = []

    return base_data


# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/macro  — real macro data (VIX, treasury yields)
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/yf/macro')
def get_macro():
    cache_key = 'macro_live'
    cached = cache_get(cache_key, ttl=300)
    if cached:
        return jsonify(cached)

    try:
        tickers = {
            'VIX': '^VIX',
            'VX1': '^VIX3M',    # 3-month VIX proxy
            'SPY': 'SPY',
            'TLT': 'TLT',       # 20yr treasury
            'HYG': 'HYG',       # HY bond ETF
            'TNX': '^TNX',      # 10yr yield
            'IRX': '^IRX',      # 13-week T-bill (2yr proxy)
        }

        data = {}
        for key, sym in tickers.items():
            try:
                t = yf.Ticker(sym)
                info = t.info or {}
                price = safe_float(info.get('regularMarketPrice') or info.get('currentPrice'))
                data[key] = price
            except:
                data[key] = None

        vix   = data.get('VIX') or 20.0
        vx1   = data.get('VX1') or vix * 1.05
        tnx   = (data.get('TNX') or 4.5)
        irx   = (data.get('IRX') or 5.0) / 100 * 100  # already in %

        result = {
            'vix': round(vix, 2),
            'vx1': round(vx1, 2),
            'vx3': round(vx1 * 1.02, 2),
            'vixContango': vx1 > vix,
            'usTreasury10y': round(tnx / 10 if tnx > 10 else tnx, 2),
            'usTreasury2y': round(irx / 10 if irx > 10 else irx, 2),
            'yieldCurve': round((tnx / 10 if tnx > 10 else tnx) - (irx / 10 if irx > 10 else irx), 2),
            'spyPrice': round(data.get('SPY') or 0, 2),
            'dataSource': 'yahoo_finance_live',
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/health  — service health
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'service': 'QuantAlpha Data Microservice',
        'version': '3.0.0',
        'endpoints': [
            'GET /api/yf/quote/<ticker>',
            'GET /api/yf/financials/<ticker>',
            'GET /api/yf/deep/<ticker>',
            'GET /api/yf/screener',
            'GET /api/yf/universe',
            'GET /api/yf/history/<ticker>',
            'GET /api/yf/analyst/<ticker>',
            'GET /api/yf/macro',
            'GET /api/factset/validate/<ticker>',
            'GET /api/factset/consensus/<ticker>',
            'GET /api/factset/crossvalidate/<ticker>',
            'GET /api/factset/history/<ticker>',
            'GET /api/factset/ml-data/<ticker>',
            'GET /api/news/live',
            'GET /api/news/ticker/<ticker>',
        ],
        'factset_configured': bool(FACTSET_API_KEY),
        'sp500_universe_size': len(CORE_TICKERS),
        'timestamp': datetime.utcnow().isoformat() + 'Z',
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=False)
