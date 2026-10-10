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
      /**
       * AŞAĞIDAKI İKİ QAYDA — React Compiler üçündür.
       *
       * `eslint-plugin-react-hooks` v7 onları XƏTA kimi işarələyir, lakin bu
       * layihədə React Compiler NƏ QURAŞDIRILIB, NƏ DƏ AKTİVDİR
       * (`babel-plugin-react-compiler` yoxdur, vite konfiqurasiyasında da
       * istifadə olunmur). Yəni onların icra zamanı HEÇ BİR TƏSİRİ yoxdur —
       * gələcəkdə kompilyatora keçid üçün məsləhətdirlər.
       *
       * 41 belə mesaj "xəta" kimi görünəndə həqiqi xətalar (sintaksis,
       * təyin olunmamış dəyişən) onların arasında itirdi. Ona görə onlar
       * xəbərdarlıq səviyyəsinə salınır: siqnal qalır, amma real problemləri
       * gizlətmir.
       *
       * `set-state-in-effect`: "propu state-ə köçür" nümunəsini işarələyir —
       * bu, standart və düzgün React yanaşmasıdır, qüsur deyil.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

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
