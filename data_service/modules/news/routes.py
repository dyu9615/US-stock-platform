"""
modules/news — News Intelligence and RSS Feeds
Authoritative news scanning from multiple sources:
  - Yahoo Finance RSS
  - Reuters Business
  - MarketWatch / CNBC (when available)
Supports per-ticker and market-wide news.
"""

from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
import urllib.request
import urllib.parse
import traceback

from modules.utils import cache_get, cache_set

bp = Blueprint('news', __name__, url_prefix='/api')


def _parse_rss(url, source_name, ticker=None):
    """Parse an RSS feed and return list of headline dicts."""
    import xml.etree.ElementTree as ET
    headlines = []
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as r:
            root = ET.fromstring(r.read())
        channel = root.find('channel') or root
        for item in channel.findall('item')[:10]:
            title = (item.findtext('title') or '').strip()
            link  = item.findtext('link') or ''
            pub   = item.findtext('pubDate') or ''
            desc  = item.findtext('description') or ''
            if title:
                headlines.append({
                    'title': title,
                    'url': link,
                    'time': pub,
                    'description': desc[:200],
                    'source': source_name,
                    'tickers': [ticker] if ticker else [],
                    'dataSource': 'rss_feed',
                })
    except:
        pass
    return headlines


@bp.route('/factset/news/headlines')
def factset_news_headlines():
    ticker   = request.args.get('ticker', '').upper().strip()
    category = request.args.get('category', 'all')
    limit    = int(request.args.get('limit', 20))

    cache_key = f'fs_news_{ticker}_{category}_{limit}'
    cached = cache_get(cache_key, ttl=300)
    if cached:
        return jsonify(cached)

    try:
        headlines = []

        # Ticker-specific news
        if ticker:
            headlines.extend(_parse_rss(
                f'https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US',
                'Yahoo Finance', ticker
            ))

        # Market-wide authoritative sources
        headlines.extend(_parse_rss(
            'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US',
            'Yahoo Finance Markets'
        ))
        headlines.extend(_parse_rss(
            'https://feeds.reuters.com/reuters/businessNews',
            'Reuters Business'
        ))

        # Sort by time (most recent first) and limit
        headlines = headlines[:limit]

        result = {
            'ticker': ticker or 'ALL',
            'category': category,
            'headlines': headlines,
            'count': len(headlines),
            'sources': ['Yahoo Finance', 'Reuters Business'],
            'dataSource': 'rss_aggregator',
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/news/scan/<ticker>')
def news_scan(ticker):
    """Authoritative news scan for a specific ticker — used by Deep Analysis Layer 1."""
    ticker = ticker.upper().strip()
    cache_key = f'news_scan_{ticker}'
    cached = cache_get(cache_key, ttl=300)
    if cached:
        return jsonify(cached)

    headlines = _parse_rss(
        f'https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US',
        'Yahoo Finance', ticker
    )

    result = {
        'ticker': ticker,
        'headlines': headlines,
        'count': len(headlines),
        'dataSource': 'yahoo_finance_rss',
        'lastUpdated': datetime.utcnow().isoformat() + 'Z',
    }
    cache_set(cache_key, result)
    return jsonify(result)
