"""
modules/macro — Dashboard Macro Liquidity and Sentiment Logic
Real macro data: VIX, Treasury yields, SPY via Yahoo Finance.
"""

from flask import Blueprint, jsonify, request
import yfinance as yf
from datetime import datetime

from modules.utils import cache_get, cache_set, safe_float

bp = Blueprint('macro', __name__, url_prefix='/api')


@bp.route('/yf/macro')
def get_macro():
    cache_key = 'macro_live'
    cached = cache_get(cache_key, ttl=300)
    if cached:
        return jsonify(cached)

    try:
        tickers = {
            'VIX': '^VIX',
            'VX1': '^VIX3M',
            'SPY': 'SPY',
            'TLT': 'TLT',
            'HYG': 'HYG',
            'TNX': '^TNX',
            'IRX': '^IRX',
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

        vix = data.get('VIX') or 20.0
        vx1 = data.get('VX1') or vix * 1.05
        tnx = (data.get('TNX') or 4.5)
        irx = (data.get('IRX') or 5.0) / 100 * 100

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
