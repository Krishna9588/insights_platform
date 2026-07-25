import yfinance as yf
import json

def finance(ticker_symbol: str):
    """
    Scrapes financial data for a given ticker symbol using yfinance.
    """
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info
        
        # Extract key financial metrics
        data = {
            "symbol": ticker_symbol,
            "company_name": info.get("shortName", ""),
            "industry": info.get("industry", ""),
            "sector": info.get("sector", ""),
            "market_cap": info.get("marketCap", None),
            "current_price": info.get("currentPrice", None),
            "previous_close": info.get("regularMarketPreviousClose", None),
            "pe_ratio": info.get("trailingPE", None),
            "forward_pe": info.get("forwardPE", None),
            "dividend_yield": info.get("dividendYield", None),
            "revenue_growth": info.get("revenueGrowth", None),
            "ebitda": info.get("ebitda", None),
            "total_revenue": info.get("totalRevenue", None),
            "debt_to_equity": info.get("debtToEquity", None),
            "profit_margin": info.get("profitMargins", None),
            "summary": info.get("longBusinessSummary", "")
        }
        
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import sys
    # Default to AAPL if no argument is provided
    symbol = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    print(f"Testing finance scraper for {symbol}...\n")
    result = finance(symbol)
    print(json.dumps(result, indent=2))
