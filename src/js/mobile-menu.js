// ==============================================
// MOBILE-MENU.JS - Mobile Navigation Handler
// ==============================================

class MobileMenu {
  constructor() {
    this.init();
  }

  init() {
    this.createMobileToggle();
    this.createOverlay();
    this.attachEventListeners();
    this.handleResize();
  }

  createMobileToggle() {
    // Check if toggle already exists
    if (document.querySelector('.mobile-menu-toggle')) return;

    const toggle = document.createElement('button');
    toggle.className = 'mobile-menu-toggle';
    toggle.setAttribute('aria-label', 'Toggle menu');
    toggle.innerHTML = `
      <span class="icon">☰</span>
      <span class="hide-mobile" data-i18n="nav.menu">Menu</span>
    `;
    document.body.appendChild(toggle);
  }

  createOverlay() {
    // Check if overlay already exists
    if (document.querySelector('.mobile-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    document.body.appendChild(overlay);
  }

  attachEventListeners() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const overlay = document.querySelector('.mobile-overlay');
    const sidebar = document.querySelector('.sidebar');

    if (toggle) {
      toggle.addEventListener('click', () => this.toggleMenu());
    }

    if (overlay) {
      overlay.addEventListener('click', () => this.closeMenu());
    }

    // Close menu on nav item click (mobile)
    if (sidebar) {
      const navItems = sidebar.querySelectorAll('.nav-item');
      navItems.forEach(item => {
        item.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            this.closeMenu();
          }
        });
      });
    }

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMenu();
      }
    });
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
    const body = document.body;

    body.classList.add('menu-open');
    sidebar?.classList.add('mobile-open');
    overlay?.classList.add('active');
    
    // Prevent body scroll
    body.style.overflow = 'hidden';
  }

  closeMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const body = document.body;

    body.classList.remove('menu-open');
    sidebar?.classList.remove('mobile-open');
    overlay?.classList.remove('active');
    
    // Restore body scroll
    body.style.overflow = '';
  }

  handleResize() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Close menu when resizing to desktop
        if (window.innerWidth > 768) {
          this.closeMenu();
        }
      }, 250);
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
