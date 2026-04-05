import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { brand, category, competitors, country, score, breakdown, mentionedCount, totalPrompts, funnelBreakdown } = req.body;

  const funnelSummary = (funnelBreakdown || [])
    .map(s => `${s.label}: ${s.rate}% visibility (${s.mentioned}/${s.total} prompts)`)
    .join(', ');

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 900,
      messages: [{
        role: 'user',
        content: `You are an AI visibility strategist. Generate 4 specific, actionable recommendations for this brand to improve how they appear in AI-generated recommendations.

Brand: ${brand}
Category: ${category}
Country: ${country || 'India'}
Competitors: ${(competitors || []).join(', ')}
Verity Score: ${score}/100
Mentioned in: ${mentionedCount}/${totalPrompts} prompts
Funnel breakdown: ${funnelSummary}
Score components: Mention rate ${breakdown?.mention}/40, First position ${breakdown?.firstPosition}/25, Sentiment ${breakdown?.sentiment}/20, Breadth ${breakdown?.breadth}/15

Rules:
- Be SPECIFIC to this brand, category, and country — no generic advice
- Address the weakest funnel stage first if there is a clear one
- Each action must be something a marketing or content team can do in the next 2 weeks
- Reference actual channels, content types, or tactics relevant to ${category} in ${country || 'India'}

Respond ONLY with valid JSON array:
[
  {
    "title": "Short action title (max 8 words)",
    "description": "2 sentences: what to do and why it improves AI visibility specifically",
    "impact": "high|medium|low",
    "effort": "high|medium|low",
    "category": "content|pr|seo|product",
    "stage": "discovery|comparison|decision|all"
  }
]`
      }]
    });

    const text = message.content[0].text.trim().replace(/```json|```/g, '').trim();
    const recommendations = JSON.parse(text);
    return res.status(200).json({ recommendations });
  } catch (err) {
    console.error('recommendations error:', err);
    return res.status(500).json({ error: 'Failed to generate recommendations' });
  }
}
