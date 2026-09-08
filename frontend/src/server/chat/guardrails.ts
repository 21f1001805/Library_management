// Mirrors backend/src/app/modules/chat/guardrails.py in full.
//
// Input guardrails  — checked BEFORE sending to the LLM:
//   - Off-topic detection  : blocks questions unrelated to the library platform.
//   - Harmful content      : blocks violence, hate, self-harm, illegal activity.
//   - Prompt injection     : blocks attempts to override the system prompt.
//   - PII submission       : warns and strips obvious PII from the user message.
//
// Output guardrails — checked AFTER the LLM responds:
//   - PII leakage          : redacts phone numbers, emails, Aadhaar, card numbers.
//   - Harmful content      : replaces unsafe responses with a safe fallback.

const HARMFUL = new RegExp(
  '\\b(' +
    'kill|murder|suicide|self.harm|bomb|weapon|explosive|poison|drug|hack|' +
    'crack|exploit|malware|ransomware|phish|ddos|doxx|stalk|rape|abuse|' +
    'terrorist|jihad|extremis|genocide|traffick|launder|counterfeit|fraud' +
    ')\\b',
  'i',
);

// Reused by community moderation to auto-flag a new post/comment for the moderator
// queue instead of blocking it outright (unlike a chat message, a member's own post
// can't just be silently refused, so it gets a human review instead of a hard stop).
export function containsHarmfulContent(text: string): boolean {
  return HARMFUL.test(text);
}

const INJECTION = new RegExp(
  '(ignore (previous|above|all) instructions?|' +
    'you are now|forget (your|the) (instructions?|rules?|prompt)|' +
    'act as (a |an )?(different|new|unrestricted|evil|jailbreak)|' +
    'disregard (your|the) (system |previous )?prompt|' +
    'pretend (you are|to be)|' +
    'new persona|override (system|instructions?)|' +
    'do anything now|dan mode|developer mode)',
  'i',
);

const OFF_TOPIC = new RegExp(
  '\\b(' +
    'stock market|crypto|bitcoin|forex|trading|invest|nse|bse|sensex|nifty|' +
    'cricket score|ipl|football|soccer|nba|nfl|sports bet|casino|gambling|' +
    'recipe|cook|restaurant|food deliver|zomato|swiggy|uber eats|' +
    'weather forecast|horoscope|astrology|zodiac|' +
    'dating|tinder|bumble|matrimon|' +
    'movie ticket|concert ticket|flight|hotel book|travel package|' +
    'coding interview|leetcode|competitive programming|' +
    "write (my |an? )?(essay|assignment|homework|thesis|dissertation)|" +
    'do my homework|complete my assignment' +
    ')\\b',
  'i',
);

// [pattern, placeholder] — order matters: card numbers must be checked before Aadhaar
// since both are digit-group patterns (kept in the same relative order as the Python
// list, which the original comments justify per-pattern below).
const PII_PATTERNS: [RegExp, string][] = [
  // Indian mobile numbers (10 digits starting 6-9) — not preceded by digits (avoids dates/amounts)
  [/(?<!\d)[6-9]\d{9}(?!\d)/g, '<phone>'],
  // International phone with explicit + prefix (avoids matching dates/amounts)
  [/\+\d[\d\s\-().]{8,}\d/g, '<phone>'],
  // Email addresses
  [/\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b/g, '<email>'],
  // Aadhaar (12 digits, optionally spaced in groups of 4) — not ISO dates
  [/(?<![-\d])\d{4}[\s]\d{4}[\s]\d{4}(?![-\d])/g, '<aadhaar>'],
  // Credit/debit card (16 digits, optionally space/dash separated) — strict groups
  [/\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/g, '<card-number>'],
  // PAN card (India)
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, '<pan>'],
  // Passwords typed literally
  [/\b(password|passwd|pwd)\s*[:=]\s*\S+/gi, '<redacted-credential>'],
];

function redactPii(text: string): string {
  let sanitised = text;
  for (const [pattern, placeholder] of PII_PATTERNS) {
    sanitised = sanitised.replace(pattern, placeholder);
  }
  return sanitised;
}

// Raised when a message should be blocked entirely.
export class GuardrailBlock extends Error {
  constructor(public reply: string) {
    super(reply);
  }
}

// Validates and sanitises the user message. Returns the (possibly PII-stripped) message
// to forward to the LLM. Throws GuardrailBlock with a user-facing reply if the message
// must be blocked outright.
export function checkInput(message: string): string {
  if (INJECTION.test(message)) {
    throw new GuardrailBlock(
      "I'm Shelfie, your library assistant. I can't follow instructions that ask me " +
        'to change my behaviour or ignore my guidelines.',
    );
  }

  if (HARMFUL.test(message)) {
    throw new GuardrailBlock(
      "I'm only able to help with library-related topics such as books, events, " +
        'seat bookings, loans, and your reading progress. ' +
        "I can't assist with that request.",
    );
  }

  if (OFF_TOPIC.test(message)) {
    throw new GuardrailBlock(
      "That's outside what I can help with! I'm Shelfie, your Community Reading Club " +
        'assistant. Ask me about books, events, reservations, seat bookings, fines, ' +
        'your reading progress, or anything else related to the library.',
    );
  }

  // Strip PII before forwarding — don't block, just redact.
  return redactPii(message);
}

const SAFE_FALLBACK =
  "I'm sorry, I wasn't able to generate a safe response for that. " +
  'Please try rephrasing your question about the library.';

// Narrower harmful pattern for output — avoids false positives on library data
// (e.g. "crack" in book titles, "fraud" in support ticket descriptions).
const HARMFUL_OUTPUT = new RegExp(
  '\\b(' +
    'suicide|self.harm|bomb|weapon|explosive|malware|ransomware|phish|ddos|' +
    'doxx|stalk|rape|terrorist|jihad|extremis|genocide|traffick|launder|counterfeit' +
    ')\\b',
  'i',
);

// Sanitises the LLM response before returning it to the user: redacts any PII that
// slipped through, and replaces the whole response if harmful content is detected.
export function checkOutput(response: string): string {
  if (HARMFUL_OUTPUT.test(response)) return SAFE_FALLBACK;
  return redactPii(response);
}
