import { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Dashboard.module.css';
import { extractMentionData } from '../lib/scoring';

const IMPACT_COLOR = { high: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' }, medium: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' }, low: { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' } };
const CAT_LABEL = { content: 'Content', pr: 'PR & Comms', seo: 'SEO', product: 'Product' };

function ScoreRing({ score, size = 100 }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 60 ? '#16a34a' : score >= 30 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0ec" strokeWidth="7"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2 - 4} textAnchor="middle" fontSize="22" fontWeight="600" fill={color} fontFamily="Instrument Serif, serif">{score}</text>
      <text x={size/2} y={size/2 + 14} textAnchor="middle" fontSize="11" fill="#a8a89e" fontFamily="Inter, sans-serif">/100</text>
    </svg>
  );
}

export default function Dashboard({ brand, category, competitors, allResults, verityScore, competitorScores, recommendations, personas, onReset }) {
  const [activePersona, setActivePersona] = useState(personas[0]?.id);
  const score = verityScore?.total || 0;
  const scoreColor = score >= 60 ? '#16a34a' : score >= 30 ? '#d97706' : '#dc2626';
  const scoreBg = score >= 60 ? '#f0fdf4' : score >= 30 ? '#fffbeb' : '#fef2f2';
  const scoreBd = score >= 60 ? '#bbf7d0' : score >= 30 ? '#fde68a' : '#fecaca';

  const allCompetitors = competitors.map(c => ({ name: c, score: competitorScores[c] || 0 }))
    .sort((a, b) => b.score - a.score);

  const totalPrompts = verityScore?.totalPrompts || 0;
  const mentionedCount = verityScore?.mentionedCount || 0;
  const missedCount = totalPrompts - mentionedCount;
  const topCompWinner = allCompetitors[0];

  const activeResults = allResults[activePersona] || {};

  // Compute per-persona mention counts for tabs
  function personaMentions(pid) {
    const r = allResults[pid] || {};
    return Object.values(r).filter(res => extractMentionData(res.response || '', brand, competitors).mentioned).length;
  }

  function highlightText(text) {
    if (!text) return '';
    let r = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const bEsc = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    r = r.replace(new RegExp(`(${bEsc})`, 'gi'), '<span class="brand-hl">$1</span>');
    competitors.forEach(c => {
      const cEsc = c.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (cEsc) r = r.replace(new RegExp(`(${cEsc})`, 'gi'), '<span class="comp-hl">$1</span>');
    });
    return r;
  }

  return (
    <>
      <Head><title>{brand} — Verity Score {score}/100</title></Head>
      <div className={styles.page}>

        {/* NAV */}
        <nav className={styles.nav}>
          <div className={styles.logo}>
            <span className={`${styles.logoMark} serif`}>V</span>
            <span className={styles.logoText}>Verity</span>
          </div>
          <div className={styles.navMeta}>
            <span className={styles.navBrand}>{brand}</span>
            <span className={styles.navSep}>·</span>
            <span className={styles.navCat}>{category}</span>
          </div>
          <button className={styles.newScan} onClick={onReset}>+ New scan</button>
        </nav>

        <div className={styles.content}>

          {/* ── SUMMARY HEADER ── */}
          <div className={styles.summary}>
            <div className={styles.summaryLeft}>
              <div className={styles.summaryScoreWrap}>
                <ScoreRing score={score} size={96} />
              </div>
              <div className={styles.summaryText}>
                <p className={styles.summaryEyebrow}>Verity Score</p>
                <h1 className={`${styles.summaryHeadline} serif`}>{verityScore?.label || 'Analyzing...'}</h1>
                <p className={styles.summarySub}>
                  {brand} appeared in <strong>{mentionedCount} of {totalPrompts}</strong> AI prompts scanned across {personas.length} models.
                  {missedCount > 0 && topCompWinner && ` In the ${missedCount} prompt${missedCount > 1 ? 's' : ''} you missed, ${topCompWinner.name} was recommended instead.`}
                </p>
              </div>
            </div>
            <div className={styles.summaryStats}>
              {[
                { label: 'Mention rate', value: `${totalPrompts > 0 ? Math.round((mentionedCount / totalPrompts) * 100) : 0}%`, sub: `${mentionedCount}/${totalPrompts} prompts` },
                { label: 'Score vs best competitor', value: topCompWinner ? `${score} vs ${topCompWinner.score}` : '—', sub: topCompWinner ? (score > topCompWinner.score ? '↑ You lead' : score === topCompWinner.score ? 'Tied' : `↓ ${topCompWinner.name} leads`) : 'No competitors' },
              ].map(s => (
                <div key={s.label} className={styles.statCard}>
                  <p className={styles.statLabel}>{s.label}</p>
                  <p className={styles.statVal}>{s.value}</p>
                  <p className={styles.statSub}>{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.body}>
            {/* LEFT COLUMN */}
            <div className={styles.left}>

              {/* SCORE BREAKDOWN */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Score breakdown</h3>
                <div className={styles.breakdowns}>
                  {[
                    { label: 'Mention rate', val: verityScore?.breakdown?.mention, max: 40, tip: 'How often your brand appears across all prompts' },
                    { label: 'First position', val: verityScore?.breakdown?.firstPosition, max: 25, tip: 'How often you\'re the top recommendation' },
                    { label: 'Sentiment', val: verityScore?.breakdown?.sentiment, max: 20, tip: 'Positive vs neutral framing when mentioned' },
                    { label: 'AI breadth', val: verityScore?.breakdown?.breadth, max: 15, tip: 'Mentioned across multiple AI models' },
                  ].map(b => (
                    <div key={b.label} className={styles.bdRow}>
                      <div className={styles.bdTop}>
                        <span className={styles.bdLabel}>{b.label}</span>
                        <span className={styles.bdVal}>{b.val || 0}<span className={styles.bdMax}>/{b.max}</span></span>
                      </div>
                      <div className={styles.bdTrack}>
                        <div className={styles.bdFill} style={{ width: `${((b.val || 0) / b.max) * 100}%`, background: scoreColor }} />
                      </div>
                      <p className={styles.bdTip}>{b.tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* COMPETITOR BENCHMARK */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Competitor benchmark</h3>
                <p className={styles.cardSub}>Estimated AI visibility score for each brand based on the same prompts</p>
                <div className={styles.benchList}>
                  {/* Your brand */}
                  <div className={`${styles.benchRow} ${styles.benchRowYou}`}>
                    <div className={styles.benchMeta}>
                      <span className={styles.benchName}>{brand}</span>
                      <span className={styles.youBadge}>you</span>
                    </div>
                    <div className={styles.benchBarWrap}>
                      <div className={styles.benchBar} style={{ width: `${score}%`, background: scoreColor }} />
                    </div>
                    <span className={styles.benchScore} style={{ color: scoreColor }}>{score}</span>
                  </div>
                  {allCompetitors.map(c => {
                    const ahead = c.score > score;
                    return (
                      <div key={c.name} className={styles.benchRow}>
                        <span className={styles.benchName}>{c.name}</span>
                        <div className={styles.benchBarWrap}>
                          <div className={styles.benchBar} style={{ width: `${c.score}%`, background: ahead ? '#dc2626' : '#d1d5db' }} />
                        </div>
                        <span className={styles.benchScore} style={{ color: ahead ? '#dc2626' : '#9ca3af' }}>{c.score}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className={styles.right}>

              {/* ACTION PLAN — always at top of right column */}
              {recommendations.length > 0 && (
                <div className={styles.card}>
                  <div className={styles.actionHeader}>
                    <div>
                      <h3 className={styles.cardTitle}>Your action plan</h3>
                      <p className={styles.cardSub}>Specific steps to improve your score — ranked by impact</p>
                    </div>
                  </div>
                  <div className={styles.actionList}>
                    {recommendations.map((r, i) => {
                      const ic = IMPACT_COLOR[r.impact] || IMPACT_COLOR.low;
                      return (
                        <div key={i} className={styles.actionItem}>
                          <div className={styles.actionItemTop}>
                            <div className={styles.actionMeta}>
                              <span className={styles.actionNum}>{i + 1}</span>
                              <span className={styles.actionCat}>{CAT_LABEL[r.category] || r.category}</span>
                            </div>
                            <span className={styles.impactBadge} style={{ background: ic.bg, borderColor: ic.border, color: ic.text }}>
                              {r.impact} impact
                            </span>
                          </div>
                          <h4 className={styles.actionTitle}>{r.title}</h4>
                          <p className={styles.actionDesc}>{r.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI RESPONSES */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>AI responses</h3>
                <p className={styles.cardSub}>
                  <span className={styles.legendDot} style={{ background: '#fef9c3', border: '1px solid #fde68a' }} />
                  <span style={{ color: '#713f12' }}>Yellow = your brand</span>
                  <span style={{ margin: '0 6px', color: '#d1d5db' }}>·</span>
                  <span className={styles.legendDot} style={{ background: '#fee2e2', border: '1px solid #fecaca' }} />
                  <span style={{ color: '#991b1b' }}>Red = competitor</span>
                </p>
                <div className={styles.personaTabs}>
                  {personas.map(p => {
                    const m = personaMentions(p.id);
                    const t = Object.values(allResults[p.id] || {}).length;
                    const isActive = activePersona === p.id;
                    return (
                      <button key={p.id}
                        className={`${styles.personaTab} ${isActive ? styles.personaTabActive : ''}`}
                        onClick={() => setActivePersona(p.id)}>
                        <span className={styles.personaDot} style={{ background: p.color }} />
                        <span className={styles.personaLabel}>{p.label}</span>
                        <span className={styles.personaStat} style={{ background: m > 0 ? '#f0fdf4' : '#f9fafb', color: m > 0 ? '#16a34a' : '#9ca3af' }}>
                          {m}/{t}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className={styles.responseList}>
                  {Object.entries(activeResults).map(([catId, result]) => {
                    const a = extractMentionData(result.response || '', brand, competitors);
                    return (
                      <ResponseCard key={catId} result={result} analysis={a}
                        brand={brand} competitors={competitors} highlightText={highlightText} />
                    );
                  })}
                  {Object.keys(activeResults).length === 0 && (
                    <p className={styles.emptyState}>No responses for this model.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ResponseCard({ result, analysis, highlightText }) {
  const [expanded, setExpanded] = useState(false);

  const STATUS = analysis.mentioned
    ? { label: 'Mentioned', bg: '#f0fdf4', bd: '#bbf7d0', color: '#15803d', icon: '✓' }
    : { label: 'Not mentioned', bg: '#fef2f2', bd: '#fecaca', color: '#dc2626', icon: '—' };

  const promptCatColors = {
    Discovery: { bg: '#eff6ff', color: '#1d4ed8' },
    'Direct brand': { bg: '#fffbeb', color: '#b45309' },
    Competitive: { bg: '#f5f3ff', color: '#6d28d9' },
    'High intent': { bg: '#f0fdf4', color: '#15803d' },
  };
  const catStyle = promptCatColors[result.promptLabel] || { bg: '#f9fafb', color: '#6b7280' };

  return (
    <div className={styles.responseCard} style={{ borderLeft: `3px solid ${analysis.mentioned ? '#16a34a' : '#dc2626'}20` }}>
      <div className={styles.rcHeader}>
        <div className={styles.rcMeta}>
          <span className={styles.rcCat} style={{ background: catStyle.bg, color: catStyle.color }}>
            {result.promptLabel}
          </span>
          <span className={styles.rcStatus} style={{ background: STATUS.bg, borderColor: STATUS.bd, color: STATUS.color }}>
            {STATUS.icon} {STATUS.label}
          </span>
        </div>
        {analysis.mentioned && analysis.competitorsMentioned.length > 0 && (
          <span className={styles.rcCompNote}>+{analysis.competitorsMentioned.length} competitor{analysis.competitorsMentioned.length > 1 ? 's' : ''} also mentioned</span>
        )}
      </div>

      <p className={styles.rcPrompt}>"{result.prompt}"</p>

      <div className={`${styles.rcResponse} ${expanded ? styles.rcExpanded : ''}`}
        dangerouslySetInnerHTML={{ __html: highlightText(result.response) }} />

      {(result.response || '').length > 220 && (
        <button className={styles.rcToggle} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less ↑' : 'Read full response ↓'}
        </button>
      )}

      {!analysis.mentioned && analysis.competitorsMentioned.length > 0 && (
        <div className={styles.rcMissedNote}>
          Recommended instead: <strong>{analysis.competitorsMentioned.join(', ')}</strong>
        </div>
      )}
    </div>
  );
}
