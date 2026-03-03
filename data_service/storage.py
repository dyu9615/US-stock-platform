import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'bloomberg_archive.db')

def init_db():
    """Initialize the SQLite database for Bloomberg data archiving."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Table for reference/consensus data
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bbg_reference_archive (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT,
            data_type TEXT,
            fields_json TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Table for historical price bars
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bbg_history_archive (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT,
            date TEXT,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(ticker, date)
        )
    ''')
    conn.commit()
    conn.close()

def archive_reference_data(ticker, data_type, data_dict):
    """Store a snapshot of Bloomberg reference/consensus data."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO bbg_reference_archive (ticker, data_type, fields_json) VALUES (?, ?, ?)",
            (ticker, data_type, json.dumps(data_dict))
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Storage Error (Reference): {e}")

def archive_history_data(ticker, bars):
    """Store historical price bars, avoiding duplicates."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        for bar in bars:
            cursor.execute('''
                INSERT OR IGNORE INTO bbg_history_archive 
                (ticker, date, open, high, low, close, volume) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                ticker, 
                bar.get('date'), 
                bar.get('open'), 
                bar.get('high'), 
                bar.get('low'), 
                bar.get('close'), 
                bar.get('volume')
            ))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Storage Error (History): {e}")

# Initialize on module load
init_db()
