import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.search(query, { quotesCount: 8 });
    const quotes: Array<{
      symbol: string;
      shortname?: string;
      longname?: string;
      exchDisp?: string;
      typeDisp?: string;
      isYahooFinance?: boolean;
    }> = result.quotes ?? [];

    const suggestions = quotes
      .filter((q) => q.isYahooFinance)
      .map((q) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || '',
        exchange: q.exchDisp || '',
        type: q.typeDisp || '',
      }));

    return NextResponse.json(suggestions);
  } catch (err) {
    console.error('Yahoo Finance search error:', err);
    return NextResponse.json([], { status: 500 });
  }
}
