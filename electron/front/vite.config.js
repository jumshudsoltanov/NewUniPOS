import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0', // Allow all network interfaces
    port: 5173,
    strictPort: true,
  },
  esbuild: {
    /**
     * PERFORMANS: bütün `console.*` və `debugger` ifadələri BURAXILIŞ paketindən
     * tamamilə çıxarılır.
     *
     * Niyə mənbədən silmək əvəzinə belə:
     *   • Layihədə 1100-dən çox console çağırışı var; onların onlarcası
     *     mötərizəsiz `if`, `else` və ox funksiyalarının gövdəsindədir
     *     (`.catch(err => console.error(...))`). Mexaniki silinmə kodu sındırardı.
     *   • esbuild çağırışı ARQUMENTLƏRİ İLƏ BİRLİKDƏ atır, yəni şablon sətirləri
     *     və `JSON.stringify(...)` kimi ağır ifadələr ümumiyyətlə hesablanmır.
     *     Sətri sadəcə silməklə eyni nəticədir, amma risksizdir.
     *   • `npm run dev`-də loglar olduğu kimi qalır, nasazlıq axtarışı pozulmur.
     *
     * Qeyd: `drop` yalnız build-ə təsir edir, dev serverə yox.
     */
    drop: ['console', 'debugger'],
  },
  build: {
    sourcemap: true
  }
})
