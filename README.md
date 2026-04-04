# Verity — AI Brand Visibility Intelligence

> See how AI recommends your brand. Measure, benchmark, and improve your presence across ChatGPT, Gemini, Claude, and Perplexity.

![Verity](https://img.shields.io/badge/Next.js-14-black) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## What is Verity?

Verity scans AI models to answer one critical question: **Why is my competitor showing up in AI recommendations — and I'm not?**

It runs structured prompt categories across simulated AI personas (ChatGPT, Gemini, Claude, Perplexity), analyzes brand mentions, computes a **Verity Score (0–100)**, benchmarks against competitors, and delivers actionable recommendations.

---

## Features

- **URL or brand name input** — paste your website URL, Verity infers your brand, category, and top competitors automatically
- **AI Visibility Score** — 0–100 composite score across mention rate, first-position rate, sentiment, and AI breadth
- **4 prompt categories** — Discovery, Direct brand, Competitive, High intent
- **4 AI personas** — ChatGPT, Gemini, Claude, Perplexity (powered by Claude API with tuned system prompts)
- **Competitor auto-discovery** — Verity finds your top competitors; you review and adjust
- **Competitor benchmarking** — side-by-side score comparison
- **Action plan** — 4 AI-generated, specific recommendations to improve visibility
- **Real-time scan log** — live progress as each prompt runs

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/your-username/verity.git
cd verity
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Get your API key at [console.anthropic.com](https://console.anthropic.com)

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### Option A: One-click (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add environment variable: `ANTHROPIC_API_KEY`
4. Click Deploy

### Option B: Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. Add your `ANTHROPIC_API_KEY` in the Vercel dashboard under **Settings → Environment Variables**.

---

## Project Structure

```
verity/
├── pages/
│   ├── index.js          # Main onboarding flow (Input → Confirm → Scan)
│   ├── _app.js           # App wrapper
│   └── api/
│       ├── resolve.js    # Brand/URL → brand name + category + competitors
│       ├── analyze.js    # Run a single prompt against one AI persona
│       └── recommendations.js  # Generate action plan from scan results
├── components/
│   └── Dashboard.js      # Full results dashboard
├── lib/
│   ├── prompts.js        # Prompt templates + AI persona definitions
│   └── scoring.js        # Verity Score computation engine
├── styles/
│   ├── globals.css       # Design tokens + global styles
│   ├── Home.module.css   # Onboarding page styles
│   └── Dashboard.module.css  # Dashboard styles
└── .env.example          # Environment variable template
```

---

## Verity Score Methodology

| Component | Weight | Description |
|-----------|--------|-------------|
| Mention rate | 40 pts | How often brand appears across all prompts |
| First position | 25 pts | How often brand is recommended first |
| Sentiment | 20 pts | Positive vs neutral vs negative framing |
| AI breadth | 15 pts | Mentioned across multiple AI models |

---

## Roadmap (P1)

- [ ] Historical tracking — store runs and show score trends over time
- [ ] Scheduled monitoring — weekly auto-runs with email summaries
- [ ] Custom prompt library — add your own prompts
- [ ] Real API integration — plug in actual OpenAI + Gemini keys
- [ ] Source intelligence — which sources (Reddit, blogs, reviews) influence AI answers
- [ ] Score alerts — notify when score drops or competitor rises

---

## Tech Stack

- **Framework**: Next.js 14 (App Router compatible)
- **AI**: Anthropic Claude API (`claude-opus-4-5`)
- **Styling**: CSS Modules (zero dependencies)
- **Hosting**: Vercel
- **Fonts**: DM Serif Display + DM Sans (Google Fonts)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |

---

## License

MIT
