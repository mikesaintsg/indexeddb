import tseslint from 'typescript-eslint'
import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import type { Linter } from 'eslint'

/** Formatting rules - all auto-fixable with --fix */
const formattingRules: Linter.RulesRecord = {
	'indent': ['error', 'tab', { SwitchCase: 1 }],
	'quotes': ['error', 'single', { avoidEscape: true }],
	'semi': ['error', 'never'],
	'comma-dangle': ['error', 'always-multiline'],
	'no-trailing-spaces': 'error',
	'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
	'eol-last': ['error', 'always'],
	'object-curly-spacing': ['error', 'always'],
	'array-bracket-spacing': ['error', 'never'],
	'space-before-function-paren': ['error', 'never'],
	'keyword-spacing': ['error', { before: true, after: true }],
	'space-infix-ops': 'error',
	'arrow-spacing': ['error', { before: true, after: true }],
	'no-case-declarations': 'off',
}

export default defineConfig(
	// Global ignores
	{ ignores: ['dist/**', 'node_modules/**'] },

	eslint.configs.recommended,
	tseslint.configs.recommendedTypeChecked,
	tseslint.configs.stylisticTypeChecked,

	// Parser options for typed linting
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
			},
		},
	},

	// Type definition files - formatting only, disable unused vars
	{
		files: ['**/types.ts', '**/*.d.ts'],
		rules: {
			...formattingRules,
			'@typescript-eslint/no-unused-vars': 'off',
		},
	},

	// All other TypeScript files
	{
		files: ['**/*.ts'],
		ignores: ['**/types.ts', '**/*.d.ts'],
		rules: {
			...formattingRules,

			// Override unused vars with underscore pattern
			'@typescript-eslint/no-unused-vars': ['error', {
				varsIgnorePattern: '^_',
				argsIgnorePattern: '^_',
				ignoreRestSiblings: true,
			}],

			// Code quality
			'no-console': 'warn',
			'no-debugger': 'error',
			'no-var': 'error',
			'prefer-const': 'error',
		},
	},

	// Test files - relaxed rules for testing patterns
	{
		files: ['tests/**/*.ts'],
		rules: {
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
		},
	},

	// Showcase files - relaxed rules for demo code
	{
		files: ['showcase/**/*.ts'],
		rules: {
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'no-console': 'off',
		},
	},
)
