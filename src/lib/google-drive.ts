const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY!;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;

/** Load the Google API + Identity Services scripts */
export function loadGoogleScripts(): Promise<void> {
  return Promise.all([
    loadScript('https://apis.google.com/js/api.js'),
    loadScript('https://accounts.google.com/gsi/client'),
  ]).then(() => {
    return new Promise<void>((resolve) => {
      gapi.load('client', async () => {
        await gapi.client.init({ apiKey: API_KEY });
        resolve();
      });
    });
  });
}

/** Prompt user to sign in and get an access token */
export function signIn(): Promise<string> {
  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        accessToken = response.access_token;
        resolve(accessToken);
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function isSignedIn(): boolean {
  return accessToken !== null;
}

const ROOT_FOLDER_NAME = 'CmdbForm';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Upload a text string as a .txt file into /CmdbForm/{ticker}/ on Google Drive */
export async function uploadTextFile(
  ticker: string,
  fileName: string,
  textContent: string,
): Promise<{ id: string; name: string }> {
  if (!accessToken) {
    await signIn();
  }

  const rootFolderId = await findOrCreateFolder(ROOT_FOLDER_NAME, 'root');
  const tickerFolderId = await findOrCreateFolder(ticker, rootFolderId);

  const fileBlob = new Blob([textContent], { type: 'text/plain' });
  const metadata = {
    name: fileName,
    mimeType: 'text/plain',
    parents: [tickerFolderId],
  };

  // Use resumable upload for large files (>5MB), multipart for small ones
  if (fileBlob.size > 5 * 1024 * 1024) {
    return resumableUpload(metadata, fileBlob);
  }

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  );
  form.append('file', fileBlob);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Drive upload failed: ${err}`);
  }

  return res.json();
}

/** Find an existing folder by name inside a parent, or create it */
async function findOrCreateFolder(
  name: string,
  parentId: string,
): Promise<string> {
  const query =
    `name='${name}' and mimeType='${FOLDER_MIME}' and '${parentId}' in parents and trashed=false`;
  const searchUrl =
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    throw new Error(`Folder search failed: ${await searchRes.text()}`);
  }

  const { files } = (await searchRes.json()) as { files: { id: string }[] };
  if (files.length > 0) {
    return files[0].id;
  }

  // Create the folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Folder creation failed: ${await createRes.text()}`);
  }

  const folder = (await createRes.json()) as { id: string };
  return folder.id;
}

/** Resumable upload for files >5MB (supports up to 5TB per Google docs) */
async function resumableUpload(
  metadata: { name: string; mimeType: string; parents: string[] },
  fileBlob: Blob,
): Promise<{ id: string; name: string }> {
  // Step 1: Initiate the resumable session
  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'text/plain',
        'X-Upload-Content-Length': String(fileBlob.size),
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!initRes.ok) {
    throw new Error(`Resumable upload init failed: ${await initRes.text()}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('No upload URI returned from Google Drive');
  }

  // Step 2: Upload the file content in one PUT (works for files up to ~100MB)
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': String(fileBlob.size),
    },
    body: fileBlob,
  });

  if (!uploadRes.ok) {
    throw new Error(`Resumable upload failed: ${await uploadRes.text()}`);
  }

  return uploadRes.json();
}

/* ---- helpers ---- */

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}
