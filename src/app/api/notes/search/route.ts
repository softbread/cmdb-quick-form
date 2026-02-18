import { NextResponse } from 'next/server';
import { listTickerNotes } from '@/lib/google-drive-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.trim() || '';

  if (!ticker) {
    return NextResponse.json(
      { error: 'ticker is required' },
      { status: 400 },
    );
  }

  try {
    const files = await listTickerNotes(ticker);
    return NextResponse.json({
      ticker,
      hasNotes: files.length > 0,
      totalNotes: files.length,
      latestNote: files[0] || null,
      files,
    });
  } catch (err) {
    console.error('Ticker notes search error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to search notes' },
      { status: 500 },
    );
  }
}
