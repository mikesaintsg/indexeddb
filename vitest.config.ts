import { mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'
import { playwright } from '@vitest/browser-playwright'

export default mergeConfig(viteConfig, {
	test: {
		include: ['tests/**/*.test.ts'],
		browser: {
			enabled: true,
			provider: playwright(),
			instances: [
				{ browser: 'chromium' },
			],
		},
		setupFiles: ['./tests/setup.ts'],
	},
})
