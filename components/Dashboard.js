import { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Dashboard.module.css';
import { extractMentionData } from '../lib/scoring';

const IMPACT_COLORS = { high: '#4ade80', medium: '#c8b560', low: '#9998a8' };
const CATEGORY_LABELS = { content: 'Content', pr: 'PR & Comms', seo: 'SEO', product: 'Product' };

export default function Dashboard({
  brand, category, competitors, allResults,
  verityScore, competitorScores, recommendations, personas, onReset
}) {
  const [activePersona, setActivePersona] = useState(personas[0]?.id);
  const [activePromptCategory, setActivePromptCategory] = useState(null);

  const activeResults = allResults[activePersona] || {};
  const scoreColor = verityScore?.total >= 60 ? '#4ade80' : verityScore?.total >= 30 ? '#c8b560' : '#f87171';

  const allCompetitorData = competitors.map(c => ({
    name: c,
    score: competitorScores[c] || 0,
  })).sort((a, b) => b.score - a.score);

  return (
    <>
      <Head>
        <title>{brand} — Verity AI Visibility Report</title>
      </Head>
      <div className={styles.page}>
        {/* Nav */}
        <nav className={styles.nav}>
          <div className={styles.logo}>
            <span className={`${styles.logoMark} serif`}>V</span>
            <span className={styles.logoText}>Verity</span>
          </div>
          <div className={styles.navCenter}>
            <span className={styles.navBrand}>{brand}</span>
            <span className={styles.navDot}>·</span>
            <span className={styles.navCategory}>{category}</span>
          </div>
          <button className={styles.newScanBtn} onClick={onReset}>+ New scan</button>
        </nav>

        <div className={styles.layout}>
          {/* LEFT SIDEBAR */}
          <aside className={styles.sidebar}>
            {/* Verity Score */}
            <div className={styles.scoreCard}>
              <div className={styles.scoreLabelRow}>
                <span className={styles.scoreLabel}>Verity Score</span>
              </div>
              <div className={styles.scoreRing}>
                <svg viewBox="0 0 80 80" className={styles.ringsvg}>
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg-4)" strokeWidth="6"/>
                  <circle
                    cx="40" cy="40" r="34"
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(verityScore?.total / 100) * 213.6} 213.6`}
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <div className={styles.scoreCenter}>
                  <span className={`${styles.scoreNum} serif`} style={{ color: scoreColor }}>{verityScore?.total}</span>
                  <span className={styles.scoreMax}>/100</span>
                </div>
              </div>
              <p className={styles.scoreStatus}>{verityScore?.label}</p>
              <div className={styles.breakdownList}>
                {[
                  { label: 'Mention rate', val: verityScore?.breakdown?.mention, max: 40 },
                  { label: 'First position', val: verityScore?.breakdown?.firstPosition, max: 25 },
                  { label: 'Sentiment', val: verityScore?.breakdown?.sentiment, max: 20 },
                  { label: 'AI breadth', val: verityScore?.breakdown?.breadth, max: 15 },
                ].map(b => (
                  <div key={b.label} className={styles.breakdownRow}>
                    <span className={styles.breakdownLabel}>{b.label}</span>
                    <div className={styles.breakdownBarWrap}>
                      <div className={styles.breakdownBar} style={{ width: `${((b.val || 0) / b.max) * 100}%`, background: scoreColor }} />
                    </div>
                    <span className={styles.breakdownVal}>{b.val}<span className={styles.breakdownMax}>/{b.max}</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitor benchmark */}
            <div className={styles.sideCard}>
              <div className={styles.cardTitle}>Competitor benchmark</div>
              <div className={styles.compList}>
                {/* Your brand first */}
                <div className={`${styles.compRow} ${styles.compRowYou}`}>
                  <span className={styles.compName}>{brand} <span className={styles.youTag}>you</span></span>
                  <div className={styles.compBarWrap}>
                    <div className={styles.compBar} style={{ width: `${verityScore?.total || 0}%`, background: '#c8b560' }} />
                  </div>
                  <span className={styles.compScore} style={{ color: '#c8b560' }}>{verityScore?.total || 0}</span>
                </div>
                {allCompetitorData.map(c => (
                  <div key={c.name} className={styles.compRow}>
                    <span className={styles.compName}>{c.name}</span>
                    <div className={styles.compBarWrap}>
                      <div className={styles.compBar} style={{ width: `${c.score}%`, background: c.score > (verityScore?.total || 0) ? '#f87171' : '#555466' }} />
                    </div>
                    <span className={styles.compScore} style={{ color: c.score > (verityScore?.total || 0) ? '#f87171' : '#9998a8' }}>{c.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* MAIN */}
          <main className={styles.main}>
            {/* Model tabs */}
            <div className={styles.modelTabs}>
              {personas.map(p => {
                const pResults = allResults[p.id] || {};
                const mentions = Object.values(pResults).filter(r => {
                  const a = extractMentionData(r.response || '', brand, competitors);
                  return a.mentioned;
                }).length;
                const total = Object.values(pResults).length;
                return (
                  <button
                    key={p.id}
                    className={`${styles.modelTab} ${activePersona === p.id ? styles.modelTabActive : ''}`}
                    onClick={() => setActivePersona(p.id)}
                    style={activePersona === p.id ? { borderColor: p.color + '50', background: p.color + '10' } : {}}
                  >
                    <span className={styles.tabDot} style={{ background: p.color }} />
                    <span className={styles.tabLabel}>{p.label}</span>
                    <span className={styles.tabStat}>{mentions}/{total}</span>
                  </button>
                );
              })}
            </div>

            {/* Response cards */}
            <div className={styles.responseGrid}>
              {Object.entries(activeResults).map(([catId, result]) => {
                const analysis = extractMentionData(result.response || '', brand, competitors);
                return (
                  <ResponseCard
                    key={catId}
                    result={result}
                    analysis={analysis}
                    brand={brand}
                    competitors={competitors}
                    catId={catId}
                  />
                );
              })}
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className={styles.recoSection}>
                <div className={styles.recoHeader}>
                  <h3 className={styles.recoTitle}>Action plan</h3>
                  <p className={styles.recoSub}>Specific steps to improve your AI visibility score</p>
                </div>
                <div className={styles.recoGrid}>
                  {recommendations.map((r, i) => (
                    <div key={i} className={styles.recoCard}>
                      <div className={styles.recoCardHeader}>
                        <span className={styles.recoCategoryTag} style={{ color: IMPACT_COLORS[r.impact] }}>
                          {CATEGORY_LABELS[r.category] || r.category}
                        </span>
                        <div className={styles.recoBadges}>
                          <span className={styles.impactBadge} style={{ color: IMPACT_COLORS[r.impact], background: IMPACT_COLORS[r.impact] + '18', borderColor: IMPACT_COLORS[r.impact] + '30' }}>
                            {r.impact} impact
                          </span>
                        </div>
                      </div>
                      <h4 className={styles.recoCardTitle}>{r.title}</h4>
                      <p className={styles.recoCardDesc}>{r.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

function ResponseCard({ result, analysis, brand, competitors }) {
  const [expanded, setExpanded] = useState(false);

  function highlightText(text) {
    if (!text) return '';
    let result = text;
    // Escape HTML first
    result = result.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Highlight brand
    const brandEsc = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`(${brandEsc})`, 'gi'), '<mark class="brand-hl">$1</mark>');
    // Highlight competitors
    competitors.forEach(c => {
      const cEsc = c.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (cEsc) result = result.replace(new RegExp(`(${cEsc})`, 'gi'), '<mark class="comp-hl">$1</mark>');
    });
    return result;
  }

  const sentimentColor = analysis.sentiment === 'positive' ? '#4ade80' : analysis.sentiment === 'negative' ? '#f87171' : '#9998a8';

  return (
    <div className={`${styles.responseCard} ${analysis.mentioned ? styles.responseCardMentioned : styles.responseCardMissed}`}>
      <div className={styles.responseCardHeader}>
        <div className={styles.responseCardMeta}>
          <span className={styles.promptCatLabel} style={{ background: result.categoryColor + '1a', color: result.categoryColor }}>
            {result.promptLabel}
          </span>
          <span className={`${styles.mentionBadge} ${analysis.mentioned ? styles.mentionBadgeYes : styles.mentionBadgeNo}`}>
            {analysis.mentioned ? '✓ Mentioned' : '— Not mentioned'}
          </span>
        </div>
        {analysis.mentioned && (
          <div className={styles.responseCardStats}>
            {analysis.rankPosition && (
              <span className={styles.statPill}>Rank ~{analysis.rankPosition}</span>
            )}
            <span className={styles.statPill} style={{ color: sentimentColor }}>
              {analysis.sentiment}
            </span>
            {analysis.competitorsMentioned.length > 0 && (
              <span className={styles.statPill} style={{ color: '#f87171' }}>
                +{analysis.competitorsMentioned.length} competitor{analysis.competitorsMentioned.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      <p className={styles.promptText}>{result.prompt}</p>

      <div className={`${styles.responseText} ${expanded ? styles.responseExpanded : ''}`}>
        <span dangerouslySetInnerHTML={{ __html: highlightText(result.response) }} />
      </div>

      {result.response && result.response.length > 200 && (
        <button className={styles.expandBtn} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less ↑' : 'Read full response ↓'}
        </button>
      )}

      {!analysis.mentioned && analysis.competitorsMentioned.length > 0 && (
        <div className={styles.missedNote}>
          Competitors recommended instead: <strong>{analysis.competitorsMentioned.join(', ')}</strong>
        </div>
      )}
    </div>
  );
}
