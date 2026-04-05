import Anthropic from '@anthropic-ai/sdk';
import { AI_PERSONAS } from '../../lib/prompts';
import { checkRateLimit, getClientIp } from '../../lib/rateLimit';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── REAL: Gemini 1.5 Flash (free tier) ──────────────────────────────────────
async function callGemini(prompt, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── REAL: Groq Llama 3.1 (free tier) ────────────────────────────────────────
async function callGroq(prompt, systemPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 600,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── SIMULATED: Claude with persona prompt ────────────────────────────────────
async function callClaude(prompt, systemPrompt) {
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text;
}

// ── ROUTER ───────────────────────────────────────────────────────────────────
async function runOne(task) {
  const persona = AI_PERSONAS.find(p => p.id === task.personaId);
  if (!persona) throw new Error('Unknown persona');

  switch (task.personaId) {
    case 'gemini':
      return await callGemini(task.prompt, persona.system);
    case 'llama':
      return await callGroq(task.prompt, persona.system);
    default:
      return await callClaude(task.prompt, persona.system);
  }
}

// ── HANDLER ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit check — only on scan initiation (tasks array present)
  const ip = getClientIp(req);
  const limit = checkRateLimit(ip);

  if (!limit.allowed) {
    return res.status(429).json({
      error: 'rate_limited',
      message: "You've used all your free scans for today.",
      resetAt: limit.resetAt,
      total: limit.total,
    });
  }

  const { tasks } = req.body;
  if (!tasks || !Array.isArray(tasks)) {
    return res.status(400).json({ error: 'tasks array required' });
  }

  // Fire all in parallel
  const settled = await Promise.allSettled(tasks.map(task => runOne(task)));

  const results = tasks.map((task, i) => {
    const outcome = settled[i];
    return {
      personaId: task.personaId,
      promptId: task.promptId,
      promptLabel: task.promptLabel,
      prompt: task.prompt,
      intent: task.intent,
      stage: task.stage,
      categoryColor: task.categoryColor,
      response: outcome.status === 'fulfilled' ? outcome.value : '',
      error: outcome.status === 'rejected' ? outcome.reason?.message : null,
    };
  });

  return res.status(200).json({
    results,
    rateLimit: { remaining: limit.remaining, total: limit.total, resetAt: limit.resetAt },
  });
}

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };
