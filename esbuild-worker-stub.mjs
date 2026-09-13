/**
 * The VS Code webview always renders on the main thread. Replace worker
 * entry mechanisms before esbuild traverses them.
 */
export const mainThreadOnlyWorkerStubs = {
  name: 'main-thread-only-worker-stubs',
  setup(build) {
    build.onResolve({ filter: /render-worker-host/ }, (args) => ({
      path: args.path,
      namespace: 'stub-render-worker-host',
    }));
    build.onLoad({ filter: /.*/, namespace: 'stub-render-worker-host' }, () => ({
      contents:
        "export function createRenderWorker() {" +
        " throw new Error('[ooxml] worker rendering is not available in the VS Code extension (main-thread only)'); }",
      loader: 'js',
    }));

    build.onResolve({ filter: /\?worker&inline$/ }, (args) => ({
      path: args.path,
      namespace: 'stub-inline-worker',
    }));
    build.onLoad({ filter: /.*/, namespace: 'stub-inline-worker' }, () => ({
      contents:
        "export default class MainThreadOnlyWorker {" +
        " constructor() { throw new Error('[ooxml] parser worker is not available in the VS Code extension (main-thread only)'); }" +
        " }",
      loader: 'js',
    }));
  },
};
