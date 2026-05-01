import { supabase, SUPABASE_TABLES } from './supabase.js';
import { ensureOnlineForCriticalAction } from './network.js';
import { withGlobalLoader } from './loaders.js';

const AUTH_STORAGE_KEYS = ['tvolako_user', 'tvolako_token', 'volako-auth-token'];
let authRedirectTriggered = false;

function cleanupAuthStorage() {
  AUTH_STORAGE_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures to avoid masking auth errors.
    }
  });
}

function redirectToLoginOnce() {
  if (authRedirectTriggered) {
    return;
  }

  authRedirectTriggered = true;
  cleanupAuthStorage();

  if (window.location.pathname !== '/login' && window.location.pathname !== '/login.html') {
    window.location.href = '/login';
  }
}

function isAuthError(error) {
  if (!error) {
    return false;
  }

  const code = (error.code || '').toUpperCase();
  const message = (error.message || '').toLowerCase();
  return (
    code === 'PGRST301' ||
    code === '401' ||
    message.includes('jwt') ||
    message.includes('auth') ||
    message.includes('not authenticated') ||
    message.includes('session')
  );
}

function formatSupabaseError(error, fallback) {
  if (!error) {
    return fallback;
  }

  const parts = [];
  if (error.message) {
    parts.push(error.message);
  }
  if (error.code) {
    parts.push(`code: ${error.code}`);
  }
  if (error.details) {
    parts.push(`details: ${error.details}`);
  }
  if (error.hint) {
    parts.push(`hint: ${error.hint}`);
  }

  return parts.length ? parts.join(' | ') : fallback;
}

async function requireUserId() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user?.id) {
    redirectToLoginOnce();
    throw new Error('Session expiree. Veuillez vous reconnecter.');
  }

  return session.user.id;
}

function handleDbError(error, fallback = 'Erreur base de donnees') {
  if (!error) {
    return;
  }

  if (isAuthError(error)) {
    redirectToLoginOnce();
    throw new Error('Session expiree. Veuillez vous reconnecter.');
  }

  const message = formatSupabaseError(error, fallback);
  throw new Error(message);
}

export async function fetchTable(tableName, options = {}) {
  return withGlobalLoader(async () => {
    const userId = await requireUserId();
    const {
      columns = '*',
      orderBy = 'created_at',
      ascending = false,
      filters = []
    } = options;

    let query = supabase
      .from(tableName)
      .select(columns)
      .eq('user_id', userId);

    for (const filter of filters) {
      query = query[filter.operator](filter.column, filter.value);
    }

    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }

    const { data, error } = await query;
    handleDbError(error, `Impossible de lire ${tableName}`);
    return data || [];
  }, { message: 'Recuperation des donnees...' });
}

export async function insertRow(tableName, payload, actionLabel) {
  return withGlobalLoader(async () => {
    if (!ensureOnlineForCriticalAction(actionLabel)) {
      throw new Error('MODE_HORS_LIGNE');
    }

    const userId = await requireUserId();
    const { data, error } = await supabase
      .from(tableName)
      .insert([{ ...payload, user_id: userId }])
      .select()
      .single();

    handleDbError(error, `Impossible d'ajouter dans ${tableName}`);
    return data;
  }, { message: 'Enregistrement en cours...' });
}

export async function updateRow(tableName, id, payload, actionLabel) {
  return withGlobalLoader(async () => {
    if (!ensureOnlineForCriticalAction(actionLabel)) {
      throw new Error('MODE_HORS_LIGNE');
    }

    const userId = await requireUserId();
    const { data, error } = await supabase
      .from(tableName)
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    handleDbError(error, `Impossible de modifier ${tableName}`);
    return data;
  }, { message: 'Mise a jour en cours...' });
}

export async function deleteRow(tableName, id, actionLabel) {
  return withGlobalLoader(async () => {
    if (!ensureOnlineForCriticalAction(actionLabel)) {
      throw new Error('MODE_HORS_LIGNE');
    }

    const userId = await requireUserId();
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    handleDbError(error, `Impossible de supprimer dans ${tableName}`);
  }, { message: 'Suppression en cours...' });
}

export async function callRpc(name, params = {}, actionLabel = 'Cette action') {
  return withGlobalLoader(async () => {
    if (!ensureOnlineForCriticalAction(actionLabel)) {
      throw new Error('MODE_HORS_LIGNE');
    }

    const { data, error } = await supabase.rpc(name, params);
    handleDbError(error, `RPC ${name} en erreur`);
    return data;
  }, { message: 'Chargement des donnees...' });
}

/**
 * Charger toutes les catégories accessibles par l'utilisateur connecté
 * (catégories système user_id IS NULL + catégories custom de l'utilisateur)
 */
export async function fetchCategories() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.CATEGORIES)
    .select('id, slug, name, icon, color, sort_order, is_default, user_id')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('sort_order', { ascending: true });

  handleDbError(error, 'Impossible de charger les catégories');
  // Mapper slug → id pour compatibilité avec le reste de l'application
  return (data || []).map(cat => ({
    id: cat.slug,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    sort_order: cat.sort_order,
    is_default: cat.is_default,
    db_id: cat.id
  }));
}

