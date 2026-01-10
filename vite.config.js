import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: 'src',
  server: {
    // Middleware pour gérer les URLs sans extension .html
    middlewareMode: false,
    proxy: {}
  },
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
        settings: resolve(__dirname, 'src/settings.html'),
        savings: resolve(__dirname, 'src/savings.html')
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
    }),
    // Plugin pour supporter les URLs sans extension .html
    {
      name: 'html-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          
          // Ignorer les fichiers statiques (CSS, JS, images, etc.)
          if (url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json)$/)) {
            return next();
          }
          
          // Si l'URL ne se termine pas par .html et n'est pas un fichier statique
          if (!url.includes('.') && url !== '/') {
            // Supprimer le trailing slash si présent
            const cleanUrl = url.replace(/\/$/, '');
            // Ajouter .html à l'URL
            req.url = cleanUrl + '.html';
          } else if (url === '/') {
            req.url = '/index.html';
          }
          
          next();
        });
      }
    }
  ]
});
