import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
	plugins: [viteSingleFile()],
	root: 'showcase',
	publicDir: false,
	build: {
		outDir: '../dist/showcase',
		emptyOutDir: true,
		sourcemap: false,
	},
	resolve: {
		alias: {
			'~/src': resolve(__dirname, '../src'),
		},
	},
})
