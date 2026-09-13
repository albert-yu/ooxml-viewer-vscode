import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { mainThreadOnlyWorkerStubs } from './esbuild-worker-stub.mjs';

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Copy WASM and worker assets from @silurus/ooxml into dist/
function copyAssets() {
  const ooxmlDist = path.resolve('node_modules/@silurus/ooxml/dist');
  if (fs.existsSync(ooxmlDist)) {
    const files = fs.readdirSync(ooxmlDist);
    for (const file of files) {
      const fullPath = path.join(ooxmlDist, file);
      if (file.endsWith('.wasm')) {
        fs.copyFileSync(fullPath, path.join('dist', file));
        console.log(`[asset] Copied ${file} to dist/`);
      } else if (file === 'assets' && fs.statSync(fullPath).isDirectory()) {
        fs.cpSync(fullPath, path.join('dist', 'assets'), { recursive: true });
        console.log(`[asset] Copied assets/ directory to dist/assets`);
      }
    }
  }
}

copyAssets();

// 1. Extension Host Build (Node CJS)
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  external: ['vscode'],
  outfile: 'dist/extension.js',
  sourcemap: !isProduction,
  minify: isProduction,
};

// 2. Webview Client Build (Browser IIFE)
const webviewConfig = {
  entryPoints: ['src/webview/index.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  outfile: 'dist/webview.js',
  sourcemap: !isProduction,
  minify: isProduction,
  define: {
    'import.meta.url': 'self.location.href',
  },
  loader: {
    '.wasm': 'file',
  },
  plugins: [mainThreadOnlyWorkerStubs],
};

if (isWatch) {
  const [extCtx, wvCtx] = await Promise.all([
    esbuild.context(extensionConfig),
    esbuild.context(webviewConfig),
  ]);
  await Promise.all([extCtx.watch(), wvCtx.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([
    esbuild.build(extensionConfig),
    esbuild.build(webviewConfig),
  ]);
  console.log('Build completed successfully.');
}
