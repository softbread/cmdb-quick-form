interface GenerateSummaryInput {
  ticker: string;
  scope: 'latest' | 'all';
  notesText: string;
  noteCount: number;
  recentNoteNames: string[];
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY env var is not set');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  return { apiKey, model };
}

function buildPrompt({
  ticker,
  scope,
  notesText,
  noteCount,
  recentNoteNames,
}: GenerateSummaryInput): string {
  const scopeText = scope === 'latest' ? 'the most recent note' : 'all available notes';
  const recencyLine =
    recentNoteNames.length > 0
      ? `Most recent note files: ${recentNoteNames.join(', ')}`
      : 'Most recent note files: Not available';

  return [
    'You are a senior financial analyst covering public companies.',
    `Summarize ${scopeText} for ticker ${ticker}.`,
    `Total notes analyzed: ${noteCount}.`,
    recencyLine,
    'Write in a professional, insightful tone.',
    'Stay strictly grounded in the provided notes.',
    'Do not invent facts, numbers, dates, or company events.',
    'When figures are available, cite the actual values and units explicitly.',
    'If a requested data point is missing, state "Not provided in notes."',
    'If notes conflict, call out the conflict and quote both figures/statements.',
    'If multiple notes are provided: prioritize recent notes for the current view, while comparing key topics and figures chronologically from oldest to newest.',
    'Output format:',
    '1) Current view (recent notes weighted most heavily)',
    '2) Chronological comparison of key topics/figures (oldest -> newest; include dates and exact figures)',
    '3) Key positives',
    '4) Key risks/negatives',
    '5) Important numbers/facts (with exact figures and dates when present)',
    '6) Open questions / follow-ups',
    '',
    'NOTES:',
    notesText,
  ].join('\n');
}

export async function generateGeminiNoteSummary(input: GenerateSummaryInput): Promise<{
  model: string;
  summary: string;
}> {
  const { apiKey, model } = getGeminiConfig();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const summary = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('\n')
    .trim();

  if (!summary) {
    throw new Error('Gemini returned an empty summary');
  }

  return { model, summary };
}