export async function createCustomCategory(payload) {
  return withGlobalLoader(async () => {
    if (!ensureOnlineForCriticalAction('Creation de categorie')) {
      throw new Error('MODE_HORS_LIGNE');
    }

    const userId = await requireUserId();
    const { data, error } = await supabase
      .from(SUPABASE_TABLES.CATEGORIES)
      .insert([{
        slug: payload.slug,
        name: payload.name,
        icon: payload.icon || '📦',
        color: payload.color || '#6b7280',
        sort_order: payload.sort_order ?? 99,
        is_default: false,
        user_id: userId
      }])
      .select('id, slug, name, icon, color, sort_order, is_default, user_id')
      .single();

    handleDbError(error, 'Impossible de creer la categorie');
    return data;
  }, { message: 'Creation de la categorie...' });
}

export async function deleteCustomCategory(categoryDbId) {
  return withGlobalLoader(async () => {
    if (!ensureOnlineForCriticalAction('Suppression de categorie')) {
      throw new Error('MODE_HORS_LIGNE');
    }

    const userId = await requireUserId();
    const { error } = await supabase
      .from(SUPABASE_TABLES.CATEGORIES)
      .delete()
      .eq('id', categoryDbId)
      .eq('user_id', userId)
      .eq('is_default', false);

    handleDbError(error, 'Impossible de supprimer la categorie');
  }, { message: 'Suppression de la categorie...' });
}

export async function fetchDashboardSnapshot() {
  const userId = await requireUserId();
  const data = await callRpc('volako_get_dashboard_snapshot', { p_user_id: userId }, 'Chargement du dashboard');
  return data?.[0] || null;
}

export async function fetchDashboardRecentTransactions(limit = 5) {
  const userId = await requireUserId();
  return callRpc('volako_get_dashboard_recent_transactions', { p_user_id: userId, p_limit: limit }, 'Chargement des transactions');
}

export async function fetchDashboardCategoryBreakdown() {
  const userId = await requireUserId();
  return callRpc('volako_get_dashboard_category_breakdown', { p_user_id: userId }, 'Chargement du dashboard');
}

export async function fetchDashboardTrend7() {
  const userId = await requireUserId();
  return callRpc('volako_get_dashboard_trend7', { p_user_id: userId }, 'Chargement du dashboard');
}

export async function fetchDashboardBudgetUsage() {
  const userId = await requireUserId();
  return callRpc('volako_get_dashboard_budget_usage', { p_user_id: userId }, 'Chargement du dashboard');
}

export async function fetchDashboardBalance12Months() {
  const userId = await requireUserId();
  return callRpc('volako_get_dashboard_balance_12m', { p_user_id: userId }, 'Chargement du dashboard');
}

export async function fetchReportsSummary(period) {
  const userId = await requireUserId();
  const data = await callRpc('volako_get_report_summary', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
  return data?.[0] || null;
}

export async function fetchReportsCategoryBreakdown(period) {
  const userId = await requireUserId();
  return callRpc('volako_get_report_category_breakdown', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
}

export async function fetchReportsMonthlyComparison(period) {
  const userId = await requireUserId();
  return callRpc('volako_get_report_monthly_comparison', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
}

export async function fetchReportsExpenseTrend(period) {
  const userId = await requireUserId();
  return callRpc('volako_get_report_expense_trend', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
}

export async function fetchReportsTopExpenses(period) {
  const userId = await requireUserId();
  return callRpc('volako_get_report_top_expenses', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
}

export async function fetchReportsWeekly(period) {
  const userId = await requireUserId();
  return callRpc('volako_get_report_weekly', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
}

export async function fetchBudgetProgress() {
  const userId = await requireUserId();
  return callRpc('volako_get_budget_progress', { p_user_id: userId }, 'Chargement des budgets');
}

export async function fetchSavingsStats() {
  const userId = await requireUserId();
  const data = await callRpc('volako_get_savings_stats', { p_user_id: userId }, 'Chargement de l epargne');
  return data?.[0] || null;
}

export async function applySavingsTransaction(payload) {
  const userId = await requireUserId();
  return callRpc('volako_apply_savings_transaction', {
    p_user_id: userId,
    p_savings_id: payload.savings_id,
    p_type: payload.type,
    p_amount: payload.amount,
    p_description: payload.description,
    p_date: payload.date ?? null
  }, 'Transaction epargne');
}

export async function fetchUserSettings() {
  return withGlobalLoader(async () => {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from(SUPABASE_TABLES.USER_SETTINGS)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    handleDbError(error, 'Impossible de lire les parametres');
    return data;
  }, { message: 'Chargement des parametres...' });
}

export async function upsertUserSettings(payload) {
  return withGlobalLoader(async () => {
    const userId = await requireUserId();
    if (!ensureOnlineForCriticalAction('Mise a jour des parametres')) {
      throw new Error('MODE_HORS_LIGNE');
    }

    const dataToSave = {
      user_id: userId,
      theme: payload.theme,
      language: payload.language,
      currency: payload.currency,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from(SUPABASE_TABLES.USER_SETTINGS)
      .upsert(dataToSave, { onConflict: 'user_id' });

    handleDbError(error, 'Impossible de sauvegarder les parametres');
  }, { message: 'Sauvegarde des parametres...' });
}
