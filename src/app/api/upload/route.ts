import { NextResponse } from 'next/server';
import { uploadTextFile } from '@/lib/google-drive-server';

// Allow up to 12MB request body for large text submissions
export const maxDuration = 60; // seconds
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { ticker, text } = await request.json();

    if (!ticker || !text) {
      return NextResponse.json(
        { error: 'Both ticker and text are required.' },
        { status: 400 },
      );
    }

    const trimmedTicker = ticker.trim();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${trimmedTicker}_${timestamp}.txt`;

    const result = await uploadTextFile(trimmedTicker, fileName, text);

    return NextResponse.json({
      id: result.id,
      name: result.name,
      folder: `CmdbForm/${trimmedTicker}`,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
