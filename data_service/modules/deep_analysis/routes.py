"""
modules/deep_analysis — Stock Deep Analysis (3-Layer Architecture)

Layer 1: Yahoo Finance Real-Time Data + Authoritative News Scanning
Layer 2: Non-GAAP Adjustments, Analyst-Grade Earning Analysis (Skill Layer)
Layer 3: ML/AI Prediction Layer — Opens external AI chat (no embedded LLM)

Also supports ER (Earnings Report) upload for deep financial analysis.
"""

from flask import Blueprint, jsonify, request
import yfinance as yf
from datetime import datetime, timedelta
import traceback
import json
import os
import xml.etree.ElementTree as ET
import urllib.request

from modules.utils import (
    cache_get, cache_set, safe_float, safe_int,
    save_json_to_storage, load_json_from_latest, get_module_storage_path,
)

bp = Blueprint('deep_analysis', __name__, url_prefix='/api')


# ══════════════════════════════════════════════════════════════════════════════
# Helper: fetch authoritative news for a ticker
# ══════════════════════════════════════════════════════════════════════════════
def _fetch_news(ticker, limit=10):
    """Fetch news headlines from Yahoo Finance RSS for a ticker."""
    headlines = []
    sources = [
        (f'https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US', 'Yahoo Finance'),
        ('https://feeds.reuters.com/reuters/businessNews', 'Reuters'),
    ]
    for url, source_name in sources:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=6) as r:
                root = ET.fromstring(r.read())
            channel = root.find('channel') or root
            for item in channel.findall('item')[:5]:
                title = (item.findtext('title') or '').strip()
                link = item.findtext('link') or ''
                pub = item.findtext('pubDate') or ''
                if title:
                    headlines.append({
                        'title': title,
                        'url': link,
                        'time': pub,
                        'source': source_name,
                    })
        except:
            pass
    return headlines[:limit]


