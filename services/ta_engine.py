import sys
import json
import yfinance as yf
import pandas_ta as ta
import pandas as pd

def calculate_ta(ticker, timeframe='1d'):
    try:
        # Fetch data
        df = yf.download(ticker, period="1y", interval=timeframe, progress=False, multi_level_index=False)
        
        if df.empty:
            print(json.dumps({"error": f"Data history untuk {ticker} tidak ditemukan."}))
            return

        # YF might return MultiIndex if we didn't flatten properly, ensure it's flat
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Calculate indicators
        # EMA
        df['EMA_20'] = ta.ema(df['Close'], length=20)
        df['EMA_50'] = ta.ema(df['Close'], length=50)
        df['EMA_200'] = ta.ema(df['Close'], length=200)
        
        # RSI
        df['RSI_14'] = ta.rsi(df['Close'], length=14)
        
        # MACD
        macd = ta.macd(df['Close'])
        if macd is not None and not getattr(macd, 'empty', True):
            df['MACD_Line'] = macd.iloc[:, 0]
            df['MACD_Signal'] = macd.iloc[:, 2] # Usually MACD, Histogram, Signal
        else:
            df['MACD_Line'] = None
            df['MACD_Signal'] = None

        # ADX
        adx = ta.adx(df['High'], df['Low'], df['Close'], length=14)
        if adx is not None and not getattr(adx, 'empty', True):
            df['ADX_14'] = adx.iloc[:, 0]
        else:
            df['ADX_14'] = None

        # Get latest values
        latest = df.iloc[-1]
        
        # Some values might be NaN if not enough data
        def get_val(val):
            if pd.isna(val) or val is None:
                return None
            return float(val)

        result = {
            "ema20": get_val(latest['EMA_20']),
            "ema50": get_val(latest['EMA_50']),
            "ema200": get_val(latest['EMA_200']),
            "rsi14": get_val(latest['RSI_14']),
            "macd_line": get_val(latest['MACD_Line']),
            "macd_signal": get_val(latest['MACD_Signal']),
            "adx14": get_val(latest['ADX_14'])
        }
        
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Ticker required"}))
        sys.exit(1)
    
    ticker_arg = sys.argv[1]
    tf = sys.argv[2] if len(sys.argv) > 2 else '1d'
    calculate_ta(ticker_arg, tf)
