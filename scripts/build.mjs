import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function build() {
  const htmlPath = path.join(root, 'src', 'index.html');
  const cachePath = path.join(root, 'data', 'mcd-menu.json');
  const outDir = path.join(root, 'dist');
  const outPath = path.join(outDir, 'maimai-restaurant.html');
  const rootOutPath = path.join(root, 'maimai-restaurant.html');
  // docs/ 用于静态托管：既是 GitHub Pages 的发布源，也是在线试玩页的部署目录
  const docsDir = path.join(root, 'docs');
  const docsOutPath = path.join(docsDir, 'index.html');

  let html = fs.readFileSync(htmlPath, 'utf-8');

  let cacheScript = 'window.MCD_MENU_CACHE = null;';
  if (fs.existsSync(cachePath)) {
    try {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      cacheScript = `window.MCD_MENU_CACHE = ${JSON.stringify(cache)};`;
    } catch (e) {
      console.warn('MCP cache parse failed, using null', e.message);
    }
  }

  html = html.replace('// __INLINE_MCP_CACHE__', cacheScript);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(outPath, html, 'utf-8');
  fs.writeFileSync(rootOutPath, html, 'utf-8');
  fs.writeFileSync(docsOutPath, html, 'utf-8');
  console.log(`Built: ${outPath}`);
  console.log(`Built: ${rootOutPath}`);
  console.log(`Built: ${docsOutPath}`);
}

build();

if (process.argv.includes('--watch')) {
  const files = [
    path.join(root, 'src', 'index.html'),
    path.join(root, 'data', 'mcd-menu.json')
  ];
  let timer = null;
  for (const f of files) {
    fs.watchFile(f, { interval: 300 }, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        console.log('Change detected, rebuilding...');
        build();
      }, 100);
    });
  }
  console.log('Watching for changes...');
}
