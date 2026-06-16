# BigQuery Release Notes Dashboard & Share Hub

A premium web application built using Python Flask, vanilla HTML5, CSS3, and JavaScript that fetches, parses, and formats the Google Cloud BigQuery Atom feed in real-time. It splits daily updates into individual items (Features, Issues, Changes, Deprecations) and provides a customizable social media composer to share updates directly on X (Twitter).

---

## 🌟 Key Features

* **Sub-Entry Splitting**: Google groups all of a day's releases into a single feed item. This application parses inside the HTML structures and isolates individual updates, enabling users to read, filter, and share specific entries separately.
* **Smart Tweet Compiler**: Automatically formats plaintext drafts by translating relative URLs to absolute Google Cloud links, enforcing character limits, and appending hashtags (`#BigQuery #GoogleCloud`).
* **Live Tweet Preview Mockup**: A built-in virtual tweet card displays formatting updates in real-time, coloring hashtags and URLs in blue to show exactly what the post will look like on Twitter/X.
* **Web Intent Sharing**: Shares updates via Twitter/X Web Intents (`https://twitter.com/intent/tweet?text=...`) opening directly in a new tab, bypassing the need for complex developer API keys or OAuth setups.
* **In-Memory Caching**: Caches parsed updates for 1 hour to ensure instant page loads, with a manual cache bypass available via the "Refresh" button.
* **Filter & Search Controls**: Real-time keyword search and category tag filtering (Features, Issues, Changes, Deprecations).
* **Rich CSS Design System**: Features a high-end dark theme, radial background blur glows, glassmorphic cards, animated stats tickers, skeleton screens, and custom toast alerts.

---

## 📁 File Structure

```text
bq_release_notes/
│
├── app.py                 # Flask Server, In-Memory Cache, XML parser & Tweet formatter
├── requirements.txt       # Python package dependencies (Flask, requests, beautifulsoup4)
├── .gitignore             # Git exclusion rules
├── README.md              # Project documentation
│
├── templates/
│   └── index.html         # Main semantic dashboard DOM structure & modal overlay
│
└── static/
    ├── css/
    │   └── style.css      # Design variables, dark theme layout, & keyframe animations
    └── js/
        └── app.js         # Frontend controller, stats counters, filters, & composers
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Python 3.10+ installed on your computer.

### Setup Instructions

1. **Clone or Navigate to the Directory**:
   ```bash
   cd C:\Users\shash\AppData\Local\agy\bin\bq_release_notes
   ```

2. **Create a Python Virtual Environment**:
   ```bash
   python -m venv venv
   ```

3. **Activate the Virtual Environment & Install Dependencies**:
   * **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     pip install -r requirements.txt
     ```
   * **Windows (Command Prompt)**:
     ```cmd
     .\venv\Scripts\activate.bat
     pip install -r requirements.txt
     ```
   * **macOS / Linux**:
     ```bash
     source venv/bin/activate
     pip install -r requirements.txt
     ```

---

## 💻 Running the Application

To launch the Flask development server, execute:

```bash
python app.py
```

By default, the server will start on:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

* To refresh the cache with fresh data from Google's servers, click the **Refresh** button in the top right.
* Type keywords in the search bar or select category tags to filter release notes.
* Click **Tweet** on any card to edit, preview, copy, or publish that specific update.
