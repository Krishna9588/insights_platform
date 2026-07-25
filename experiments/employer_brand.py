import requests
from bs4 import BeautifulSoup
import json
import re

def employer_brand(company_name: str):
    """
    Estimates the employer brand rating (Glassdoor/Ambitionbox) by searching Google
    and extracting the star rating from the search result snippets.
    This avoids direct anti-bot protections on review sites.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }
        
        # We will check both Glassdoor and AmbitionBox via Google Search
        platforms = ["Glassdoor", "AmbitionBox"]
        results = {}
        
        for platform in platforms:
            query = f"{company_name} {platform} reviews"
            url = f"https://html.duckduckgo.com/html/?q={query.replace(' ', '+')}"
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                text_content = soup.get_text(separator=' ')
                
                # Look for patterns like "4.2/5", "4.2 out of 5", "Rating: 4.2"
                match = re.search(r'(?:Rating:\s*)?([1-5]\.\d)\s*(?:/5|out of 5|·|stars?)', text_content, re.IGNORECASE)
                
                if match:
                    rating = match.group(1)
                    results[platform.lower()] = {
                        "rating": float(rating),
                        "max_rating": 5.0
                    }
                else:
                    results[platform.lower()] = {"rating": None, "note": "Could not extract from search results"}
            else:
                results[platform.lower()] = {"error": f"Search failed with status {response.status_code}"}
                
        data = {
            "company": company_name,
            "employer_ratings": results
        }
        
        return {"status": "success", "data": data}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import sys
    # Default to Groww if no argument is provided
    company = sys.argv[1] if len(sys.argv) > 1 else "Groww"
    print(f"Testing Employer Brand scraper for '{company}'...\n")
    
    result = employer_brand(company)
    print(json.dumps(result, indent=2))
