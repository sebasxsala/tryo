import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	minify: true,
	clean: true,
	treeshake: true,
	metafile: true,
	target: 'es2020',
	sourcemap: true,
	splitting: false,
});
