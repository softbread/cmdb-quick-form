'use client';

import { useCallback, useRef, useState } from 'react';
import TickerInput from './TickerInput';
import styles from './page.module.css';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [textSize, setTextSize] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const handleTextChange = useCallback(() => {
    const len = textRef.current?.value.length ?? 0;
    setTextSize(len);
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
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.trim(), text }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setStatus('success');
      setMessage(`Uploaded "${data.name}" to ${data.folder}/.`);
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
        Enter a ticker and text content. The text will be saved as a .txt file.
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
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Submitting…' : 'Submit'}
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
  if (chars < 1024) return `${chars} B`;
  if (chars < 1024 * 1024) return `${(chars / 1024).toFixed(1)} KB`;
  return `${(chars / (1024 * 1024)).toFixed(1)} MB`;
}
