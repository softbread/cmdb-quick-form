import { NextResponse } from 'next/server';
import { generateGeminiNoteSummary } from '@/lib/gemini-server';
import { getTickerNotesForSummary } from '@/lib/google-drive-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface SummaryRequestBody {
  ticker?: string;
  scope?: 'latest' | 'all';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SummaryRequestBody;
    const ticker = body.ticker?.trim() || '';
    const scope = body.scope === 'all' ? 'all' : 'latest';

    if (!ticker) {
      return NextResponse.json(
        { error: 'ticker is required' },
        { status: 400 },
      );
    }

    const noteData = await getTickerNotesForSummary(ticker, scope);
    if (noteData.files.length === 0) {
      return NextResponse.json(
        { error: `No notes found for ticker "${ticker}"` },
        { status: 404 },
      );
    }

    if (!noteData.combinedText) {
      return NextResponse.json(
        {
          error:
            'Notes were found, but none could be read as text. Only plain text files and Google Docs are supported.',
        },
        { status: 400 },
      );
    }

    const result = await generateGeminiNoteSummary({
      ticker,
      scope,
      notesText: noteData.combinedText,
      noteCount: noteData.usedFiles.length,
      recentNoteNames: noteData.usedFiles.slice(-3).reverse().map((file) => file.name),
    });

    return NextResponse.json({
      ticker,
      scope,
      model: result.model,
      summary: result.summary,
      totalNotesFound: noteData.files.length,
      notesUsed: noteData.usedFiles.length,
      skippedNotes: noteData.skippedFiles.length,
      usedFileNames: noteData.usedFiles.map((file) => file.name),
      skippedFileNames: noteData.skippedFiles.map((file) => file.name),
    });
  } catch (err) {
    console.error('Notes summary error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate summary' },
      { status: 500 },
    );
  }
}
