import os
import json
import traceback
from datetime import datetime, timedelta

# Note: blpapi requires a running Bloomberg Terminal (bbcomm.exe) and the blpapi python package.
# pip install blpapi
try:
    import blpapi
    BLPAPI_AVAILABLE = True
except ImportError:
    BLPAPI_AVAILABLE = False
    print("Warning: blpapi module not found. Bloomberg functions will return mock data or fail.")

# Default host and port for local Bloomberg Terminal
BBG_HOST = os.environ.get('BBG_HOST', 'localhost')
BBG_PORT = int(os.environ.get('BBG_PORT', 8194))

def get_bbg_session():
    """Create and start a Bloomberg API session."""
    if not BLPAPI_AVAILABLE:
        raise RuntimeError("blpapi package is not installed.")
        
    options = blpapi.SessionOptions()
    options.setServerHost(BBG_HOST)
    options.setServerPort(BBG_PORT)
    
    session = blpapi.Session(options)
    if not session.start():
        raise ConnectionError("Failed to start Bloomberg session. Is the Terminal running?")
    return session

def fetch_bbg_reference_data(tickers, fields):
    """
    Fetch static reference data (e.g., current price, name, fundamentals).
    Matches FactSet Fundamentals / Quote data.
    """
    if not BLPAPI_AVAILABLE:
        return {ticker: {field: "N/A" for field in fields} for ticker in tickers}
        
    session = get_bbg_session()
    try:
        if not session.openService("//blp/refdata"):
            raise ConnectionError("Failed to open //blp/refdata")
            
        refDataService = session.getService("//blp/refdata")
        request = refDataService.createRequest("ReferenceDataRequest")
        
        # Format tickers for Bloomberg (e.g., 'AAPL US Equity')
        for t in tickers:
            request.append("securities", t if ' Equity' in t else f"{t} US Equity")
            
        for f in fields:
            request.append("fields", f)
            
        session.sendRequest(request)
        
        result = {}
        while True:
            ev = session.nextEvent(500)
            for msg in ev:
                if msg.messageType() == blpapi.Name("ReferenceDataResponse"):
                    securityDataArray = msg.getElement("securityData")
                    for i in range(securityDataArray.numValues()):
                        securityData = securityDataArray.getValueAsElement(i)
                        ticker = securityData.getElementAsString("security")
                        fieldData = securityData.getElement("fieldData")
                        
                        data_dict = {}
                        for j in range(fieldData.numElements()):
                            field = fieldData.getElement(j)
                            data_dict[str(field.name())] = field.getValue()
                        
                        # Strip ' US Equity' for returning to app
                        base_ticker = ticker.replace(" US Equity", "")
                        result[base_ticker] = data_dict
                        
            if ev.eventType() == blpapi.Event.RESPONSE:
                break
        return result
    finally:
        session.stop()

def fetch_bbg_historical_data(ticker, fields, start_date, end_date, periodicity="DAILY"):
    """
    Fetch time-series data (e.g., historical prices, volume).
    Matches FactSet Prices / History data.
    """
    if not BLPAPI_AVAILABLE:
        return []
        
    session = get_bbg_session()
    try:
        if not session.openService("//blp/refdata"):
            raise ConnectionError("Failed to open //blp/refdata")
            
        refDataService = session.getService("//blp/refdata")
        request = refDataService.createRequest("HistoricalDataRequest")
        
        bbg_ticker = ticker if ' Equity' in ticker else f"{ticker} US Equity"
        request.getElement("securities").appendValue(bbg_ticker)
        
        for f in fields:
            request.getElement("fields").appendValue(f)
            
        request.set("periodicitySelection", periodicity)
        request.set("startDate", start_date.replace("-", ""))
        request.set("endDate", end_date.replace("-", ""))
        
        session.sendRequest(request)
        
        results = []
        while True:
            ev = session.nextEvent(500)
            for msg in ev:
                if msg.messageType() == blpapi.Name("HistoricalDataResponse"):
                    securityData = msg.getElement("securityData")
                    fieldDataArray = securityData.getElement("fieldData")
                    
                    for i in range(fieldDataArray.numValues()):
                        fieldData = fieldDataArray.getValueAsElement(i)
                        row = {}
                        for j in range(fieldData.numElements()):
                            field = fieldData.getElement(j)
                            val = field.getValue()
                            # Handle datetime objects
                            if hasattr(val, 'isoformat'):
                                val = val.isoformat()
                            row[str(field.name())] = val
                        results.append(row)
                        
            if ev.eventType() == blpapi.Event.RESPONSE:
                break
        return results
    finally:
        session.stop()

def fetch_bbg_estimates(ticker):
    """
    Fetch consensus estimates.
    Matches FactSet Consensus Estimates.
    """
    fields = [
        "BEST_EPS",             # Blended forward EPS
        "BEST_SALES",           # Blended forward Sales
        "BEST_EBITDA",          # Blended forward EBITDA
        "BEST_TARGET_PRICE",    # Mean Price Target
        "TOT_ANALYST_REC",      # Total Analyst Count
    ]
    data = fetch_bbg_reference_data([ticker], fields)
    base_ticker = ticker.replace(" US Equity", "")
    
    if base_ticker in data:
        # Map Bloomberg fields to the format expected by the app
        d = data[base_ticker]
        return {
            'ticker': base_ticker,
            'estimates': [
                {'metric': 'EPS', 'value': d.get('BEST_EPS')},
                {'metric': 'SALES', 'value': d.get('BEST_SALES')},
                {'metric': 'EBITDA', 'value': d.get('BEST_EBITDA')}
            ],
            'priceTarget': {
                'mean': d.get('BEST_TARGET_PRICE'),
                'analystCount': d.get('TOT_ANALYST_REC')
            }
        }
    return {}

# ── Bloomberg Field Mapping Reference ──
# FactSet / Custom Metric   | Bloomberg Field
# --------------------------|-------------------------
# Price                     | PX_LAST
# Volume                    | PX_VOLUME
# EPS (NTM)                 | BEST_EPS
# Sales (NTM)               | BEST_SALES
# EBITDA                    | EBITDA
# Gross Margin              | GROSS_MARGIN
# Free Cash Flow            | CF_FREE_CASH_FLOW
# Market Cap                | CUR_MKT_CAP
# P/E Ratio (Forward)       | BEST_PE_RATIO
