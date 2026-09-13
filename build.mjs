import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

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
      if (file.endsWith('.wasm')) {
        fs.copyFileSync(path.join(ooxmlDist, file), path.join('dist', file));
        console.log(`[asset] Copied ${file} to dist/`);
      }
    }
  }
}

copyAssets();

// 1. Extension Host Build (Node CJS)
const extensionContext = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  external: ['vscode'],
  outfile: 'dist/extension.js',
  sourcemap: !isProduction,
  minify: isProduction,
});

// 2. Webview Client Build (Browser IIFE)
const webviewContext = await esbuild.context({
  entryPoints: ['src/webview/index.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/webview.js',
  sourcemap: !isProduction,
  minify: isProduction,
});

if (isWatch) {
  await Promise.all([extensionContext.watch(), webviewContext.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([extensionContext.rebuild(), webviewContext.rebuild()]);
  await Promise.all([extensionContext.dispose(), webviewContext.dispose()]);
  console.log('Build completed successfully.');
}
