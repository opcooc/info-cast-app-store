import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['platform/**/*.ts'],
  splitting: false,
  sourcemap: false,
  clean: true,
  format: ['cjs'],
  outDir: 'dist',
  minify: true,
  outExtension: ({ format }) =>
    format === 'cjs' ? { js: '.cjs' } : { js: '.js' },
});
