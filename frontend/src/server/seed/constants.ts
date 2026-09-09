// Shared templates/lists used by seedDemoData.ts and seedDailyRefresh.ts — extracted
// once so nothing drifts between the two, mirroring Python's actual cross-import
// (seed_daily_refresh.py does `from seed_demo_data import REVIEW_TEMPLATES,
// SUPPORT_DESCRIPTIONS` today).

export const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan',
  'Rohan', 'Kabir', 'Aryan', 'Dev', 'Yash', 'Karan', 'Nikhil', 'Ananya', 'Diya', 'Saanvi',
  'Aadhya', 'Kavya', 'Myra', 'Anika', 'Ira', 'Riya', 'Priya', 'Neha', 'Pooja', 'Sneha',
  'Meera', 'Isha', 'Tara', 'Rahul', 'Amit', 'Vikram', 'Sanjay', 'Rajesh', 'Suresh',
  'Manoj', 'Deepak',
];

export const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Reddy', 'Rao', 'Iyer', 'Nair',
  'Menon', 'Joshi', 'Mehta', 'Shah', 'Desai', 'Kapoor', 'Malhotra', 'Chopra', 'Bose',
  'Banerjee', 'Mukherjee', 'Chatterjee', 'Das', 'Ghosh', 'Agarwal', 'Bansal', 'Jain',
  'Saxena', 'Tiwari', 'Pandey',
];

export const POST_TEMPLATES = [
  "Just finished {title} — what a ride! Highly recommend to anyone who loves this genre.",
  'Currently halfway through {title}. The pacing is incredible so far.',
  'Does anyone else think {title} deserves more attention? Underrated gem.',
  'Started a new reading challenge this month — {title} is book #1!',
  'Book club pick for this month: {title}. Discussion thread below.',
  'Re-reading {title} for the third time and still finding new details.',
];

export const COMMENT_TEMPLATES = [
  'Totally agree, loved this one too!',
  'Adding this to my to-read list right now.',
  'The ending really surprised me.',
  'Great pick, thanks for sharing.',
  'I had a different take but respect the perspective.',
  'This is one of my all-time favorites.',
];

export const REVIEW_TEMPLATES = [
  "A gripping read from start to finish — couldn't put it down.",
  'Solid story, though the middle dragged a little for me.',
  "One of the best books I've borrowed from this library so far.",
  'Enjoyed the character development, would recommend.',
  'Not quite what I expected, but still a worthwhile read.',
  'Beautifully written. Already looking forward to a re-read.',
];

export const SUPPORT_DESCRIPTIONS: Record<string, string> = {
  book_reservation:
    "My reservation queue position hasn't updated in several days, can someone check?",
  payment: 'I was charged but my membership status still shows as inactive.',
  seat_booking: "I couldn't cancel my seat booking from the app, it just keeps loading.",
  harassment: 'Another member has been repeatedly leaving inappropriate comments on my posts.',
  offline_library: 'The library was closed during posted opening hours yesterday.',
  attendance: "The check-in system didn't register my child's visit today.",
  other: 'Just a general question about how the membership renewal process works.',
};

export const PERMISSION_REASONS = [
  'Need to approve fine waivers directly for walk-in members without escalating each time.',
  'Requesting access to override the seat booking limit during exam season.',
  'Would like permission to issue books for members with an outstanding balance under review.',
  'Need elevated access to manage the book procurement queue this quarter.',
];

export const EXTRA_EVENT_TITLES = [
  'New Arrivals Showcase',
  'Weekend Writing Workshop',
  'Teen Book Swap',
  'Classic Literature Circle',
  'Local Author Meet & Greet',
  'Study Skills & Speed Reading Session',
];

