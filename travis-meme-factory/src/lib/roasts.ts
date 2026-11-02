import { pick, shuffle } from './random';

/*
 * Offline "AI" roast engine: hand-written jokes + combinatorial templates.
 * Everything is playful and fictional — no slurs, threats, or real personal info.
 */

export interface RoastCategory {
  id: string;
  label: string;
  emoji: string;
  lines: string[];
  /** templates with {a}/{b}/{c} slots, filled from `parts` */
  combos?: { t: string; parts: Record<string, string[]> }[];
}

const activities = ['parallel parking', 'microwaving soup', 'reading a clock', 'opening a jar', 'small talk', 'assembling IKEA furniture', 'spelling "definitely"', 'crossing the street', 'using a revolving door', 'folding a fitted sheet'];
const things = ['a Roomba', 'a houseplant', 'a damp napkin', 'a lost GPS', 'a sleepy goldfish', 'a pigeon with Wi-Fi', 'a screensaver', 'a buffering video', 'a traffic cone', 'a toddler on espresso'];

export const ROAST_CATEGORIES: RoastCategory[] = [
  {
    id: 'disrespectful',
    label: 'Absolutely disrespectful',
    emoji: '💀',
    lines: [
      'Travis has the energy of a group project member who "did the title slide."',
      "Travis isn't the main character. He's the loading screen.",
      'Travis brings a fork to a soup party and calls it strategy.',
      'Travis has two moods: confused and about to be confused.',
      "If common sense were a currency, Travis would be on a payment plan.",
      'Travis gets lost in a straight hallway.',
      'Travis claps when the plane lands. Even when he is not on the plane.',
      'Somewhere a village is missing its idiot and Travis is not giving him back.',
      'Travis is proof that confidence and accuracy are not related.',
      "Travis's search history is just \"how to\" with nothing after it.",
    ],
    combos: [
      { t: 'Travis is about as useful as {a} at {b}.', parts: { a: ['a screen door', 'a chocolate teapot', 'a solar flashlight', 'an inflatable dartboard', 'a glass hammer'], b: ['a submarine', 'midnight', 'a marathon', 'a job interview', 'a funeral'] } },
      { t: 'Travis has the decision-making skills of {a}.', parts: { a: things } },
    ],
  },
  {
    id: 'school',
    label: 'School',
    emoji: '🎒',
    lines: [
      'Travis studied for the wrong test. With confidence.',
      'Travis wrote his name on the test and called it a strong start.',
      "Travis's highlighter has highlighted the entire textbook. Everything is important. Nothing is learned.",
      'Travis asked if the open-book test was open-book.',
      'Travis\'s group project contribution: "Sounds good 👍"',
      'Teacher: any questions? Travis: what class is this',
      'Travis cited Wikipedia. The page was about him. He wrote it.',
      'Travis brought a calculator to English class "just in case."',
    ],
    combos: [{ t: 'Travis got a {a} on {b} and still {c}.', parts: { a: ['D-', '12%', 'participation trophy', 'sticker that said "tried"'], b: ['the spelling bee', 'gym class', 'lunch', 'the fire drill'], c: ['asked for extra credit', 'called it a win', 'blamed the Wi-Fi', 'went to celebrate'] } }],
  },
  {
    id: 'work',
    label: 'Work',
    emoji: '💼',
    lines: [
      'Travis replied-all to say "please don\'t reply-all."',
      'Travis has been "circling back" since 2019.',
      'Travis muted himself to talk and unmuted himself to chew.',
      'Travis\'s LinkedIn says "Visionary." His manager says "Where is Travis."',
      'Travis scheduled a meeting to discuss having fewer meetings.',
      "Travis's most productive hour is the 10 minutes before he leaves.",
      'Travis called IT because his monitor was off. It was not plugged in. It was not his desk.',
      'Travis printed an email to save it.',
    ],
    combos: [{ t: 'Travis spent {a} on {b} and called it {c}.', parts: { a: ['3 hours', 'all of Tuesday', 'the whole quarter', '45 minutes'], b: ['choosing a font', 'renaming one file', 'a Slack emoji', 'fixing his chair height'], c: ['deep work', 'leadership', 'strategy', 'synergy'] } }],
  },
  {
    id: 'dating',
    label: 'Dating',
    emoji: '💘',
    lines: [
      'Travis\'s dating profile says "fluent in sarcasm." He means "bad at texting."',
      'Travis took her to a nice dinner. It was the free samples at Costco.',
      'Travis double-texted. Then triple. Then sent a voice memo of him breathing nervously.',
      'Travis says he\'s "talking to someone." It\'s Siri.',
      'Travis\'s rizz is on a 6-8 week shipping delay.',
      'Travis tried to be mysterious and just ended up being missing.',
      'Travis brought flowers. Fake ones. From the restaurant. That they were at.',
      "Travis's love language is forgetting your birthday and saying \"I'm more of a vibe guy.\"",
    ],
    combos: [{ t: 'Travis\'s opening line: "{a}" Results: {b}.', parts: { a: ['Do you like Minecraft?', 'Are you a parking ticket?', 'I can do a backflip (I cannot)', 'Rate my car (it is my mom\'s)'], b: ['blocked', 'left on read', 'she gave him her brother\'s number', 'restraining order from a vending machine'] } }],
  },
  {
    id: 'sports',
    label: 'Sports',
    emoji: '🏀',
    lines: [
      "Travis warmed up for 45 minutes and played for 2.",
      'Travis calls every shot "mine" and has never caught a ball.',
      'Travis in pickup basketball: zero points, nine technical fouls, one nap.',
      'Travis tore his hamstring tying his shoe.',
      'Travis still talks about one goal he scored in 4th grade. It was an own goal.',
      'Travis bought $400 running shoes to walk to the fridge faster.',
      'Travis plays fantasy football like it is a horoscope.',
      "Travis's vertical jump is measured in millimeters.",
    ],
    combos: [{ t: 'Travis trained {a} for {b} and still lost to {c}.', parts: { a: ['6 months', 'one whole afternoon', 'every day (in his head)'], b: ['a 5K', 'beer pong', 'a pull-up', 'a thumb war'], c: ['a toddler', 'a guy in flip-flops', 'his grandma', 'gravity'] } }],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    emoji: '🧠',
    lines: [
      'Travis thinks "Wi-Fi" is a place.',
      'Travis tried to put a "?" on a "!" to ask an exclamation.',
      'Travis got locked out of his car. With the window open.',
      'Travis Googled "Google."',
      'Travis has two brain cells and they\'re both on cooldown.',
      'Travis asked for his steak "medium well done rare."',
      'Travis thought a "one-way street" meant you can only drive it once.',
      'Travis tried to unsubscribe from the newsletter by replying "stop" to a billboard.',
    ],
    combos: [{ t: 'Travis is out here losing at {a} to {b}.', parts: { a: activities, b: things } }],
  },
  {
    id: 'nonsense',
    label: 'Random nonsense',
    emoji: '🦆',
    lines: [
      'Travis is legally allowed to own 3 ducks in this state and he has 4.',
      'Travis once ate a candle "to see what vanilla tastes like."',
      'Travis has beef with a specific seagull.',
      'Travis claims he invented the color beige.',
      'Travis is banned from a Build-A-Bear.',
      'Travis has been training a pigeon to deliver his texts. Response time: unchanged.',
      'Travis thinks the moon is following him because they are friends.',
      'Travis drank a smoothie with a fork as a personal challenge.',
    ],
    combos: [{ t: 'Fun fact: Travis is {a} to {b}.', parts: { a: ['emotionally attached', 'allergic', 'legally married', 'a sworn enemy', 'distantly related'], b: ['a lawn flamingo', 'Tuesdays', 'the number 7', 'a specific shopping cart', 'the concept of soup'] } }],
  },
  {
    id: 'motivational',
    label: 'Fake motivational quotes',
    emoji: '✨',
    lines: [
      '"Shoot for the moon. Even if you miss, you\'ll still be confused." — Travis',
      '"Be the person your dog thinks you are. Mine thinks I\'m a sandwich." — Travis',
      '"The early bird gets the worm. I\'m not eating a worm." — Travis',
      '"Never give up. Unless it\'s hard." — Travis',
      '"Hustle until your haters ask what you do. I also don\'t know." — Travis',
      '"Dream big. Then go back to sleep." — Travis',
      '"Every expert was once a beginner. I plan on staying a beginner." — Travis',
      '"If at first you don\'t succeed, blame the instructions." — Travis',
    ],
    combos: [{ t: '"{a}, {b}." — Travis, probably', parts: { a: ['Work hard in silence', 'Believe in yourself', 'Stay humble', 'Rise and grind'], b: ['then tell everyone immediately', 'but also have a backup self', 'unless someone compliments you', 'after 2 PM'] } }],
  },
  {
    id: 'news',
    label: 'Breaking news about Travis',
    emoji: '🚨',
    lines: [], // filled from the news generator below
  },
  {
    id: 'quotes',
    label: 'Things Travis would say',
    emoji: '🗣️',
    lines: [
      '"I don\'t need directions, I have a feeling."',
      '"Technically, I wasn\'t wrong, I was early."',
      '"I could do that, I just don\'t want to."',
      '"I\'m not lost, I\'m exploring."',
      '"That doesn\'t count, I wasn\'t ready."',
      '"Bro, trust me" (do not trust him)',
      '"I read like half of a headline about it, so I\'m basically an expert."',
      '"I\'ll Venmo you." (He will not Venmo you.)',
      '"Five more minutes." — said every 5 minutes since 2017.',
      '"I\'ve been to the gym" (once, to use the bathroom)',
    ],
    combos: [{ t: '"I\'m basically a {a}, I just {b}."', parts: { a: ['professional chef', 'genius', 'pro gamer', 'millionaire', 'pilot'], b: ['have never done it', 'need the right vibe', 'lost my password', 'haven\'t started yet'] } }],
  },
];

