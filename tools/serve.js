import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.argv[2] || '.'), port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.ttf':'font/ttf', '.woff2':'font/woff2', '.woff':'font/woff', '.md':'text/plain' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'), path = decodeURIComponent(url.pathname), target = resolve(root, `.${path}`);
    if (target !== root && !target.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const info = await stat(target), file = info.isDirectory() ? resolve(target, 'index.html') : target;
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Dither: http://127.0.0.1:${port} (serving ${root})`));
