import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      /**
       * `_` prefiksi "bilərəkdən istifadə olunmur" deməkdir.
       * Əvvəl bu qayda yalnız DƏYİŞƏNLƏRƏ tətbiq olunurdu; funksiya
       * parametrləri, tutulan xətalar və massiv destrukturlaşdırması əhatə
       * olunmurdu, ona görə `(e) => {}` kimi məcburi, lakin istifadə edilməyən
       * parametrlər xəta kimi görünürdü. İndi konvensiya hər yerdə eynidir.
       */
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z_]',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
])
