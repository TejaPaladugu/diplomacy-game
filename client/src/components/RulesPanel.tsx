import { useMemo, useState } from 'react';
import { RULE_SECTIONS } from '../data/rulesText';

export function RulesPanel() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return RULE_SECTIONS;
    return RULE_SECTIONS.map((s) => ({
      heading: s.heading,
      body: s.body.filter((line) => line.toLowerCase().includes(q)),
    })).filter((s) => s.heading.toLowerCase().includes(q) || s.body.length > 0);
  }, [query]);

  return (
    <div className="rules-panel">
      <input className="rules-search" placeholder="Search the rules…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="rules-scroll">
        {filtered.map((s) => (
          <section key={s.heading}>
            <h4>{s.heading}</h4>
            <ul>
              {s.body.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
        {filtered.length === 0 && <p className="muted">No matches.</p>}
      </div>
    </div>
  );
}
