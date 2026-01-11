// ==============================================
// UX-ENHANCEMENTS.JS - Améliorations UX
// ==============================================

class UXEnhancements {
  constructor() {
    this.init();
  }

  init() {
    this.initSmoothScroll();
    this.initHeaderScroll();
    this.initLazyLoading();
    this.initTouchFeedback();
  }

  // Smooth scroll pour les liens d'ancrage
  initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        
        // Ignore # seul
        if (href === '#') return;
        
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          const headerOffset = 80;
          const elementPosition = target.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  }

  // Effet sur le header au scroll
  initHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) return;

    let lastScroll = 0;
    const scrollThreshold = 50;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll > scrollThreshold) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }

      // Optionnel : Cacher le header au scroll down, montrer au scroll up
      // if (currentScroll > lastScroll && currentScroll > scrollThreshold) {
      //   header.style.transform = 'translateY(-100%)';
      // } else {
      //   header.style.transform = 'translateY(0)';
      // }

      lastScroll = currentScroll;
    }, { passive: true });
  }

  // Lazy loading pour les images (si vous en ajoutez)
  initLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.classList.add('loaded');
              observer.unobserve(img);
            }
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  // Feedback tactile amélioré
  initTouchFeedback() {
    // Ajouter une classe 'touching' pendant le touch
    document.addEventListener('touchstart', (e) => {
      const target = e.target.closest('.btn, .nav-item, .card, .feature-card');
      if (target) {
        target.classList.add('touching');
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const target = e.target.closest('.btn, .nav-item, .card, .feature-card');
      if (target) {
        setTimeout(() => {
          target.classList.remove('touching');
        }, 150);
      }
    }, { passive: true });

    document.addEventListener('touchcancel', (e) => {
      const target = e.target.closest('.btn, .nav-item, .card, .feature-card');
      if (target) {
        target.classList.remove('touching');
      }
    }, { passive: true });
  }

  // Détection du type d'appareil
  static getDeviceType() {
    const width = window.innerWidth;
    if (width <= 480) return 'mobile-small';
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }

  // Vérifier si c'est un appareil tactile
  static isTouchDevice() {
    return (('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (navigator.msMaxTouchPoints > 0));
  }
}

// Initialiser au chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new UXEnhancements();
    
    // Ajouter une classe au body selon le type d'appareil
    document.body.classList.add(`device-${UXEnhancements.getDeviceType()}`);
    
    if (UXEnhancements.isTouchDevice()) {
      document.body.classList.add('touch-device');
    }
  });
} else {
  new UXEnhancements();
  document.body.classList.add(`device-${UXEnhancements.getDeviceType()}`);
  if (UXEnhancements.isTouchDevice()) {
    document.body.classList.add('touch-device');
  }
}

// Re-détecter le type d'appareil au redimensionnement
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // Retirer les anciennes classes
    document.body.classList.remove('device-mobile-small', 'device-mobile', 'device-tablet', 'device-desktop');
    // Ajouter la nouvelle
    document.body.classList.add(`device-${UXEnhancements.getDeviceType()}`);
  }, 250);
});

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UXEnhancements;
}
