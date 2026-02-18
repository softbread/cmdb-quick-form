import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

export interface DriveNoteFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: number;
}

interface DriveContext {
  drive: ReturnType<typeof getDrive>;
  rootFolderId: string;
  driveId?: string;
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env var is not set');
  }

  // Support both raw JSON and base64-encoded JSON
  let json: string;
  if (raw.trimStart().startsWith('{')) {
    json = raw;
  } else {
    json = Buffer.from(raw, 'base64').toString('utf-8');
  }

  let credentials;
  try {
    credentials = JSON.parse(json);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON (raw or base64)');
  }

  if (!credentials.client_email) {
    throw new Error(
      `Service account JSON missing client_email. Keys found: ${Object.keys(credentials).join(', ')}`,
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

function normalizeTicker(ticker: string): string {
  return ticker.trim();
}

function escapeQueryValue(value: string): string {
  return value.replace(/'/g, "\\'");
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

async function getDriveContext(): Promise<DriveContext> {
  const drive = getDrive();
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
  const driveId = await getDriveId(drive, rootFolderId);

  return { drive, rootFolderId, driveId };
}

/** Find an existing folder by name inside a parent, or create it */
async function findOrCreateFolder(
  drive: ReturnType<typeof getDrive>,
  name: string,
  parentId: string,
  driveId?: string,
): Promise<string> {
  const escaped = escapeQueryValue(name);
  const query = `name='${escaped}' and mimeType='${FOLDER_MIME}' and '${parentId}' in parents and trashed=false`;

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

/** Find an existing folder by name inside a parent */
async function findFolderByName(
  drive: ReturnType<typeof getDrive>,
  name: string,
  parentId: string,
  driveId?: string,
): Promise<string | null> {
  const escaped = escapeQueryValue(name);
  const query = `name='${escaped}' and mimeType='${FOLDER_MIME}' and '${parentId}' in parents and trashed=false`;

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

  const id = res.data.files?.[0]?.id;
  return id ?? null;
}

function isSupportedTextMime(mimeType: string): boolean {
  return mimeType === 'text/plain' || mimeType === GOOGLE_DOC_MIME;
}

function extractTimestampFromFileName(fileName: string): Date | null {
  const match = fileName.match(
    /(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?Z/i,
  );
  if (!match) return null;

  const ms = match[5] ?? '000';
  const iso = `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${ms}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getChronologicalDate(file: DriveNoteFile): Date {
  const fromName = extractTimestampFromFileName(file.name);
  if (fromName) return fromName;

  const fromModified = new Date(file.modifiedTime);
  if (!Number.isNaN(fromModified.getTime())) return fromModified;

  return new Date(0);
}

async function streamToText(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function readDriveTextFile(
  drive: ReturnType<typeof getDrive>,
  file: DriveNoteFile,
): Promise<string> {
  if (file.mimeType === GOOGLE_DOC_MIME) {
    const res = await drive.files.export(
      { fileId: file.id, mimeType: 'text/plain' },
      { responseType: 'stream' },
    );
    return streamToText(res.data as unknown as Readable);
  }

  const res = await drive.files.get(
    { fileId: file.id, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' },
  );
  return streamToText(res.data as unknown as Readable);
}

async function getTickerFolderId(
  ticker: string,
  context: DriveContext,
): Promise<string | null> {
  return findFolderByName(
    context.drive,
    normalizeTicker(ticker),
    context.rootFolderId,
    context.driveId,
  );
}

export async function listTickerNotes(ticker: string): Promise<DriveNoteFile[]> {
  const context = await getDriveContext();
  const tickerFolderId = await getTickerFolderId(ticker, context);
  if (!tickerFolderId) return [];

  return listNotesInFolder(context, tickerFolderId);
}

async function listNotesInFolder(
  context: DriveContext,
  folderId: string,
): Promise<DriveNoteFile[]> {
  const query = `'${folderId}' in parents and trashed=false and mimeType!='${FOLDER_MIME}'`;
  const res = context.driveId
    ? await context.drive.files.list({
        q: query,
        fields: 'files(id,name,mimeType,modifiedTime,size)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'drive',
        driveId: context.driveId,
        orderBy: 'modifiedTime desc',
        pageSize: 100,
      })
    : await context.drive.files.list({
        q: query,
        fields: 'files(id,name,mimeType,modifiedTime,size)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        orderBy: 'modifiedTime desc',
        pageSize: 100,
      });

  const files = res.data.files ?? [];
  return files
    .filter((f): f is { id: string; name: string; mimeType: string; modifiedTime: string; size?: string } =>
      Boolean(f.id && f.name && f.mimeType && f.modifiedTime),
    )
    .map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      size: f.size ? Number.parseInt(f.size, 10) : undefined,
    }));
}

export async function getTickerNotesForSummary(
  ticker: string,
  scope: 'latest' | 'all',
): Promise<{
  files: DriveNoteFile[];
  usedFiles: DriveNoteFile[];
  skippedFiles: DriveNoteFile[];
  combinedText: string;
}> {
  const context = await getDriveContext();
  const tickerFolderId = await getTickerFolderId(ticker, context);
  if (!tickerFolderId) {
    return {
      files: [],
      usedFiles: [],
      skippedFiles: [],
      combinedText: '',
    };
  }

  const files = await listNotesInFolder(context, tickerFolderId);
  const selectedFiles =
    scope === 'latest'
      ? files.slice(0, 1)
      : [...files].sort(
          (a, b) => getChronologicalDate(a).getTime() - getChronologicalDate(b).getTime(),
        );

  const usedFiles: DriveNoteFile[] = [];
  const skippedFiles: DriveNoteFile[] = [];
  const pieces: string[] = [];

  for (const file of selectedFiles) {
    if (!isSupportedTextMime(file.mimeType)) {
      skippedFiles.push(file);
      continue;
    }

    let content = '';
    try {
      content = (await readDriveTextFile(context.drive, file)).trim();
    } catch {
      skippedFiles.push(file);
      continue;
    }
    if (!content) continue;

    const dateByName = extractTimestampFromFileName(file.name);
    const header = [
      '',
      '',
      `### ${file.name}`,
      `- Note date (from filename when available): ${(dateByName || getChronologicalDate(file)).toISOString()}`,
      `- Drive modified time: ${file.modifiedTime}`,
      '',
    ].join('\n');
    pieces.push(`${header}${content}`);
    usedFiles.push(file);
  }

  return {
    files,
    usedFiles,
    skippedFiles,
    combinedText: pieces.join('').trim(),
  };
}

/** Upload text as a .txt file into /{ticker}/ inside the configured Shared Drive folder */
export async function uploadTextFile(
  ticker: string,
  fileName: string,
  textContent: string,
): Promise<{ id: string; name: string }> {
  const { drive, rootFolderId, driveId } = await getDriveContext();
  const tickerFolderId = await findOrCreateFolder(
    drive,
    normalizeTicker(ticker),
    rootFolderId,
    driveId,
  );

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
