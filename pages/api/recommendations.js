import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { brand, category, competitors, score, breakdown, mentionedCount, totalPrompts } = req.body;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are an AI visibility strategist helping a brand improve how they appear in AI-generated recommendations.

Brand: ${brand}
Category: ${category}
Competitors: ${competitors.join(', ')}
Verity Score: ${score}/100
Mentioned in: ${mentionedCount}/${totalPrompts} prompts
Score breakdown: Mention rate: ${breakdown.mention}/40, First position: ${breakdown.firstPosition}/25, Sentiment: ${breakdown.sentiment}/20, Breadth: ${breakdown.breadth}/15

Generate exactly 4 specific, actionable recommendations to improve AI visibility. Each must be concrete — not generic advice.

Respond ONLY with valid JSON:
[
  {
    "title": "Short action title",
    "description": "1-2 sentence specific action",
    "impact": "high|medium|low",
    "effort": "high|medium|low",
    "category": "content|pr|seo|product"
  }
]`
      }]
    });

    const text = message.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const recommendations = JSON.parse(clean);
    return res.status(200).json({ recommendations });
  } catch (err) {
    console.error('recommendations error:', err);
    return res.status(500).json({ error: 'Failed to generate recommendations' });
  }
}
