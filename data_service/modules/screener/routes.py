"""
modules/screener — AI Five-Factor Screening Engine
This module:
  - Reads raw data from local storage (price_volume module)
  - Does NOT fetch any online data
  - Computes five-factor scores: Growth, Valuation, Quality, Safety, Momentum
  - Applies hard filters and returns ranked results
"""

from flask import Blueprint, jsonify, request
from datetime import datetime

from modules.utils import (
    cache_get, cache_set, safe_float, safe_int,
    load_json_from_latest,
)

bp = Blueprint('screener', __name__, url_prefix='/api')


def _compute_five_factor_scores(stocks):
    """
    Compute Growth/Valuation/Quality/Safety/Momentum scores (0-100)
    for a list of raw stock dicts from local storage.
    Applies hard filters: mktcap >= $10B, grossMargin >= 0.
    """
    results = []
    for s in stocks:
        price = safe_float(s.get('price'))
        if price <= 0:
            continue
        mkt_cap_b = safe_float(s.get('marketCap'))
        if mkt_cap_b < 10:
            continue

        rev_growth  = safe_float(s.get('revenueGrowth'))
        gross_mgn   = safe_float(s.get('grossMargin'))
        op_mgn      = safe_float(s.get('operatingMargin'))
        ebitda_mgn  = safe_float(s.get('ebitdaMargin'))
        net_mgn     = safe_float(s.get('netMargin'))
        roe         = safe_float(s.get('roe'))
        roa         = safe_float(s.get('roa'))
        forward_pe  = safe_float(s.get('forwardPE'))
        ev_ebitda   = safe_float(s.get('evEbitda'))
        ev_rev      = safe_float(s.get('evRevenue'))
        fcf_yield   = safe_float(s.get('fcfYield'))
        de_ratio    = safe_float(s.get('debtEquity'))
        beta        = safe_float(s.get('beta', 1.0))
        week52_hi   = safe_float(s.get('week52High', 1))
        price52     = price / week52_hi if week52_hi > 0 else 0
        analyst_rt  = safe_float(s.get('analystRating', 3.0))
        price_tgt   = safe_float(s.get('priceTarget', price))
        upside      = ((price_tgt - price) / price * 100) if price > 0 else 0
        eps_growth  = safe_float(s.get('earningsGrowth'))
        short_pct   = safe_float(s.get('shortPct'))
        current_rt  = safe_float(s.get('currentRatio', 1.0))
        trailing_pe = safe_float(s.get('trailingPE'))
        pb_ratio    = safe_float(s.get('pbRatio'))
        ps_ratio    = safe_float(s.get('psRatio'))
        num_analysts = safe_int(s.get('numAnalysts'))
        change_pct  = safe_float(s.get('changePct'))

        # Hard filter
        if gross_mgn < 0:
            continue

        # ── 1. Growth Score ────────────────────────────────────────────────
        g_score = 50
        if rev_growth > 30: g_score += 40
        elif rev_growth > 15: g_score += 25
        elif rev_growth > 5: g_score += 10
        elif rev_growth < 0: g_score -= 30
        if eps_growth > 20: g_score += 10
        g_score = max(0, min(100, g_score))

        # ── 2. Valuation Score ─────────────────────────────────────────────
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

        # ── 3. Quality Score ───────────────────────────────────────────────
        q_score = 50
        if gross_mgn > 60: q_score += 25
        elif gross_mgn > 40: q_score += 15
        elif gross_mgn > 20: q_score += 5
        if roe > 25: q_score += 20
        elif roe > 15: q_score += 10
        if ebitda_mgn > 30: q_score += 10
        elif ebitda_mgn < 5: q_score -= 20
        q_score = max(0, min(100, q_score))

        # ── 4. Safety Score ────────────────────────────────────────────────
        s_score = 70
        if de_ratio > 3: s_score -= 35
        elif de_ratio > 1.5: s_score -= 15
        if beta > 2: s_score -= 20
        elif beta > 1.5: s_score -= 10
        if short_pct > 10: s_score -= 15
        if current_rt > 2: s_score += 10
        elif current_rt < 1: s_score -= 20
        s_score = max(0, min(100, s_score))

        # ── 5. Momentum Score ──────────────────────────────────────────────
        m_score = 50
        if price52 > 0.95: m_score += 30
        elif price52 > 0.85: m_score += 15
        elif price52 < 0.6: m_score -= 20
        if upside > 20: m_score += 15
        elif upside < -10: m_score -= 15
        if analyst_rt <= 1.5: m_score += 10
        elif analyst_rt >= 4: m_score -= 10
        m_score = max(0, min(100, m_score))

        # Composite
        composite = round((g_score + v_score + q_score + s_score + m_score) / 5, 1)

        results.append({
            'ticker': s.get('ticker'),
            'name': s.get('name', ''),
            'sector': s.get('sector', '—'),
            'industry': s.get('industry', '—'),
            'price': round(price, 2),
            'changePct': round(change_pct, 2),
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
            'totalDebt': round(safe_float(s.get('totalDebt')), 2),
            'totalCash': round(safe_float(s.get('totalCash')), 2),
            'netDebt': round(safe_float(s.get('netDebt')), 2),
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
            # Meta
            'dataSource': 'local_storage_computed',
            'factsetValidated': False,
            'divergenceFlag': False,
        })

    # Sort by composite descending
    results.sort(key=lambda x: x.get('compositeScore', 0), reverse=True)
    return results


# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/screener  — Five-factor screener (reads from local data only)
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/yf/screener')
def get_screener():
    """
    Reads raw data from local storage (price_volume module).
    Computes five-factor scores. No online data fetching.
    """
    cache_key = 'screener_v4_local'
    cached = cache_get(cache_key, ttl=60)  # short cache since data is local
    if cached:
        return jsonify(cached)

    # Load raw data from local storage
    raw_data, dt_str = load_json_from_latest('price_volume', 'universe_raw.json')

    if raw_data is None or not raw_data.get('stocks'):
        return jsonify({
            'stocks': [],
            'count': 0,
            'needsRefresh': True,
            'message': 'No local data available. Please go to Data Center and click "Refresh Data" first.',
            'dataSource': 'none',
            'lastUpdated': None,
        })

    stocks = raw_data['stocks']

    # Apply five-factor scoring
    results = _compute_five_factor_scores(stocks)

    out = {
        'stocks': results,
        'count': len(results),
        'universe_size': len(stocks),
        'dataSource': 'local_storage_computed',
        'rawDataFetchedAt': dt_str,
        'scoredAt': datetime.utcnow().isoformat() + 'Z',
        'needsRefresh': False,
        'factsetCrossValidation': False,
        'lastUpdated': datetime.utcnow().isoformat() + 'Z',
    }
    cache_set(cache_key, out)
    return jsonify(out)
