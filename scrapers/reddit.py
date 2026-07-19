"""
Unified Reddit Scraper - Refactored to use Pullpush API (Open source Reddit alternative)
Requires NO credentials, NO api keys, NO auth. Bypasses Reddit 403 Forbidden blocks.
"""

import os
import sys
import json
import time
import argparse
import re
from typing import Optional, Dict, List, Tuple
from datetime import datetime
from pathlib import Path
import requests

# Configuration
OUTPUT_DIR = Path("reddit_data")
PULLPUSH_BASE = "https://api.pullpush.io/reddit/search"
REQUEST_TIMEOUT = 30
RATE_LIMIT_DELAY = 1  # Seconds between requests to be nice to pullpush

class RedditScraper:
    """Unified Reddit scraper using Pullpush API."""

    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.output_dir = OUTPUT_DIR
        self.output_dir.mkdir(exist_ok=True)
        self.session = requests.Session()
        if self.verbose:
            self._log("✓ Reddit Scraper initialized (Pullpush API)")

    def _log(self, message: str):
        if self.verbose:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"[{timestamp}] {message}")

    def _delay(self):
        time.sleep(RATE_LIMIT_DELAY)

    def _sanitize_filename(self, name: str) -> str:
        safe = name.lower().replace(" ", "_").replace("-", "_")
        safe = re.sub(r'[^a-z0-9_]', '', safe)
        return safe[:50]

    def _fetch_pullpush(self, endpoint: str, params: Dict) -> List[Dict]:
        """Fetch data from Pullpush API."""
        url = f"{PULLPUSH_BASE}/{endpoint}/"
        try:
            self._delay()
            response = self.session.get(url, params=params, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            return data.get('data', [])
        except Exception as e:
            self._log(f"✗ Error fetching from Pullpush: {str(e)[:60]}")
            return []

    def _extract_post_data(self, data: Dict) -> Dict:
        """Map Pullpush submission data to platform schema."""
        return {
            'id': data.get('id'),
            'title': data.get('title', ''),
            'author': data.get('author', '[deleted]'),
            'subreddit': data.get('subreddit', ''),
            'url': data.get('url', ''),
            'selftext': data.get('selftext', '')[:3000] if data.get('selftext') else '',
            'score': data.get('score', 0),
            'upvote_ratio': data.get('upvote_ratio', 0),
            'num_comments': data.get('num_comments', 0),
            'created_utc': data.get('created_utc', 0),
            'edited': False, # Pullpush doesn't track edits well
            'permalink': data.get('permalink', ''),
            'is_self': data.get('is_self', False),
            'is_video': data.get('is_video', False),
            'over_18': data.get('over_18', False),
            'spoiler': data.get('spoiler', False),
            'gilded': 0,
            'all_awardings': [],
        }

    def _extract_comment_data(self, data: Dict) -> Dict:
        """Map Pullpush comment data to platform schema."""
        return {
            'id': data.get('id'),
            'author': data.get('author', '[deleted]'),
            'body': data.get('body', '')[:2000] if data.get('body') else '',
            'score': data.get('score', 0),
            'created_utc': data.get('created_utc', 0),
            'edited': False,
            'depth': 0,
            'parent_id': data.get('parent_id', ''),
            'gilded': 0,
            'awards': [],
            'replies': [] # We'll build the tree if needed, but pullpush returns a flat list usually
        }

    def _build_comment_tree(self, flat_comments: List[Dict]) -> List[Dict]:
        """Convert flat pullpush comments to nested tree (if possible)."""
        comments_by_id = {}
        top_level = []
        
        for c in flat_comments:
            c_data = self._extract_comment_data(c)
            comments_by_id[f"t1_{c_data['id']}"] = c_data
            
        for c in flat_comments:
            c_data = comments_by_id.get(f"t1_{c['id']}")
            if not c_data:
                continue
            parent_id = c.get('parent_id', '')
            if parent_id.startswith('t3_'):
                top_level.append(c_data)
            elif parent_id in comments_by_id:
                comments_by_id[parent_id]['replies'].append(c_data)
            else:
                top_level.append(c_data)
                
        return top_level

    def _save_result(self, result: Dict, prefix: str):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{prefix}_{timestamp}.json"
        filepath = self.output_dir / filename
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            self._log(f"✓ Saved results to {filepath}")
        except Exception as e:
            self._log(f"✗ Failed to save results: {e}")

    def scrape_post(self, url: str) -> Dict:
        self._log(f"\n{'=' * 70}")
        self._log(f"SCRAPING POST: {url}")
        
        # Extract post ID from URL
        match = re.search(r'/comments/([^/]+)', url)
        if not match:
            return {'error': 'Invalid Reddit post URL'}
        post_id = match.group(1)
        
        submissions = self._fetch_pullpush('submission', {'ids': post_id})
        if not submissions:
            return {'error': 'Post not found via Pullpush API'}
            
        post_data = self._extract_post_data(submissions[0])
        self._log(f"✓ Title: {post_data.get('title', '')[:50]}")
        
        # Fetch comments
        comments_raw = self._fetch_pullpush('comment', {'link_id': post_id, 'size': 500})
        comments = self._build_comment_tree(comments_raw)
        
        self._log(f"✓ Score: {post_data.get('score')} | Comments: {len(comments_raw)}")
        
        result = {
            'type': 'post',
            'stats': {
                'total_comments_fetched': len(comments_raw),
                'total_replies': sum(len(c.get('replies', [])) for c in comments),
                'scraped_at': datetime.now().isoformat()
            },
            'post': post_data,
            'comments': comments
        }
        self._save_result(result, f"post_{post_data.get('id', 'unknown')}")
        return result

    def scrape_subreddit(self, subreddit: str, limit: int = 25, category: str = 'hot', time_filter: str = 'all', scrape_comments: bool = False) -> Dict:
        subreddit = re.sub(r'^/?(r/)?', '', subreddit, flags=re.IGNORECASE).strip('/')

        self._log(f"\n{'=' * 70}")
        self._log(f"SCRAPING SUBREDDIT: r/{subreddit}")
        
        # Note: Pullpush doesn't have 'hot' or 'top' sorting the same way. It defaults to chronological.
        # We will fetch latest submissions.
        submissions = self._fetch_pullpush('submission', {'subreddit': subreddit, 'size': limit})
        
        posts = []
        for idx, sub in enumerate(submissions, 1):
            post_data = self._extract_post_data(sub)
            if scrape_comments:
                self._log(f"  [{idx}/{limit}] Fetching comments for: {post_data.get('title', '')[:40]}...")
                comments_raw = self._fetch_pullpush('comment', {'link_id': post_data['id'], 'size': 100})
                post_data['comments'] = self._build_comment_tree(comments_raw)
            else:
                post_data['comments'] = []
            posts.append(post_data)

        self._log(f"✓ Extracted {len(posts)} posts")
        
        result = {
            'type': 'subreddit',
            'subreddit_info': {'name': subreddit},
            'posts': posts,
            'stats': {
                'posts_extracted': len(posts),
                'total_comments': sum(len(p.get('comments', [])) for p in posts),
                'category': 'new',
            },
            'scraped_at': datetime.now().isoformat(),
        }
        self._save_result(result, f"subreddit_{subreddit}")
        return result

    def search_reddit(self, query: str, limit: int = 25, scrape_comments: bool = True) -> Dict:
        self._log(f"\n{'=' * 70}")
        self._log(f"SEARCHING REDDIT: '{query}'")
        
        submissions = self._fetch_pullpush('submission', {'q': query, 'size': limit})
        
        posts = []
        for idx, sub in enumerate(submissions, 1):
            post_data = self._extract_post_data(sub)
            if scrape_comments:
                self._log(f"  [{idx}/{limit}] Fetching comments for: {post_data.get('title', '')[:40]}...")
                comments_raw = self._fetch_pullpush('comment', {'link_id': post_data['id'], 'size': 100})
                post_data['comments'] = self._build_comment_tree(comments_raw)
            else:
                post_data['comments'] = []
            posts.append(post_data)

        result = {
            'type': 'search',
            'query': query,
            'posts': posts,
            'stats': {
                'posts_extracted': len(posts),
                'total_comments': sum(len(p.get('comments', [])) for p in posts),
            },
            'scraped_at': datetime.now().isoformat(),
        }
        self._save_result(result, f"search_{self._sanitize_filename(query)}")
        return result

    def scrape_user(self, username: str, limit: int = 25, scrape_comments: bool = True) -> Dict:
        username = re.sub(r'^/?(u/)?', '', username, flags=re.IGNORECASE).strip('/')

        self._log(f"\n{'=' * 70}")
        self._log(f"SCRAPING USER: u/{username}")
        
        submissions = self._fetch_pullpush('submission', {'author': username, 'size': limit})
        
        posts = []
        for idx, sub in enumerate(submissions, 1):
            post_data = self._extract_post_data(sub)
            if scrape_comments:
                self._log(f"  [{idx}/{limit}] Fetching comments for: {post_data.get('title', '')[:40]}...")
                comments_raw = self._fetch_pullpush('comment', {'link_id': post_data['id'], 'size': 100})
                post_data['comments'] = self._build_comment_tree(comments_raw)
            else:
                post_data['comments'] = []
            posts.append(post_data)

        result = {
            'type': 'user',
            'user_info': {'name': username},
            'posts': posts,
            'stats': {
                'posts_extracted': len(posts),
                'total_comments': sum(len(p.get('comments', [])) for p in posts),
            },
            'scraped_at': datetime.now().isoformat(),
        }
        self._save_result(result, f"user_{username}")
        return result

def interactive_mode(scraper: RedditScraper):
    print("\n" + "="*70)
    print("REDDIT SCRAPER - INTERACTIVE MODE (Pullpush API)")
    print("="*70)

    while True:
        print("\nWhat would you like to scrape?\n")
        print("  1. Post (by URL)")
        print("  2. Subreddit (by name)")
        print("  3. Search (by keyword/phrase)")
        print("  4. User (by username)")
        print("  5. Default (auto-detect)")
        print("  6. Exit")

        try:
            choice = input("\nSelect option (1-6): ").strip()
            
            if choice == '1':
                url = input("Enter post URL: ").strip()
                scraper.scrape_post(url)
                
            elif choice == '2':
                sub = input("Enter subreddit name: ").strip()
                limit = input("Number of posts (default 25): ").strip()
                limit = int(limit) if limit.isdigit() else 25
                comments = input("Scrape comments? [y/N]: ").strip().lower() == 'y'
                scraper.scrape_subreddit(sub, limit, 'new', 'all', comments)
                
            elif choice == '3':
                query = input("Enter search query: ").strip()
                limit = input("Number of results (default 25): ").strip()
                limit = int(limit) if limit.isdigit() else 25
                comments = input("Scrape comments? [y/N]: ").strip().lower() == 'y'
                scraper.search_reddit(query, limit, comments)
                
            elif choice == '4':
                user = input("Enter username: ").strip()
                limit = input("Number of posts (default 25): ").strip()
                limit = int(limit) if limit.isdigit() else 25
                comments = input("Scrape comments? [y/N]: ").strip().lower() == 'y'
                scraper.scrape_user(user, limit, comments)
                
            elif choice == '5':
                val = input("Enter input (subreddit, user, or search): ").strip()
                if val.startswith('http'):
                    if '/comments/' in val:
                        scraper.scrape_post(val)
                    elif '/r/' in val:
                        scraper.scrape_subreddit(val, 25, 'new', 'all', False)
                    elif '/user/' in val:
                        scraper.scrape_user(val, 25, False)
                elif val.lower().startswith('u/') or val.lower().startswith('/u/'):
                    scraper.scrape_user(val, 25, False)
                elif val.lower().startswith('r/') or val.lower().startswith('/r/'):
                    scraper.scrape_subreddit(val, 25, 'new', 'all', False)
                elif re.match(r'^[a-zA-Z0-9_]{3,21}$', val) and ' ' not in val:
                    scraper.scrape_subreddit(val, 25, 'new', 'all', False)
                else:
                    scraper.search_reddit(val, 25, False)
                    
            elif choice == '6':
                print("Exiting...")
                break
                
        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"Error: {e}")

