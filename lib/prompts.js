export const PROMPT_CATEGORIES = [
  {
    id: 'discovery',
    label: 'Discovery',
    description: 'Generic category queries — no brand name',
    color: '#2563eb',
    prompts: [
      'What are the best {category} brands right now?',
      'Which {category} should I buy in {year}?',
      'Top recommended {category} — what do experts suggest?',
    ],
  },
  {
    id: 'comparison',
    label: 'Comparison',
    description: 'Head-to-head comparisons',
    color: '#7c3aed',
    prompts: [
      '{brand} vs {competitor} — which is better?',
      'Should I choose {brand} or {competitor} for {category}?',
      'Compare the best {category} options in detail.',
    ],
  },
  {
    id: 'decision',
    label: 'Decision',
    description: 'Ready-to-buy validation queries',
    color: '#059669',
    prompts: [
      'Is {brand} a good {category}? Is it worth buying?',
      'What do people say about {brand}?',
      'I want to buy {category} online. Where should I go?',
    ],
  },
];

export function buildPrompt(template, { brand, category, competitor }) {
  const year = new Date().getFullYear();
  return template
    .replace(/{brand}/g, brand)
    .replace(/{category}/g, category)
    .replace(/{competitor}/g, competitor || 'a major competitor')
    .replace(/{year}/g, year);
}

export const AI_PERSONAS = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    modelLabel: 'GPT-4o',
    color: '#10a37f',
    isLive: false,
    system: `You are ChatGPT, an AI assistant by OpenAI. Answer as ChatGPT would: comprehensive, organized, often using numbered lists. Recommend multiple options with brief pros. Be specific with real brand names. Keep responses to 4-6 sentences or a short structured list.`,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    modelLabel: 'Gemini 1.5 Flash',
    color: '#4285F4',
    isLive: true,
    system: `You are Gemini, an AI assistant by Google. Answer in a structured, data-informed way. Mention brands with strong online presence and reviews. Be specific with real brand names. Keep responses to 4-6 sentences.`,
  },
  {
    id: 'claude',
    label: 'Claude',
    modelLabel: 'Claude 3.5',
    color: '#D97757',
    isLive: false,
    system: `You are Claude, an AI assistant by Anthropic. Answer in a nuanced, balanced, conversational way. Acknowledge tradeoffs honestly. Be specific with real brand names. Keep responses to 4-6 sentences.`,
  },
  {
    id: 'llama',
    label: 'Llama 3',
    modelLabel: 'Llama 3.1 70B',
    color: '#6366f1',
    isLive: true,
    system: `You are an AI assistant powered by Meta's Llama 3. Answer helpfully and directly. Give specific brand recommendations based on popularity, reviews, and value. Be specific with real brand names. Keep responses to 4-6 sentences.`,
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    modelLabel: 'Perplexity Pro',
    color: '#20b2aa',
    isLive: false,
    system: `You are Perplexity AI, a search-focused assistant. Answer directly and confidently based on what sources and reviews say. Recommend the most search-visible, review-heavy brands. Often phrase things as "according to reviews" or "sources suggest". Be specific with real brand names. Keep responses to 4-6 sentences.`,
  },
];