// First-generation multilingual posts were one-liners — read as obviously generated.
// Deleted outright by seedDailyRefresh.ts and replaced with HUMANIZED_POST_TEMPLATES
// below, since they're brand new with zero real comments/likes on them yet.
export const RETIRED_SHORT_POST_TEMPLATES = [
  '{title} ਹੁਣੇ ਖਤਮ ਕੀਤੀ — ਬਹੁਤ ਵਧੀਆ ਕਿਤਾਬ ਸੀ! ਸਾਰਿਆਂ ਨੂੰ ਪੜ੍ਹਨ ਦੀ ਸਲਾਹ ਦਿੰਦਾ ਹਾਂ।',
  'ਇਸ ਮਹੀਨੇ ਦੀ ਬੁੱਕ ਕਲੱਬ ਚੋਣ: {title}। ਹੇਠਾਂ ਆਪਣੇ ਵਿਚਾਰ ਸਾਂਝੇ ਕਰੋ।',
  '{title} ಓದಿ ಮುಗಿಸಿದೆ — ಅದ್ಭುತ ಪುಸ್ತಕ! ಎಲ್ಲರಿಗೂ ಶಿಫಾರಸು ಮಾಡುತ್ತೇನೆ.',
  '{title} ಪುಸ್ತಕವನ್ನು ಮತ್ತೊಮ್ಮೆ ಓದುತ್ತಿದ್ದೇನೆ, ಇನ್ನೂ ಹೊಸ ಸಂಗತಿಗಳು ಸಿಗುತ್ತಿವೆ.',
  '{title} படித்து முடித்தேன் — மிகவும் அருமையான புத்தகம்! அனைவருக்கும் பரிந்துரைக்கிறேன்.',
  'இந்த மாத புத்தக கிளப் தேர்வு: {title}. கீழே உங்கள் கருத்துகளைப் பகிரவும்.',
  '{title} नुकतेच वाचून पूर्ण केले — खूप छान पुस्तक होते! सर्वांना वाचण्याची शिफारस करतो.',
  'या महिन्याची बुक क्लब निवड: {title}. खाली तुमचे विचार मांडा.',
  '{title} अभी-अभी पूरी की — बहुत ही शानदार किताब थी! सभी को पढ़ने की सलाह देता हूं।',
  '{title} বইটি এইমাত্র শেষ করলাম — দারুণ বই! সবাইকে পড়ার পরামর্শ দিচ্ছি।',
  '{title} పుస్తకం చదవడం పూర్తి చేశాను — చాలా బాగుంది! అందరికీ సిఫారసు చేస్తున్నాను.',
  '{title} വായിച്ചു തീർത്തു — വളരെ നല്ല പുസ്തകം! എല്ലാവരോടും ശുപാർശ ചെയ്യുന്നു.',
];

