/**
 * Verity Score Engine v2
 * Funnel-aware scoring: Discovery → Comparison → Decision
 *
 * Score range: 0–100
 *   Mention rate     → 0–40 pts
 *   First-position   → 0–25 pts
 *   Sentiment        → 0–20 pts
 *   Breadth          → 0–15 pts
 */

export const FUNNEL_STAGES = [
  { id: 'discovery',  label: 'Discovery',  color: '#2563eb', desc: 'Consumers discovering the category for the first time' },
  { id: 'comparison', label: 'Comparison', color: '#7c3aed', desc: 'Consumers comparing options and shortlisting brands' },
  { id: 'decision',   label: 'Decision',   color: '#059669', desc: 'Consumers validating their choice before buying' },
];

export function extractMentionData(responseText, brand, competitors = []) {
  if (!responseText) return { mentioned: false, rankPosition: null, sentiment: 'absent', competitorsMentioned: [] };

  const lower = responseText.toLowerCase();
  const brandLower = brand.toLowerCase();
  const mentioned = lower.includes(brandLower);

  let rankPosition = null;
  if (mentioned) {
    const lines = responseText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(brandLower)) {
        const numMatch = lines[i].match(/^(\d+)[.\)]/);
        rankPosition = numMatch ? parseInt(numMatch[1]) : Math.floor(i / 2) + 1;
        break;
      }
    }
    if (rankPosition === null) rankPosition = 2;
  }

  const positiveSignals = ['best', 'top', 'recommend', 'excellent', 'great', 'trusted', 'popular', 'leading', 'preferred', 'strong', 'reliable', 'quality', 'worth'];
  const negativeSignals = ['avoid', 'poor', 'bad', 'overpriced', 'disappointing', 'issue', 'problem', 'complaint', 'inferior'];

  let sentiment = 'absent';
  if (mentioned) {
    const idx = lower.indexOf(brandLower);
    const window = lower.substring(Math.max(0, idx - 150), Math.min(lower.length, idx + 250));
    const posCount = positiveSignals.filter(s => window.includes(s)).length;
    const negCount = negativeSignals.filter(s => window.includes(s)).length;
    sentiment = negCount > posCount ? 'negative' : posCount > 0 ? 'positive' : 'neutral';
  }

  const competitorsMentioned = competitors.filter(c => lower.includes(c.toLowerCase().trim()));

  return { mentioned, rankPosition, sentiment, competitorsMentioned };
}

// Compute Verity Score from all results
// allResults: { [modelId]: { [promptKey]: { response, stage, ... } } }
export function computeVerityScore(allResults, brand, competitors = []) {
  const breakdown = { mention: 0, firstPosition: 0, sentiment: 0, breadth: 0 };
  let totalPrompts = 0;
  let mentionedCount = 0;
  let firstPositionCount = 0;
  let sentimentSum = 0;
  const modelsWithMention = new Set();

  Object.entries(allResults).forEach(([modelId, prompts]) => {
    Object.values(prompts).forEach(result => {
      if (!result?.response) return;
      totalPrompts++;
      const data = extractMentionData(result.response, brand, competitors);
      if (data.mentioned) {
        mentionedCount++;
        modelsWithMention.add(modelId);
        if (data.rankPosition === 1) firstPositionCount++;
        sentimentSum += data.sentiment === 'positive' ? 1 : data.sentiment === 'neutral' ? 0.5 : 0;
      }
    });
  });

  if (totalPrompts === 0) return { total: 0, breakdown, label: 'No data', mentionedCount: 0, totalPrompts: 0, modelsWithMention: [] };

  breakdown.mention = Math.round((mentionedCount / totalPrompts) * 40);
  breakdown.firstPosition = Math.round((firstPositionCount / totalPrompts) * 25);
  breakdown.sentiment = Math.round((sentimentSum / totalPrompts) * 20);
  breakdown.breadth = Math.round((modelsWithMention.size / Math.max(Object.keys(allResults).length, 1)) * 15);

  const total = Math.min(breakdown.mention + breakdown.firstPosition + breakdown.sentiment + breakdown.breadth, 100);

  let label = 'Not visible';
  if (total >= 80) label = 'Strong presence';
  else if (total >= 60) label = 'Moderate presence';
  else if (total >= 35) label = 'Weak presence';
  else if (total >= 10) label = 'Rarely mentioned';

  return { total, breakdown, label, mentionedCount, totalPrompts, modelsWithMention: [...modelsWithMention] };
}

// Per-funnel-stage score breakdown
export function computeFunnelBreakdown(allResults, brand, competitors = []) {
  const stages = { discovery: { mentioned: 0, total: 0 }, comparison: { mentioned: 0, total: 0 }, decision: { mentioned: 0, total: 0 } };

  Object.values(allResults).forEach(prompts => {
    Object.values(prompts).forEach(result => {
      if (!result?.response || !result?.stage) return;
      const stage = result.stage;
      if (!stages[stage]) return;
      stages[stage].total++;
      const data = extractMentionData(result.response, brand, competitors);
      if (data.mentioned) stages[stage].mentioned++;
    });
  });

  return Object.entries(stages).map(([id, s]) => ({
    id,
    ...FUNNEL_STAGES.find(f => f.id === id),
    mentioned: s.mentioned,
    total: s.total,
    rate: s.total > 0 ? Math.round((s.mentioned / s.total) * 100) : 0,
  }));
}

export function computeCompetitorScore(competitorName, allResults, brand, competitors) {
  let totalPrompts = 0;
  let mentionedCount = 0;
  let firstPositionCount = 0;
  let sentimentSum = 0;

  Object.values(allResults).forEach(prompts => {
    Object.values(prompts).forEach(result => {
      if (!result?.response) return;
      totalPrompts++;
      const data = extractMentionData(result.response, competitorName, [brand]);
      if (data.mentioned) {
        mentionedCount++;
        if (data.rankPosition === 1) firstPositionCount++;
        sentimentSum += data.sentiment === 'positive' ? 1 : data.sentiment === 'neutral' ? 0.5 : 0;
      }
    });
  });

  if (totalPrompts === 0) return 0;
  const s = Math.round((mentionedCount / totalPrompts) * 40)
    + Math.round((firstPositionCount / totalPrompts) * 25)
    + Math.round((sentimentSum / totalPrompts) * 20)
    + 10;
  return Math.min(s, 100);
}
