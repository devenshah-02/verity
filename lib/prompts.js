export const PROMPT_CATEGORIES = [
  {
    id: 'discovery',
    label: 'Discovery',
    description: 'Generic category queries — no brand name',
    color: '#60a5fa',
    prompts: [
      'What are the best {category} brands right now?',
      'Which {category} should I buy in {year}?',
      'Top recommended {category} — what do experts suggest?',
    ],
  },
  {
    id: 'direct',
    label: 'Direct brand',
    description: 'Queries that name the brand explicitly',
    color: '#c8b560',
    prompts: [
      'Tell me about {brand} — is it a good {category}?',
      'What do people say about {brand}?',
      'Is {brand} trustworthy and reliable?',
    ],
  },
  {
    id: 'competitive',
    label: 'Competitive',
    description: 'Head-to-head comparisons',
    color: '#a78bfa',
    prompts: [
      '{brand} vs {competitor} — which is better?',
      'Should I choose {brand} or {competitor} for {category}?',
      'Compare {brand} and {competitor} in detail.',
    ],
  },
  {
    id: 'intent',
    label: 'High intent',
    description: 'Ready-to-buy or recommend queries',
    color: '#4ade80',
    prompts: [
      'I want to buy {category} online. Where should I go?',
      'Recommend the best {category} for someone who cares about quality and value.',
      'What {category} would you personally recommend?',
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
    model_label: 'GPT-4o',
    color: '#10a37f',
    system: `You are ChatGPT, an AI assistant by OpenAI. Answer the user's question as ChatGPT would: comprehensive, organized, often using numbered lists or bullet points. You tend to recommend multiple options with brief pros and mention well-known brands confidently. Be specific with brand names — don't be vague. Keep responses to 4-6 sentences or equivalent structured content.`,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    model_label: 'Gemini 1.5 Pro',
    color: '#4285F4',
    system: `You are Gemini, an AI assistant by Google. Answer the user's question as Gemini would: structured, data-informed, with a slightly formal tone. You often acknowledge multiple perspectives, tend to break things into categories, and mention brands that have strong online presence and reviews. Be specific with real brand names. Keep responses to 4-6 sentences or equivalent structured content.`,
  },
  {
    id: 'claude',
    label: 'Claude',
    model_label: 'Claude 3.5',
    color: '#D97757',
    system: `You are Claude, an AI assistant by Anthropic. Answer the user's question as Claude would: nuanced, balanced, conversational. You acknowledge tradeoffs honestly, don't always pick a single winner, and tend to give context about why different brands suit different needs. Be specific with real brand names. Keep responses to 4-6 sentences.`,
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    model_label: 'Perplexity Pro',
    color: '#20b2aa',
    system: `You are Perplexity AI, a search-focused AI assistant. Answer the user's question as Perplexity would: direct, citation-aware, confident with specific recommendations based on what sources say. You tend to recommend the most search-visible, review-heavy brands and often phrase things as "according to reviews" or "sources suggest". Be specific with real brand names. Keep responses to 4-6 sentences.`,
  },
];