def main():
    parser = argparse.ArgumentParser(description="Reddit Pullpush Scraper")
    parser.add_argument("--default", help="Auto-detect input type")
    args = parser.parse_args()

    scraper = RedditScraper()
    
    if args.default:
        val = args.default
        if val.startswith('http') and '/comments/' in val:
            print(json.dumps(scraper.scrape_post(val)))
        elif val.lower().startswith('u/') or val.lower().startswith('/u/'):
            print(json.dumps(scraper.scrape_user(val)))
        elif val.lower().startswith('r/') or val.lower().startswith('/r/'):
            print(json.dumps(scraper.scrape_subreddit(val)))
        else:
            print(json.dumps(scraper.search_reddit(val)))
    else:
        interactive_mode(scraper)

if __name__ == "__main__":
    main()

def reddit(target_input: str, mode: str = "default", limit: int = 25, **kwargs) -> Dict:
    scraper = RedditScraper(verbose=False)
    if mode == "post":
        return scraper.scrape_post(target_input)
    elif mode == "subreddit":
        scrape_comments = kwargs.get("scrape_comments", True)
        return scraper.scrape_subreddit(target_input, limit, 'new', 'all', scrape_comments)
    elif mode == "search":
        scrape_comments = kwargs.get("scrape_comments", True)
        return scraper.search_reddit(target_input, limit, scrape_comments)
    elif mode == "user":
        scrape_comments = kwargs.get("scrape_comments", True)
        return scraper.scrape_user(target_input, limit, scrape_comments)
    else:
        val = target_input.strip()
        if val.startswith('http') and '/comments/' in val:
            return scraper.scrape_post(val)
        elif val.lower().startswith('u/') or val.lower().startswith('/u/'):
            return scraper.scrape_user(val, limit)
        elif val.lower().startswith('r/') or val.lower().startswith('/r/'):
            return scraper.scrape_subreddit(val, limit)
        else:
            return scraper.search_reddit(val, limit)
