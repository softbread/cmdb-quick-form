import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function getAuth() {
  // Support two modes:
  // 1. GOOGLE_SERVICE_ACCOUNT_KEY = full JSON (works locally)
  // 2. GOOGLE_SA_CLIENT_EMAIL + GOOGLE_SA_PRIVATE_KEY = separate vars (works on Vercel)
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const saEmail = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const saKey = process.env.GOOGLE_SA_PRIVATE_KEY;

  let credentials: { client_email: string; private_key: string };

  if (saEmail && saKey) {
    credentials = {
      client_email: saEmail,
      private_key: saKey.replace(/\\n/g, '\n'),
    };
  } else if (raw) {
    try {
      credentials = JSON.parse(raw);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
    }
  } else {
    throw new Error(
      'Set either GOOGLE_SERVICE_ACCOUNT_KEY or both GOOGLE_SA_CLIENT_EMAIL and GOOGLE_SA_PRIVATE_KEY',
    );
  }

  if (!credentials.client_email) {
    throw new Error(
      `Service account credentials missing client_email. Keys found: ${Object.keys(credentials).join(', ')}`,
    );
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

/**
 * Get the Shared Drive ID that contains the root folder.
 * If GOOGLE_DRIVE_FOLDER_ID is itself a Shared Drive, it returns that ID.
 * Otherwise it looks up which driveId the folder belongs to.
 */
async function getDriveId(
  drive: ReturnType<typeof getDrive>,
  folderId: string,
): Promise<string | undefined> {
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'driveId',
      supportsAllDrives: true,
    });
    return res.data.driveId || undefined;
  } catch {
    return undefined;
  }
}

/** Find an existing folder by name inside a parent, or create it */
async function findOrCreateFolder(
  drive: ReturnType<typeof getDrive>,
  name: string,
  parentId: string,
  driveId?: string,
): Promise<string> {
  const query = `name='${name}' and mimeType='${FOLDER_MIME}' and '${parentId}' in parents and trashed=false`;

  const res = driveId
    ? await drive.files.list({
        q: query,
        fields: 'files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'drive',
        driveId,
      })
    : await drive.files.list({
        q: query,
        fields: 'files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

  const files = res.data.files;
  if (files && files.length > 0 && files[0].id) {
    return files[0].id;
  }

  const createRes = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  const id = createRes.data.id;
  if (!id) throw new Error(`Failed to create folder "${name}"`);
  return id;
}

/** Upload text as a .txt file into /{ticker}/ inside the configured Shared Drive folder */
export async function uploadTextFile(
  ticker: string,
  fileName: string,
  textContent: string,
): Promise<{ id: string; name: string }> {
  const drive = getDrive();

  // GOOGLE_DRIVE_FOLDER_ID should be a folder inside a Shared Drive (Team Drive).
  // The service account must have Content Manager or higher on the Shared Drive.
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
  const driveId = await getDriveId(drive, rootFolderId);
  const tickerFolderId = await findOrCreateFolder(drive, ticker, rootFolderId, driveId);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'text/plain',
      parents: [tickerFolderId],
    },
    media: {
      mimeType: 'text/plain',
      body: Readable.from(textContent),
    },
    fields: 'id,name',
    supportsAllDrives: true,
  });

  return {
    id: res.data.id || '',
    name: res.data.name || fileName,
  };
}
