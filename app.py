import logging
import time
import xml.etree.ElementTree as ET
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
BASE_URL = "https://cloud.google.com"

# In-memory cache for parsed release notes
# Structure: { "timestamp": float, "data": list }
cache = {"timestamp": 0, "data": None}
CACHE_DURATION = 3600  # 1 hour in seconds

def clean_and_format_html(html_content):
    """
    Cleans up HTML inside updates, fixing relative links to point to google cloud.
    """
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    for a in soup.find_all('a'):
        href = a.get('href')
        if href:
            if href.startswith('/'):
                a['href'] = urljoin(BASE_URL, href)
            # Make links open in a new tab
            a['target'] = '_blank'
            a['rel'] = 'noopener noreferrer'
    return str(soup)

def get_plain_text_for_tweet(html_content, date_str, update_type):
    """
    Converts HTML content to a plain text summary optimized for Twitter (280 limit).
    """
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Process links to include URL next to text
    for a in soup.find_all('a'):
        href = a.get('href')
        if href:
            if href.startswith('/'):
                href = urljoin(BASE_URL, href)
            # Shorten/format links in text
            a.replace_with(f"{a.get_text()} ({href})")
            
    plain_text = soup.get_text().strip()
    
    # Normalize whitespace
    plain_text = " ".join(plain_text.split())
    
    # Construct base tweet
    # Example: "BigQuery Update [June 15, 2026] - Feature: Use Gemini Cloud Assist to optimize query performance..."
    header = f"BigQuery Update ({date_str}) [{update_type}]: "
    footer = " #BigQuery #GoogleCloud"
    
    max_body_len = 280 - len(header) - len(footer) - 5 # extra safety margins
    
    if len(plain_text) > max_body_len:
        body = plain_text[:max_body_len-3] + "..."
    else:
        body = plain_text
        
    return f"{header}{body}{footer}"

def parse_release_notes(feed_xml):
    """
    Parses the BigQuery Atom feed XML into structured JSON.
    """
    try:
        # Register namespace to handle Atom elements correctly
        namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(feed_xml)
        
        parsed_entries = []
        
        for entry in root.findall('atom:entry', namespaces):
            date_str = entry.find('atom:title', namespaces).text.strip()
            entry_id = entry.find('atom:id', namespaces).text.strip()
            
            # Find alternate link for permalink
            link_el = entry.find("atom:link[@rel='alternate']", namespaces)
            link_url = link_el.get('href') if link_el is not None else "https://cloud.google.com/bigquery/docs/release-notes"
            
            content_el = entry.find('atom:content', namespaces)
            if content_el is None or content_el.text is None:
                continue
                
            content_html = content_el.text.strip()
            soup = BeautifulSoup(content_html, 'html.parser')
            
            # Split the HTML content by h3 elements (which separate individual updates)
            # Each entry is a single day containing multiple updates
            day_updates = []
            current_type = "General"
            current_blocks = []
            
            for child in soup.contents:
                # child can be a Tag, NavigableString, or Comment
                if hasattr(child, 'name') and child.name == 'h3':
                    # Save previous update if there was one
                    if current_blocks:
                        raw_html = ''.join(str(el) for el in current_blocks).strip()
                        cleaned_html = clean_and_format_html(raw_html)
                        tweet_text = get_plain_text_for_tweet(raw_html, date_str, current_type)
                        
                        day_updates.append({
                            "type": current_type,
                            "content_html": cleaned_html,
                            "tweet_text": tweet_text
                        })
                        current_blocks = []
                    current_type = child.get_text().strip()
                else:
                    current_blocks.append(child)
            
            # Save the final block for the entry
            if current_blocks:
                raw_html = ''.join(str(el) for el in current_blocks).strip()
                cleaned_html = clean_and_format_html(raw_html)
                tweet_text = get_plain_text_for_tweet(raw_html, date_str, current_type)
                
                day_updates.append({
                    "type": current_type,
                    "content_html": cleaned_html,
                    "tweet_text": tweet_text
                })
                
            # Only add if we parsed some updates
            if day_updates:
                parsed_entries.append({
                    "date": date_str,
                    "link": link_url,
                    "id": entry_id,
                    "updates": day_updates
                })
                
        return parsed_entries
    except Exception as e:
        logger.error(f"Error parsing release notes XML: {e}", exc_info=True)
        raise e

def fetch_feed_data():
    """
    Fetches the XML feed from Google Cloud.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    response = requests.get(FEED_URL, headers=headers, timeout=15)
    response.raise_for_status()
    return response.content

def get_release_notes(force_refresh=False):
    """
    Gets the release notes from cache or fetches them if expired/forced.
    """
    global cache
    current_time = time.time()
    
    if force_refresh or not cache["data"] or (current_time - cache["timestamp"] > CACHE_DURATION):
        logger.info("Cache missed or refresh forced. Fetching release notes...")
        xml_data = fetch_feed_data()
        parsed_data = parse_release_notes(xml_data)
        
        # Update cache
        cache["data"] = parsed_data
        cache["timestamp"] = current_time
        logger.info("Cache updated successfully.")
        
    return cache["data"]

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/notes")
def api_notes():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    try:
        notes = get_release_notes(force_refresh=force_refresh)
        return jsonify({
            "success": True,
            "last_updated": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(cache["timestamp"])),
            "notes": notes
        })
    except Exception as e:
        logger.error(f"Failed to load release notes: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
