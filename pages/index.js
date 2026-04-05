import { useState, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import Dashboard from '../components/Dashboard';
import { PROMPT_CATEGORIES, AI_PERSONAS, buildPrompt } from '../lib/prompts';
import { extractMentionData, computeVerityScore, computeCompetitorScore } from '../lib/scoring';

const STEPS = { LANDING: 'landing', INPUT: 'input', CONFIRM: 'confirm', SCANNING: 'scanning', RESULTS: 'results' };

export default function Home() {
  const [step, setStep] = useState(STEPS.LANDING);
  const [rawInput, setRawInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [competitors, setCompetitors] = useState([]);
  const [competitorInput, setCompetitorInput] = useState('');
  const [selectedPersonas] = useState(['chatgpt', 'gemini', 'claude', 'perplexity']);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [allResults, setAllResults] = useState({});
  const [verityScore, setVerityScore] = useState(null);
  const [competitorScores, setCompetitorScores] = useState({});
  const [recommendations, setRecommendations] = useState([]);

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
      setResolveError('Could not identify your brand. Try entering your brand name directly.');
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

  async function startScan() {
    setStep(STEPS.SCANNING);
    setScanProgress(0);
    setScanStatus('Building prompts...');

    const activePersonas = AI_PERSONAS.filter(p => selectedPersonas.includes(p.id));
    const results = {};

    // Build all tasks upfront
    const allTasks = [];
    activePersonas.forEach(persona => {
      PROMPT_CATEGORIES.forEach(cat => {
        const competitor = competitors[0] || 'a major competitor';
        const prompt = buildPrompt(cat.prompts[0], { brand, category, competitor });
        allTasks.push({
          personaId: persona.id,
          promptId: cat.id,
          promptLabel: cat.label,
          prompt,
          categoryColor: cat.color,
        });
      });
    });

    // Fire ALL tasks in parallel via single API call
    setScanStatus(`Querying ${activePersonas.length} AI models simultaneously...`);
    setScanProgress(20);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: allTasks }),
      });
      const data = await res.json();

      setScanProgress(70);
      setScanStatus('Analyzing responses...');

      // Restructure into { personaId: { promptId: result } }
      (data.results || []).forEach(r => {
        if (!results[r.personaId]) results[r.personaId] = {};
        results[r.personaId][r.promptId] = {
          response: r.response || '',
          promptLabel: r.promptLabel,
          prompt: r.prompt,
          category: r.promptId,
          categoryColor: r.categoryColor,
        };
      });
    } catch (e) {
      console.error('Scan failed', e);
    }

    setAllResults(results);
    setScanProgress(85);
    setScanStatus('Computing your Verity Score...');

    const score = computeVerityScore(results, brand, competitors);
    setVerityScore(score);

    const compScores = {};
    competitors.forEach(c => {
      compScores[c] = computeCompetitorScore(c, results, brand, competitors);
    });
    setCompetitorScores(compScores);

    setScanProgress(92);
    setScanStatus('Generating your action plan...');

    try {
      const recRes = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand, category, competitors,
          score: score.total,
          breakdown: score.breakdown,
          mentionedCount: score.mentionedCount,
          totalPrompts: score.totalPrompts,
        }),
      });
      const recData = await recRes.json();
      setRecommendations(recData.recommendations || []);
    } catch (e) {
      setRecommendations([]);
    }

    setScanProgress(100);
    setScanStatus('Done!');
    await new Promise(r => setTimeout(r, 400));
    setStep(STEPS.RESULTS);
  }

  function reset() {
    setStep(STEPS.LANDING);
    setRawInput('');
    setBrand('');
    setCategory('');
    setCompetitors([]);
    setAllResults({});
    setVerityScore(null);
    setCompetitorScores({});
    setRecommendations([]);
    setScanProgress(0);
  }

  if (step === STEPS.RESULTS) {
    return (
      <Dashboard
        brand={brand}
        category={category}
        competitors={competitors}
        allResults={allResults}
        verityScore={verityScore}
        competitorScores={competitorScores}
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

      <div className={styles.page}>
        <nav className={styles.nav}>
          <div className={styles.logo} onClick={() => setStep(STEPS.LANDING)} style={{ cursor: 'pointer' }}>
            <span className={`${styles.logoMark} serif`}>V</span>
            <span className={styles.logoText}>Verity</span>
          </div>
          {step !== STEPS.LANDING && (
            <button className={styles.backBtn} onClick={() => setStep(STEPS.LANDING)}>← Back</button>
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
                When someone asks ChatGPT, Gemini, or Perplexity for a recommendation in your category — does your brand show up? Verity tells you exactly where you stand, who's winning instead, and what to do about it.
              </p>
              <div className={styles.heroActions}>
                <button className={styles.heroCta} onClick={() => setStep(STEPS.INPUT)}>
                  Scan my brand — it's free →
                </button>
                <span className={styles.heroNote}>Takes ~20 seconds. No sign-up needed.</span>
              </div>
              <div className={styles.modelRow}>
                {[
                  { label: 'ChatGPT', color: '#10a37f' },
                  { label: 'Gemini', color: '#4285F4' },
                  { label: 'Claude', color: '#D97757' },
                  { label: 'Perplexity', color: '#20b2aa' },
                ].map(m => (
                  <span key={m.label} className={styles.modelPill}>
                    <span className={styles.modelDot} style={{ background: m.color }} />
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.howItWorks}>
              <p className={styles.sectionEyebrow}>How it works</p>
              <div className={styles.steps}>
                {[
                  { n: '1', title: 'Enter your brand or URL', desc: 'Paste your website or type your brand name. Verity figures out your category and finds your competitors automatically.' },
                  { n: '2', title: 'We query 4 AI models', desc: 'Verity runs 16 prompts across ChatGPT, Gemini, Claude, and Perplexity — discovery queries, comparisons, and purchase-intent searches.' },
                  { n: '3', title: 'Get your Verity Score', desc: 'See exactly where you appear, where competitors beat you, and get a specific action plan to improve your AI visibility.' },
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

            <div className={styles.whySection}>
              <p className={styles.sectionEyebrow}>Why this matters</p>
              <div className={styles.whyGrid}>
                {[
                  { stat: '40%', label: 'of product searches now start with an AI assistant, not Google' },
                  { stat: '0', label: 'tools exist today to measure your brand\'s AI visibility — until now' },
                  { stat: '3×', label: 'more likely a brand is purchased when recommended first by AI' },
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
              <p className={styles.ctaSub}>Find out where you stand in 20 seconds.</p>
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
                <p className={styles.flowSub}>Paste your website URL or type your brand name</p>
              </div>
              <div className={styles.inputGroup}>
                <input
                  className={styles.mainInput}
                  type="text"
                  placeholder="myntra.com  or  Myntra  or  Online fashion brand India"
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !resolving && rawInput.trim() && handleResolve()}
                  autoFocus
                />
                {resolveError && <p className={styles.inputError}>{resolveError}</p>}
              </div>
              <button
                className={styles.primaryBtn}
                onClick={handleResolve}
                disabled={resolving || !rawInput.trim()}
              >
                {resolving ? <span className={styles.spinner} /> : null}
                {resolving ? 'Identifying brand...' : 'Continue →'}
              </button>
              <div className={styles.exampleRow}>
                <span className={styles.exampleLabel}>Try:</span>
                {['myntra.com', 'boAt', 'Lenskart', 'Nykaa'].map(ex => (
                  <button key={ex} className={styles.exampleChip}
                    onClick={() => setRawInput(ex)}>
                    {ex}
                  </button>
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
                    <p className={styles.confirmMeta}>We identified your brand as</p>
                    <h2 className={`${styles.confirmBrand} serif`}>{brand}</h2>
                    <p className={styles.confirmCategory}>{category}</p>
                  </div>
                  <button className={styles.ghostBtn} onClick={() => setStep(STEPS.INPUT)}>
                    Edit
                  </button>
                </div>
              </div>

              <div className={styles.confirmSection}>
                <div className={styles.confirmSectionHeader}>
                  <div>
                    <p className={styles.confirmSectionTitle}>Competitors to benchmark against</p>
                    <p className={styles.confirmSectionSub}>We found these automatically. Remove any you don't want, or add others.</p>
                  </div>
                </div>
                <div className={styles.chipList}>
                  {competitors.map(c => (
                    <div key={c} className={styles.competitorChip}>
                      {c}
                      <button className={styles.removeChip} onClick={() => removeCompetitor(c)}>×</button>
                    </div>
                  ))}
                </div>
                <div className={styles.addRow}>
                  <input
                    className={styles.addInput}
                    type="text"
                    placeholder="Add a competitor..."
                    value={competitorInput}
                    onChange={e => setCompetitorInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCompetitor()}
                  />
                  <button className={styles.addBtn} onClick={addCompetitor}>Add</button>
                </div>
              </div>

              <div className={styles.scanPreview}>
                <div className={styles.scanPreviewInner}>
                  <span className={styles.scanPreviewIcon}>⚡</span>
                  <div>
                    <p className={styles.scanPreviewTitle}>What we'll scan</p>
                    <p className={styles.scanPreviewDesc}>16 prompts across ChatGPT, Gemini, Claude & Perplexity — discovery, comparison, and purchase-intent queries — all in parallel. Takes ~20 seconds.</p>
                  </div>
                </div>
              </div>

              <button className={styles.primaryBtn} onClick={startScan}>
                Start scan →
              </button>
            </div>
          </div>
        )}

        {/* ── SCANNING ── */}
        {step === STEPS.SCANNING && (
          <div className={styles.centeredFlow}>
            <div className={`${styles.flowCard} ${styles.scanCard}`}>
              <div className={styles.scanAnimation}>
                <div className={styles.scanRings}>
                  <div className={styles.ring1} />
                  <div className={styles.ring2} />
                  <div className={styles.ring3} />
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
                {[
                  { label: 'ChatGPT', color: '#10a37f' },
                  { label: 'Gemini', color: '#4285F4' },
                  { label: 'Claude', color: '#D97757' },
                  { label: 'Perplexity', color: '#20b2aa' },
                ].map(m => (
                  <div key={m.label} className={styles.modelStatusItem}>
                    <span className={`${styles.modelStatusDot} ${scanProgress > 20 && scanProgress < 85 ? styles.dotActive : scanProgress >= 85 ? styles.dotDone : ''}`}
                      style={scanProgress >= 85 ? { background: m.color } : {}} />
                    {m.label}
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