// (language, template) — "{title}" is filled in from a fixed book/member per template
// (not randomized) so the resulting content string is deterministic and can be checked
// for exact existence, the same one-time-only idempotency style as the rest of this
// codebase's seed scripts. Long-form and first-person on purpose — a specific moment, an
// honest complaint, a feeling — instead of generic one-line praise, which is what read
// as AI-written.
export const HUMANIZED_POST_TEMPLATES: [string, string][] = [
  [
    'English',
    "I picked up {title} on a whim because the cover caught my eye at the return desk, and I honestly wasn't expecting to get hooked the way I did. I ended up reading half of it in one sitting on a Sunday afternoon, ignoring three text messages and a cup of tea going cold beside me. The middle section dragged a little, if I'm being honest, but the ending completely made up for it. If anyone else here has read it, I'd love to talk about that last chapter — I'm still thinking about it two days later.",
  ],
  [
    'English',
    "Not going to lie, {title} sat on my nightstand for almost a month before I actually opened it — work had me exhausted and reading felt like one more thing on the to-do list. But once I started, I couldn't put it down. There's a scene about halfway through that genuinely caught me off guard on the metro, which was mildly embarrassing but also kind of nice. It's rare a book makes me feel something that strongly. Borrowing it from here was honestly one of the better decisions I've made this month.",
  ],
  [
    'English',
    "My book club picked {title} for this month and I'll admit I went in with low expectations, since the last two picks weren't really my thing. This one surprised me. The characters felt real in a way that's hard to describe — flawed, a little annoying sometimes, but real. We're meeting this weekend to discuss it and I already have a list of questions I want to bring up, especially about how the story wraps up. Curious what everyone else here made of it.",
  ],
  [
    'English',
    "Finished {title} late last night and immediately regretted staying up, since I had work in a few hours, but zero regrets about the book itself. It's the kind of story that sneaks up on you — nothing feels particularly dramatic chapter by chapter, and then suddenly you're emotionally wrecked by page two hundred and not entirely sure how you got there. Already thinking about who I can lend my next pick to so we can talk about this one properly.",
  ],
  [
    'English',
    "A friend recommended {title} to me weeks ago and I finally got around to borrowing it last weekend, mostly because I'd run out of other things on my list. I wasn't prepared for how much it would stick with me. There's a subplot involving a secondary character that I actually think might be my favorite part of the whole book, which isn't something I expected going in. Already planning to pass the recommendation along to at least two other people I know.",
  ],
  [
    'English',
    "I read {title} mostly on my daily commute, a few pages at a time squeezed in between stops, which honestly isn't the ideal way to experience a book like this but it's what I had. Even in short bursts it managed to pull me in every single time I opened it. By the last week I was deliberately taking the longer route home just to get a few extra pages in. Worth every minute, even the ones I probably should've spent doing something else.",
  ],
  [
    'English',
    "It rained pretty much the entire weekend, so I curled up with {title} and didn't leave the couch for most of Saturday. That's usually a sign a book is doing something right, and this one definitely was. A couple of the plot choices near the middle felt a little convenient, if I'm nitpicking, but I was too invested by that point to actually mind. Would happily read it again on the next rainy weekend that comes along.",
  ],
  [
    'English',
    "My younger sibling kept insisting I read {title}, and after putting it off for way too long I finally borrowed a copy last week. We've been texting back and forth about it ever since, comparing notes on which parts hit hardest. It's rare that we actually agree on a book this much. If anyone else here has read it, I'm curious whether you saw the ending coming, because we definitely didn't.",
  ],
  [
    'Punjabi',
    '{title} ਮੈਂ ਪਿਛਲੇ ਹਫ਼ਤੇ ਪੜ੍ਹਨੀ ਸ਼ੁਰੂ ਕੀਤੀ ਸੀ, ਬਸ ਐਵੇਂ ਹੀ, ਬਿਨਾਂ ਕੋਈ ਖਾਸ ਉਮੀਦ ਰੱਖੇ। ਪਰ ਪਹਿਲੇ ਕੁਝ ਸਫ਼ਿਆਂ ਤੋਂ ਬਾਅਦ ਹੀ ਮੈਨੂੰ ਲੱਗਾ ਕਿ ਇਹ ਕਿਤਾਬ ਵੱਖਰੀ ਹੈ। ਇੱਕ ਰਾਤ ਤਾਂ ਮੈਂ ਸੌਣਾ ਹੀ ਭੁੱਲ ਗਿਆ, ਬੱਸ ਪੜ੍ਹਦਾ ਹੀ ਰਿਹਾ ਕਿਉਂਕਿ ਕਹਾਣੀ ਛੱਡਣ ਦਾ ਦਿਲ ਨਹੀਂ ਕਰ ਰਿਹਾ ਸੀ। ਵਿਚਕਾਰ ਥੋੜ੍ਹਾ ਹੌਲੀ ਲੱਗੀ, ਪਰ ਅੰਤ ਪੜ੍ਹ ਕੇ ਸੱਚੀਂ ਅੱਖਾਂ ਵਿੱਚ ਪਾਣੀ ਆ ਗਿਆ, ਇਹ ਮੰਨਣ ਵਿੱਚ ਕੋਈ ਸ਼ਰਮ ਨਹੀਂ। ਇਸ ਕਹਾਣੀ ਦੇ ਮੁੱਖ ਕਿਰਦਾਰ ਨੇ ਜੋ ਫ਼ੈਸਲੇ ਲਏ, ਉਹ ਹਾਲੇ ਵੀ ਦਿਮਾਗ਼ ਵਿੱਚ ਘੁੰਮ ਰਹੇ ਹਨ। ਜੇ ਕਿਸੇ ਹੋਰ ਨੇ ਵੀ ਪੜ੍ਹੀ ਹੈ, ਮੈਨੂੰ ਦੱਸਿਓ, ਗੱਲ ਕਰਨੀ ਹੈ ਇਸ ਬਾਰੇ।',
  ],
  [
    'Kannada',
    '{title} ಪುಸ್ತಕವನ್ನು ನಾನು ಗ್ರಂಥಾಲಯದಿಂದ ತೆಗೆದುಕೊಂಡಾಗ ಅಷ್ಟೇನೂ ನಿರೀಕ್ಷೆ ಇರಲಿಲ್ಲ, ಸುಮ್ಮನೆ ಸಮಯ ಕಳೆಯಲು ಎಂದು ಶುರು ಮಾಡಿದೆ. ಆದರೆ ಮೊದಲ ಅಧ್ಯಾಯದ ನಂತರವೇ ಪುಸ್ತಕ ಬಿಡಲು ಮನಸ್ಸಾಗಲಿಲ್ಲ. ಆಫೀಸಿನಲ್ಲಿ ಕೂಡ ಮನಸ್ಸು ಈ ಕಥೆಯ ಕಡೆಗೆ ಹೋಗುತ್ತಿತ್ತು, ಮನೆಗೆ ಬಂದ ತಕ್ಷಣ ಮತ್ತೆ ಓದಲು ಕುಳಿತುಕೊಳ್ಳುತ್ತಿದ್ದೆ. ಕೊನೆಯ ಪುಟಗಳಂತೂ ನನ್ನನ್ನು ನಿಜವಾಗಿಯೂ ಭಾವುಕನನ್ನಾಗಿ ಮಾಡಿದವು, ಕಣ್ಣಲ್ಲಿ ನೀರೂ ಬಂತು ಎಂದು ಒಪ್ಪಿಕೊಳ್ಳುತ್ತೇನೆ. ಇಂತಹ ಪುಸ್ತಕಗಳು ಸಿಗುವುದು ಅಪರೂಪ, ಈ ಗ್ರಂಥಾಲಯದಲ್ಲಿ ಸಿಕ್ಕಿದ್ದಕ್ಕೆ ತುಂಬಾ ಖುಷಿಯಾಗಿದೆ. ಯಾರಾದರೂ ಓದಿದ್ದರೆ ದಯವಿಟ್ಟು ಹೇಳಿ, ಈ ಬಗ್ಗೆ ಮಾತನಾಡೋಣ.',
  ],
  [
    'Tamil',
    '{title} புத்தகத்தை நான் எடுத்தபோது பெரிதாக எதிர்பார்ப்பு இல்லாமல்தான் ஆரம்பித்தேன், ஆனால் சில பக்கங்களுக்குள்ளேயே அந்த கதையின் மீது ஒரு பிடிப்பு ஏற்பட்டுவிட்டது. ஒரு வார இறுதியில் வேறு எந்த வேலையும் செய்யாமல் முழு புத்தகத்தையும் படித்து முடித்தேன், அப்படி ஒரு உணர்வு. நடுவில் சற்று மெதுவாக நகர்ந்தது, ஆனால் முடிவைப் படித்தபோது மனது கனத்தது, கண்களில் நீர் வந்தது என்பது உண்மை. இந்த கதையின் முக்கிய பாத்திரம் எடுக்கும் முடிவுகளை நான் இன்னும் யோசித்துக்கொண்டே இருக்கிறேன். யாராவது படித்திருந்தால் இதைப் பற்றி பேசலாமா?',
  ],
  [
    'Marathi',
    '{title} ही कादंबरी मी लायब्ररीतून घेतली तेव्हा फार अपेक्षा नव्हती, पण पहिली काही पाने वाचल्यावरच लक्षात आलं की ही गोष्ट वेगळी आहे. एका रात्री तर मी झोपायचं विसरूनच वाचत बसलो, इतकं गुंतवून टाकणारं होतं. मध्यभागी थोडं संथ वाटलं, पण शेवट वाचताना खरंच डोळ्यात पाणी आलं हे कबूल करायलाच हवं. या कथेतील मुख्य पात्राने घेतलेले निर्णय अजूनही डोक्यातून जात नाहीत. कोणी वाचलं असेल तर नक्की सांगा, याबद्दल खूप काही बोलण्यासारखं आहे.',
  ],
  [
    'Hindi',
    '{title} किताब मैंने लाइब्रेरी से बस यूं ही उठा ली थी, कोई खास उम्मीद नहीं थी। लेकिन शुरुआती कुछ पन्नों के बाद ही समझ आ गया कि यह कहानी अलग है। एक रात तो मैं सोना ही भूल गया, बस पढ़ता ही रहा क्योंकि कहानी छोड़ने का मन ही नहीं कर रहा था। बीच में थोड़ा धीमा लगा, लेकिन अंत पढ़ते हुए सच में आंखों में पानी आ गया, यह मानने में कोई शर्म नहीं। इस किताब के मुख्य किरदार ने जो फैसले लिए, वो अभी भी दिमाग में घूम रहे हैं। अगर किसी और ने भी पढ़ी है तो बताइए, बात करनी है।',
  ],
  [
    'Bengali',
    '{title} বইটা লাইব্রেরি থেকে নিয়েছিলাম তেমন কোনো প্রত্যাশা ছাড়াই, কিন্তু প্রথম কয়েক পাতা পড়েই বুঝলাম এই গল্পটা অন্যরকম। এক রাতে তো ঘুমাতেই ভুলে গিয়েছিলাম, শুধু পড়েই যাচ্ছিলাম, গল্পটা ছাড়তে মন চাইছিল না। মাঝখানে একটু ধীর মনে হয়েছিল, কিন্তু শেষটা পড়ে সত্যিই চোখে জল এসে গিয়েছিল, স্বীকার করতে দ্বিধা নেই। এই বইয়ের প্রধান চরিত্র যে সিদ্ধান্তগুলো নিয়েছে, সেগুলো এখনও মাথা থেকে সরছে না। কেউ পড়ে থাকলে জানাবেন, এই নিয়ে কথা বলতে চাই।',
  ],
  [
    'Telugu',
    '{title} పుస్తకం లైబ్రరీ నుండి తీసుకున్నప్పుడు పెద్దగా ఆశలు లేవు, కానీ మొదటి కొన్ని పేజీలు చదివాక ఈ కథ వేరు అని అర్థమైంది. ఒక రాత్రి నిద్ర పోవడం మర్చిపోయి చదువుతూనే ఉన్నాను, కథను వదలాలని అనిపించలేదు. మధ్యలో కొంచెం నెమ్మదిగా అనిపించింది, కానీ చివరిభాగం చదివేటప్పుడు నిజంగా కళ్ళలో నీళ్లు వచ్చాయి, ఇది ఒప్పుకోవడంలో సిగ్గు లేదు. ఈ పుస్తకంలో ముఖ్య పాత్ర తీసుకున్న నిర్ణయాలు ఇంకా నా మనసులో తిరుగుతూనే ఉన్నాయి. ఎవరైనా చదివి ఉంటే చెప్పండి, దీని గురించి మాట్లాడాలని ఉంది.',
  ],
  [
    'Malayalam',
    '{title} എന്ന പുസ്തകം ലൈബ്രറിയിൽ നിന്ന് എടുത്തപ്പോൾ വലിയ പ്രതീക്ഷയൊന്നും ഉണ്ടായിരുന്നില്ല, പക്ഷേ ആദ്യത്തെ കുറച്ച് പേജുകൾ വായിച്ചപ്പോൾ തന്നെ ഈ കഥ വ്യത്യസ്തമാണെന്ന് തോന്നി. ഒരു രാത്രി ഉറങ്ങാൻ മറന്ന് വായിച്ചുകൊണ്ടിരുന്നു, കഥ വിടാൻ തോന്നിയില്ല. നടുവിൽ അല്പം പതുക്കെ പോയെങ്കിലും, അവസാനഭാഗം വായിച്ചപ്പോൾ ശരിക്കും കണ്ണ് നിറഞ്ഞു എന്നത് സത്യമാണ്. ഈ കഥയിലെ പ്രധാന കഥാപാത്രം എടുത്ത തീരുമാനങ്ങൾ ഇപ്പോഴും മനസ്സിൽ നിന്ന് പോകുന്നില്ല. ആരെങ്കിലും വായിച്ചിട്ടുണ്ടെങ്കിൽ പറയൂ, ഇതിനെക്കുറിച്ച് സംസാരിക്കണം.',
  ],
];

// Mirrors backend/scripts/seed_pricing_plans.py's PLANS — needed here because that
// script itself is one of the 11 not being ported (its baseline rows also ship as a
// Prisma migration), but seedDemoData.ts's own force-reset pricing-plan upsert still
// needs the data.
export const PRICING_PLANS = [
  { planId: '1m', months: 1, price: 999, savePercent: 0, badge: null as string | null },
  { planId: '3m', months: 3, price: 2697, savePercent: 10, badge: 'mostPopular' },
  { planId: '6m', months: 6, price: 4915, savePercent: 18, badge: null as string | null },
  { planId: '12m', months: 12, price: 8991, savePercent: 25, badge: 'bestValue' },
];
