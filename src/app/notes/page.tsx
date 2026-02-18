'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Streamdown } from 'streamdown';
import TickerInput from '../TickerInput';
import styles from './page.module.css';

type LoadState = 'idle' | 'loading' | 'success' | 'error';
type SummaryScope = 'latest' | 'all';

interface NoteFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: number;
}

interface SearchResponse {
  ticker: string;
  hasNotes: boolean;
  totalNotes: number;
  latestNote: NoteFile | null;
  files: NoteFile[];
}

interface SummaryResponse {
  ticker: string;
  scope: SummaryScope;
  model: string;
  summary: string;
  totalNotesFound: number;
  notesUsed: number;
  skippedNotes: number;
  usedFileNames: string[];
  skippedFileNames: string[];
}

export default function NotesPage() {
  const [ticker, setTicker] = useState('');
  const [searchState, setSearchState] = useState<LoadState>('idle');
  const [searchMessage, setSearchMessage] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);

  const [scope, setScope] = useState<SummaryScope>('latest');
  const [summaryState, setSummaryState] = useState<LoadState>('idle');
  const [summaryMessage, setSummaryMessage] = useState('');
  const [summaryResult, setSummaryResult] = useState<SummaryResponse | null>(null);

  const handleSearch = async () => {
    const normalizedTicker = ticker.trim();
    if (!normalizedTicker) {
      setSearchState('error');
      setSearchMessage('Ticker is required.');
      return;
    }

    setSearchState('loading');
    setSearchMessage('');
    setSearchResult(null);
    setSummaryState('idle');
    setSummaryMessage('');
    setSummaryResult(null);

    try {
      const res = await fetch(`/api/notes/search?ticker=${encodeURIComponent(normalizedTicker)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to search notes');
      }

      const parsed = data as SearchResponse;
      setSearchResult(parsed);
      setSearchState('success');
      setSearchMessage(
        parsed.hasNotes
          ? `Found ${parsed.totalNotes} note(s) for ${parsed.ticker}.`
          : `No notes found for ${parsed.ticker}.`,
      );
    } catch (err) {
      setSearchState('error');
      setSearchMessage(err instanceof Error ? err.message : 'Failed to search notes');
    }
  };

  const handleGenerateSummary = async () => {
    if (!searchResult?.hasNotes) return;

    setSummaryState('loading');
    setSummaryMessage('');
    setSummaryResult(null);

    try {
      const res = await fetch('/api/notes/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: searchResult.ticker, scope }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate summary');
      }

      const parsed = data as SummaryResponse;
      setSummaryResult(parsed);
      setSummaryState('success');
      setSummaryMessage(
        `Summary generated with ${parsed.model} using ${parsed.notesUsed} note(s).`,
      );
    } catch (err) {
      setSummaryState('error');
      setSummaryMessage(err instanceof Error ? err.message : 'Failed to generate summary');
    }
  };

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLink}>Upload Notes</Link>
        <Link href="/notes" className={`${styles.navLink} ${styles.navLinkActive}`}>Search & Summarize</Link>
      </nav>

      <h1 className={styles.title}>Ticker Notes Summary</h1>
      <p className={styles.subtitle}>
        Search a ticker in Google Drive and generate a Gemini summary from the most recent note or all notes.
      </p>

      <section className={styles.card}>
        <div className={styles.field}>
          <span className={styles.label}>Ticker</span>
          <TickerInput value={ticker} onChange={setTicker} />
        </div>

        <button
          type="button"
          className={styles.btn}
          onClick={handleSearch}
          disabled={searchState === 'loading'}
        >
          {searchState === 'loading' ? 'Searching…' : 'Search Notes'}
        </button>

        {searchMessage && (
          <p className={`${styles.message} ${searchState === 'error' ? styles.error : styles.success}`}>
            {searchMessage}
          </p>
        )}

        {searchResult?.files?.length ? (
          <div className={styles.notesPreview}>
            <p className={styles.notesHeading}>Latest files</p>
            <ul className={styles.notesList}>
              {searchResult.files.slice(0, 8).map((file) => (
                <li key={file.id} className={styles.notesListItem}>
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.fileTime}>{formatTime(file.modifiedTime)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {searchResult?.hasNotes ? (
        <section className={styles.card}>
          <p className={styles.label}>Summary Scope</p>
          <div className={styles.scopeRow}>
            <label className={styles.scopeOption}>
              <input
                type="radio"
                name="scope"
                checked={scope === 'latest'}
                onChange={() => setScope('latest')}
              />
              Most recent note
            </label>
            <label className={styles.scopeOption}>
              <input
                type="radio"
                name="scope"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
              />
              All notes in folder
            </label>
          </div>

          <button
            type="button"
            className={styles.btn}
            onClick={handleGenerateSummary}
            disabled={summaryState === 'loading'}
          >
            {summaryState === 'loading' ? 'Generating…' : 'Generate Summary'}
          </button>

          {summaryMessage && (
            <p className={`${styles.message} ${summaryState === 'error' ? styles.error : styles.success}`}>
              {summaryMessage}
            </p>
          )}

          {summaryResult ? (
            <div className={styles.summaryBox}>
              <p className={styles.summaryMeta}>
                Scope: {summaryResult.scope === 'latest' ? 'Most recent note' : 'All notes'} | Used:{' '}
                {summaryResult.notesUsed}/{summaryResult.totalNotesFound}
              </p>
              <div className={styles.summaryText}>
                <Streamdown>{summaryResult.summary}</Streamdown>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
