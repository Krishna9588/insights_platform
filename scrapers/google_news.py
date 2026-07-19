import requests
from bs4 import BeautifulSoup
from datetime import datetime
import json
import os
import argparse
import urllib.parse
import re

def scrape_google_news(query, num_results=10, output_dir=None):
    print(f"Scraping Google News for: {query}")
    encoded_query = urllib.parse.quote_plus(query)
    # Using RSS feed for more structured and reliable data
    url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to fetch news: {e}")
        return {"error": str(e), "status": "failed"}

    # Parse XML
    try:
        soup = BeautifulSoup(response.content, features='xml')
        items = soup.findAll('item')
    except Exception as e:
        print(f"Failed to parse XML: {e}")
        return {"error": "XML Parse Error", "status": "failed"}

    results = []
    for item in items[:num_results]:
        title = item.title.text if item.title else ""
        link = item.link.text if item.link else ""
        pub_date = item.pubDate.text if item.pubDate else ""
        source = item.source.text if item.source else ""
        
        desc_text = ""
        if item.description:
            desc_soup = BeautifulSoup(item.description.text, "html.parser")
            desc_text = desc_soup.get_text(separator=" ", strip=True)
            # Sometimes Google News repeats the title and source in the description. Let's keep the raw text.
        
        # Optional: clean up title by removing source from the end if it exists
        if source and title.endswith(f" - {source}"):
            title = title[:-len(f" - {source}")]

        results.append({
            "title": title,
            "link": link,
            "published_at": pub_date,
            "source": source,
            "description": desc_text
        })
    print(f"Extracted {len(results)} news articles.")

    data = {
        "metadata": {
            "query": query,
            "total_extracted": len(results),
            "timestamp": datetime.now().isoformat(),
            "source": "Google News RSS"
        },
        "articles": results
    }

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        safe_name = re.sub(r'[^a-z0-9_]', '', query.lower())
        if not safe_name:
            safe_name = "news"
        filepath = os.path.join(output_dir, f"google_news_{safe_name}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Saved to {filepath}")

    return data

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Google News Scraper")
    parser.add_argument("-q", "--query", required=True, help="Search query")
    parser.add_argument("-n", "--num", type=int, default=10, help="Number of results to fetch")
    parser.add_argument("-o", "--output", help="Output directory to save JSON")
    args = parser.parse_args()

    scrape_google_news(args.query, args.num, args.output)
