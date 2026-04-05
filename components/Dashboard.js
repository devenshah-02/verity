import { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Dashboard.module.css';
import { extractMentionData } from '../lib/scoring';

const FUNNEL_META = {
  discovery:  { label: 'Discovery',  color: '#2563eb', bg: '#eff6ff', bd: '#bfdbfe', lightText: '#1d4ed8' },
  comparison: { label: 'Comparison', color: '#7c3aed', bg: '#f5f3ff', bd: '#ddd6fe', lightText: '#6d28d9' },
  decision:   { label: 'Decision',   color: '#059669', bg: '#f0fdf4', bd: '#bbf7d0', lightText: '#047857' },
};

const IMPACT_COLOR = {
  high:   { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  medium: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
  low:    { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' },
};

const CAT_LABEL = { content: 'Content', pr: 'PR & Comms', seo: 'SEO', product: 'Product' };

function ScoreRing({ score, size = 96 }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 60 ? '#16a34a' : score >= 30 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0ec" strokeWidth="7"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeLinecap="round" strokeDasharray={`${fill} ${circ}`}
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2 - 4} textAnchor="middle" fontSize="21" fontWeight="600"
        fill={color} fontFamily="Instrument Serif,serif">{score}</text>
      <text x={size/2} y={size/2 + 14} textAnchor="middle" fontSize="11"
        fill="#a8a89e" fontFamily="Inter,sans-serif">/100</text>
    </svg>
  );
}

export default function Dashboard({
  brand, category, country, competitors, allResults,
  verityScore, competitorScores, funnelBreakdown, generatedPrompts,
  recommendations, personas, onReset,
}) {
  const [activePersona, setActivePersona] = useState(personas[0]?.id);
  const [activeStage, setActiveStage] = useState('all');

  const score = verityScore?.total || 0;
  const scoreColor = score >= 60 ? '#16a34a' : score >= 30 ? '#d97706' : '#dc2626';

  const allCompetitors = competitors
    .map(c => ({ name: c, score: competitorScores[c] || 0 }))
    .sort((a, b) => b.score - a.score);

  const totalPrompts = verityScore?.totalPrompts || 0;
  const mentionedCount = verityScore?.mentionedCount || 0;
  const missedCount = totalPrompts - mentionedCount;
  const topComp = allCompetitors[0];

  // Worst funnel stage
  const worstStage = funnelBreakdown.reduce((worst, s) => {
    if (s.total === 0) return worst;
    if (!worst || s.rate < worst.rate) return s;
    return worst;
  }, null);

  const activeResults = allResults[activePersona] || {};

  // Filter by funnel stage if selected
  const filteredResults = activeStage === 'all'
    ? Object.entries(activeResults)
    : Object.entries(activeResults).filter(([, r]) => r.stage === activeStage);

  function personaMentions(pid) {
    return Object.values(allResults[pid] || {})
      .filter(r => extractMentionData(r.response || '', brand, competitors).mentioned).length;
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
            <span className={styles.navSep}>·</span>
            <span className={styles.navCat}>{country}</span>
          </div>
          <button className={styles.newScan} onClick={onReset}>+ New scan</button>
        </nav>

        <div className={styles.content}>

          {/* ── SCORE HEADER ── */}
          <div className={styles.summary}>
            <div className={styles.summaryLeft}>
              <ScoreRing score={score} />
              <div className={styles.summaryText}>
                <p className={styles.summaryEyebrow}>Verity Score · {country}</p>
                <h1 className={`${styles.summaryHeadline} serif`}>{verityScore?.label || '—'}</h1>
                <p className={styles.summarySub}>
                  <strong>{brand}</strong> appeared in <strong>{mentionedCount} of {totalPrompts}</strong> real consumer prompts scanned across {personas.length} AI models.
                  {missedCount > 0 && topComp && (
                    <> In the <strong>{missedCount}</strong> you missed, <strong>{topComp.name}</strong> was recommended instead.</>
                  )}
                </p>
              </div>
            </div>
            <div className={styles.summaryStats}>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>Mention rate</p>
                <p className={styles.statVal}>{totalPrompts > 0 ? Math.round((mentionedCount / totalPrompts) * 100) : 0}%</p>
                <p className={styles.statSub}>{mentionedCount}/{totalPrompts} prompts</p>
              </div>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>Weakest stage</p>
                <p className={styles.statVal} style={{ color: worstStage ? FUNNEL_META[worstStage.id]?.color : 'inherit' }}>
                  {worstStage?.label || '—'}
                </p>
                <p className={styles.statSub}>{worstStage ? `${worstStage.rate}% visibility` : 'No data'}</p>
              </div>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>vs top competitor</p>
                <p className={styles.statVal} style={{ color: topComp && topComp.score > score ? '#dc2626' : '#16a34a' }}>
                  {topComp ? `${score > topComp.score ? '+' : ''}${score - topComp.score}` : '—'}
                </p>
                <p className={styles.statSub}>{topComp ? (score > topComp.score ? `You lead ${topComp.name}` : score === topComp.score ? `Tied with ${topComp.name}` : `${topComp.name} leads`) : 'No competitors'}</p>
              </div>
            </div>
          </div>

          {/* ── FUNNEL BREAKDOWN — hero section ── */}
          <div className={styles.funnelSection}>
            <div className={styles.funnelSectionHeader}>
              <h2 className={styles.sectionTitle}>Buyer journey visibility</h2>
              <p className={styles.sectionSub}>Where in the purchase funnel does {brand} appear — and where do you go dark?</p>
            </div>
            <div className={styles.funnelGrid}>
              {funnelBreakdown.map(stage => {
                const meta = FUNNEL_META[stage.id];
                if (!meta) return null;
                const width = stage.total > 0 ? (stage.mentioned / stage.total) * 100 : 0;
                const verdict = stage.rate >= 60 ? 'Strong' : stage.rate >= 30 ? 'Weak' : stage.rate === 0 ? 'Invisible' : 'Rarely visible';
                const verdictColor = stage.rate >= 60 ? '#16a34a' : stage.rate >= 30 ? '#d97706' : '#dc2626';
                return (
                  <div key={stage.id} className={styles.funnelCard} style={{ borderColor: meta.bd }}>
                    <div className={styles.funnelCardTop}>
                      <span className={styles.funnelBadge} style={{ background: meta.bg, color: meta.color, borderColor: meta.bd }}>
                        {meta.label}
                      </span>
                      <span className={styles.funnelVerdict} style={{ color: verdictColor }}>{verdict}</span>
                    </div>
                    <div className={styles.funnelRate}>
                      <span className={styles.funnelRateNum} style={{ color: meta.color }}>{stage.rate}%</span>
                      <span className={styles.funnelRateSub}>visibility · {stage.mentioned}/{stage.total} prompts</span>
                    </div>
                    <div className={styles.funnelBar}>
                      <div className={styles.funnelBarFill} style={{ width: `${width}%`, background: meta.color }} />
                    </div>
                    <p className={styles.funnelDesc}>{stage.desc}</p>
                    {generatedPrompts?.[stage.id]?.slice(0, 2).map((p, i) => (
                      <p key={i} className={styles.funnelExPrompt}>"{p.prompt}"</p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.body}>
            {/* LEFT */}
            <div className={styles.left}>

              {/* Score breakdown */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Score breakdown</h3>
                <div className={styles.breakdowns}>
                  {[
                    { label: 'Mention rate', val: verityScore?.breakdown?.mention, max: 40, tip: 'How often your brand appears' },
                    { label: 'First position', val: verityScore?.breakdown?.firstPosition, max: 25, tip: 'How often you\'re recommended first' },
                    { label: 'Sentiment', val: verityScore?.breakdown?.sentiment, max: 20, tip: 'Positive vs neutral framing' },
                    { label: 'AI breadth', val: verityScore?.breakdown?.breadth, max: 15, tip: 'Mentioned across multiple models' },
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

              {/* Competitor benchmark */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Competitor benchmark</h3>
                <p className={styles.cardSub}>AI visibility score across the same prompts</p>
                <div className={styles.benchList}>
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

            {/* RIGHT */}
            <div className={styles.right}>

              {/* Action plan */}
              {recommendations.length > 0 && (
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Your action plan</h3>
                  <p className={styles.cardSub}>Specific steps to improve your AI visibility — ranked by impact</p>
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

              {/* AI responses */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>AI responses</h3>
                <p className={styles.cardSub}>
                  <span className={styles.legendDot} style={{ background: '#fef9c3', border: '1px solid #fde68a' }} />
                  <span style={{ color: '#713f12', fontSize: 12 }}>Your brand</span>
                  <span style={{ margin: '0 8px', color: '#d1d5db' }}>·</span>
                  <span className={styles.legendDot} style={{ background: '#fee2e2', border: '1px solid #fecaca' }} />
                  <span style={{ color: '#991b1b', fontSize: 12 }}>Competitor</span>
                </p>

                {/* Persona tabs */}
                <div className={styles.personaTabs}>
                  {personas.map(p => {
                    const m = personaMentions(p.id);
                    const t = Object.values(allResults[p.id] || {}).length;
                    return (
                      <button key={p.id}
                        className={`${styles.personaTab} ${activePersona === p.id ? styles.personaTabActive : ''}`}
                        onClick={() => setActivePersona(p.id)}>
                        <span className={styles.personaDot} style={{ background: p.color }} />
                        <span className={styles.personaLabel}>{p.label}</span>
                        {p.isLive
                          ? <span className={styles.liveBadge}>Live</span>
                          : <span className={styles.simBadge}>Simulated</span>
                        }
                        <span className={styles.personaStat}
                          style={{ background: m > 0 ? '#f0fdf4' : '#f9fafb', color: m > 0 ? '#16a34a' : '#9ca3af' }}>
                          {m}/{t}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Funnel stage filter */}
                <div className={styles.stageFilter}>
                  {['all', 'discovery', 'comparison', 'decision'].map(s => {
                    const meta = s === 'all' ? null : FUNNEL_META[s];
                    return (
                      <button key={s}
                        className={`${styles.stageFilterBtn} ${activeStage === s ? styles.stageFilterActive : ''}`}
                        style={activeStage === s && meta ? { background: meta.bg, color: meta.color, borderColor: meta.bd } : {}}
                        onClick={() => setActiveStage(s)}>
                        {s === 'all' ? 'All stages' : meta?.label}
                      </button>
                    );
                  })}
                </div>

                <div className={styles.responseList}>
                  {filteredResults.map(([key, result]) => {
                    const a = extractMentionData(result.response || '', brand, competitors);
                    return (
                      <ResponseCard key={key} result={result} analysis={a} highlightText={highlightText} />
                    );
                  })}
                  {filteredResults.length === 0 && (
                    <p className={styles.emptyState}>No responses for this filter.</p>
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
  const meta = result.stage ? FUNNEL_META[result.stage] : null;

  const STATUS = analysis.mentioned
    ? { label: 'Mentioned', bg: '#f0fdf4', bd: '#bbf7d0', color: '#15803d', icon: '✓' }
    : { label: 'Not mentioned', bg: '#fef2f2', bd: '#fecaca', color: '#dc2626', icon: '—' };

  return (
    <div className={styles.responseCard} style={{ borderLeft: `3px solid ${analysis.mentioned ? '#16a34a' : '#dc2626'}22` }}>
      <div className={styles.rcHeader}>
        <div className={styles.rcMeta}>
          {meta && (
            <span className={styles.rcStage} style={{ background: meta.bg, color: meta.color, borderColor: meta.bd }}>
              {meta.label}
            </span>
          )}
          <span className={styles.rcStatus} style={{ background: STATUS.bg, borderColor: STATUS.bd, color: STATUS.color }}>
            {STATUS.icon} {STATUS.label}
          </span>
        </div>
        {analysis.mentioned && analysis.competitorsMentioned.length > 0 && (
          <span className={styles.rcCompNote}>+{analysis.competitorsMentioned.length} competitor also here</span>
        )}
      </div>

      <p className={styles.rcPrompt}>"{result.prompt}"</p>

      {result.intent && <p className={styles.rcIntent}>{result.intent}</p>}

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
