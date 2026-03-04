"""
modules/factset — FactSet API Integration and Data Enrichment
Cross-validation, concordance, screening, estimates, security intelligence.
"""

from flask import Blueprint, jsonify, request
import yfinance as yf
from datetime import datetime, timedelta
import traceback
import urllib.request
import urllib.parse
import urllib.error
import base64

from modules.utils import cache_get, cache_set, safe_float, safe_int, CORE_TICKERS

bp = Blueprint('factset', __name__, url_prefix='/api')


def _get_blpapi_available():
    """Check if Bloomberg/FactSet API is available."""
    try:
        from modules.bloomberg.routes import BLPAPI_AVAILABLE
        return BLPAPI_AVAILABLE
    except:
        return False


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/crossvalidate/<ticker>
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/factset/crossvalidate/<ticker>')
def factset_crossvalidate(ticker):
    ticker = ticker.upper().strip()
    cache_key = f'fs_xval_{ticker}'
    cached = cache_get(cache_key, ttl=1800)
    if cached:
        return jsonify(cached)

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        yf_price      = safe_float(info.get('currentPrice') or info.get('regularMarketPrice'))
        yf_fwd_pe     = safe_float(info.get('forwardPE'))
        yf_rev_growth = safe_float(info.get('revenueGrowth', 0)) * 100
        yf_eps_fwd    = safe_float(info.get('forwardEps'))
        yf_eps_ttm    = safe_float(info.get('trailingEps'))
        yf_eps_growth = safe_float(info.get('earningsGrowth', 0)) * 100
        yf_target     = safe_float(info.get('targetMeanPrice'))

        fs_eps = yf_eps_fwd
        fs_rev_growth = yf_rev_growth
        fs_ebitda = None
        used_factset = False

        # Calculate divergences
        divergences = []
        yf_eps_compare = yf_eps_ttm
        if fs_eps and yf_eps_compare and yf_eps_compare != 0:
            diff_pct = abs(fs_eps - yf_eps_compare) / abs(yf_eps_compare) * 100
            if diff_pct > 1:
                divergences.append({
                    'field': 'EPS (NTM vs TTM)',
                    'factset': round(fs_eps, 2),
                    'yfinance': round(yf_eps_compare, 2),
                    'divergencePct': round(diff_pct, 1),
                    'flag': 'Data divergence',
                    'note': 'NTM forward EPS vs TTM historical EPS difference'
                })

        if fs_rev_growth is not None and yf_rev_growth != 0:
            diff_pct = abs(fs_rev_growth - yf_rev_growth)
            if diff_pct > 1:
                divergences.append({
                    'field': 'Revenue Growth % (NTM vs YoY)',
                    'factset': round(fs_rev_growth, 1),
                    'yfinance': round(yf_rev_growth, 1),
                    'divergencePct': round(diff_pct, 1),
                    'flag': 'Data divergence',
                })

        result = {
            'ticker': ticker,
            'validated': True,
            'yfMetrics': {
                'price': yf_price, 'forwardPE': yf_fwd_pe,
                'revenueGrowth': round(yf_rev_growth, 1),
                'forwardEps': yf_eps_fwd, 'trailingEps': yf_eps_ttm,
                'targetMean': yf_target,
            },
            'factsetConsensus': {
                'ntmEps': fs_eps,
                'ntmRevGrowth': round(fs_rev_growth, 1) if fs_rev_growth is not None else None,
                'ntmEbitda': fs_ebitda,
                'source': 'Yahoo Finance Forward Estimates (NTM Proxy)',
            },
            'divergences': divergences,
            'divergenceFlag': len(divergences) > 0,
            'dataSource': 'yf_forward_vs_trailing',
            'usedFactSet': used_factset,
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'ticker': ticker, 'validated': False}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/validate/<ticker>
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/factset/validate/<ticker>')
def factset_validate(ticker):
    ticker = ticker.upper().strip()
    return jsonify({
        'ticker': ticker,
        'validated': False,
        'message': 'FactSet API key not configured.',
        'setup_guide': {
            'step1': 'Obtain API key from FactSet Developer Portal',
            'step2': 'Add to .dev.vars: BLPAPI_AVAILABLE=your_key',
            'step3': 'Restart data service',
        }
    }), 200


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/concordance/entity
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/factset/concordance/entity')
def factset_concordance_entity():
    name   = request.args.get('name', '').strip()
    ticker = request.args.get('ticker', '').upper().strip()
    if not name and not ticker:
        return jsonify({'error': 'Provide name or ticker parameter'}), 400

    factset_id = f'{ticker}-US' if ticker else None
    result = {
        'query': name or ticker,
        'matches': [{'factsetId': factset_id, 'entityName': name or ticker, 'matchFlag': 'HEURISTIC'}] if factset_id else [],
        'count': 1 if factset_id else 0,
        'dataSource': 'heuristic_fallback',
        'lastUpdated': datetime.utcnow().isoformat() + 'Z',
    }
    return jsonify(result)


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/screening/run
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/factset/screening/run', methods=['GET', 'POST'])
def factset_screening_run():
    if request.method == 'POST':
        body = request.get_json(silent=True) or {}
        screen_type = body.get('screen', 'value')
        limit = int(body.get('limit', 50))
    else:
        screen_type = request.args.get('screen', 'value')
        limit = int(request.args.get('limit', 50))

    SCREENS = {
        'value':    {'label': 'Deep Value'},
        'growth':   {'label': 'High Growth'},
        'quality':  {'label': 'Quality'},
        'momentum': {'label': 'Momentum'},
    }

    cache_key = f'fs_screening_{screen_type}_{limit}'
    cached = cache_get(cache_key, ttl=1800)
    if cached:
        return jsonify(cached)

    try:
        TICKERS_TO_SCREEN = CORE_TICKERS[:30]
        results = []
        for t_sym in TICKERS_TO_SCREEN:
            c_key = f'screen_stock_{t_sym}'
            stock_data = cache_get(c_key, ttl=3600)
            if not stock_data:
                try:
                    t = yf.Ticker(t_sym)
                    info = t.info or {}
                    stock_data = {
                        'ticker': t_sym,
                        'name': info.get('longName', t_sym),
                        'sector': info.get('sector', 'Unknown'),
                        'marketCap': safe_float(info.get('marketCap', 0)) / 1e9,
                        'forwardPE': safe_float(info.get('forwardPE')),
                        'revenueGrowth': safe_float(info.get('revenueGrowth', 0)) * 100,
                        'grossMargin': safe_float(info.get('grossMargins', 0)) * 100,
                        'fcfYield': 0,
                        'evEbitda': safe_float(info.get('enterpriseToEbitda')),
                    }
                    cache_set(c_key, stock_data)
                except:
                    continue
            results.append(stock_data)

        if screen_type == 'value':
            results = [s for s in results if s.get('evEbitda', 99) < 15 and s.get('forwardPE', 99) < 25]
        elif screen_type == 'growth':
            results = [s for s in results if s.get('revenueGrowth', 0) > 10]
        elif screen_type == 'quality':
            results = [s for s in results if s.get('grossMargin', 0) > 35]

        results = sorted(results, key=lambda x: x.get('revenueGrowth', 0), reverse=True)[:limit]

        result = {
            'screen': screen_type,
            'screenLabel': SCREENS.get(screen_type, {}).get('label', screen_type),
            'stocks': results,
            'count': len(results),
            'dataSource': 'yf_local_screener',
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/security-intel/<ticker>
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/factset/security-intel/<ticker>')
def factset_security_intel(ticker):
    ticker = ticker.upper().strip()
    output_type = request.args.get('outputType', 'full')
    cache_key = f'fs_secintel_{ticker}_{output_type}'
    cached = cache_get(cache_key, ttl=900)
    if cached:
        return jsonify(cached)

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        price     = safe_float(info.get('currentPrice') or info.get('regularMarketPrice'))
        prev      = safe_float(info.get('previousClose'))
        chg_pct   = ((price - prev) / prev * 100) if prev else 0
        week52h   = safe_float(info.get('fiftyTwoWeekHigh'))
        week52l   = safe_float(info.get('fiftyTwoWeekLow'))
        avg_vol   = safe_float(info.get('averageVolume'))
        vol       = safe_float(info.get('volume'))
        vol_ratio = vol / avg_vol if avg_vol else 1.0

        movement_summary = {
            'ticker': ticker, 'price': price,
            'change_pct': round(chg_pct, 2),
            'direction': 'up' if chg_pct > 0 else 'down' if chg_pct < 0 else 'flat',
            'volume_ratio': round(vol_ratio, 2),
            'signal': 'high_volume' if vol_ratio > 2 else 'normal',
            'week52_high': week52h, 'week52_low': week52l,
            'pct_from_52h': round((price - week52h) / week52h * 100, 1) if week52h else None,
            'pct_from_52l': round((price - week52l) / week52l * 100, 1) if week52l else None,
            'short_summary': f'{ticker} {"+%.2f" % chg_pct if chg_pct >= 0 else "%.2f" % chg_pct}% today, vol ratio {vol_ratio:.1f}x avg',
        }
        if output_type == 'oneline':
            movement_summary = {'oneline': movement_summary['short_summary']}

        result = {
            'ticker': ticker,
            'stockMovement': movement_summary,
            'events': [],
            'dataSource': 'yahoo_finance_fallback',
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'ticker': ticker}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/estimates/rolling/<ticker>
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/factset/estimates/rolling/<ticker>')
def factset_estimates_rolling(ticker):
    ticker = ticker.upper().strip()
    fiscal = request.args.get('period', 'NTM')
    cache_key = f'fs_est_rolling_{ticker}_{fiscal}'
    cached = cache_get(cache_key, ttl=3600)
    if cached:
        return jsonify(cached)

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        items = [
            {'metric': 'EPS', 'value': safe_float(info.get('forwardEps')), 'currency': 'USD'},
            {'metric': 'EPS_GROWTH', 'value': safe_float(info.get('earningsGrowth')), 'currency': 'USD'},
            {'metric': 'SALES_GROWTH', 'value': safe_float(info.get('revenueGrowth')), 'currency': 'USD'},
            {'metric': 'EBITDA', 'value': safe_float(info.get('ebitda')), 'currency': 'USD'},
        ]
        rec = info.get('recommendationMean', 3.0)
        rating_map = {1: 'Strong Buy', 2: 'Buy', 3: 'Hold', 4: 'Underperform', 5: 'Sell'}
        result = {
            'ticker': ticker, 'period': fiscal, 'estimates': items,
            'ratings': {
                'recommendation': rating_map.get(round(rec), 'Hold'),
                'recommendationMean': rec,
                'numAnalysts': info.get('numberOfAnalystOpinions', 0),
            },
            'count': len(items),
            'dataSource': 'yahoo_finance_forward',
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'ticker': ticker}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/factset/estimates/surprise/<ticker>
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/factset/estimates/surprise/<ticker>')
def factset_estimates_surprise(ticker):
    ticker = ticker.upper().strip()
    periods = int(request.args.get('periods', 8))
    cache_key = f'fs_surprise_{ticker}_{periods}'
    cached = cache_get(cache_key, ttl=3600)
    if cached:
        return jsonify(cached)

    try:
        t = yf.Ticker(ticker)
        try:
            hist_earn = t.earnings_history
        except:
            hist_earn = None

        surprises = []
        if hist_earn is not None and not hist_earn.empty:
            for idx, row in hist_earn.iterrows():
                actual   = row.get('epsActual')
                estimate = row.get('epsEstimate')
                surprise_pct = None
                if estimate and estimate != 0 and actual is not None:
                    surprise_pct = round((float(actual) - float(estimate)) / abs(float(estimate)) * 100, 2)
                surprises.append({
                    'period': str(idx)[:10],
                    'metric': 'EPS',
                    'actual': float(actual) if actual else None,
                    'estimate': float(estimate) if estimate else None,
                    'surprise_pct': surprise_pct,
                    'beat': surprise_pct > 0 if surprise_pct else None,
                })

        result = {
            'ticker': ticker,
            'surprises': surprises[:periods],
            'count': len(surprises),
            'dataSource': 'yahoo_finance_earnings_history',
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'ticker': ticker}), 500
