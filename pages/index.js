import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import Dashboard from '../components/Dashboard';
import { AI_PERSONAS } from '../lib/prompts';
import { extractMentionData, computeVerityScore, computeCompetitorScore, computeFunnelBreakdown } from '../lib/scoring';
import RateLimitModal from '../components/RateLimitModal';

const STEPS = { LANDING: 'landing', INPUT: 'input', CONFIRM: 'confirm', GENERATING: 'generating', PREVIEW: 'preview', SCANNING: 'scanning', RESULTS: 'results' };

const FUNNEL_META = {
  discovery:  { label: 'Discovery',  color: '#2563eb', bg: '#eff6ff', bd: '#bfdbfe', desc: 'Consumer is exploring the category, no brand in mind yet' },
  comparison: { label: 'Comparison', color: '#7c3aed', bg: '#f5f3ff', bd: '#ddd6fe', desc: 'Consumer is comparing options, shortlisting brands' },
  decision:   { label: 'Decision',   color: '#059669', bg: '#f0fdf4', bd: '#bbf7d0', desc: 'Consumer is validating before buying' },
};

const COUNTRIES = [
  'India','United States','United Kingdom','Australia','Canada','Singapore',
  'UAE','Germany','France','Brazil','Indonesia','Philippines','Nigeria',
  'South Africa','Malaysia','Thailand','Japan','South Korea','Mexico','Italy',
].sort();

