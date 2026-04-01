import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const rootDir = __dirname;

export default defineConfig({
	define: {
		'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
	},
	build: {
		outDir: 'dist/webview',
		emptyOutDir: false,
		sourcemap: true,
		minify: false,
		lib: {
			entry: resolve(rootDir, 'src/web/webview/app.ts'),
			name: 'FlowableBpmnWebview',
			formats: ['iife'],
			fileName: () => 'app.js',
		},
		rollupOptions: {
			output: {
				intro: 'globalThis.process = globalThis.process || { env: {} };',
			},
		},
	},
	assetsInclude: ['**/*.bpmn', '**/*.xml'],
});