/* ---------------- Breaking news ---------------- */

const newsSubjects = ['LOCAL MAN TRAVIS', 'TRAVIS', 'AREA MAN TRAVIS', 'SOURCES CLOSE TO TRAVIS', 'SCIENTISTS STUDYING TRAVIS', "TRAVIS'S MOM", 'TRAVIS, 2 BRAIN CELLS STRONG,'];
const newsVerbs = [
  "STILL DOESN'T KNOW WHAT'S GOING ON",
  'REPORTEDLY MAKES ANOTHER QUESTIONABLE DECISION',
  'CONFIDENTLY WRONG FOR 400TH CONSECUTIVE DAY',
  'ATTEMPTS TO PULL "PUSH" DOOR FOR 11 MINUTES',
  'SPOTTED EATING CEREAL WITH A FORK',
  'CLAIMS HE "COULD TOTALLY BEAT A BEAR"',
  'SETS NEW WORLD RECORD FOR "BRB" (6 HOURS)',
  'ANNOUNCES PLAN; PLAN IMMEDIATELY FAILS',
  'MISTAKES OWN REFLECTION FOR "SOME GUY"',
  'LEFT ON READ BY AUTOMATED CUSTOMER SERVICE BOT',
  'LOSES ARGUMENT TO SMART FRIDGE',
  'GETS STUCK IN REVOLVING DOOR; CALLS IT "CARDIO"',
];
const newsFull = [
  "SOURCES CONFIRM TRAVIS HAS NEVER BEEN RIGHT",
  'EXPERTS BAFFLED AS TRAVIS SOMEHOW GETS LOST IN OWN DRIVEWAY',
  'NATION ON EDGE AS TRAVIS SAYS "HOLD MY DRINK"',
  'STUDY FINDS 100% OF TRAVIS\'S IDEAS "SEEMED GOOD AT 2 AM"',
  'TRAVIS DECLARES WAR ON GEESE; GEESE WINNING',
  'GROUP CHAT GOES SILENT AFTER TRAVIS SENDS "quick question"',
  'METEOROLOGISTS PREDICT 90% CHANCE OF TRAVIS BEING LATE',
  'TRAVIS UNVEILS NEW BUSINESS IDEA: IT IS UBER BUT FOR NAPS',
  'DOG REFUSES TO PLAY FETCH WITH TRAVIS, CITING "VIBES"',
  'TRAVIS DISCOVERS VEGETABLES, IMMEDIATELY REGRETS IT',
  'LOCAL GPS SUBMITS RESIGNATION AFTER WEEK WITH TRAVIS',
  'TRAVIS FINALLY FINISHES SENTENCE STARTED IN 2019',
];
const tickers = [
  'Experts "not surprised"',
  'Developing story',
  'More at 11',
  'Witnesses describe "a lot of confidence"',
  'Travis could not be reached for comment (he was napping)',
  'Stock market unaffected, somehow',
  'Officials urge public to "just let him cook"',
  'His mom says he is "a good boy, actually"',
  'Geese unavailable for comment',
];

