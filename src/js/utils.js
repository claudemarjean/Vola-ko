/**
 * UTILS.JS - Utility Functions
 * Fonctions utilitaires partagées
 */

/**
 * Categories Configuration
 */
export const CATEGORIES = [
  { id: 'alimentation', name: 'Alimentation', icon: '🛒', color: '#10b981' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#3b82f6' },
  { id: 'logement', name: 'Logement', icon: '🏠', color: '#f59e0b' },
  { id: 'sante', name: 'Santé', icon: '💊', color: '#ef4444' },
  { id: 'loisirs', name: 'Loisirs', icon: '🎮', color: '#8b5cf6' },
  { id: 'autre', name: 'Autre', icon: '📦', color: '#6b7280' }
];

/**
 * Currencies Configuration
 */
export const CURRENCIES = [
  { code: 'MGA', symbol: 'MGA', name: 'Ariary Malgache' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'Dollar Américain' }
];

/**
 * Format currency
 */
export function formatCurrency(amount, currency = 'MGA') {
  const formatted = new Intl.NumberFormat('fr-FR').format(amount);
  return `${formatted} ${currency}`;
}

/**
 * Format date
 */
export function formatDate(dateString, locale = 'fr-FR') {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, { 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format relative date (e.g., "Il y a 2 jours")
 */
export function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Aujourd\'hui';
  if (diff === 1) return 'Hier';
  if (diff < 7) return `Il y a ${diff} jours`;
  if (diff < 30) return `Il y a ${Math.floor(diff / 7)} semaines`;
  if (diff < 365) return `Il y a ${Math.floor(diff / 30)} mois`;
  
  return formatDate(dateString);
}

/**
 * Get category by ID
 */
export function getCategoryById(id) {
  return CATEGORIES.find(cat => cat.id === id);
}

/**
 * Get category icon
 */
export function getCategoryIcon(categoryId) {
  const category = getCategoryById(categoryId);
  return category ? category.icon : '📦';
}

/**
 * Get category name
 */
export function getCategoryName(categoryId) {
  const category = getCategoryById(categoryId);
  return category ? category.name : categoryId;
}

/**
 * Validate email
 */
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Generate unique ID
 */
export function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value, total) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Get current month range
 */
export function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

/**
 * Get current year range
 */
export function getCurrentYearRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  return { start, end };
}

/**
 * Filter by date range
 */
export function filterByDateRange(items, startDate, endDate) {
  return items.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= startDate && itemDate <= endDate;
  });
}

/**
 * Sum amounts
 */
export function sumAmounts(items) {
  return items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
}

/**
 * Group by category
 */
export function groupByCategory(items) {
  return items.reduce((groups, item) => {
    const category = item.category || 'autre';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {});
}

/**
 * Show notification (simple alert for now, can be improved)
 */
export function showNotification(message, type = 'info') {
  // TODO: Implement better notification system (toast, etc.)
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // Simple alert for now
  if (type === 'error') {
    alert(`❌ ${message}`);
  } else if (type === 'success') {
    alert(`✅ ${message}`);
  }
}

/**
 * Confirm action
 */
export function confirmAction(message) {
  return confirm(message);
}

export default {
  CATEGORIES,
  CURRENCIES,
  formatCurrency,
  formatDate,
  formatRelativeDate,
  getCategoryById,
  getCategoryIcon,
  getCategoryName,
  validateEmail,
  generateId,
  debounce,
  calculatePercentage,
  getCurrentMonthRange,
  getCurrentYearRange,
  filterByDateRange,
  sumAmounts,
  groupByCategory,
  showNotification,
  confirmAction
};
