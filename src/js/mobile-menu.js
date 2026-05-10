// ==============================================
// MOBILE-MENU.JS - Mobile Navigation Handler
// Vola-ko — Mobile Topbar + Drawer
// ==============================================

class MobileMenu {
  constructor() {
    this.sidebarEventsBound = false;
    this.domObserver = null;
    this.init();
  }

  init() {
    this.createMobileQuickToggle();
    this.createOverlay();
    this.attachEventListeners();
    this.handleResize();
    this.moveControlsToQuickMenu();
    this.watchForDeferredControls();
  }

  /**
   * Create a single floating quick-controls toggle on the right edge (mobile only)
   */
  createMobileQuickToggle() {
    if (document.getElementById('mobile-quick-toggle-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'mobile-quick-toggle-wrapper';
    wrapper.className = 'mobile-quick-toggle-wrapper';
    wrapper.innerHTML = `
      <button
        type="button"
        class="mobile-quick-menu-toggle"
        id="mobile-quick-menu-toggle"
        aria-label="Ouvrir les reglages rapides"
        aria-expanded="false"
        aria-controls="mobile-quick-menu"
      >
        <span class="mobile-quick-menu-toggle__track" aria-hidden="true">
          <span class="mobile-quick-menu-toggle__thumb">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </span>
      </button>
      <div class="mobile-quick-menu" id="mobile-quick-menu" role="menu" aria-label="Menu rapide mobile">
        <span class="mobile-quick-menu-title">Reglages rapides</span>
        <div class="mobile-quick-menu-actions" id="mobile-quick-menu-actions"></div>
      </div>
    `;
    document.body.appendChild(wrapper);
  }

  /**
   * Move theme toggle and logout into expandable mobile quick menu
   */
  moveControlsToQuickMenu() {
    if (window.innerWidth > 768) return;

    const quickMenuActions = document.getElementById('mobile-quick-menu-actions');
    if (!quickMenuActions) return;

    this.ensureQuickMenuActionButton({
      sourceId: 'theme-toggle',
      cloneId: 'theme-toggle-mobile',
      iconMarkup: '<span aria-hidden="true">🌓</span>',
      label: 'Apparence'
    });

    this.ensureQuickMenuActionButton({
      sourceId: 'logout-btn',
      cloneId: 'logout-btn-mobile',
      iconMarkup: `
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      `,
      label: 'Déconnexion',
      logout: true
    });
  }

  ensureQuickMenuActionButton({ sourceId, cloneId, iconMarkup, label, logout = false }) {
    const sourceButton = document.getElementById(sourceId);
    const quickMenuActions = document.getElementById('mobile-quick-menu-actions');

    if (!sourceButton || !quickMenuActions || document.getElementById(cloneId)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = cloneId;
    button.className = 'btn btn-secondary mobile-quick-menu-item';
    if (logout) {
      button.classList.add('mobile-quick-menu-item--logout');
    }

    button.innerHTML = `${iconMarkup}<span>${label}</span>`;
    button.dataset.menuLabel = label;
    button.style.setProperty('--item-index', String(quickMenuActions.children.length));
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.addEventListener('click', () => {
      sourceButton.click();
      this.closeQuickMenu();
    });
    quickMenuActions.appendChild(button);
  }

  createOverlay() {
    if (document.querySelector('.mobile-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
  }

  attachEventListeners() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const overlay = document.querySelector('.mobile-overlay');
    const quickMenuToggle = document.getElementById('mobile-quick-menu-toggle');

    if (toggle) {
      toggle.addEventListener('click', () => this.toggleMenu());
    }

    if (overlay) {
      overlay.addEventListener('click', () => this.closeMenu());
    }

    if (quickMenuToggle) {
      quickMenuToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        this.toggleQuickMenu();
      });
    }

    document.addEventListener('click', (event) => {
      if (window.innerWidth > 768) return;

      const quickMenu = document.getElementById('mobile-quick-menu');
      const quickMenuToggleBtn = document.getElementById('mobile-quick-menu-toggle');
      if (!quickMenu || !quickMenuToggleBtn) return;

      if (!quickMenu.contains(event.target) && !quickMenuToggleBtn.contains(event.target)) {
        this.closeQuickMenu();
      }
    });

    this.attachSidebarNavListeners();

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMenu();
        this.closeQuickMenu();
      }
    });
  }

  toggleQuickMenu() {
    const quickMenu = document.getElementById('mobile-quick-menu');
    if (!quickMenu) return;

    if (quickMenu.classList.contains('open')) {
      this.closeQuickMenu();
    } else {
      this.openQuickMenu();
    }
  }

  openQuickMenu() {
    const quickMenu = document.getElementById('mobile-quick-menu');
    const toggle = document.getElementById('mobile-quick-menu-toggle');
    if (!quickMenu || !toggle) return;

    quickMenu.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Fermer les reglages rapides');
  }

  closeQuickMenu() {
    const quickMenu = document.getElementById('mobile-quick-menu');
    const toggle = document.getElementById('mobile-quick-menu-toggle');
    if (!quickMenu || !toggle) return;

    quickMenu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Ouvrir les reglages rapides');
  }

  attachSidebarNavListeners() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || sidebar.dataset.mobileMenuBound === 'true') return;

    // Close menu on nav item click (mobile)
    const navItems = sidebar.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          this.closeMenu();
        }
      });
    });

    sidebar.dataset.mobileMenuBound = 'true';
  }

  toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const body = document.body;

    if (body.classList.contains('menu-open')) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const toggle = document.querySelector('.mobile-menu-toggle');
    const body = document.body;

    body.classList.add('menu-open');
    this.closeQuickMenu();
    sidebar?.classList.add('mobile-open');
    overlay?.classList.add('active');
    toggle?.setAttribute('aria-expanded', 'true');

    // Prevent body scroll
    body.style.overflow = 'hidden';
  }

  closeMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const toggle = document.querySelector('.mobile-menu-toggle');
    const body = document.body;

    body.classList.remove('menu-open');
    sidebar?.classList.remove('mobile-open');
    overlay?.classList.remove('active');
    toggle?.setAttribute('aria-expanded', 'false');

    // Restore body scroll
    body.style.overflow = '';
  }

  handleResize() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth > 768) {
          this.closeMenu();
          this.closeQuickMenu();
        } else {
          // Populate quick menu controls on mobile
          this.moveControlsToQuickMenu();
          this.attachSidebarNavListeners();
        }
      }, 250);
    });
  }

  watchForDeferredControls() {
    if (this.domObserver) return;

    this.domObserver = new MutationObserver(() => {
      this.moveControlsToQuickMenu();
      this.attachSidebarNavListeners();
    });

    this.domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize mobile menu when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MobileMenu();
  });
} else {
  new MobileMenu();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileMenu;
}
