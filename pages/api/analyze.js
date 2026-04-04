import Anthropic from '@anthropic-ai/sdk';
import { AI_PERSONAS } from '../../lib/prompts';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { personaId, prompt } = req.body;
  if (!personaId || !prompt) return res.status(400).json({ error: 'personaId and prompt required' });

  const persona = AI_PERSONAS.find(p => p.id === personaId);
  if (!persona) return res.status(400).json({ error: 'Unknown persona' });

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      system: persona.system,
      messages: [{ role: 'user', content: prompt }]
    });

    return res.status(200).json({ response: message.content[0].text });
  } catch (err) {
    console.error('analyze error:', err);
    return res.status(500).json({ error: 'API call failed', detail: err.message });
  }
}
