"""
QuantAlpha Data Microservice — Port 3001
Thin router: all logic lives in modules/*.

Architecture:
  modules/macro/          — Dashboard macro liquidity and sentiment
  modules/price_volume/   — Data Center raw data fetching + local storage
  modules/screener/       — AI Five-factor screening engine
  modules/deep_analysis/  — Individual stock deep-dive logic
  modules/factset/        — FactSet API integration and data enrichment
  modules/bloomberg/      — Bloomberg Terminal integration and local archiving
  modules/news/           — News intelligence and RSS feeds
  modules/ml/             — Machine Learning model management and signals
  modules/trading/        — Position management and performance analysis
  modules/backtest/       — Backtesting engine logic
  modules/research/       — Research papers and AI-extracted strategy library
"""

import sys
import os

# Ensure modules directory is importable
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ══════════════════════════════════════════════════════════════════════════════
# Register all module blueprints
# Each module is isolated — if one module has a bug, others still work.
# ══════════════════════════════════════════════════════════════════════════════

_registered_modules = []
_failed_modules = []


def _safe_register(module_name, import_path):
    """Safely register a blueprint. If a module fails to import, log error but don't crash."""
    global _registered_modules, _failed_modules
    try:
        mod = __import__(import_path, fromlist=['bp'])
        app.register_blueprint(mod.bp)
        _registered_modules.append(module_name)
    except Exception as e:
        _failed_modules.append({'module': module_name, 'error': str(e)})
        print(f"⚠ Failed to load module [{module_name}]: {e}")


# Core data modules
_safe_register('price_volume',  'modules.price_volume')
_safe_register('screener',      'modules.screener')
_safe_register('macro',         'modules.macro')
_safe_register('deep_analysis', 'modules.deep_analysis')

# Integration modules
_safe_register('factset',       'modules.factset')
_safe_register('bloomberg',     'modules.bloomberg')
_safe_register('news',          'modules.news')

# Advanced modules (placeholders)
_safe_register('ml',            'modules.ml')
_safe_register('trading',       'modules.trading')
_safe_register('backtest',      'modules.backtest')
_safe_register('research',      'modules.research')

print(f"✓ Loaded {len(_registered_modules)} modules: {', '.join(_registered_modules)}")
if _failed_modules:
    print(f"✗ Failed {len(_failed_modules)} modules: {', '.join(m['module'] for m in _failed_modules)}")


# ══════════════════════════════════════════════════════════════════════════════
# /api/health  — service health
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/health')
def health():
    from modules.utils import CORE_TICKERS
    try:
        from modules.bloomberg.routes import BLPAPI_AVAILABLE
    except:
        BLPAPI_AVAILABLE = False

    return jsonify({
        'status': 'ok',
        'service': 'QuantAlpha Data Microservice',
        'version': '6.0.0',
        'architecture': 'modular',
        'modules': {
            'loaded': _registered_modules,
            'failed': _failed_modules,
            'total': len(_registered_modules) + len(_failed_modules),
        },
        'endpoints': [
            # Data Center (price_volume)
            'POST /api/dc/refresh          — Fetch & store raw data locally',
            'GET  /api/dc/data             — Read latest local data (no online fetch)',
            'GET  /api/dc/snapshots        — List all stored snapshots',
            'GET  /api/yf/quote/<ticker>   — Single ticker quote',
            'GET  /api/yf/financials/<t>   — Quarterly financials',
            'GET  /api/yf/history/<t>      — OHLCV history',
            'GET  /api/yf/analyst/<t>      — Analyst recommendations',
            'GET  /api/yf/universe         — Quick universe listing',
            # Screener
            'GET  /api/yf/screener         — Five-factor screener (from local data)',
            # Macro
            'GET  /api/yf/macro            — Live macro data (VIX, yields)',
            # Deep Analysis (3-Layer)
            'GET  /api/yf/deep/<ticker>    — Full 3-layer deep analysis',
            'POST /api/deep/upload-er      — Upload Earnings Report for analysis',
            'GET  /api/deep/er-history     — List uploaded ER files',
            # FactSet
            'GET  /api/factset/crossvalidate/<t>',
            'GET  /api/factset/validate/<t>',
            'GET  /api/factset/concordance/entity',
            'GET|POST /api/factset/screening/run',
            'GET  /api/factset/security-intel/<t>',
            'GET  /api/factset/estimates/rolling/<t>',
            'GET  /api/factset/estimates/surprise/<t>',
            # Bloomberg
            'GET  /api/bloomberg/consensus/<t>',
            'GET  /api/bloomberg/fundamentals/<t>',
            'GET  /api/bloomberg/history/<t>',
            # News
            'GET  /api/factset/news/headlines',
            'GET  /api/news/scan/<ticker>  — Authoritative news scan for ticker',
            # Placeholders
            'GET  /api/ml/status',
            'GET  /api/trading/status',
            'GET  /api/backtest/status',
            'GET  /api/research/status',
        ],
        'factset_configured': bool(BLPAPI_AVAILABLE),
        'sp500_universe_size': len(CORE_TICKERS),
        'timestamp': datetime.utcnow().isoformat() + 'Z',
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=False)
