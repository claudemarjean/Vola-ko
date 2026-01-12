/**
 * SYNC_STATUS.JS - Sync Status Monitor
 * Affichage de l'état de synchronisation pour l'utilisateur
 */

import { syncManager } from './sync.js';

class SyncStatusMonitor {
  constructor() {
    this.statusElement = null;
    this.init();
  }

  /**
   * Initialiser le moniteur de statut
   */
  init() {
    // Créer l'élément de statut s'il n'existe pas
    this.createStatusElement();

    // S'abonner aux changements de statut
    syncManager.onSyncStatusChange((status) => {
      this.updateStatus(status);
    });

    // Mettre à jour le statut initial
    this.updateStatus({
      online: navigator.onLine,
      syncing: false,
      lastSync: null
    });
  }

  /**
   * Créer l'élément de statut dans le DOM
   */
  createStatusElement() {
    // Vérifier si l'élément existe déjà
    this.statusElement = document.getElementById('sync-status');
    
    if (!this.statusElement) {
      // Créer l'élément
      this.statusElement = document.createElement('div');
      this.statusElement.id = 'sync-status';
      this.statusElement.className = 'sync-status';
      
      // Injecter le HTML
      this.statusElement.innerHTML = `
        <div class="sync-status-content">
          <span class="sync-icon">⚡</span>
          <span class="sync-text">Initialisation...</span>
        </div>
      `;

      // Ajouter au body
      document.body.appendChild(this.statusElement);

      // Ajouter les styles
      this.injectStyles();
    }
  }

  /**
   * Injecter les styles CSS pour le statut de synchronisation
   */
  injectStyles() {
    const styleId = 'sync-status-styles';
    
    // Ne pas injecter si les styles existent déjà
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .sync-status {
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: var(--bg-secondary, #f8f9fa);
        border: 1px solid var(--border-color, #dee2e6);
        border-radius: 8px;
        padding: 8px 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        transition: all 0.3s ease;
        font-size: 13px;
      }

      .sync-status.online {
        border-color: var(--success-color, #28a745);
      }

      .sync-status.offline {
        border-color: var(--warning-color, #ffc107);
        background: var(--warning-bg, #fff3cd);
      }

      .sync-status.syncing {
        border-color: var(--primary-color, #007bff);
      }

      .sync-status.error {
        border-color: var(--danger-color, #dc3545);
        background: var(--danger-bg, #f8d7da);
      }

      .sync-status-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .sync-icon {
        font-size: 16px;
        animation: none;
      }

      .sync-status.syncing .sync-icon {
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .sync-text {
        color: var(--text-primary, #212529);
        font-weight: 500;
      }

      /* Mode sombre */
      [data-theme="dark"] .sync-status {
        background: var(--bg-secondary, #2d3748);
        border-color: var(--border-color, #4a5568);
      }

      [data-theme="dark"] .sync-text {
        color: var(--text-primary, #e2e8f0);
      }

      /* Responsive */
      @media (max-width: 768px) {
        .sync-status {
          bottom: 70px;
          right: 10px;
          font-size: 12px;
          padding: 6px 12px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Mettre à jour le statut affiché
   */
  updateStatus(status) {
    if (!this.statusElement) {
      return;
    }

    const { online, syncing, lastSync, error } = status;

    // Supprimer toutes les classes de statut
    this.statusElement.classList.remove('online', 'offline', 'syncing', 'error');

    let icon = '⚡';
    let text = '';
    let statusClass = '';

    if (error) {
      icon = '⚠️';
      text = 'Erreur de synchronisation';
      statusClass = 'error';
    } else if (!online) {
      icon = '📡';
      text = 'Hors ligne';
      statusClass = 'offline';
    } else if (syncing) {
      icon = '🔄';
      text = 'Synchronisation...';
      statusClass = 'syncing';
    } else if (lastSync) {
      icon = '✓';
      text = `Synchronisé ${this.formatLastSync(lastSync)}`;
      statusClass = 'online';
    } else {
      icon = '⚡';
      text = 'En ligne';
      statusClass = 'online';
    }

    // Appliquer la classe de statut
    this.statusElement.classList.add(statusClass);

    // Mettre à jour le contenu
    const iconElement = this.statusElement.querySelector('.sync-icon');
    const textElement = this.statusElement.querySelector('.sync-text');

    if (iconElement) {
      iconElement.textContent = icon;
    }

    if (textElement) {
      textElement.textContent = text;
    }
  }

  /**
   * Formater la date de dernière synchronisation
   */
  formatLastSync(lastSync) {
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return 'à l\'instant';
    } else if (diffMins < 60) {
      return `il y a ${diffMins}min`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return `il y a ${diffHours}h`;
      } else {
        return date.toLocaleDateString();
      }
    }
  }

  /**
   * Masquer le statut
   */
  hide() {
    if (this.statusElement) {
      this.statusElement.style.display = 'none';
    }
  }

  /**
   * Afficher le statut
   */
  show() {
    if (this.statusElement) {
      this.statusElement.style.display = 'block';
    }
  }
}

// Instance singleton
export const syncStatusMonitor = new SyncStatusMonitor();
