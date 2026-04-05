import { useState } from 'react';
import styles from '../styles/RateLimitModal.module.css';

export default function RateLimitModal({ resetAt, onClose }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | done | error
  const [errorMsg, setErrorMsg] = useState('');

  const resetTime = resetAt
    ? new Date(resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'tomorrow';

  async function handleSubmit() {
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Failed');
      setStatus('done');
    } catch (e) {
      setErrorMsg('Something went wrong. Try again.');
      setStatus('idle');
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>

        <div className={styles.iconWrap}>
          <div className={styles.icon}>⏱</div>
        </div>

        {status !== 'done' ? (
          <>
            <h2 className={styles.title}>You've used your free scans for today</h2>
            <p className={styles.sub}>
              You get <strong>10 free scans per day</strong>. Your limit resets at <strong>{resetTime}</strong>.
            </p>

            <div className={styles.divider}>
              <span>Want unlimited scans?</span>
            </div>

            <p className={styles.proTeaser}>
              Verity Pro is coming — unlimited scans, scheduled monitoring, full competitor tracking, and real OpenAI integration. Drop your email and we'll notify you first.
            </p>

            <div className={styles.inputRow}>
              <input
                className={styles.emailInput}
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoFocus
              />
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? '...' : 'Notify me →'}
              </button>
            </div>

            {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

            <button className={styles.skipBtn} onClick={onClose}>
              I'll wait until {resetTime}
            </button>
          </>
        ) : (
          <>
            <h2 className={styles.title}>You're on the list 🎉</h2>
            <p className={styles.sub}>
              We'll email you the moment Verity Pro launches. Your scans reset at <strong>{resetTime}</strong>.
            </p>
            <button className={styles.doneBtn} onClick={onClose}>Got it</button>
          </>
        )}
      </div>
    </div>
  );
}
