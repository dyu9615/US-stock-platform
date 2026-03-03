import urllib.request
import urllib.error
import base64
import json
import os

FACTSET_SERIAL = 'UNIV_MI-2185784'
FACTSET_API_KEY = 'dI8TR8jny4a1nq4fCupLIZCT23GN9i8H4B6ukBq7'
FACTSET_BASE = 'https://api.factset.com/content'

import ssl
context = ssl._create_unverified_context()

def test_factset():
    credentials = f'{FACTSET_SERIAL}:{FACTSET_API_KEY}'
    auth = base64.b64encode(credentials.encode()).decode()
    headers = {
        'Authorization': f'Basic {auth}',
        'Accept': 'application/json',
        'User-Agent': 'QuantAlpha-Diagnostic/1.0'
    }
    
    path = '/factset-fundamentals/v2/fundamentals'
    url = f'https://api.factset.com/content{path}?ids=AAPL-US'
    
    print(f"Testing FactSet Fundamentals API (GET {url})...")
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10, context=context) as r:
            data = json.loads(r.read())
            print("SUCCESS! API responded correctly.")
            print(f"Data received: {json.dumps(data, indent=2)[:500]}")
    except urllib.error.HTTPError as e:
        print(f"FAILED! HTTP Error {e.code}: {e.reason}")
        try:
            body = e.read().decode()
            print(f"Response body: {body}")
        except:
            pass
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    test_factset()
