# Sunday Guelph VB — Setup Guide

## Files
- `index.html` — The website (open in any browser or host on GitHub Pages, Netlify, etc.)
- `google-apps-script.js` — Paste into Google Apps Script to connect to Google Sheets

---

## Connecting Google Sheets (5 minutes)

### Step 1 — Create your Google Spreadsheet
1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Name it "Sunday Guelph VB".

### Step 2 — Open Apps Script
1. In your spreadsheet, click **Extensions → Apps Script**.
2. Delete any existing code.
3. Paste the entire contents of `google-apps-script.js`.
4. Click **Save** (disk icon).

### Step 3 — Deploy as Web App
1. Click **Deploy → New Deployment**.
2. Click the gear icon next to "Type" and select **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**.
5. **Copy the Web App URL** (looks like `https://script.google.com/macros/s/XXXXXXXXX/exec`).

### Step 4 — Update the website
1. Open `index.html` in a text editor.
2. Find the `SHEETS_ENDPOINTS` section near the bottom:
   ```js
   const SHEETS_ENDPOINTS = {
     registration: 'https://script.google.com/macros/s/YOUR_REGISTRATION_SCRIPT_ID/exec',
     pickup:       'https://script.google.com/macros/s/YOUR_PICKUP_SCRIPT_ID/exec',
     scores:       'https://script.google.com/macros/s/YOUR_SCORES_SCRIPT_ID/exec',
   };
   ```
3. Replace **all three** `YOUR_..._SCRIPT_ID` URLs with the **same Web App URL** you copied.
4. Save the file.

That's it! The script automatically creates three tabs in your spreadsheet:
- **Registrations** — Season registration form entries
- **Pickup Signups** — Pick-up game signups
- **Scores** — Game score submissions

---

## Hosting the Website

### Option A: GitHub Pages (Free)
1. Create a GitHub account and new repository.
2. Upload `index.html`.
3. Go to Settings → Pages → set Source to main branch.
4. Your site is live at `https://yourusername.github.io/your-repo`.

### Option B: Netlify (Free)
1. Go to [netlify.com](https://netlify.com).
2. Drag and drop the `index.html` file.
3. Done — instant live URL.

### Option C: Local
Just open `index.html` in your browser. Everything works locally too.

---

## Customizing the Site

| What to change | Where in index.html |
|---|---|
| Pick-up dates | `pickupData` array in the `<script>` tag |
| Schedule games | `scheduleData` array |
| Sample scores | `sampleScores` array |
| Court names | `<select id="sc-court">` options |
| Season names | `<select id="reg-season">` options |
| Contact email | Footer `href="mailto:..."` |

---

## Confirmation Emails (Optional)
The Apps Script can automatically send confirmation emails to registrants and pick-up signups. It uses Gmail via Google's `MailApp` service — no extra setup needed, as long as the script runs under your Google account.
