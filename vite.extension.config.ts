import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const rootDir = __dirname;

export default defineConfig({
	define: {
		'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: true,
		minify: false,
		lib: {
			entry: resolve(rootDir, 'src/web/extension.ts'),
			formats: ['cjs'],
			fileName: () => 'web/extension.js',
		},
		rollupOptions: {
			external: ['vscode'],
			output: {
				intro: 'globalThis.process = globalThis.process || { env: {} };',
			},
		},
	},
	assetsInclude: ['**/*.bpmn', '**/*.xml'],
});
