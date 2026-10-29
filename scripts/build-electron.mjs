import { build } from 'esbuild';
import { resolve } from 'node:path';
const common = { absWorkingDir: process.cwd(), tsconfig: resolve('tsconfig.json'), bundle: true, platform: 'node', format: 'cjs', target: 'node22', sourcemap: false };
await build({ ...common, entryPoints: [resolve('electron/main.ts')], outfile: resolve('dist-electron/main.cjs'), external: ['electron', 'sql.js'] });
await build({ ...common, entryPoints: [resolve('electron/preload.ts')], outfile: resolve('dist-electron/preload.cjs'), external: ['electron'] });