export default function Home() {
  const [step, setStep] = useState(STEPS.LANDING);
  const [rawInput, setRawInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [competitors, setCompetitors] = useState([]);
  const [competitorInput, setCompetitorInput] = useState('');
  const [country, setCountry] = useState('India');
  const [countryDetected, setCountryDetected] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [generatedPrompts, setGeneratedPrompts] = useState(null);
  const [generatingError, setGeneratingError] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [allResults, setAllResults] = useState({});
  const [verityScore, setVerityScore] = useState(null);
  const [competitorScores, setCompetitorScores] = useState({});
  const [funnelBreakdown, setFunnelBreakdown] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [rateLimitInfo, setRateLimitInfo] = useState(null); // { resetAt, total }
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);

  const selectedPersonas = ['chatgpt', 'gemini', 'claude', 'llama', 'perplexity'];

  useEffect(() => {
    fetch('/api/detect-country')
      .then(r => r.json())
      .then(d => { if (d.detected) { setCountry(d.country); setCountryDetected(true); } })
      .catch(() => {});
  }, []);

  async function handleResolve() {
    if (!rawInput.trim()) return;
    setResolveError('');
    setResolving(true);
    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: rawInput.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBrand(data.brand);
      setCategory(data.category);
      setCompetitors(data.competitors || []);
      setStep(STEPS.CONFIRM);
    } catch (e) {
      setResolveError('Could not identify your brand. Try typing your brand name directly.');
    } finally {
      setResolving(false);
    }
  }

  function addCompetitor() {
    const val = competitorInput.trim();
    if (val && !competitors.includes(val)) {
      setCompetitors(prev => [...prev, val]);
      setCompetitorInput('');
    }
  }

  function removeCompetitor(c) {
    setCompetitors(prev => prev.filter(x => x !== c));
  }

  async function handleGeneratePrompts() {
    setStep(STEPS.GENERATING);
    setGeneratingError('');
    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, category, country, competitors }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedPrompts(data.prompts);
      setStep(STEPS.PREVIEW);
    } catch (e) {
      setGeneratingError('Failed to generate prompts. Please try again.');
      setStep(STEPS.CONFIRM);
    }
  }

  async function startScan() {
    setStep(STEPS.SCANNING);
    setScanProgress(0);
    setScanStatus('Preparing scan...');

    const activePersonas = AI_PERSONAS.filter(p => selectedPersonas.includes(p.id));
    const results = {};
    const allTasks = [];

    activePersonas.forEach(persona => {
      Object.entries(generatedPrompts).forEach(([stage, prompts]) => {
        prompts.forEach((p, idx) => {
          allTasks.push({
            personaId: persona.id,
            promptId: `${stage}_${idx}`,
            promptLabel: FUNNEL_META[stage]?.label || stage,
            prompt: p.prompt,
            intent: p.intent,
            stage,
            categoryColor: FUNNEL_META[stage]?.color || '#666',
          });
        });
      });
    });

    setScanStatus(`Querying ${activePersonas.length} AI models across 3 funnel stages...`);
    setScanProgress(15);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: allTasks }),
      });

      // Handle rate limit
      if (res.status === 429) {
        const data = await res.json();
        setRateLimitInfo({ resetAt: data.resetAt, total: data.total });
        setShowRateLimitModal(true);
        setStep(STEPS.CONFIRM);
        return;
      }

      const data = await res.json();
      setScanProgress(65);
      setScanStatus('Analysing mentions and sentiment...');

      (data.results || []).forEach(r => {
        if (!results[r.personaId]) results[r.personaId] = {};
        results[r.personaId][r.promptId] = {
          response: r.response || '',
          promptLabel: r.promptLabel,
          prompt: r.prompt,
          intent: r.intent,
          stage: r.stage,
          categoryColor: r.categoryColor,
        };
      });
    } catch (e) {
      console.error('Scan failed', e);
    }

    setAllResults(results);
    setScanProgress(78);
    setScanStatus('Computing your Verity Score...');

    const score = computeVerityScore(results, brand, competitors);
    setVerityScore(score);

    const funnel = computeFunnelBreakdown(results, brand, competitors);
    setFunnelBreakdown(funnel);

    const compScores = {};
    competitors.forEach(c => { compScores[c] = computeCompetitorScore(c, results, brand, competitors); });
    setCompetitorScores(compScores);

    setScanProgress(90);
    setScanStatus('Generating action plan...');

    try {
      const recRes = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand, category, competitors, country,
          score: score.total, breakdown: score.breakdown,
          mentionedCount: score.mentionedCount, totalPrompts: score.totalPrompts,
          funnelBreakdown: funnel,
        }),
      });
      const recData = await recRes.json();
      setRecommendations(recData.recommendations || []);
    } catch (e) { setRecommendations([]); }

    setScanProgress(100);
    setScanStatus('Done!');
    await new Promise(r => setTimeout(r, 350));
    setStep(STEPS.RESULTS);
  }

  function reset() {
    setStep(STEPS.LANDING);
    setRawInput(''); setBrand(''); setCategory('');
    setCompetitors([]); setGeneratedPrompts(null);
    setAllResults({}); setVerityScore(null);
    setCompetitorScores({}); setFunnelBreakdown([]);
    setRecommendations([]); setScanProgress(0);
  }

  const filteredCountries = COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()));

  if (step === STEPS.RESULTS) {
    return (
      <Dashboard
        brand={brand} category={category} country={country}
        competitors={competitors} allResults={allResults}
        verityScore={verityScore} competitorScores={competitorScores}
        funnelBreakdown={funnelBreakdown} generatedPrompts={generatedPrompts}
        recommendations={recommendations}
        personas={AI_PERSONAS.filter(p => selectedPersonas.includes(p.id))}
        onReset={reset}
      />
    );
  }

  return (
    <>
      <Head>
        <title>Verity — AI Brand Visibility</title>
        <meta name="description" content="Find out if AI recommends your brand — or your competitor." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {showRateLimitModal && (
        <RateLimitModal
          resetAt={rateLimitInfo?.resetAt}
          onClose={() => setShowRateLimitModal(false)}
        />
      )}

      <div className={styles.page}>
        <nav className={styles.nav}>
          <div className={styles.logo} onClick={() => setStep(STEPS.LANDING)}>
            <span className={`${styles.logoMark} serif`}>V</span>
            <span className={styles.logoText}>Verity</span>
          </div>
          {step !== STEPS.LANDING && (
            <button className={styles.backBtn} onClick={() => {
              if (step === STEPS.PREVIEW) setStep(STEPS.CONFIRM);
              else if (step === STEPS.CONFIRM) setStep(STEPS.INPUT);
              else setStep(STEPS.LANDING);
            }}>← Back</button>
          )}
          {step === STEPS.LANDING && (
            <button className={styles.navCta} onClick={() => setStep(STEPS.INPUT)}>
              Check your brand →
            </button>
          )}
        </nav>

        {/* ── LANDING ── */}
        {step === STEPS.LANDING && (
          <div className={styles.landing}>
            <div className={styles.landingHero}>
              <div className={styles.heroBadge}>Free AI visibility scan</div>
              <h1 className={`${styles.heroHeadline} serif`}>
                What does AI say<br />about your brand?
              </h1>
              <p className={styles.heroSub}>
                When a consumer asks ChatGPT "best air fryer under ₹5000" — does your brand appear? Verity runs the exact prompts real consumers type, across 5 AI models, and tells you where you're winning and where you're invisible.
              </p>
              <div className={styles.heroActions}>
                <button className={styles.heroCta} onClick={() => setStep(STEPS.INPUT)}>
                  Scan my brand — it's free →
                </button>
                <span className={styles.heroNote}>~30 seconds · No sign-up needed · 10 free scans/day</span>
              </div>
              <div className={styles.modelRow}>
                {AI_PERSONAS.map(m => (
                  <span key={m.id} className={styles.modelPill}>
                    <span className={styles.modelDot} style={{ background: m.color }} />
                    {m.label}
                    {m.isLive
                      ? <span className={styles.liveBadge}>Live</span>
                      : <span className={styles.simBadge}>Sim</span>
                    }
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <p className={styles.sectionEyebrow}>How it works</p>
              <h2 className={styles.sectionTitle}>Four steps to your AI visibility score</h2>
              <p className={styles.sectionSub}>From brand name to full funnel analysis in under a minute.</p>
              <div className={styles.steps}>
                {[
                  { n: '1', title: 'Enter your brand or URL', desc: 'Verity identifies your category and auto-discovers your top competitors. You review and adjust in seconds.' },
                  { n: '2', title: 'We generate real consumer prompts', desc: 'AI generates the actual queries consumers type — across Discovery, Comparison, and Decision stages — localised to your country.' },
                  { n: '3', title: 'We scan 5 AI models simultaneously', desc: 'Every prompt runs across ChatGPT, Gemini (live), Claude, Llama 3 (live), and Perplexity in parallel. Takes ~30 seconds.' },
                  { n: '4', title: 'Get your Verity Score + action plan', desc: 'See exactly which funnel stage you\'re invisible at, which competitors are winning, and what to do about it this week.' },
                ].map(s => (
                  <div key={s.n} className={styles.stepCard}>
                    <div className={styles.stepNum}>{s.n}</div>
                    <div>
                      <h3 className={styles.stepTitle}>{s.title}</h3>
                      <p className={styles.stepDesc}>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <p className={styles.sectionEyebrow}>The buyer journey in AI</p>
              <h2 className={styles.sectionTitle}>Most brands are losing before they even know it</h2>
              <p className={styles.funnelIntro}>Brands only track whether they appear when someone searches their name. But by then it's too late — the consumer's shortlist was already formed two stages earlier.</p>
              <div className={styles.funnelCards}>
                {[
                  { stage: 'Discovery', color: '#2563eb', bg: '#eff6ff', bd: '#bfdbfe', example: '"best appliance for healthy cooking at home"', insight: 'No brand named. Pure category visibility. Most brands are completely invisible here.' },
                  { stage: 'Comparison', color: '#7c3aed', bg: '#f5f3ff', bd: '#ddd6fe', example: '"Philips vs Havells air fryer which is better"', insight: 'Shortlist is forming. If you\'re not in this conversation, you\'re not in consideration.' },
                  { stage: 'Decision', color: '#059669', bg: '#f0fdf4', bd: '#bbf7d0', example: '"is Philips air fryer worth buying in India"', insight: 'Consumer has 1–2 brands in mind. Sentiment and trust signals matter most here.' },
                ].map(f => (
                  <div key={f.stage} className={styles.funnelCard} style={{ borderColor: f.bd, background: f.bg }}>
                    <span className={styles.funnelStageLabel} style={{ color: f.color }}>{f.stage}</span>
                    <p className={styles.funnelExample}>"{f.example}"</p>
                    <p className={styles.funnelInsight} style={{ color: f.color }}>{f.insight}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <p className={styles.sectionEyebrow}>Why this matters now</p>
              <h2 className={styles.sectionTitle}>AI is the new discovery layer</h2>
              <p className={styles.sectionSub}>And right now, no one is tracking it except Verity.</p>
              <div className={styles.whyGrid}>
                {[
                  { stat: '40%', label: 'of product searches now start with an AI assistant' },
                  { stat: '3×', label: 'more likely to buy when your brand is recommended first' },
                  { stat: '0', label: 'other tools measure your presence in AI recommendations' },
                ].map(w => (
                  <div key={w.stat} className={styles.whyCard}>
                    <div className={`${styles.whyStat} serif`}>{w.stat}</div>
                    <p className={styles.whyLabel}>{w.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.landingCta}>
              <h2 className={`${styles.ctaHeadline} serif`}>Your competitors are already being recommended.</h2>
              <p className={styles.ctaSub}>Find out where you stand in 30 seconds.</p>
              <button className={styles.heroCta} onClick={() => setStep(STEPS.INPUT)}>
                Scan my brand — it's free →
              </button>
            </div>
          </div>
        )}

        {/* ── INPUT ── */}
        {step === STEPS.INPUT && (
          <div className={styles.centeredFlow}>
            <div className={styles.flowCard}>
              <div className={styles.flowCardHeader}>
                <h2 className={`${styles.flowTitle} serif`}>Enter your brand</h2>
                <p className={styles.flowSub}>Paste your website URL or type your brand name — we'll figure out the rest</p>
              </div>
              <div className={styles.inputGroup}>
                <input
                  className={styles.mainInput}
                  type="text"
                  placeholder="philips.co.in  or  Philips  or  air fryer brand India"
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !resolving && rawInput.trim() && handleResolve()}
                  autoFocus
                />
                {resolveError && <p className={styles.inputError}>{resolveError}</p>}
              </div>
              <button className={styles.primaryBtn} onClick={handleResolve} disabled={resolving || !rawInput.trim()}>
                {resolving && <span className={styles.spinner} />}
                {resolving ? 'Identifying brand...' : 'Continue →'}
              </button>
              <div className={styles.exampleRow}>
                <span className={styles.exampleLabel}>Try:</span>
                {['Philips', 'boAt', 'Lenskart', 'Myntra', 'Nike', 'Samsung'].map(ex => (
                  <button key={ex} className={styles.exampleChip} onClick={() => setRawInput(ex)}>{ex}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIRM ── */}
        {step === STEPS.CONFIRM && (
          <div className={styles.centeredFlow}>
            <div className={styles.flowCard}>
              <div className={styles.flowCardHeader}>
                <div className={styles.confirmBrandRow}>
                  <div>
                    <p className={styles.confirmMeta}>Brand identified</p>
                    <h2 className={`${styles.confirmBrand} serif`}>{brand}</h2>
                    <p className={styles.confirmCategory}>{category}</p>
                  </div>
                  <button className={styles.ghostBtn} onClick={() => setStep(STEPS.INPUT)}>Edit</button>
                </div>
              </div>

              <div className={styles.confirmSection}>
                <p className={styles.confirmSectionTitle}>Your market</p>
                <p className={styles.confirmSectionSub}>
                  {countryDetected ? 'Detected from your location.' : 'Defaulted to India.'} Change to get localised prompts.
                </p>
                <div className={styles.countrySelector} onClick={() => { setShowCountryDropdown(!showCountryDropdown); setCountrySearch(''); }}>
                  <span className={styles.countrySelectorVal}>{country}</span>
                  <span className={styles.countrySelectorArrow}>⌄</span>
                </div>
                {showCountryDropdown && (
                  <div className={styles.countryDropdown}>
                    <input className={styles.countrySearch} placeholder="Search countries..."
                      value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                      onClick={e => e.stopPropagation()} autoFocus />
                    <div className={styles.countryList}>
                      {filteredCountries.map(c => (
                        <button key={c} className={`${styles.countryOption} ${c === country ? styles.countryOptionActive : ''}`}
                          onClick={e => { e.stopPropagation(); setCountry(c); setShowCountryDropdown(false); }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.confirmSection}>
                <p className={styles.confirmSectionTitle}>Competitors to benchmark</p>
                <p className={styles.confirmSectionSub}>Auto-discovered. Remove any or add your own.</p>
                <div className={styles.chipList}>
                  {competitors.map(c => (
                    <div key={c} className={styles.competitorChip}>
                      {c}
                      <button className={styles.removeChip} onClick={() => removeCompetitor(c)}>×</button>
                    </div>
                  ))}
                </div>
                <div className={styles.addRow}>
                  <input className={styles.addInput} type="text" placeholder="Add a competitor..."
                    value={competitorInput} onChange={e => setCompetitorInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCompetitor()} />
                  <button className={styles.addBtn} onClick={addCompetitor}>Add</button>
                </div>
              </div>

              {generatingError && <p className={styles.inputError} style={{ marginBottom: 16 }}>{generatingError}</p>}

              <button className={styles.primaryBtn} onClick={handleGeneratePrompts}>
                Generate real consumer prompts →
              </button>
              <p className={styles.primaryBtnNote}>We'll show you the exact queries before scanning</p>
            </div>
          </div>
        )}

        {/* ── GENERATING ── */}
        {step === STEPS.GENERATING && (
          <div className={styles.centeredFlow}>
            <div className={`${styles.flowCard} ${styles.generatingCard}`}>
              <div className={styles.generatingAnim}>
                <div className={styles.genDot} style={{ animationDelay: '0s' }} />
                <div className={styles.genDot} style={{ animationDelay: '0.15s' }} />
                <div className={styles.genDot} style={{ animationDelay: '0.3s' }} />
              </div>
              <h2 className={`${styles.scanTitle} serif`}>Generating prompts</h2>
              <p className={styles.scanSub}>
                Creating realistic {category} queries that consumers in {country} actually type into AI — across Discovery, Comparison, and Decision stages
              </p>
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === STEPS.PREVIEW && generatedPrompts && (
          <div className={styles.previewFlow}>
            <div className={styles.previewCard}>
              <div className={styles.previewHeader}>
                <h2 className={`${styles.flowTitle} serif`}>Real consumer prompts</h2>
                <p className={styles.flowSub}>
                  Actual queries {country} consumers type when looking for {category}. We'll check if <strong>{brand}</strong> appears in each one across 5 AI models.
                </p>
              </div>

              <div className={styles.funnelStages}>
                {Object.entries(FUNNEL_META).map(([stageId, meta]) => {
                  const prompts = generatedPrompts[stageId] || [];
                  return (
                    <div key={stageId} className={styles.stageBlock}>
                      <div className={styles.stageHeader}>
                        <span className={styles.stageBadge} style={{ background: meta.bg, color: meta.color, borderColor: meta.bd }}>
                          {meta.label}
                        </span>
                        <span className={styles.stageDesc}>{meta.desc}</span>
                      </div>
                      <div className={styles.promptList}>
                        {prompts.map((p, i) => (
                          <div key={i} className={styles.promptItem}>
                            <div className={styles.promptItemLeft}>
                              <span className={styles.promptQuote} style={{ color: meta.color }}>"</span>
                              <span className={styles.promptText}>{p.prompt}</span>
                            </div>
                            <span className={styles.promptIntent}>{p.intent}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.previewMeta}>
                <div className={styles.previewMetaInner}>
                  <span className={styles.previewMetaIcon}>⚡</span>
                  <span className={styles.previewMetaText}>
                    <strong>{Object.values(generatedPrompts).reduce((a, p) => a + p.length, 0)} prompts</strong> × <strong>5 AI models</strong> (2 live, 3 simulated) — all in parallel, ~30 seconds
                  </span>
                </div>
              </div>

              <button className={styles.primaryBtn} onClick={startScan}>Run the scan →</button>
            </div>
          </div>
        )}

        {/* ── SCANNING ── */}
        {step === STEPS.SCANNING && (
          <div className={styles.centeredFlow}>
            <div className={`${styles.flowCard} ${styles.scanCard}`}>
              <div className={styles.scanAnimation}>
                <div className={styles.scanRings}>
                  <div className={styles.ring1} /><div className={styles.ring2} /><div className={styles.ring3} />
                  <div className={styles.scanCore} />
                </div>
              </div>
              <h2 className={`${styles.scanTitle} serif`}>Scanning AI models</h2>
              <p className={styles.scanSub}>{scanStatus}</p>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${scanProgress}%` }} />
              </div>
              <p className={styles.progressPct}>{scanProgress}%</p>
              <div className={styles.modelStatus}>
                {AI_PERSONAS.filter(p => selectedPersonas.includes(p.id)).map(m => (
                  <div key={m.id} className={styles.modelStatusItem}>
                    <span
                      className={`${styles.modelStatusDot} ${scanProgress > 15 && scanProgress < 78 ? styles.dotActive : scanProgress >= 78 ? styles.dotDone : ''}`}
                      style={scanProgress >= 78 ? { background: m.color } : {}}
                    />
                    {m.label}
                    {m.isLive && <span className={styles.liveIndicator}>live</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