export function breakingNews(n = 6): string[] {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < n && guard++ < 100) {
    out.add(Math.random() < 0.45 ? pick(newsFull) : `${pick(newsSubjects)} ${pick(newsVerbs)}`);
  }
  return [...out];
}

export const randomTicker = () => shuffle(tickers.filter((t) => t.length < 40)).slice(0, 2).join(' • ');

function fill(combo: { t: string; parts: Record<string, string[]> }): string {
  return combo.t.replace(/\{(\w+)\}/g, (_, k: string) => pick(combo.parts[k] ?? ['?']));
}

/** Generate `n` distinct captions for a category. */
export function generateRoasts(categoryId: string, n = 6): string[] {
  const cat = ROAST_CATEGORIES.find((c) => c.id === categoryId) ?? ROAST_CATEGORIES[0];
  if (cat.id === 'news') return breakingNews(n);
  const out = new Set<string>();
  const pool = shuffle(cat.lines);
  let guard = 0;
  while (out.size < n && guard++ < 200) {
    if (cat.combos && (Math.random() < 0.35 || pool.length === 0)) out.add(fill(pick(cat.combos)));
    else if (pool.length) out.add(pool.pop()!);
  }
  return [...out];
}

/** A random short caption from any category (for the chaos button). */
export function anyCaption(): string {
  const cat = pick(ROAST_CATEGORIES);
  return generateRoasts(cat.id, 1)[0];
}

