import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const THREE = ['three', 'three/*', 'troika-three-text']

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // src/lib is the pure model (house spec, plan drawing, timelines). It must stay free of
    // rendering, React and DOM code so it can be tested in Node and reused for framing.
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...THREE, 'react', 'react/*', 'react-dom', 'react-dom/*', 'next', 'next/*'],
              message: 'src/lib is pure TypeScript: no three, React or Next imports.',
            },
            {
              group: ['@/scene/*', '@/components/*', '@/client/*', '@/app/*', '@/content/*'],
              message: 'src/lib may not depend on the app, DOM or scene layers.',
            },
          ],
        },
      ],
    },
  },
  {
    // three.js reaches the browser only through the lazy import() in StageMount, which keeps
    // it out of the initial bundle. (Dynamic imports are not checked by this rule.)
    files: ['src/app/**', 'src/components/**', 'src/content/**', 'src/client/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...THREE, '@/scene/*'],
              message: 'Load the 3D stage lazily via StageMount; never import three statically.',
            },
          ],
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'artifacts/**', 'next-env.d.ts']),
])
