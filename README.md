# CMDB Quick Form

A simple form that accepts a ticker/title and text content, converts the text to a `.txt` file, and uploads it to Google Drive under `/CmdbForm/{ticker}/`. No user login required — uploads happen server-side via a Google service account.

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Google Drive API** under APIs & Services
4. Create a **Service Account**:
   - Go to IAM & Admin → Service Accounts → Create Service Account
   - Give it a name (e.g. `cmdb-form-uploader`)
   - Click Create and Continue (no roles needed)
   - Click Done
5. Create a key for the service account:
   - Click on the service account → Keys → Add Key → Create new key → JSON
   - Download the JSON key file
6. **Share a Google Drive folder with the service account**:
   - In Google Drive, create a folder (or use your root)
   - Share it with the service account's email (e.g. `cmdb-form-uploader@your-project.iam.gserviceaccount.com`)
   - Give it **Editor** access
   - The app will create `CmdbForm/` inside the service account's Drive (or the shared folder)

## Local Development

```bash
# Install dependencies
npm install

# Create env file
cp .env.example .env.local
```

Edit `.env.local` and paste the entire service account JSON key as a single line:

```
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@...iam.gserviceaccount.com",...}
```

```bash
# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository
3. Add the environment variable in Vercel project settings:
   - `GOOGLE_SERVICE_ACCOUNT_KEY` — paste the full JSON key as a single line
4. Deploy

Alternatively, deploy via the Vercel CLI:

```bash
npm i -g vercel
vercel
```

Set the environment variable:

```bash
vercel env add GOOGLE_SERVICE_ACCOUNT_KEY
```

## File Structure on Google Drive

Each submission creates a timestamped `.txt` file:

```
My Drive/
└── CmdbForm/
    ├── AAPL/
    │   ├── AAPL_2026-02-12T15-30-45-123Z.txt
    │   └── AAPL_2026-02-12T16-00-12-456Z.txt
    └── MSFT/
        └── MSFT_2026-02-12T15-45-00-789Z.txt
```

## Features

- **Ticker autocomplete** — searches Yahoo Finance as you type
- **Large text support** — handles up to 10MB of text
- **No user login** — uploads via server-side service account
- **Auto-organized** — files sorted into folders by ticker
