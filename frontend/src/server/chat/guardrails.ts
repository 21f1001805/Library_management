// Minimal subset of backend/src/app/modules/chat/guardrails.py — just the harmful-
// content check community moderation uses to auto-flag a new post/comment for the
// moderator queue. The rest of that file (prompt-injection/PII/off-topic checks, the
// full chat guardrail pipeline) is phase 8 (chat agent).
const HARMFUL = new RegExp(
  '\\b(' +
    'kill|murder|suicide|self.harm|bomb|weapon|explosive|poison|drug|hack|' +
    'crack|exploit|malware|ransomware|phish|ddos|doxx|stalk|rape|abuse|' +
    'terrorist|jihad|extremis|genocide|traffick|launder|counterfeit|fraud' +
    ')\\b',
  'i',
);

export function containsHarmfulContent(text: string): boolean {
  return HARMFUL.test(text);
}
