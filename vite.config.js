import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'src/index.html',
        login: 'src/login.html',
        register: 'src/register.html',
        dashboard: 'src/dashboard.html',
        expenses: 'src/expenses.html',
        incomes: 'src/incomes.html',
        budgets: 'src/budgets.html',
        reports: 'src/reports.html',
        settings: 'src/settings.html'
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
  }
});
