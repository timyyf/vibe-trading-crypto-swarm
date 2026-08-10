// Copia mirofish/worlds para dist/mirofish/worlds durante o build.
// Garante que o server bundle (dist/server.cjs) e a publish Netlify encontrem os worlds.
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'mirofish', 'worlds');
const DEST = path.join(ROOT, 'dist', 'mirofish', 'worlds');

await mkdir(path.dirname(DEST), { recursive: true });
await cp(SRC, DEST, { recursive: true });
console.log(`[copy-worlds] ${SRC} -> ${DEST}`);
