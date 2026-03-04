"""
modules/bloomberg — Bloomberg Terminal Integration and Local Archiving
Wraps bloomberg_service.py and storage.py with Flask routes.
"""

from flask import Blueprint, jsonify, request
import yfinance as yf
from datetime import datetime, timedelta
import traceback

from modules.utils import cache_get, cache_set, safe_float, safe_int

bp = Blueprint('bloomberg', __name__, url_prefix='/api')

# Try to import Bloomberg service
try:
    from bloomberg_service import (
        BLPAPI_AVAILABLE,
        fetch_bbg_reference_data,
        fetch_bbg_historical_data,
        fetch_bbg_estimates
    )
    from storage import archive_reference_data, archive_history_data
except ImportError:
    BLPAPI_AVAILABLE = False
    def fetch_bbg_reference_data(*a, **k): return {}
    def fetch_bbg_historical_data(*a, **k): return []
    def fetch_bbg_estimates(*a, **k): return {}
    def archive_reference_data(*a, **k): pass
    def archive_history_data(*a, **k): pass


# ══════════════════════════════════════════════════════════════════════════════
# /api/bloomberg/consensus/<ticker>
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/bloomberg/consensus/<ticker>')
def bloomberg_consensus(ticker):
    ticker = ticker.upper().strip()
    cache_key = f'fs_consensus_{ticker}'
    cached = cache_get(cache_key, ttl=3600)
    if cached:
        return jsonify(cached)

    if BLPAPI_AVAILABLE:
        try:
            bbg_data = fetch_bbg_estimates(ticker)
            if bbg_data:
                bbg_data['dataSource'] = 'bloomberg_terminal'
                bbg_data['lastUpdated'] = datetime.utcnow().isoformat() + 'Z'
                archive_reference_data(ticker, 'consensus', bbg_data)
                cache_set(cache_key, bbg_data)
                return jsonify(bbg_data)
        except Exception as e:
            print(f"Bloomberg Error: {e}")

    # Yahoo Finance fallback
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        fwd_eps        = safe_float(info.get('forwardEps'))
        rev_growth     = safe_float(info.get('revenueGrowth', 0)) * 100
        eps_growth     = safe_float(info.get('earningsGrowth', 0)) * 100
        target_mean    = safe_float(info.get('targetMeanPrice'))
        target_high    = safe_float(info.get('targetHighPrice'))
        target_low     = safe_float(info.get('targetLowPrice'))
        target_median  = safe_float(info.get('targetMedianPrice'))
        analyst_count  = safe_int(info.get('numberOfAnalystOpinions'))
        ebitda_raw     = safe_float(info.get('ebitda', 0))

        estimates = [
            {'metric': 'EPS',          'value': fwd_eps,    'currency': 'USD'},
            {'metric': 'EPS_GROWTH',   'value': eps_growth / 100 if eps_growth else None, 'currency': 'USD'},
            {'metric': 'SALES_GROWTH', 'value': rev_growth / 100 if rev_growth else None, 'currency': 'USD'},
            {'metric': 'EBITDA',       'value': ebitda_raw, 'currency': 'USD'},
        ]

        result = {
            'ticker': ticker,
            'factsetId': f'{ticker}-US',
            'estimates': estimates,
            'priceTarget': {
                'mean': target_mean, 'high': target_high, 'low': target_low,
                'median': target_median, 'analystCount': analyst_count,
            },
            'dataSource': 'yahoo_finance_forward',
            'factsetConfigured': bool(BLPAPI_AVAILABLE),
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'ticker': ticker}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/bloomberg/fundamentals/<ticker>
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/bloomberg/fundamentals/<ticker>')
def bloomberg_fundamentals(ticker):
    ticker = ticker.upper().strip()
    if not BLPAPI_AVAILABLE:
        # Redirect to price_volume financials
        from modules.price_volume.routes import get_financials
        return get_financials(ticker)

    fields = ["SALES_REV_TURN", "EBITDA", "NET_INCOME", "EPS_BASIC", "FREE_CASH_FLOW",
              "TOT_DEBT_TO_TOT_EQY", "GROSS_MARGIN", "OPER_MARGIN", "CUR_MKT_CAP", "PE_RATIO"]
    try:
        data = fetch_bbg_reference_data([ticker], fields)
        bbg_fields = data.get(ticker, {})
        archive_reference_data(ticker, 'fundamentals', bbg_fields)
        result = {'ticker': ticker, 'fundamentals': bbg_fields, 'dataSource': 'bloomberg_terminal'}
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/bloomberg/history/<ticker>
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/bloomberg/history/<ticker>')
def bloomberg_history(ticker):
    ticker = ticker.upper().strip()
    start_date = request.args.get('start', (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d'))
    end_date   = request.args.get('end', datetime.now().strftime('%Y-%m-%d'))

    if not BLPAPI_AVAILABLE:
        from modules.price_volume.routes import get_history
        return get_history(ticker)

    cache_key = f'bbg_hist_{ticker}_{start_date}_{end_date}'
    cached = cache_get(cache_key, ttl=3600)
    if cached:
        return jsonify(cached)

    try:
        fields = ["PX_OPEN", "PX_HIGH", "PX_LOW", "PX_LAST", "PX_VOLUME"]
        data = fetch_bbg_historical_data(ticker, fields, start_date, end_date)
        bars = []
        for row in data:
            bars.append({
                'date': row.get('date'),
                'open': safe_float(row.get('PX_OPEN')),
                'high': safe_float(row.get('PX_HIGH')),
                'low': safe_float(row.get('PX_LOW')),
                'close': safe_float(row.get('PX_LAST')),
                'volume': safe_int(row.get('PX_VOLUME'))
            })
        result = {'ticker': ticker, 'bars': bars, 'dataSource': 'bloomberg_terminal'}
        archive_history_data(ticker, bars)
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