/* ---------------- Meme of the Day titles ---------------- */

const motdA = ['The Sistine Chapel of', 'A Harvard Case Study in', 'The Mona Lisa of', 'Exhibit A in', 'A Peer-Reviewed Paper on', 'The Final Boss of', 'A Netflix Documentary about', 'The Constitution of'];
const motdB = ['Travis Being Travis', 'Bad Decisions', 'Pure Unfiltered Chaos', 'Why We Can\'t Have Nice Things', 'Travis Energy', 'Emotional Damage', 'Group Chat Warfare', 'Being Confidently Wrong'];

export function motdTitle(rng: () => number = Math.random) {
  return `${pick(motdA, rng)} ${pick(motdB, rng)}`;
}

export const LOADING_LINES = [
  'Consulting the Travis archives…',
  'Calibrating disrespect levels…',
  'Teaching AI what "Travis" means… it is concerned…',
  'Locating Travis\'s last brain cell…',
  'Rendering in 4K (Travis in 144p)…',
  'Asking Travis for comment… he is napping…',
];

export const EMOJI_STICKERS = [
  '😂', '🤡', '💀', '🔥', '😭', '🤣', '😤', '🙄', '🥴', '🤯', '😎', '🫠', '👀', '🧠', '💯', '🚨', '❌', '✅', '👑', '🏆',
  '🐐', '🦆', '🐸', '🍕', '🌭', '🥤', '💸', '📉', '📈', '⚡', '💥', '🎯', '🫵', '👉', '👈', '🤌', '👏', '🙏', '💩', '🧢',
  '🥵', '🥶', '🤓', '🤠', '👽', '🤖', '🎉', '⚠️', '❓',
];
