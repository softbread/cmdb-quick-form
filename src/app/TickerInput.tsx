'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './page.module.css';

interface Suggestion {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

interface TickerInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TickerInput({ value, onChange }: TickerInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/ticker-search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      }
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setActiveIndex(-1);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (symbol: string) => {
    onChange(symbol);
    setOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex].symbol);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={styles.autocomplete}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="e.g. AAPL or My Report"
        className={styles.input}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className={styles.dropdown}>
          {suggestions.map((s, i) => (
            <li
              key={s.symbol}
              className={`${styles.dropdownItem} ${i === activeIndex ? styles.dropdownItemActive : ''}`}
              onMouseDown={() => handleSelect(s.symbol)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className={styles.dropdownSymbol}>{s.symbol}</span>
              <span className={styles.dropdownName}>{s.name}</span>
              {s.exchange && <span className={styles.dropdownExchange}>{s.exchange}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
