/**
 * Verity Score Engine
 * Score range: 0–100
 * Components:
 *   Mention rate     → 0–40 pts  (was the brand mentioned at all?)
 *   First-position   → 0–25 pts  (was it the first brand recommended?)
 *   Sentiment        → 0–20 pts  (positive/neutral/negative framing)
 *   Breadth          → 0–15 pts  (mentioned across multiple AI models)
 */

export function extractMentionData(responseText, brand, competitors = []) {
  const lower = responseText.toLowerCase();
  const brandLower = brand.toLowerCase();

  const mentioned = lower.includes(brandLower);

  // Estimate rank position by finding first numbered list item containing the brand
  let rankPosition = null;
  if (mentioned) {
    const lines = responseText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(brandLower)) {
        // Check if this is a numbered item
        const numMatch = lines[i].match(/^(\d+)[.\)]/);
        if (numMatch) {
          rankPosition = parseInt(numMatch[1]);
        } else {
          // Not numbered, estimate based on paragraph position
          rankPosition = i === 0 ? 1 : Math.floor(i / 2) + 1;
        }
        break;
      }
    }
    if (rankPosition === null) rankPosition = 2; // mentioned but not in list → assume mid
  }

  // Sentiment analysis
  const positiveSignals = ['best', 'top', 'recommend', 'excellent', 'great', 'trusted', 'popular', 'leading', 'preferred', 'strong'];
  const negativeSignals = ['avoid', 'poor', 'bad', 'overpriced', 'disappointing', 'issue', 'problem', 'complaint'];

  let sentiment = 'absent';
  if (mentioned) {
    // Look in a window around the brand mention
    const idx = lower.indexOf(brandLower);
    const window = lower.substring(Math.max(0, idx - 100), Math.min(lower.length, idx + 200));
    const posCount = positiveSignals.filter(s => window.includes(s)).length;
    const negCount = negativeSignals.filter(s => window.includes(s)).length;
    if (negCount > posCount) sentiment = 'negative';
    else if (posCount > 0) sentiment = 'positive';
    else sentiment = 'neutral';
  }

  // Competitor mentions
  const competitorsMentioned = competitors.filter(c =>
    lower.includes(c.toLowerCase().trim())
  );

  return { mentioned, rankPosition, sentiment, competitorsMentioned };
}

export function computeVerityScore(allResults, brand, competitors = []) {
  // allResults: { [modelId]: { [promptId]: { response, promptLabel, category } } }
  const breakdown = { mention: 0, firstPosition: 0, sentiment: 0, breadth: 0 };

  let totalPrompts = 0;
  let mentionedCount = 0;
  let firstPositionCount = 0;
  let sentimentSum = 0;
  const modelsWithMention = new Set();

  Object.entries(allResults).forEach(([modelId, prompts]) => {
    Object.values(prompts).forEach(result => {
      if (!result.response) return;
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

  if (totalPrompts === 0) return { total: 0, breakdown, label: 'No data' };

  breakdown.mention = Math.round((mentionedCount / totalPrompts) * 40);
  breakdown.firstPosition = Math.round((firstPositionCount / totalPrompts) * 25);
  breakdown.sentiment = totalPrompts > 0 ? Math.round((sentimentSum / totalPrompts) * 20) : 0;
  breakdown.breadth = Math.round((modelsWithMention.size / Object.keys(allResults).length) * 15);

  const total = breakdown.mention + breakdown.firstPosition + breakdown.sentiment + breakdown.breadth;

  let label = 'Not visible';
  if (total >= 80) label = 'Strong presence';
  else if (total >= 60) label = 'Moderate presence';
  else if (total >= 35) label = 'Weak presence';
  else if (total >= 10) label = 'Rarely mentioned';

  return { total, breakdown, label, mentionedCount, totalPrompts, modelsWithMention: [...modelsWithMention] };
}

export function computeCompetitorScore(competitorName, allResults, brand, competitors) {
  // Build fake allResults for a competitor by checking how often they appear in responses
  let totalPrompts = 0;
  let mentionedCount = 0;
  let firstPositionCount = 0;
  let sentimentSum = 0;

  Object.values(allResults).forEach(prompts => {
    Object.values(prompts).forEach(result => {
      if (!result.response) return;
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

  const s =
    Math.round((mentionedCount / totalPrompts) * 40) +
    Math.round((firstPositionCount / totalPrompts) * 25) +
    (totalPrompts > 0 ? Math.round((sentimentSum / totalPrompts) * 20) : 0) +
    10; // assume some breadth

  return Math.min(s, 100);
}
