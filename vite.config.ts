import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
	plugins: [
		dts({
			tsconfigPath: './configs/tsconfig.build.json',
			rollupTypes: true,
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			name: 'typebuilder',
			fileName: 'index',
			formats: ['es'],
		},
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: true,
	},
	resolve: {
		alias: {
			'~/src': resolve(__dirname, 'src'),
		},
	},
})
