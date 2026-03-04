"""
modules/price_volume — Data Center: Raw Data Fetching & Local Storage
This module is responsible for:
  1. Fetching raw market data (quotes, financials, price history) from Yahoo Finance
  2. Storing fetched data locally by date+time folders
  3. Providing a refresh button API: fetch once, store locally, reuse for subsequent analysis
  4. NO computation/scoring here — that belongs to screener module

Fields per ticker (stored in universe_raw.json):
  - ticker, name, sector, industry, exchange, currency
  - price, prevClose, change, changePct, open, dayHigh, dayLow
  - week52High, week52Low, volume, avgVolume
  - marketCap (B), ev (B), sharesOutstanding, floatShares
  - shortRatio, shortPct
  - forwardPE, trailingPE, evEbitda, evRevenue, pbRatio, psRatio, pegRatio
  - revenueGrowth, earningsGrowth, revenueQoQ, earningsQoQ
  - grossMargin, ebitdaMargin, operatingMargin, netMargin, roe, roa
  - operatingCashflow, freeCashflow, fcfYield
  - totalDebt, totalCash, netDebt, debtEquity, currentRatio, quickRatio
  - dividendYield, dividendRate, payoutRatio
  - analystRating, analystAction, priceTarget, priceTargetHigh, priceTargetLow, numAnalysts
  - beta, ma50, ma200, priceTo52wHigh
  - revenue, ebitda, eps, forwardEps
"""

from flask import Blueprint, jsonify, request
import yfinance as yf
from datetime import datetime
import traceback

from modules.utils import (
    cache_get, cache_set, safe_float, safe_int,
    CORE_TICKERS, SP500_EXTENDED,
    save_json_to_storage, load_json_from_latest, list_storage_snapshots,
)

bp = Blueprint('price_volume', __name__, url_prefix='/api')


def _fetch_single_quote(ticker):
    """Fetch all raw fields for a single ticker from Yahoo Finance."""
    t = yf.Ticker(ticker)
    info = t.info or {}

    price      = safe_float(info.get('currentPrice') or info.get('regularMarketPrice'))
    prev_close = safe_float(info.get('previousClose') or info.get('regularMarketPreviousClose'))
    change     = round(price - prev_close, 4) if price and prev_close else 0
    change_pct = round((change / prev_close) * 100, 4) if prev_close else 0
    market_cap_b = safe_float(info.get('marketCap', 0)) / 1e9
    total_debt   = safe_float(info.get('totalDebt', 0))
    cash         = safe_float(info.get('totalCash', 0))
    minority_int = safe_float(info.get('minorityInterest', 0))
    ev_b = (safe_float(info.get('enterpriseValue', 0)) or
            (market_cap_b * 1e9 + total_debt - cash + minority_int)) / 1e9

    return {
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
        # Cash flow
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
        # Revenue/earnings raw
        'revenue': safe_float(info.get('totalRevenue', 0)) / 1e9,
        'ebitda': safe_float(info.get('ebitda', 0)) / 1e9,
        'eps': safe_float(info.get('trailingEps')),
        'forwardEps': safe_float(info.get('forwardEps')),
    }


# ══════════════════════════════════════════════════════════════════════════════
# /api/dc/refresh  — Fetch ALL raw data and store locally (click button to trigger)
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/dc/refresh', methods=['POST'])
def refresh_data_center():
    """
    Fetch raw data for the full CORE_TICKERS universe from Yahoo Finance.
    Store the result locally by date+time folder.
    Returns the stored data so the frontend can use it immediately.
    """
    tickers_param = request.json.get('tickers', None) if request.is_json else None
    tickers = tickers_param or CORE_TICKERS

    timestamp = datetime.utcnow()
    results = []
    errors = []

    for ticker in tickers:
        try:
            data = _fetch_single_quote(ticker.upper().strip())
            if data['price'] > 0:
                data['dataSource'] = 'yahoo_finance'
                data['fetchedAt'] = timestamp.isoformat() + 'Z'
                results.append(data)
        except Exception as e:
            errors.append({'ticker': ticker, 'error': str(e)})

    # Save to local storage
    payload = {
        'stocks': results,
        'count': len(results),
        'universe_size': len(tickers),
        'fetchedAt': timestamp.isoformat() + 'Z',
        'dataSource': 'yahoo_finance',
        'errors': errors,
    }
    filepath = save_json_to_storage('price_volume', 'universe_raw.json', payload, timestamp)

    return jsonify({
        **payload,
        'storagePath': filepath,
        'message': f'Fetched {len(results)}/{len(tickers)} tickers, stored locally.',
    })


# ══════════════════════════════════════════════════════════════════════════════
# /api/dc/data  — Read latest locally-stored data (no online fetching)
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/dc/data')
def get_data_center_data():
    """
    Return the latest locally-stored universe data.
    If no local data exists, return empty with a hint to refresh.
    """
    data, dt_str = load_json_from_latest('price_volume', 'universe_raw.json')
    if data is None:
        return jsonify({
            'stocks': [],
            'count': 0,
            'lastUpdated': None,
            'needsRefresh': True,
            'message': 'No local data found. Click "Refresh" to fetch data.',
        })
    return jsonify({
        **data,
        'lastUpdated': dt_str,
        'needsRefresh': False,
    })


# ══════════════════════════════════════════════════════════════════════════════
# /api/dc/snapshots  — List all historical snapshots
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/dc/snapshots')
def get_data_center_snapshots():
    """List all date+time snapshots stored locally."""
    snapshots = list_storage_snapshots('price_volume')
    return jsonify({'snapshots': snapshots, 'count': len(snapshots)})


# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/quote/<ticker>  — single ticker real-time quote (original API preserved)
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/yf/quote/<ticker>')
def get_quote(ticker):
    ticker = ticker.upper().strip()
    cache_key = f'quote_{ticker}'
    cached = cache_get(cache_key, ttl=300)
    if cached:
        return jsonify(cached)
    try:
        result = _fetch_single_quote(ticker)
        result['dataSource'] = 'yahoo_finance'
        result['lastUpdated'] = datetime.utcnow().isoformat() + 'Z'
        result['factsetValidated'] = False
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e), 'ticker': ticker}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/financials/<ticker>  — quarterly P&L, balance sheet, cash flow
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/yf/financials/<ticker>')
def get_financials(ticker):
    ticker = ticker.upper().strip()
    cache_key = f'fin_{ticker}'
    cached = cache_get(cache_key, ttl=3600)
    if cached:
        return jsonify(cached)
    try:
        t = yf.Ticker(ticker)

        def df_to_list(df, limit=4):
            if df is None or df.empty:
                return []
            rows = []
            for col in df.columns[:limit]:
                row = {'period': str(col)[:10]}
                for idx in df.index:
                    val = df.loc[idx, col]
                    key = str(idx).replace(' ', '_').replace('/', '_').lower()
                    try:
                        row[key] = round(float(val) / 1e6, 2) if val == val else None
                    except:
                        row[key] = None
                rows.append(row)
            return rows

        income_q   = df_to_list(t.quarterly_income_stmt)
        balance_q  = df_to_list(t.quarterly_balance_sheet)
        cashflow_q = df_to_list(t.quarterly_cashflow)

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
                'ebit': ebit, 'da': da, 'sbc': sbc,
                'adj_ebitda': round((ebit or 0) + da + sbc, 2),
            })

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
# /api/yf/history/<ticker>  — OHLCV price history
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/yf/history/<ticker>')
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
@bp.route('/yf/analyst/<ticker>')
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
# /api/yf/universe  — quick universe listing (original API preserved)
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/yf/universe')
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
                continue
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
