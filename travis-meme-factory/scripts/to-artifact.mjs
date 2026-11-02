// Turns dist-single/index.html into a claude.ai Artifact page body
// (the Artifact host supplies <!doctype>/<head>/<body> itself).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const html = readFileSync('dist-single/index.html', 'utf8');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const scripts = [...html.matchAll(/<script type="module"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (!scripts.length) throw new Error('no module script found');
const out = `<title>Travis Meme Factory</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${styles}</style>
<div id="root"></div>
<script type="module">${scripts.join('\n').replace(/<\/script/gi, '<\\/script')}</script>
`;
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/travis-meme-factory.html', out);
console.log('dist-artifact/travis-meme-factory.html', (out.length / 1024).toFixed(0) + ' KB');
