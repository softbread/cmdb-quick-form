import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
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
