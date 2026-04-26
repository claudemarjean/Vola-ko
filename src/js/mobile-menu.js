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
    this.createMobileTopbar();
    this.createOverlay();
    this.attachEventListeners();
    this.handleResize();
    this.moveControlsToTopbar();
    this.watchForDeferredControls();
  }

  /**
   * Create a proper sticky mobile topbar (replaces the floating hamburger)
   */
  createMobileTopbar() {
    if (document.querySelector('.mobile-topbar')) return;

    const topbar = document.createElement('header');
    topbar.className = 'mobile-topbar';
    topbar.setAttribute('role', 'banner');
    topbar.setAttribute('aria-label', 'Navigation mobile');
    topbar.innerHTML = `
      <a href="/" class="mobile-topbar-brand" data-link>
        <span class="mobile-topbar-brand-icon" aria-hidden="true">💰</span>
        <span class="mobile-topbar-brand-name">Vola-ko</span>
      </a>
      <div class="mobile-topbar-right" id="mobile-topbar-right">
        <!-- Controls moved here by JS -->
      </div>
    `;
    document.body.prepend(topbar);
  }

  /**
   * Move theme toggle and language selector into mobile topbar
   */
  moveControlsToTopbar() {
    if (window.innerWidth > 768) return;

    const topbarRight = document.getElementById('mobile-topbar-right');
    if (!topbarRight) return;

    // Clone theme toggle if it exists
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle && !document.getElementById('theme-toggle-mobile')) {
      const clone = themeToggle.cloneNode(true);
      clone.id = 'theme-toggle-mobile';
      clone.style.cssText = 'width:36px;height:36px;padding:0;font-size:1rem;border-radius:var(--radius-md);background:var(--bg-secondary);border:1px solid var(--border-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;';
      clone.addEventListener('click', () => themeToggle.click());
      topbarRight.appendChild(clone);
    }
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

    if (toggle) {
      toggle.addEventListener('click', () => this.toggleMenu());
    }

    if (overlay) {
      overlay.addEventListener('click', () => this.closeMenu());
    }

    this.attachSidebarNavListeners();

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMenu();
      }
    });
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
        } else {
          // Populate topbar controls on mobile
          this.moveControlsToTopbar();
          this.attachSidebarNavListeners();
        }
      }, 250);
    });
  }

  watchForDeferredControls() {
    if (this.domObserver) return;

    this.domObserver = new MutationObserver(() => {
      this.moveControlsToTopbar();
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