# ══════════════════════════════════════════════════════════════════════════════
# /api/yf/deep/<ticker> — Full 3-Layer Deep Analysis
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/yf/deep/<ticker>')
def get_deep(ticker):
    ticker = ticker.upper().strip()
    cache_key = f'deep_{ticker}'
    cached = cache_get(cache_key, ttl=1800)
    if cached:
        return jsonify(cached)

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}

        # ═══════════════════════════════════════════════════════════════════
        # LAYER 1: Yahoo Finance Real-Time Data + News Scanning
        # ═══════════════════════════════════════════════════════════════════

        # 1a. Market structure
        price        = safe_float(info.get('currentPrice') or info.get('regularMarketPrice'))
        prev_close   = safe_float(info.get('previousClose'))
        change       = round(price - prev_close, 4) if price and prev_close else 0
        change_pct   = round((change / prev_close) * 100, 2) if prev_close else 0
        market_cap   = safe_float(info.get('marketCap', 0))
        total_debt   = safe_float(info.get('totalDebt', 0))
        short_debt   = safe_float(info.get('shortLongTermDebt', 0)) or safe_float(info.get('currentDebt', 0))
        cash         = safe_float(info.get('totalCash', 0))
        minority     = safe_float(info.get('minorityInterest', 0))
        preferred    = safe_float(info.get('preferredStock', 0))
        ev = market_cap + total_debt + minority + preferred - cash
        ev_b = ev / 1e9

        # 1b. Price history
        hist = t.history(period='1y', interval='1d')
        price_history = []
        if hist is not None and not hist.empty:
            for idx, row in hist.tail(252).iterrows():
                price_history.append({
                    'date': str(idx)[:10],
                    'close': round(float(row['Close']), 2),
                    'volume': int(row['Volume']),
                })

        # 1c. News headlines
        news_headlines = _fetch_news(ticker)

        layer1 = {
            'description': 'Layer 1: Yahoo Finance Real-Time Data + Authoritative News',
            'price': round(price, 2),
            'prevClose': round(prev_close, 2),
            'change': round(change, 2),
            'changePct': round(change_pct, 2),
            'marketCap_b': round(market_cap / 1e9, 2),
            'sector': info.get('sector', '—'),
            'industry': info.get('industry', '—'),
            'name': info.get('longName') or info.get('shortName', ticker),
            'exchange': info.get('exchange', '—'),
            'week52High': safe_float(info.get('fiftyTwoWeekHigh')),
            'week52Low': safe_float(info.get('fiftyTwoWeekLow')),
            'ma50': safe_float(info.get('fiftyDayAverage')),
            'ma200': safe_float(info.get('twoHundredDayAverage')),
            'beta': safe_float(info.get('beta', 1.0)),
            'volume': safe_int(info.get('regularMarketVolume')),
            'avgVolume': safe_int(info.get('averageVolume')),
            'forwardPE': safe_float(info.get('forwardPE')),
            'trailingPE': safe_float(info.get('trailingPE')),
            'priceHistory': price_history[-60:],
            'news': news_headlines,
            'dataSource': 'yahoo_finance_live',
        }

        # ═══════════════════════════════════════════════════════════════════
        # LAYER 2: Non-GAAP Adjustments & Analyst-Grade Earning Analysis
        # ═══════════════════════════════════════════════════════════════════

        cfs = t.quarterly_cashflow
        ics = t.quarterly_income_stmt
        bs  = t.quarterly_balance_sheet

        def q_val(df, row_patterns, q=0, scale=1e6):
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

        def ttm_val(df, row_patterns, scale=1e6):
            return sum(q_val(df, row_patterns, q=i, scale=scale) for i in range(4))

        ocf_ttm   = ttm_val(cfs, ['operating cash flow', 'total cash from operating activities'])
        capex_ttm = abs(ttm_val(cfs, ['capital expenditure', 'capital expenditures', 'purchase of property plant']))
        sbc_ttm   = abs(ttm_val(cfs, ['stock based compensation', 'share based compensation']))
        da_ttm    = abs(ttm_val(cfs, ['depreciation', 'depreciation and amortization', 'depreciation amortization']))
        op_income_ttm = ttm_val(ics, ['operating income', 'ebit'])
        ebitda_raw_ttm = ttm_val(ics, ['ebitda', 'normalized ebitda'])
        if ebitda_raw_ttm == 0:
            ebitda_raw_ttm = op_income_ttm + da_ttm
        adj_ebitda_ttm = op_income_ttm + da_ttm + sbc_ttm
        rev_ttm = ttm_val(ics, ['total revenue', 'revenue'])

        # Computed ratios
        ev_ebitda_adj = (ev_b * 1e9 / (adj_ebitda_ttm * 1e6)) if adj_ebitda_ttm != 0 else 0
        ev_ebitda_raw = (ev_b * 1e9 / (ebitda_raw_ttm * 1e6)) if ebitda_raw_ttm != 0 else 0
        fcf_ttm = ocf_ttm - capex_ttm
        adj_fcf_ttm = ocf_ttm - capex_ttm - sbc_ttm
        fcf_yield = (fcf_ttm * 1e6 / market_cap * 100) if market_cap > 0 else 0
        adj_fcf_yield = (adj_fcf_ttm * 1e6 / market_cap * 100) if market_cap > 0 else 0
        net_debt = (total_debt - cash) / 1e9
        net_leverage = (net_debt / (adj_ebitda_ttm / 1000)) if adj_ebitda_ttm != 0 else 0
        adj_ebitda_margin = (adj_ebitda_ttm / rev_ttm * 100) if rev_ttm != 0 else safe_float(info.get('ebitdaMargins', 0)) * 100

        # Per-quarter table
        quarterly_table = []
        for q_idx in range(min(4, len(ics.columns) if ics is not None and not ics.empty else 0)):
            period = str(ics.columns[q_idx])[:10] if ics is not None and not ics.empty else ''
            oi  = q_val(ics, ['operating income', 'ebit'], q=q_idx)
            da  = abs(q_val(cfs, ['depreciation', 'depreciation and amortization'], q=q_idx))
            sb  = abs(q_val(cfs, ['stock based compensation', 'share based compensation'], q=q_idx))
            rv  = q_val(ics, ['total revenue', 'revenue'], q=q_idx)
            net = q_val(ics, ['net income'], q=q_idx)
            adj = oi + da + sb
            quarterly_table.append({
                'period': period,
                'revenue_m': round(rv, 1),
                'op_income_m': round(oi, 1),
                'net_income_m': round(net, 1),
                'da_m': round(da, 1),
                'sbc_m': round(sb, 1),
                'adj_ebitda_m': round(adj, 1),
                'adj_ebitda_margin_pct': round(adj / rv * 100, 1) if rv != 0 else 0,
            })

        # Analyst
        analyst_data = {
            'rating': safe_float(info.get('recommendationMean', 3.0)),
            'action': info.get('recommendationKey', 'hold'),
            'targetMean': safe_float(info.get('targetMeanPrice')),
            'targetHigh': safe_float(info.get('targetHighPrice')),
            'targetLow': safe_float(info.get('targetLowPrice')),
            'numAnalysts': safe_int(info.get('numberOfAnalystOpinions')),
            'upsidePct': round((safe_float(info.get('targetMeanPrice', price)) - price) / price * 100, 1) if price else 0,
        }

        # Earnings surprise (if available)
        earnings_surprise = []
        try:
            earn_hist = t.earnings_history
            if earn_hist is not None and not earn_hist.empty:
                for idx, row in earn_hist.head(4).iterrows():
                    actual = row.get('epsActual')
                    estimate = row.get('epsEstimate')
                    surprise_pct = None
                    if estimate and estimate != 0 and actual is not None:
                        surprise_pct = round((float(actual) - float(estimate)) / abs(float(estimate)) * 100, 2)
                    earnings_surprise.append({
                        'period': str(idx)[:10],
                        'actual': float(actual) if actual else None,
                        'estimate': float(estimate) if estimate else None,
                        'surprisePct': surprise_pct,
                        'beat': surprise_pct > 0 if surprise_pct is not None else None,
                    })
        except:
            pass

        # Audit flags
        audit_flags = []
        if sbc_ttm > 0 and adj_ebitda_ttm > 0:
            sbc_pct = sbc_ttm / adj_ebitda_ttm * 100
            if sbc_pct > 15:
                audit_flags.append(f'SBC/Adj.EBITDA {sbc_pct:.0f}% — high non-cash distortion')
        if net_leverage > 3.0:
            audit_flags.append(f'Net Leverage {net_leverage:.1f}x > 3.0x — high debt risk')
        if capex_ttm > ocf_ttm * 0.5 and ocf_ttm > 0:
            audit_flags.append(f'CapEx/OCF {capex_ttm/ocf_ttm*100:.0f}% — capital intensive')
        if safe_float(info.get('shortPercentOfFloat', 0)) > 0.1:
            audit_flags.append(f'Short interest {safe_float(info.get("shortPercentOfFloat",0))*100:.1f}%')

        layer2 = {
            'description': 'Layer 2: Non-GAAP Adjustments & Analyst-Grade Earning Analysis',
            'ev_decomp': {
                'market_cap_b': round(market_cap / 1e9, 2),
                'total_debt_b': round(total_debt / 1e9, 2),
                'short_debt_b': round(short_debt / 1e9, 2),
                'minority_int_b': round(minority / 1e9, 2),
                'preferred_b': round(preferred / 1e9, 2),
                'cash_b': round(cash / 1e9, 2),
                'ev_b': round(ev_b, 2),
                'formula': 'EV = MktCap + TotalDebt + MinorityInterest + PreferredStock - Cash',
            },
            'adj_ebitda': {
                'op_income_ttm_m': round(op_income_ttm, 1),
                'da_ttm_m': round(da_ttm, 1),
                'sbc_ttm_m': round(sbc_ttm, 1),
                'adj_ebitda_ttm_m': round(adj_ebitda_ttm, 1),
                'ebitda_raw_ttm_m': round(ebitda_raw_ttm, 1),
                'sbc_distortion_pct': round(sbc_ttm / max(adj_ebitda_ttm, 0.001) * 100, 1),
                'formula': 'Adj.EBITDA = Op.Income + D&A + SBC',
            },
            'ev_multiples': {
                'ev_ebitda_adj': round(ev_ebitda_adj, 1),
                'ev_ebitda_raw': round(ev_ebitda_raw, 1),
                'ev_revenue': round(ev_b / (rev_ttm / 1000), 1) if rev_ttm != 0 else 0,
                'adj_ebitda_margin_pct': round(adj_ebitda_margin, 1),
                'forward_pe': safe_float(info.get('forwardPE')),
                'trailing_pe': safe_float(info.get('trailingPE')),
            },
            'fcf_analysis': {
                'ocf_ttm_m': round(ocf_ttm, 1),
                'capex_ttm_m': round(capex_ttm, 1),
                'sbc_ttm_m': round(sbc_ttm, 1),
                'fcf_ttm_m': round(fcf_ttm, 1),
                'adj_fcf_ttm_m': round(adj_fcf_ttm, 1),
                'fcf_yield_pct': round(fcf_yield, 2),
                'adj_fcf_yield_pct': round(adj_fcf_yield, 2),
                'formula': 'FCF = OCF - CapEx; AdjFCF = FCF - SBC',
            },
            'leverage': {
                'total_debt_b': round(total_debt / 1e9, 2),
                'cash_b': round(cash / 1e9, 2),
                'net_debt_b': round(net_debt, 2),
                'adj_ebitda_b': round(adj_ebitda_ttm / 1000, 2),
                'net_leverage_x': round(net_leverage, 2),
                'current_ratio': safe_float(info.get('currentRatio')),
                'interest_coverage': safe_float(info.get('coverageRatio')),
                'debt_equity': safe_float(info.get('debtToEquity', 0)) / 100,
                'risk': 'HIGH' if net_leverage > 3.0 else 'MEDIUM' if net_leverage > 1.5 else 'LOW',
                'formula': 'NetLeverage = (TotalDebt - Cash) / Adj.EBITDA',
            },
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
            'quarterly_adj_ebitda': quarterly_table,
            'analyst': analyst_data,
            'earnings_surprise': earnings_surprise,
            'audit_flags': audit_flags,
        }

        # ═══════════════════════════════════════════════════════════════════
        # LAYER 3: ML/AI Prediction — External AI Link (no embedded LLM)
        # ═══════════════════════════════════════════════════════════════════

        # Build a summary that can be sent to external AI
        ai_summary_text = (
            f"Ticker: {ticker}\n"
            f"Name: {layer1['name']}\n"
            f"Sector: {layer1['sector']} | Industry: {layer1['industry']}\n"
            f"Price: ${layer1['price']} ({layer1['changePct']}%)\n"
            f"Market Cap: ${layer1['marketCap_b']}B | EV: ${round(ev_b,2)}B\n"
            f"EV/Adj.EBITDA: {round(ev_ebitda_adj,1)}x | Fwd P/E: {safe_float(info.get('forwardPE'))}\n"
            f"Revenue Growth: {safe_float(info.get('revenueGrowth',0))*100:.1f}%\n"
            f"Gross Margin: {safe_float(info.get('grossMargins',0))*100:.1f}% | Net Margin: {safe_float(info.get('profitMargins',0))*100:.1f}%\n"
            f"ROE: {safe_float(info.get('returnOnEquity',0))*100:.1f}%\n"
            f"FCF Yield: {round(fcf_yield,2)}% | Adj FCF Yield: {round(adj_fcf_yield,2)}%\n"
            f"Net Leverage: {round(net_leverage,2)}x\n"
            f"Beta: {safe_float(info.get('beta',1.0))}\n"
            f"Analyst Rating: {analyst_data['action']} ({analyst_data['rating']}) | Target: ${analyst_data['targetMean']}\n"
            f"Audit Flags: {', '.join(audit_flags) if audit_flags else 'None'}"
        )

        layer3 = {
            'description': 'Layer 3: ML/AI Prediction Layer — Open external AI chat for analysis',
            'instruction': 'This layer does NOT contain an embedded LLM. Copy the summary below and paste into ChatGPT/Claude/Perplexity for AI-powered analysis.',
            'ai_prompt_template': (
                f"Please analyze this stock as an institutional equity analyst:\n\n"
                f"{ai_summary_text}\n\n"
                f"Provide:\n"
                f"1. Bull case (2-3 catalysts)\n"
                f"2. Bear case (2-3 risks)\n"
                f"3. Fair value estimate with methodology\n"
                f"4. Position sizing recommendation\n"
                f"5. Key upcoming events to monitor"
            ),
            'external_ai_links': [
                {'name': 'ChatGPT', 'url': 'https://chat.openai.com/', 'icon': 'fa-robot'},
                {'name': 'Claude', 'url': 'https://claude.ai/', 'icon': 'fa-brain'},
                {'name': 'Perplexity', 'url': 'https://www.perplexity.ai/', 'icon': 'fa-search'},
                {'name': 'Google Gemini', 'url': 'https://gemini.google.com/', 'icon': 'fa-gem'},
            ],
            'ai_summary': ai_summary_text,
            'dataPackage': {
                'ticker': ticker,
                'price': layer1['price'],
                'ev_ebitda_adj': round(ev_ebitda_adj, 1),
                'fcf_yield': round(fcf_yield, 2),
                'net_leverage': round(net_leverage, 2),
                'revenue_growth': safe_float(info.get('revenueGrowth', 0)) * 100,
                'gross_margin': safe_float(info.get('grossMargins', 0)) * 100,
                'roe': safe_float(info.get('returnOnEquity', 0)) * 100,
                'analyst_rating': analyst_data['rating'],
                'audit_flags': audit_flags,
            },
        }

        # ═══════════════════════════════════════════════════════════════════
        # COMBINED RESULT
        # ═══════════════════════════════════════════════════════════════════
        result = {
            'ticker': ticker,
            'name': layer1['name'],
            'sector': layer1['sector'],
            'industry': layer1['industry'],
            # Three layers
            'layer1': layer1,
            'layer2': layer2,
            'layer3': layer3,
            # Quick access fields (backward compatible)
            'price': layer1['price'],
            'marketCap_b': layer1['marketCap_b'],
            'ev_decomp': layer2['ev_decomp'],
            'adj_ebitda': layer2['adj_ebitda'],
            'ev_multiples': layer2['ev_multiples'],
            'fcf_analysis': layer2['fcf_analysis'],
            'leverage': layer2['leverage'],
            'growth': layer2['growth'],
            'quarterly_adj_ebitda': layer2['quarterly_adj_ebitda'],
            'analyst': layer2['analyst'],
            'price_history': layer1['priceHistory'],
            'week52_high': layer1['week52High'],
            'week52_low': layer1['week52Low'],
            'ma50': layer1['ma50'],
            'ma200': layer1['ma200'],
            'beta': layer1['beta'],
            'audit_flags': layer2['audit_flags'],
            'news': layer1['news'],
            'earnings_surprise': layer2['earnings_surprise'],
            'factset_validated': False,
            'dataSource': 'yahoo_finance',
            'lastUpdated': datetime.utcnow().isoformat() + 'Z',
        }

        cache_set(cache_key, result)
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e), 'ticker': ticker}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/deep/upload-er — Upload Earnings Report for Deep Analysis
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/deep/upload-er', methods=['POST'])
def upload_earnings_report():
    """
    Upload a company Earnings Report (text/JSON) for deep financial analysis.
    Stores in deep_analysis/storage/ by date+time.
    """
    try:
        ticker = request.form.get('ticker', 'UNKNOWN').upper().strip()

        # Handle file upload
        if 'file' in request.files:
            f = request.files['file']
            content = f.read().decode('utf-8', errors='replace')
            filename = f.filename or 'er_upload.txt'
        elif request.is_json:
            body = request.get_json()
            content = body.get('content', '')
            filename = body.get('filename', 'er_upload.txt')
            ticker = body.get('ticker', ticker).upper().strip()
        else:
            content = request.form.get('content', '')
            filename = request.form.get('filename', 'er_upload.txt')

        if not content:
            return jsonify({'error': 'No content provided. Upload a file or send content in body.'}), 400

        # Save to storage
        timestamp = datetime.utcnow()
        er_data = {
            'ticker': ticker,
            'filename': filename,
            'content': content[:50000],  # limit size
            'contentLength': len(content),
            'uploadedAt': timestamp.isoformat() + 'Z',
        }
        filepath = save_json_to_storage('deep_analysis', f'er_{ticker}_{timestamp.strftime("%H%M%S")}.json', er_data, timestamp)

        # Generate basic AI prompt for the ER
        ai_prompt = (
            f"I have uploaded an Earnings Report for {ticker}. Please analyze:\n\n"
            f"--- BEGIN EARNINGS REPORT ---\n"
            f"{content[:5000]}\n"
            f"--- END EXCERPT ---\n\n"
            f"Please provide:\n"
            f"1. Revenue/EPS beat or miss analysis\n"
            f"2. Key management commentary highlights\n"
            f"3. Forward guidance changes\n"
            f"4. Non-GAAP adjustments to watch\n"
            f"5. Bull/Bear implications for the stock"
        )

        return jsonify({
            'success': True,
            'ticker': ticker,
            'filename': filename,
            'storagePath': filepath,
            'contentPreview': content[:500] + '...' if len(content) > 500 else content,
            'ai_prompt': ai_prompt,
            'instruction': 'Copy the AI prompt above and paste into ChatGPT/Claude for AI-powered earnings analysis.',
            'external_ai_links': [
                {'name': 'ChatGPT', 'url': 'https://chat.openai.com/'},
                {'name': 'Claude', 'url': 'https://claude.ai/'},
            ],
            'uploadedAt': timestamp.isoformat() + 'Z',
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# /api/deep/er-history — List uploaded ER files
# ══════════════════════════════════════════════════════════════════════════════
@bp.route('/deep/er-history')
def get_er_history():
    """List all uploaded earnings reports."""
    from modules.utils import list_storage_snapshots
    snapshots = list_storage_snapshots('deep_analysis')
    er_files = []
    for snap in snapshots:
        for f in snap.get('files', []):
            if f.startswith('er_'):
                er_files.append({
                    'filename': f,
                    'date': snap['date'],
                    'time': snap['time'],
                    'path': os.path.join(snap['path'], f),
                })
    return jsonify({'erFiles': er_files, 'count': len(er_files)})
