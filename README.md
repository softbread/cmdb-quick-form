# CMDB Quick Form

A simple form that accepts a ticker/title and text content, converts the text to a `.txt` file, and uploads it to Google Drive under `/CmdbForm/{ticker}/`.

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Google Drive API** under APIs & Services
4. Create credentials:
   - **OAuth 2.0 Client ID** (Application type: Web application)
     - Add `http://localhost:3000` to Authorized JavaScript origins (for local dev)
     - Add your Vercel production URL (e.g. `https://your-app.vercel.app`) to Authorized JavaScript origins
   - **API Key**
5. Configure the OAuth consent screen (External or Internal depending on your needs)

## Local Development

```bash
# Install dependencies
npm install

# Create env file
cp .env.example .env.local

# Edit .env.local and fill in your credentials:
#   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
#   NEXT_PUBLIC_GOOGLE_API_KEY=your-api-key

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - `NEXT_PUBLIC_GOOGLE_API_KEY`
4. Deploy

Alternatively, deploy via the Vercel CLI:

```bash
npm i -g vercel
vercel
```

Set the environment variables when prompted, or configure them beforehand:

```bash
vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID
vercel env add NEXT_PUBLIC_GOOGLE_API_KEY
```

Remember to add your Vercel deployment URL to the **Authorized JavaScript origins** in your Google Cloud OAuth client settings.

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
