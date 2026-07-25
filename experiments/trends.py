from pytrends.request import TrendReq
import json

def trends(keyword: str, timeframe: str = 'today 12-m'):
    """
    Scrapes Google Trends data for a given keyword using pytrends.
    """
    try:
        # Initialize pytrends with typical request parameters
        pytrends = TrendReq(hl='en-US', tz=360)
        
        # Build payload
        kw_list = [keyword]
        pytrends.build_payload(kw_list, cat=0, timeframe=timeframe, geo='', gprop='')
        
        # Fetch Interest Over Time
        interest_df = pytrends.interest_over_time()
        
        if interest_df.empty:
            return {"status": "success", "data": {"keyword": keyword, "interest_over_time": []}}
            
        # Drop the isPartial column
        if 'isPartial' in interest_df.columns:
            interest_df = interest_df.drop('isPartial', axis=1)
            
        # Convert index (date) to string and values to list of dicts
        interest_df = interest_df.reset_index()
        interest_df['date'] = interest_df['date'].dt.strftime('%Y-%m-%d')
        
        records = interest_df.to_dict('records')
        
        # Format nicely
        formatted_records = [{"date": r["date"], "interest": r[keyword]} for r in records]
        
        # Optionally, get related queries (can be slow or rate limited, so keeping it safe)
        try:
            related = pytrends.related_queries()
            top_related = related.get(keyword, {}).get('top')
            if top_related is not None:
                top_queries = top_related.head(5).to_dict('records')
            else:
                top_queries = []
        except Exception:
            top_queries = []
            
        data = {
            "keyword": keyword,
            "timeframe": timeframe,
            "interest_over_time": formatted_records,
            "top_related_queries": top_queries
        }
        
        return {"status": "success", "data": data}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import sys
    # Default to Groww if no argument is provided
    keyword = sys.argv[1] if len(sys.argv) > 1 else "Groww"
    print(f"Testing Google Trends scraper for '{keyword}'...\n")
    
    # Using a 3-month timeframe to keep output manageable in terminal
    result = trends(keyword, timeframe='today 3-m')
    print(json.dumps(result, indent=2))
