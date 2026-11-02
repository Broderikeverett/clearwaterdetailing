import type { MemeTemplate } from '../types';

/*
 * Templates are drawn procedurally (emoji + shapes) so the app ships with zero
 * copyrighted image files and works fully offline. Each is a remix of the
 * classic meme *format*. Users can also upload the original images (or anything
 * else) as custom templates from the Templates page.
 */

const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

function emoji(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number, rot = 0, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  ctx.font = `${size}px ${EMOJI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 0, size * 0.06);
  ctx.restore();
}

function vgrad(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stops: string[]) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = '#fff', font = 'Anton') {
  ctx.save();
  ctx.font = `700 ${size}px "${font}", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function stars(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, seed = 7) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, r() * 2.4 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const dark = { color: '#111111', stroke: '#ffffff', strokeWidth: 0 };

export const TEMPLATES: MemeTemplate[] = [
  {
    id: 'drake',
    name: 'Drake Hotline Bling',
    emoji: '🙅‍♂️',
    blurb: 'Reject one thing. Approve a worse thing.',
    width: 1000,
    height: 1000,
    draw(ctx) {
      vgrad(ctx, 0, 0, 500, 500, ['#ffb35c', '#f08a3c']);
      vgrad(ctx, 0, 500, 500, 500, ['#ffc978', '#f3a04a']);
      ctx.fillStyle = '#fff';
      ctx.fillRect(500, 0, 500, 1000);
      emoji(ctx, '🙅‍♂️', 250, 260, 300);
      emoji(ctx, '😏', 230, 740, 260);
      emoji(ctx, '👉', 400, 800, 140);
      ctx.fillStyle = '#000';
      ctx.fillRect(498, 0, 4, 1000);
      ctx.fillRect(0, 498, 1000, 4);
    },
    texts: [
      { x: 750, y: 250, w: 440, text: 'Doing the reasonable thing', fontSize: 60, ...dark },
      { x: 750, y: 750, w: 440, text: 'Doing whatever Travis is doing', fontSize: 60, ...dark },
    ],
    slots: [
      { x: 250, y: 230, w: 300, h: 300, shape: 'circle' },
      { x: 230, y: 720, w: 280, h: 280, shape: 'circle' },
    ],
    captionSets: [
      ['Thinking before acting', 'Reading the instructions', 'Showing up on time', 'Having a plan', 'Drinking water', 'Saving money'],
      ['Travis-ing it', 'Winging it like Travis', 'Asking Travis (bad idea)', 'Vibes-based decision making', 'Ordering a third energy drink', 'Buying another hoodie'],
    ],
  },
  {
    id: 'distracted',
    name: 'Distracted Boyfriend',
    emoji: '👀',
    blurb: 'Travis, his responsibilities, and literally anything shiny.',
    width: 1200,
    height: 800,
    draw(ctx, w, h) {
      vgrad(ctx, 0, 0, w, h * 0.62, ['#7cc6ff', '#cde9ff']);
      vgrad(ctx, 0, h * 0.62, w, h * 0.38, ['#9a9a9a', '#6d6d6d']);
      ctx.fillStyle = '#5aa05a';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(80 + i * 220, h * 0.55, 90, 0, Math.PI * 2);
        ctx.fill();
      }
      emoji(ctx, '💃', 230, 470, 330);
      emoji(ctx, '🚶‍♂️', 640, 480, 360, 0, true);
      emoji(ctx, '👀', 600, 330, 110);
      emoji(ctx, '🙎‍♀️', 990, 480, 340);
      emoji(ctx, '😤', 1040, 330, 80);
    },
    texts: [
      { x: 230, y: 130, w: 340, text: 'A new hobby', fontSize: 56 },
      { x: 640, y: 680, w: 340, text: 'Travis', fontSize: 64 },
      { x: 990, y: 130, w: 340, text: 'The 4 hobbies he quit last week', fontSize: 48 },
    ],
    slots: [{ x: 640, y: 330, w: 200, h: 200, shape: 'circle' }],
    captionSets: [
      ['A new crypto coin', 'Free samples', 'A random group chat', 'A YouTube rabbit hole', 'A dog across the street'],
      ['Travis', 'Travis', 'Travis (again)', 'Travis', 'Travis'],
      ['His actual job', 'The conversation he was in', 'His car keys', 'His gym membership', 'The plan we agreed on'],
    ],
  },
  {
    id: 'two-buttons',
    name: 'Two Buttons',
    emoji: '😰',
    blurb: 'Two terrible options. One sweaty Travis.',
    width: 900,
    height: 1100,
    draw(ctx, w) {
      vgrad(ctx, 0, 0, w, 560, ['#3a3f4b', '#23262e']);
      ctx.fillStyle = '#c9ccd3';
      ctx.fillRect(60, 320, w - 120, 200);
      for (const bx of [270, 630]) {
        ctx.fillStyle = '#7a0000';
        ctx.beginPath();
        ctx.ellipse(bx, 420, 120, 60, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e01b1b';
        ctx.beginPath();
        ctx.ellipse(bx, 400, 110, 54, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(bx - 30, 385, 40, 14, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      emoji(ctx, '👆', 450, 520, 110);
      vgrad(ctx, 0, 560, w, 540, ['#ffe0b8', '#ffcf99']);
      emoji(ctx, '😰', 450, 820, 380);
      emoji(ctx, '💦', 250, 700, 110);
      emoji(ctx, '💦', 660, 690, 90);
      emoji(ctx, '✋', 160, 960, 130);
    },
    texts: [
      { x: 270, y: 180, w: 320, text: 'Admit he was wrong', fontSize: 52, rotation: -8 },
      { x: 630, y: 180, w: 320, text: 'Double down forever', fontSize: 52, rotation: 8 },
      { x: 450, y: 1050, w: 820, text: 'Travis', fontSize: 70 },
    ],
    slots: [{ x: 450, y: 820, w: 320, h: 320, shape: 'circle' }],
    captionSets: [
      ['Admit he was wrong', 'Go to sleep', 'Text her back', 'Pay back the $20', 'Read the email'],
      ['Double down forever', 'One more episode', 'Leave her on read for 3 days', 'Pretend he forgot', 'Reply-all "per my last email"'],
      ['Travis', 'Travis at 2 AM', 'Travis, every day', 'Travis in a group project', 'Travis'],
    ],
  },
  {
    id: 'expanding-brain',
    name: 'Expanding Brain',
    emoji: '🧠',
    blurb: 'Four levels of Travis enlightenment.',
    width: 1000,
    height: 1200,
    draw(ctx) {
      const colors = ['#1b1b2a', '#1d2448', '#29207a', '#4a10a8'];
      for (let i = 0; i < 4; i++) {
        const y = i * 300;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, y, 500, 300);
        vgrad(ctx, 500, y, 500, 300, [colors[i], '#000']);
        if (i > 0) glow(ctx, 750, y + 150, 80 + i * 70, i === 3 ? 'rgba(160,220,255,0.95)' : 'rgba(110,160,255,0.7)');
        if (i === 3) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(500, y, 500, 300);
          ctx.clip();
          stars(ctx, 1000, 1200, 160, 3);
          ctx.restore();
        }
        emoji(ctx, '🧠', 750, y + 150, 90 + i * 30);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, y + 298, 1000, 4);
      }
      ctx.fillRect(498, 0, 4, 1200);
    },
    texts: [
      { x: 250, y: 150, w: 440, text: 'Making a plan', fontSize: 50, ...dark },
      { x: 250, y: 450, w: 440, text: 'Making no plan', fontSize: 50, ...dark },
      { x: 250, y: 750, w: 440, text: 'Asking Travis for a plan', fontSize: 50, ...dark },
      { x: 250, y: 1050, w: 440, text: 'Becoming Travis', fontSize: 50, ...dark },
    ],
    slots: [],
    captionSets: [
      ['Studying for the test', 'Using a calendar', 'Setting an alarm', 'Reading the menu'],
      ['Skimming the notes', 'Remembering it', 'Setting 9 alarms', 'Asking the waiter'],
      ['Asking Travis', 'Asking Travis to remind you', 'Having Travis wake you up', 'Letting Travis order'],
      ['Being Travis and learning nothing', 'Becoming one with the chaos', 'Waking up at 3 PM, enlightened', 'Ordering chicken tenders at a sushi bar'],
    ],
  },
  {
    id: 'change-my-mind',
    name: 'Change My Mind',
    emoji: '☕',
    blurb: 'A hot take on a folding table.',
    width: 1000,
    height: 750,
    draw(ctx, w, h) {
      vgrad(ctx, 0, 0, w, h * 0.55, ['#9fd2ff', '#e6f4ff']);
      vgrad(ctx, 0, h * 0.55, w, h * 0.45, ['#6cbf5a', '#3f8f37']);
      ctx.fillStyle = '#b9a58a';
      ctx.fillRect(0, h * 0.42, w, 40);
      emoji(ctx, '🧔', 260, 330, 230);
      emoji(ctx, '☕', 160, 520, 110);
      ctx.fillStyle = '#7a5532';
      ctx.fillRect(80, 560, 840, 40);
      ctx.fillRect(120, 600, 20, 150);
      ctx.fillRect(860, 600, 20, 150);
      ctx.save();
      ctx.translate(620, 420);
      ctx.rotate(-0.04);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 6;
      ctx.fillRect(-260, -150, 520, 300);
      ctx.strokeRect(-260, -150, 520, 300);
      ctx.restore();
    },
    texts: [
      { x: 620, y: 380, w: 470, text: 'Travis has never once been on time', fontSize: 44, rotation: -2.3, ...dark },
      { x: 620, y: 520, w: 470, text: 'CHANGE MY MIND', fontSize: 44, rotation: -2.3, color: '#d10000', stroke: '#fff', strokeWidth: 0 },
    ],
    slots: [{ x: 260, y: 300, w: 200, h: 200, shape: 'circle' }],
    captionSets: [
      ['Travis has never once been on time', 'Travis peaked in 7th grade', 'Travis cannot parallel park', 'Travis thinks soup is a drink', 'Travis owes everyone $5'],
      ['CHANGE MY MIND', 'CHANGE MY MIND', 'PROVE ME WRONG', 'CHANGE MY MIND', 'YOU CANNOT'],
    ],
  },
  {
    id: 'yelling-cat',
    name: 'Woman Yelling at Cat',
    emoji: '😾',
    blurb: 'Furious accusations vs. one unbothered cat.',
    width: 1200,
    height: 650,
    draw(ctx) {
      vgrad(ctx, 0, 0, 600, 650, ['#f6d3c4', '#d9a998']);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(600, 0, 600, 650);
      emoji(ctx, '😱', 300, 360, 270);
      emoji(ctx, '🫵', 470, 480, 140, 0, true);
      emoji(ctx, '👩', 120, 380, 150);
      emoji(ctx, '😾', 900, 350, 260);
      ctx.fillStyle = '#ddd';
      ctx.fillRect(640, 500, 520, 30);
      emoji(ctx, '🥗', 1080, 470, 110);
      ctx.fillStyle = '#000';
      ctx.fillRect(598, 0, 4, 650);
    },
    texts: [
      { x: 300, y: 90, w: 540, text: 'You said you were 5 minutes away an hour ago!', fontSize: 44 },
      { x: 900, y: 90, w: 540, text: 'Travis: I am literally parking', fontSize: 44 },
    ],
    slots: [
      { x: 300, y: 340, w: 230, h: 230, shape: 'circle' },
      { x: 900, y: 340, w: 230, h: 230, shape: 'circle' },
    ],
    captionSets: [
      ['You said 5 minutes an hour ago!', 'You ate my leftovers!', 'You said you would bring chips!', 'You told everyone the surprise!', 'You put metal in the microwave AGAIN!'],
      ['Travis: I am literally parking', 'Travis: they were calling to me', 'Travis: brought vibes instead', 'Travis: I thought you said "tell everyone"', 'Travis: it needed to be tested'],
    ],
  },
  {
    id: 'mocking',
    name: 'Mocking SpongeBob',
    emoji: '🐔',
    blurb: 'rEpEaT wHaT tRaViS sAiD.',
    width: 1000,
    height: 900,
    draw(ctx, w, h) {
      vgrad(ctx, 0, 0, w, h, ['#fff35a', '#f2cf00']);
      ctx.fillStyle = 'rgba(160,140,0,0.35)';
      const holes = [
        [120, 140, 50], [820, 120, 70], [180, 720, 80], [860, 760, 55], [520, 820, 40], [90, 430, 35], [920, 430, 45], [700, 260, 30],
      ];
      for (const [x, y, r] of holes) {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.8, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      emoji(ctx, '🐔', 500, 470, 380);
      emoji(ctx, '🤪', 520, 300, 160);
    },
    texts: [
      { x: 500, y: 90, w: 920, text: "Travis: I'm not even tired", fontSize: 64, transform: 'mock' },
      { x: 500, y: 810, w: 920, text: "I'm not even tired", fontSize: 72, transform: 'mock' },
    ],
    slots: [{ x: 520, y: 300, w: 220, h: 220, shape: 'circle' }],
    captionSets: [
      ["Travis: I'm a really good driver", 'Travis: trust me, I know a shortcut', "Travis: I'll start Monday", 'Travis: I could beat a pro at that', "Travis: I'm not even hungry"],
      ["I'm a really good driver", 'trust me i know a shortcut', "i'll start monday", 'i could beat a pro at that', "i'm not even hungry"],
    ],
  },
  {
    id: 'one-does-not',
    name: 'One Does Not Simply',
    emoji: '👌',
    blurb: 'An ancient warning about Travis.',
    width: 1000,
    height: 700,
    draw(ctx, w, h) {
      vgrad(ctx, 0, 0, w, h, ['#5b3b22', '#2a1a0f', '#120a05']);
      glow(ctx, 500, 330, 420, 'rgba(255,190,110,0.35)');
      emoji(ctx, '🧔', 500, 330, 300);
      emoji(ctx, '👌', 750, 470, 170);
      emoji(ctx, '🛡️', 230, 500, 140);
    },
    texts: [
      { x: 500, y: 80, w: 940, text: 'One does not simply', fontSize: 72 },
      { x: 500, y: 620, w: 940, text: 'Win an argument with Travis', fontSize: 72 },
    ],
    slots: [{ x: 500, y: 320, w: 280, h: 280, shape: 'circle' }],
    captionSets: [
      ['One does not simply', 'One does not simply', 'One does not simply', 'One does not simply'],
      ['Win an argument with Travis', 'Get Travis to reply in under 4 days', 'Split a check with Travis', 'Let Travis pick the restaurant', 'Explain the plan to Travis once'],
    ],
  },
  {
    id: 'surprised-pikachu',
    name: 'Surprised Pikachu',
    emoji: '😮',
    blurb: 'Consequences? For Travis? Shocking.',
    width: 1000,
    height: 1000,
    draw(ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1000, 420);
      vgrad(ctx, 0, 420, 1000, 580, ['#ffe14d', '#f5c400']);
      emoji(ctx, '😮', 500, 720, 380);
      ctx.fillStyle = 'rgba(230,40,40,0.75)';
      ctx.beginPath();
      ctx.arc(340, 790, 45, 0, Math.PI * 2);
      ctx.arc(660, 790, 45, 0, Math.PI * 2);
      ctx.fill();
      emoji(ctx, '⚡', 140, 520, 120, -0.3);
      emoji(ctx, '⚡', 870, 540, 110, 0.3);
    },
    texts: [
      {
        x: 500,
        y: 210,
        w: 900,
        text: 'Travis: skips every class all semester\nTravis when he fails the final:',
        fontSize: 52,
        align: 'left',
        font: 'Arial',
        ...dark,
      },
    ],
    slots: [{ x: 500, y: 720, w: 380, h: 380, shape: 'circle' }],
    captionSets: [
      [
        'Travis: skips every class all semester\nTravis when he fails the final:',
        'Travis: puts his phone at 1% all day\nTravis when it dies:',
        'Travis: tells the boss "I quit" as a joke\nTravis when HR calls:',
        'Travis: eats gas station sushi\nTravis 3 hours later:',
        'Travis: replies "k" to his girlfriend\nTravis when she is mad:',
      ],
    ],
  },
  {
    id: 'galaxy-brain',
    name: 'Galaxy Brain',
    emoji: '🌌',
    blurb: 'Travis has transcended thought itself.',
    width: 1000,
    height: 1000,
    draw(ctx, w, h) {
      const g = ctx.createRadialGradient(500, 500, 40, 500, 500, 720);
      g.addColorStop(0, '#5b2cff');
      g.addColorStop(0.45, '#1a0b5c');
      g.addColorStop(1, '#02010a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      stars(ctx, w, h, 380, 11);
      ctx.save();
      ctx.translate(500, 500);
      for (let i = 0; i < 24; i++) {
        ctx.rotate((Math.PI * 2) / 24);
        ctx.fillStyle = i % 2 ? 'rgba(120,200,255,0.18)' : 'rgba(200,120,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(700, -40);
        ctx.lineTo(700, 40);
        ctx.fill();
      }
      ctx.restore();
      glow(ctx, 500, 500, 330, 'rgba(180,230,255,0.95)');
      emoji(ctx, '🧠', 500, 500, 300);
    },
    texts: [
      { x: 500, y: 100, w: 920, text: 'Travis when he "figures out"', fontSize: 64 },
      { x: 500, y: 900, w: 920, text: 'That the microwave also has a clock', fontSize: 64 },
    ],
    slots: [{ x: 500, y: 500, w: 300, h: 300, shape: 'circle' }],
    captionSets: [
      ['Travis when he "figures out"', 'Travis at 3 AM realizing', 'Travis after one podcast', 'Travis explaining'],
      ['That the microwave also has a clock', "That 'Wi-Fi' doesn't stand for anything", 'He invented a new kind of math (it is just addition)', "Why he's actually never late (time is fake)"],
    ],
  },
  {
    id: 'breaking-news',
    name: 'Breaking News',
    emoji: '📺',
    blurb: 'Cable-news coverage of Travis-related events.',
    width: 1280,
    height: 720,
    draw(ctx, w, h) {
      vgrad(ctx, 0, 0, w, h, ['#0b2a6f', '#06153d', '#020617']);
      ctx.strokeStyle = 'rgba(80,160,255,0.15)';
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      glow(ctx, 900, 300, 380, 'rgba(60,140,255,0.35)');
      emoji(ctx, '🗺️', 960, 300, 200);
      ctx.fillStyle = '#d6001c';
      ctx.fillRect(0, 470, 420, 70);
      label(ctx, 'BREAKING NEWS', 210, 507, 46);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 540, w, 120);
      ctx.fillStyle = '#0a1a40';
      ctx.fillRect(0, 660, w, 60);
      ctx.fillStyle = '#ffd400';
      ctx.fillRect(0, 660, 140, 60);
      label(ctx, 'LIVE', 70, 691, 36, '#000');
      ctx.fillStyle = '#d6001c';
      ctx.beginPath();
      ctx.arc(1210, 60, 14, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, 'TMF NEWS', 1110, 62, 34);
    },
    texts: [
      {
        x: 640,
        y: 600,
        w: 1220,
        text: "LOCAL MAN TRAVIS STILL DOESN'T KNOW WHAT'S GOING ON",
        fontSize: 52,
        color: '#0a0a0a',
        strokeWidth: 0,
        font: 'Oswald',
      },
      {
        x: 710,
        y: 691,
        w: 1120,
        text: 'Experts "not surprised" • Developing story • More at 11',
        fontSize: 30,
        color: '#ffffff',
        strokeWidth: 0,
        font: 'Oswald',
        align: 'left',
      },
    ],
    slots: [{ x: 300, y: 250, w: 420, h: 340, shape: 'rect' }],
    captionSets: [[], []],
  },
  {
    id: 'classic',
    name: 'Classic Top / Bottom',
    emoji: '🖤',
    blurb: 'Plain black canvas. Bring your own Travis.',
    width: 1000,
    height: 1000,
    draw(ctx, w, h) {
      vgrad(ctx, 0, 0, w, h, ['#16161f', '#000']);
      emoji(ctx, '🤡', 500, 500, 360);
    },
    texts: [
      { x: 500, y: 90, w: 940, text: 'Top text', fontSize: 80 },
      { x: 500, y: 910, w: 940, text: 'Bottom text', fontSize: 80 },
    ],
    slots: [{ x: 500, y: 500, w: 640, h: 640, shape: 'rect' }],
    captionSets: [
      ['Nobody:', 'Me: hey Travis', 'Travis on day 1 of his diet', 'Travis seeing a "wet paint" sign'],
      ['Travis: *chooses chaos*', 'Travis: who?', 'Also Travis: large pizza', 'Travis: touches it'],
    ],
  },
];

export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id);
