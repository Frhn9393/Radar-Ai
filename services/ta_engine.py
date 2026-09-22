import sys
import json
import warnings
warnings.filterwarnings('ignore')
import yfinance as yf
import pandas_ta as ta
import pandas as pd

def calculate_ta(ticker, timeframe='1d'):
    try:
        # Fetch data (1 year history for proper 200 EMA & moving average calculations)
        df = yf.download(ticker, period="1y", interval=timeframe, progress=False, multi_level_index=False, auto_adjust=True)
        
        if df.empty:
            print(json.dumps({"error": f"Data history untuk {ticker} tidak ditemukan."}))
            return

        # YF might return MultiIndex if we didn't flatten properly, ensure it's flat
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Helper safely getting float value
        def get_val(val):
            if pd.isna(val) or val is None:
                return None
            return float(val)

        # 1. Moving Averages (EMA & SMA)
        df['EMA_20'] = ta.ema(df['Close'], length=20)
        df['EMA_50'] = ta.ema(df['Close'], length=50)
        df['EMA_200'] = ta.ema(df['Close'], length=200)
        df['SMA_20'] = ta.sma(df['Close'], length=20)
        df['SMA_50'] = ta.sma(df['Close'], length=50)

        # 2. RSI (14)
        df['RSI_14'] = ta.rsi(df['Close'], length=14)

        # 3. MACD (12, 26, 9)
        macd = ta.macd(df['Close'])
        if macd is not None and not getattr(macd, 'empty', True):
            df['MACD_Line'] = macd.iloc[:, 0]
            df['MACD_Hist'] = macd.iloc[:, 1]
            df['MACD_Signal'] = macd.iloc[:, 2]
        else:
            df['MACD_Line'] = None
            df['MACD_Hist'] = None
            df['MACD_Signal'] = None

        # 4. ADX (14)
        adx = ta.adx(df['High'], df['Low'], df['Close'], length=14)
        if adx is not None and not getattr(adx, 'empty', True):
            df['ADX_14'] = adx.iloc[:, 0]
        else:
            df['ADX_14'] = None

        # 5. ATR (14)
        atr = ta.atr(df['High'], df['Low'], df['Close'], length=14)
        if atr is not None and not getattr(atr, 'empty', True):
            df['ATR_14'] = atr
        else:
            df['ATR_14'] = None

        # 6. Supertrend (10, 3.0)
        supertrend = ta.supertrend(df['High'], df['Low'], df['Close'], length=10, multiplier=3.0)
        if supertrend is not None and not getattr(supertrend, 'empty', True):
            # Columns: SUPERT_10_3.0, SUPERTd_10_3.0, SUPERTl_10_3.0, SUPERTs_10_3.0
            df['SUPERT_VAL'] = supertrend.iloc[:, 0]
            df['SUPERT_DIR'] = supertrend.iloc[:, 1] # 1 is Bullish (Up), -1 is Bearish (Down)
            df['SUPERT_LONG'] = supertrend.iloc[:, 2] # Trailing Support Line
            df['SUPERT_SHORT'] = supertrend.iloc[:, 3] # Trailing Resistance Line
        else:
            df['SUPERT_VAL'] = None
            df['SUPERT_DIR'] = None
            df['SUPERT_LONG'] = None
            df['SUPERT_SHORT'] = None

        # 7. Volume Moving Average (20) & Relative Volume (RVol)
        df['VOL_SMA_20'] = ta.sma(df['Volume'], length=20)
        if df['VOL_SMA_20'].iloc[-1] and df['VOL_SMA_20'].iloc[-1] > 0:
            df['RVOL'] = df['Volume'] / df['VOL_SMA_20']
        else:
            df['RVOL'] = 1.0

        # Get latest and previous bar values
        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else latest

        st_dir = get_val(latest.get('SUPERT_DIR'))
        st_val = get_val(latest.get('SUPERT_VAL'))
        st_long = get_val(latest.get('SUPERT_LONG'))
        st_short = get_val(latest.get('SUPERT_SHORT'))
        is_st_bullish = bool(st_dir == 1.0) if st_dir is not None else False

        result = {
            "close": get_val(latest['Close']),
            "prev_close": get_val(prev['Close']),
            "volume": get_val(latest['Volume']),
            "vol_sma20": get_val(latest.get('VOL_SMA_20')),
            "rvol": get_val(latest.get('RVOL')),
            "ema20": get_val(latest.get('EMA_20')),
            "ema50": get_val(latest.get('EMA_50')),
            "ema200": get_val(latest.get('EMA_200')),
            "sma20": get_val(latest.get('SMA_20')),
            "sma50": get_val(latest.get('SMA_50')),
            "rsi14": get_val(latest.get('RSI_14')),
            "macd_line": get_val(latest.get('MACD_Line')),
            "macd_signal": get_val(latest.get('MACD_Signal')),
            "macd_hist": get_val(latest.get('MACD_Hist')),
            "adx14": get_val(latest.get('ADX_14')),
            "atr14": get_val(latest.get('ATR_14')),
            "supertrend": {
                "value": st_val,
                "direction": st_dir,
                "isBullish": is_st_bullish,
                "support": st_long,
                "resistance": st_short,
                "label": "BULLISH 🟢 (Trailing Support)" if is_st_bullish else "BEARISH 🔴 (Resistance)"
            }
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
