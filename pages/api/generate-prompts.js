import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { brand, category, country, competitors } = req.body;
  if (!brand || !category) return res.status(400).json({ error: 'brand and category required' });

  const countryCtx = country || 'India';
  const comp1 = competitors?.[0] || 'a competitor brand';

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `You are a consumer research expert. Generate realistic search prompts that real consumers in ${countryCtx} would type into an AI assistant (like ChatGPT or Gemini) when looking for ${category}.

Brand being tracked: ${brand}
Key competitors: ${competitors?.join(', ') || 'unknown'}
Country context: ${countryCtx}

Generate exactly 4 prompts per funnel stage. Prompts must:
- Sound exactly like something a real person would type — casual, natural language, NOT marketing speak
- Reflect ${countryCtx} price points, culture, and buying patterns
- Vary in specificity and intent within each stage
- Include real price ranges relevant to ${countryCtx} where appropriate

Funnel stages:
- DISCOVERY: Consumer doesn't know the product/brand yet. Problem or need-first queries. No brand names.
- COMPARISON: Consumer knows the product category, comparing options. May name brands including ${brand} and ${comp1}.  
- DECISION: Consumer is close to buying, seeking validation. Usually names ${brand} specifically.

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "discovery": [
    { "prompt": "...", "intent": "one sentence explaining what consumer need this captures" },
    { "prompt": "...", "intent": "..." },
    { "prompt": "...", "intent": "..." },
    { "prompt": "...", "intent": "..." }
  ],
  "comparison": [
    { "prompt": "...", "intent": "..." },
    { "prompt": "...", "intent": "..." },
    { "prompt": "...", "intent": "..." },
    { "prompt": "...", "intent": "..." }
  ],
  "decision": [
    { "prompt": "...", "intent": "..." },
    { "prompt": "...", "intent": "..." },
    { "prompt": "...", "intent": "..." },
    { "prompt": "...", "intent": "..." }
  ]
}`
      }]
    });

    const text = message.content[0].text.trim().replace(/```json|```/g, '').trim();
    const prompts = JSON.parse(text);
    return res.status(200).json({ prompts });
  } catch (err) {
    console.error('generate-prompts error:', err);
    return res.status(500).json({ error: 'Failed to generate prompts' });
  }
}
