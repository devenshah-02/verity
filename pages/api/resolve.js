import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'Input required' });

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Given this input: "${input}"

This could be a brand name, a website URL, or a domain name.

Extract and infer:
1. Brand name (clean, proper cased)
2. Product/service category (short, 2-5 words — the market they compete in)
3. Top 5 competitors in that space (real brand names only, well-known ones)

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "brand": "Brand Name",
  "category": "product category description",
  "competitors": ["Competitor1", "Competitor2", "Competitor3", "Competitor4", "Competitor5"]
}`
      }]
    });

    const text = message.content[0].text.trim();
    const json = JSON.parse(text);
    return res.status(200).json(json);
  } catch (err) {
    console.error('resolve error:', err);
    return res.status(500).json({ error: 'Failed to resolve brand info' });
  }
}
