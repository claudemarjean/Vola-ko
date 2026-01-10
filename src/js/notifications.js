/**
 * NOTIFICATIONS.JS - Modern Notification System
 * Système de notifications et alertes personnalisé, moderne et responsive
 */

class NotificationSystem {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    // Créer le conteneur de notifications s'il n'existe pas
    if (!document.getElementById('notification-container')) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('notification-container');
    }
  }

  /**
   * Afficher une notification toast
   * @param {string} message - Message à afficher
   * @param {string} type - Type: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Durée en ms (0 = permanent)
   */
  show(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} notification-enter`;

    const icon = this.getIcon(type);
    
    notification.innerHTML = `
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">
        <p class="notification-message">${message}</p>
      </div>
      <button class="notification-close" aria-label="Fermer">✕</button>
    `;

    this.container.appendChild(notification);

    // Animation d'entrée
    setTimeout(() => {
      notification.classList.remove('notification-enter');
      notification.classList.add('notification-show');
    }, 10);

    // Bouton de fermeture
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this.remove(notification));

    // Auto-fermeture
    if (duration > 0) {
      setTimeout(() => this.remove(notification), duration);
    }

    return notification;
  }

  /**
   * Afficher une notification de succès
   */
  success(message, duration = 4000) {
    return this.show(message, 'success', duration);
  }

  /**
   * Afficher une notification d'erreur
   */
  error(message, duration = 5000) {
    return this.show(message, 'error', duration);
  }

  /**
   * Afficher une notification d'avertissement
   */
  warning(message, duration = 4500) {
    return this.show(message, 'warning', duration);
  }

  /**
   * Afficher une notification d'information
   */
  info(message, duration = 4000) {
    return this.show(message, 'info', duration);
  }

  /**
   * Afficher une modal d'alerte (remplace alert())
   */
  alert(message, title = 'Information', type = 'info') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'notification-modal-overlay notification-modal-enter';

      const icon = this.getIcon(type);
      const iconColor = this.getIconColor(type);

      overlay.innerHTML = `
        <div class="notification-modal notification-modal-${type}">
          <div class="notification-modal-header">
            <div class="notification-modal-icon" style="background: ${iconColor}">
              ${icon}
            </div>
            <h3 class="notification-modal-title">${title}</h3>
          </div>
          <div class="notification-modal-body">
            <p class="notification-modal-message">${message}</p>
          </div>
          <div class="notification-modal-footer">
            <button class="notification-modal-btn notification-modal-btn-primary" data-action="ok">
              OK
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Animation d'entrée
      setTimeout(() => {
        overlay.classList.remove('notification-modal-enter');
      }, 10);

      // Gestion du bouton OK
      const okBtn = overlay.querySelector('[data-action="ok"]');
      okBtn.addEventListener('click', () => {
        this.closeModal(overlay);
        resolve(true);
      });

      // Focus sur le bouton
      setTimeout(() => okBtn.focus(), 100);
    });
  }

  /**
   * Afficher une modal de confirmation (remplace confirm())
   */
  confirm(message, title = 'Confirmation', options = {}) {
    return new Promise((resolve) => {
      const {
        confirmText = 'Confirmer',
        cancelText = 'Annuler',
        type = 'warning',
        danger = false
      } = options;

      const overlay = document.createElement('div');
      overlay.className = 'notification-modal-overlay notification-modal-enter';

      const icon = this.getIcon(type);
      const iconColor = this.getIconColor(type);

      overlay.innerHTML = `
        <div class="notification-modal notification-modal-${type}">
          <div class="notification-modal-header">
            <div class="notification-modal-icon" style="background: ${iconColor}">
              ${icon}
            </div>
            <h3 class="notification-modal-title">${title}</h3>
          </div>
          <div class="notification-modal-body">
            <p class="notification-modal-message">${message}</p>
          </div>
          <div class="notification-modal-footer">
            <button class="notification-modal-btn notification-modal-btn-secondary" data-action="cancel">
              ${cancelText}
            </button>
            <button class="notification-modal-btn ${danger ? 'notification-modal-btn-danger' : 'notification-modal-btn-primary'}" data-action="confirm">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Animation d'entrée
      setTimeout(() => {
        overlay.classList.remove('notification-modal-enter');
      }, 10);

      // Gestion des boutons
      const confirmBtn = overlay.querySelector('[data-action="confirm"]');
      const cancelBtn = overlay.querySelector('[data-action="cancel"]');

      confirmBtn.addEventListener('click', () => {
        this.closeModal(overlay);
        resolve(true);
      });

      cancelBtn.addEventListener('click', () => {
        this.closeModal(overlay);
        resolve(false);
      });

      // Fermeture au clic sur l'overlay
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeModal(overlay);
          resolve(false);
        }
      });

      // Focus sur le bouton de confirmation
      setTimeout(() => confirmBtn.focus(), 100);
    });
  }

  /**
   * Supprimer une notification
   */
  remove(notification) {
    notification.classList.remove('notification-show');
    notification.classList.add('notification-exit');
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  /**
   * Fermer une modal
   */
  closeModal(overlay) {
    const modal = overlay.querySelector('.notification-modal');
    modal.classList.add('notification-modal-exit');
    overlay.classList.add('notification-modal-overlay-exit');
    
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 300);
  }

  /**
   * Obtenir l'icône selon le type
   */
  getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  /**
   * Obtenir la couleur de l'icône selon le type
   */
  getIconColor(type) {
    const colors = {
      success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    };
    return colors[type] || colors.info;
  }

  /**
   * Supprimer toutes les notifications
   */
  clearAll() {
    const notifications = this.container.querySelectorAll('.notification');
    notifications.forEach(notification => this.remove(notification));
  }
}

// Instance globale
const notify = new NotificationSystem();

export default notify;
