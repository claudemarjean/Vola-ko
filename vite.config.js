import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        login: resolve(__dirname, 'src/login.html'),
        register: resolve(__dirname, 'src/register.html'),
        dashboard: resolve(__dirname, 'src/dashboard.html'),
        expenses: resolve(__dirname, 'src/expenses.html'),
        incomes: resolve(__dirname, 'src/incomes.html'),
        budgets: resolve(__dirname, 'src/budgets.html'),
        reports: resolve(__dirname, 'src/reports.html'),
        settings: resolve(__dirname, 'src/settings.html')
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      },
      mangle: true,
      format: {
        comments: false
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'locales/*',
          dest: 'locales'
        }
      ]
    })
  ]
});
