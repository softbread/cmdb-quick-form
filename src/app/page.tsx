'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isSignedIn, loadGoogleScripts, signIn, uploadTextFile } from '@/lib/google-drive';
import TickerInput from './TickerInput';
import styles from './page.module.css';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [textSize, setTextSize] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [gsiReady, setGsiReady] = useState(false);

  const handleTextChange = useCallback(() => {
    const len = textRef.current?.value.length ?? 0;
    setTextSize(len);
  }, []);

  useEffect(() => {
    loadGoogleScripts()
      .then(() => setGsiReady(true))
      .catch((err) => {
        console.error('Failed to load Google scripts', err);
        setMessage('Failed to load Google API. Check your API key / client ID.');
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const text = textRef.current?.value ?? '';

    if (!ticker.trim() || !text.trim()) {
      setMessage('Both fields are required.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      if (!isSignedIn()) {
        await signIn();
      }

      const trimmedTicker = ticker.trim();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${trimmedTicker}_${timestamp}.txt`;
      const result = await uploadTextFile(trimmedTicker, fileName, text);
      setStatus('success');
      setMessage(`Uploaded "${result.name}" to CmdbForm/${trimmedTicker}/ on Google Drive.`);
      setTicker('');
      if (textRef.current) textRef.current.value = '';
      setTextSize(0);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>CMDB Quick Form</h1>
      <p className={styles.subtitle}>
        Enter a ticker and text content. The text will be saved as a .txt file on your Google Drive.
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <span className={styles.label}>Ticker / Title</span>
          <TickerInput value={ticker} onChange={setTicker} />
        </div>

        <label className={styles.field}>
          <span className={styles.label}>
            Text Content
            {textSize > 0 && (
              <span className={styles.sizeHint}>{formatSize(textSize)}</span>
            )}
          </span>
          <textarea
            ref={textRef}
            onChange={handleTextChange}
            placeholder="Paste or type your text here…"
            className={styles.textarea}
            rows={12}
          />
        </label>

        <button
          type="submit"
          className={styles.btn}
          disabled={status === 'loading' || !gsiReady}
        >
          {status === 'loading' ? 'Uploading…' : 'Save to Google Drive'}
        </button>

        {message && (
          <p className={`${styles.message} ${status === 'success' ? styles.success : styles.error}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}

function formatSize(chars: number): string {
  const bytes = new Blob(['']).size === 0 ? chars : chars; // rough estimate
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
