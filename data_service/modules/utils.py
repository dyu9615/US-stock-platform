"""
QuantAlpha — Shared Utilities
Cache, helpers, constants used across all modules.
"""
import time
import json
import os
from datetime import datetime

# ══════════════════════════════════════════════════════════════════════════════
# In-memory cache (TTL: configurable per call)
# ══════════════════════════════════════════════════════════════════════════════
_cache = {}

def cache_get(key, ttl=900):
    if key in _cache:
        val, ts = _cache[key]
        if time.time() - ts < ttl:
            return val
    return None

def cache_set(key, val):
    _cache[key] = (val, time.time())


# ══════════════════════════════════════════════════════════════════════════════
# Safe type converters
# ══════════════════════════════════════════════════════════════════════════════
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
# S&P 500 Representative Universe
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


# ══════════════════════════════════════════════════════════════════════════════
# Local storage path helper — creates date+time based folders
# ══════════════════════════════════════════════════════════════════════════════
def get_storage_base():
    """Return the base storage directory for all modules."""
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), 'modules')

def get_module_storage_path(module_name):
    """Return the storage dir for a given module, e.g. modules/price_volume/storage/"""
    base = os.path.join(get_storage_base(), module_name, 'storage')
    os.makedirs(base, exist_ok=True)
    return base

def get_dated_storage_path(module_name, timestamp=None):
    """
    Return a date+time folder inside a module's storage, e.g.:
    modules/price_volume/storage/2026-03-04/14-30-00/
    """
    if timestamp is None:
        timestamp = datetime.utcnow()
    date_str = timestamp.strftime('%Y-%m-%d')
    time_str = timestamp.strftime('%H-%M-%S')
    path = os.path.join(get_module_storage_path(module_name), date_str, time_str)
    os.makedirs(path, exist_ok=True)
    return path

def get_latest_storage_path(module_name):
    """
    Find the latest date+time folder for a module.
    Returns (path, datetime_str) or (None, None) if no data stored yet.
    """
    base = get_module_storage_path(module_name)
    if not os.path.exists(base):
        return None, None
    dates = sorted([d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))], reverse=True)
    for date_dir in dates:
        date_path = os.path.join(base, date_dir)
        times = sorted([t for t in os.listdir(date_path) if os.path.isdir(os.path.join(date_path, t))], reverse=True)
        for time_dir in times:
            full_path = os.path.join(date_path, time_dir)
            return full_path, f"{date_dir} {time_dir.replace('-', ':')}"
    return None, None

def save_json_to_storage(module_name, filename, data, timestamp=None):
    """Save JSON data to a date+time folder for a module."""
    path = get_dated_storage_path(module_name, timestamp)
    filepath = os.path.join(path, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    return filepath

def load_json_from_latest(module_name, filename):
    """Load JSON data from the latest date+time folder for a module."""
    path, dt_str = get_latest_storage_path(module_name)
    if path is None:
        return None, None
    filepath = os.path.join(path, filename)
    if not os.path.exists(filepath):
        return None, dt_str
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f), dt_str

def list_storage_snapshots(module_name):
    """List all date+time snapshots for a module."""
    base = get_module_storage_path(module_name)
    snapshots = []
    if not os.path.exists(base):
        return snapshots
    for date_dir in sorted(os.listdir(base), reverse=True):
        date_path = os.path.join(base, date_dir)
        if not os.path.isdir(date_path):
            continue
        for time_dir in sorted(os.listdir(date_path), reverse=True):
            time_path = os.path.join(date_path, time_dir)
            if not os.path.isdir(time_path):
                continue
            files = os.listdir(time_path)
            snapshots.append({
                'date': date_dir,
                'time': time_dir.replace('-', ':'),
                'path': time_path,
                'files': files,
            })
    return snapshots
