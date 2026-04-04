import { useState, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import Dashboard from '../components/Dashboard';
import { PROMPT_CATEGORIES, AI_PERSONAS, buildPrompt } from '../lib/prompts';
import { extractMentionData, computeVerityScore, computeCompetitorScore } from '../lib/scoring';

const STEPS = { INPUT: 'input', CONFIRM: 'confirm', SCANNING: 'scanning', RESULTS: 'results' };

export default function Home() {
  const [step, setStep] = useState(STEPS.INPUT);
  const [rawInput, setRawInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [competitors, setCompetitors] = useState([]);
  const [competitorInput, setCompetitorInput] = useState('');
  const [selectedPersonas, setSelectedPersonas] = useState(['chatgpt', 'gemini', 'claude', 'perplexity']);
  const [selectedCategories, setSelectedCategories] = useState(['discovery', 'direct', 'competitive', 'intent']);
  const [scanLog, setScanLog] = useState([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [allResults, setAllResults] = useState({});
  const [verityScore, setVerityScore] = useState(null);
  const [competitorScores, setCompetitorScores] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const inputRef = useRef();

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
      setCompetitors([...competitors, val]);
      setCompetitorInput('');
    }
  }

  function removeCompetitor(c) {
    setCompetitors(competitors.filter(x => x !== c));
  }

  function togglePersona(id) {
    setSelectedPersonas(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id]
    );
  }

  function toggleCategory(id) {
    setSelectedCategories(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id]
    );
  }

  async function startScan() {
    setStep(STEPS.SCANNING);
    setScanLog([]);
    setScanProgress(0);
    setAllResults({});

    const activePersonas = AI_PERSONAS.filter(p => selectedPersonas.includes(p.id));
    const activeCategories = PROMPT_CATEGORIES.filter(c => selectedCategories.includes(c.id));
    const results = {};
    const logs = [];

    // Build all tasks
    const tasks = [];
    activePersonas.forEach(persona => {
      activeCategories.forEach(cat => {
        // Pick first prompt from each category (MVP: 1 prompt per category per model)
        const template = cat.prompts[0];
        const competitor = competitors[0] || 'a major competitor';
        const prompt = buildPrompt(template, { brand, category, competitor });
        tasks.push({ persona, cat, prompt });
      });
    });

    const total = tasks.length;
    let done = 0;

    for (const task of tasks) {
      const logEntry = { id: `${task.persona.id}-${task.cat.id}`, persona: task.persona.label, category: task.cat.label, status: 'running' };
      logs.push(logEntry);
      setScanLog([...logs]);

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personaId: task.persona.id, prompt: task.prompt }),
        });
        const data = await res.json();
        if (!results[task.persona.id]) results[task.persona.id] = {};
        results[task.persona.id][task.cat.id] = {
          response: data.response || '',
          promptLabel: task.cat.label,
          prompt: task.prompt,
          category: task.cat.id,
          categoryColor: task.cat.color,
        };
        logEntry.status = 'done';
        const analysis = extractMentionData(data.response || '', brand, competitors);
        logEntry.mentioned = analysis.mentioned;
      } catch (e) {
        logEntry.status = 'error';
      }

      done++;
      setScanProgress(Math.round((done / total) * 100));
      setScanLog([...logs]);
    }

    setAllResults(results);

    // Compute scores
    const score = computeVerityScore(results, brand, competitors);
    setVerityScore(score);

    const compScores = {};
    competitors.forEach(c => {
      compScores[c] = computeCompetitorScore(c, results, brand, competitors);
    });
    setCompetitorScores(compScores);

    // Fetch recommendations
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

    setStep(STEPS.RESULTS);
  }

  function reset() {
    setStep(STEPS.INPUT);
    setRawInput('');
    setBrand('');
    setCategory('');
    setCompetitors([]);
    setAllResults({});
    setVerityScore(null);
    setCompetitorScores({});
    setRecommendations([]);
    setScanLog([]);
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
        <meta name="description" content="See how AI recommends your brand. Measure, benchmark, and improve your presence across ChatGPT, Gemini, Claude, and Perplexity." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.page}>
        {/* Nav */}
        <nav className={styles.nav}>
          <div className={styles.logo}>
            <span className={`${styles.logoMark} serif`}>V</span>
            <span className={styles.logoText}>Verity</span>
          </div>
          <span className={styles.navTag}>Beta</span>
        </nav>

        {step === STEPS.INPUT && (
          <div className={styles.hero}>
            <div className={styles.heroInner}>
              <div className={styles.pill}>AI visibility intelligence</div>
              <h1 className={`${styles.headline} serif`}>
                What does AI say<br />about your brand?
              </h1>
              <p className={styles.subline}>
                Enter your website URL or brand name. Verity scans ChatGPT, Gemini, Claude, and Perplexity to measure your AI presence — and shows you who's winning instead.
              </p>

              <div className={styles.inputWrap}>
                <div className={styles.inputRow}>
                  <div className={styles.inputIcon}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.4"/>
                      <path d="M5.5 8c0-1.38.57-2.63 1.5-3.5M10.5 8c0 1.38-.57 2.63-1.5 3.5M3 8h10M5.5 5h5M5.5 11h5" stroke="currentColor" strokeOpacity="0.4" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <input
                    ref={inputRef}
                    className={styles.mainInput}
                    type="text"
                    placeholder="myntra.com or Myntra or Fashion e-commerce brand"
                    value={rawInput}
                    onChange={e => setRawInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleResolve()}
                    autoFocus
                  />
                  <button
                    className={styles.analyzeBtn}
                    onClick={handleResolve}
                    disabled={resolving || !rawInput.trim()}
                  >
                    {resolving ? (
                      <span className={styles.btnSpinner} />
                    ) : (
                      <>Analyze →</>
                    )}
                  </button>
                </div>
                {resolveError && <p className={styles.inputError}>{resolveError}</p>}
                <div className={styles.inputHints}>
                  <span>Try:</span>
                  {['myntra.com', 'Nykaa', 'boAt', 'Lenskart'].map(ex => (
                    <button key={ex} className={styles.exampleChip} onClick={() => { setRawInput(ex); }}>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.modelBadges}>
                {['ChatGPT', 'Gemini', 'Claude', 'Perplexity'].map((m, i) => (
                  <span key={m} className={styles.modelBadge} style={{ animationDelay: `${i * 0.1}s` }}>{m}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === STEPS.CONFIRM && (
          <div className={styles.confirmWrap}>
            <div className={styles.confirmCard}>
              <div className={styles.confirmHeader}>
                <div>
                  <p className={styles.confirmMeta}>Brand identified</p>
                  <h2 className={`${styles.confirmBrand} serif`}>{brand}</h2>
                  <p className={styles.confirmCategory}>{category}</p>
                </div>
                <button className={styles.editBtn} onClick={() => setStep(STEPS.INPUT)}>← Edit</button>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>Competitors to track</div>
                <p className={styles.sectionSub}>We found these. Remove any or add your own.</p>
                <div className={styles.competitorList}>
                  {competitors.map(c => (
                    <div key={c} className={styles.competitorChip}>
                      <span>{c}</span>
                      <button onClick={() => removeCompetitor(c)} className={styles.removeBtn}>×</button>
                    </div>
                  ))}
                </div>
                <div className={styles.addCompRow}>
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

              <div className={styles.section}>
                <div className={styles.sectionLabel}>AI models to scan</div>
                <div className={styles.toggleGrid}>
                  {AI_PERSONAS.map(p => (
                    <button
                      key={p.id}
                      className={`${styles.toggleChip} ${selectedPersonas.includes(p.id) ? styles.toggleOn : ''}`}
                      onClick={() => togglePersona(p.id)}
                      style={selectedPersonas.includes(p.id) ? { borderColor: p.color + '60', background: p.color + '14' } : {}}
                    >
                      <span className={styles.toggleDot} style={{ background: p.color }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>Prompt categories</div>
                <div className={styles.toggleGrid}>
                  {PROMPT_CATEGORIES.map(c => (
                    <button
                      key={c.id}
                      className={`${styles.toggleChip} ${selectedCategories.includes(c.id) ? styles.toggleOn : ''}`}
                      onClick={() => toggleCategory(c.id)}
                      style={selectedCategories.includes(c.id) ? { borderColor: c.color + '60', background: c.color + '14' } : {}}
                    >
                      <span className={styles.toggleDot} style={{ background: c.color }} />
                      <span>
                        <span className={styles.toggleLabel}>{c.label}</span>
                        <span className={styles.toggleDesc}>{c.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button className={styles.startScanBtn} onClick={startScan}>
                Start AI visibility scan →
              </button>
            </div>
          </div>
        )}

        {step === STEPS.SCANNING && (
          <div className={styles.scanWrap}>
            <div className={styles.scanCard}>
              <div className={styles.scanHeader}>
                <div className={styles.scanPulse} />
                <h2 className={`${styles.scanTitle} serif`}>Scanning AI models</h2>
                <p className={styles.scanSub}>Running prompts across {selectedPersonas.length} AI models — this takes about 30–60 seconds</p>
              </div>

              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${scanProgress}%` }} />
              </div>
              <p className={styles.progressLabel}>{scanProgress}% complete</p>

              <div className={styles.logList}>
                {scanLog.map(log => (
                  <div key={log.id} className={`${styles.logItem} ${styles[`logItem_${log.status}`]}`}>
                    <span className={styles.logDot} data-status={log.status} />
                    <span className={styles.logPersona}>{log.persona}</span>
                    <span className={styles.logCategory}>{log.category}</span>
                    {log.status === 'done' && (
                      <span className={log.mentioned ? styles.logMentioned : styles.logMissed}>
                        {log.mentioned ? '✓ mentioned' : '— not mentioned'}
                      </span>
                    )}
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
