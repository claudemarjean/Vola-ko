import { supabase, SUPABASE_TABLES } from './supabase.js';
import { ensureOnlineForCriticalAction } from './network.js';
import { withGlobalLoader } from './loaders.js';

const AUTH_STORAGE_KEYS = ['tvolako_user', 'tvolako_token', 'volako-auth-token'];
let authRedirectTriggered = false;
let dataScopeCache = {
  sessionUserId: null,
  ownerUserId: null,
  fetchedAt: 0
};

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

export function resetDataScopeCache() {
  dataScopeCache = {
    sessionUserId: null,
    ownerUserId: null,
    fetchedAt: 0
  };
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

async function requireSessionUserId() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user?.id) {
    redirectToLoginOnce();
    throw new Error('Session expiree. Veuillez vous reconnecter.');
  }

  return session.user.id;
}

async function requireDataOwnerUserId() {
  const sessionUserId = await requireSessionUserId();
  const cacheTtlMs = 60 * 1000;

  if (
    dataScopeCache.sessionUserId === sessionUserId &&
    dataScopeCache.ownerUserId &&
    Date.now() - dataScopeCache.fetchedAt < cacheTtlMs
  ) {
    return dataScopeCache.ownerUserId;
  }

  const { data, error } = await supabase.rpc('volako_get_data_scope_user');
  handleDbError(error, 'Impossible de determiner le scope de donnees');

  const ownerUserId = data || sessionUserId;
  dataScopeCache = {
    sessionUserId,
    ownerUserId,
    fetchedAt: Date.now()
  };

  return ownerUserId;
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
    const userId = await requireDataOwnerUserId();
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

    const userId = await requireDataOwnerUserId();
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

    const userId = await requireDataOwnerUserId();
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

    const userId = await requireDataOwnerUserId();
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

    const hasParams = params !== null
      && params !== undefined
      && (typeof params !== 'object' || Object.keys(params).length > 0);

    const { data, error } = hasParams
      ? await supabase.rpc(name, params)
      : await supabase.rpc(name);
    handleDbError(error, `RPC ${name} en erreur`);
    return data;
  }, { message: 'Chargement des donnees...' });
}

/**
 * Charger toutes les catégories accessibles par l'utilisateur connecté
 * (catégories système user_id IS NULL + catégories custom de l'utilisateur)
 */
export async function fetchCategories() {
  const userId = await requireDataOwnerUserId();
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

    const userId = await requireDataOwnerUserId();
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

    const userId = await requireDataOwnerUserId();
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
  const userId = await requireDataOwnerUserId();
  const data = await callRpc('volako_get_dashboard_snapshot', { p_user_id: userId }, 'Chargement du dashboard');
  return data?.[0] || null;
}

export async function fetchDashboardRecentTransactions(limit = 5) {
  const userId = await requireDataOwnerUserId();
  return callRpc('volako_get_dashboard_recent_transactions', { p_user_id: userId, p_limit: limit }, 'Chargement des transactions');
}

export async function fetchDashboardCategoryBreakdown() {
  const userId = await requireDataOwnerUserId();
  return callRpc('volako_get_dashboard_category_breakdown', { p_user_id: userId }, 'Chargement du dashboard');
}

export async function fetchDashboardTrend7() {
  const userId = await requireDataOwnerUserId();
  return callRpc('volako_get_dashboard_trend7', { p_user_id: userId }, 'Chargement du dashboard');
}

export async function fetchDashboardBudgetUsage() {
  const userId = await requireDataOwnerUserId();
  return callRpc('volako_get_dashboard_budget_usage', { p_user_id: userId }, 'Chargement du dashboard');
}

export async function fetchDashboardBalance12Months() {
  const userId = await requireDataOwnerUserId();
  return callRpc('volako_get_dashboard_balance_12m', { p_user_id: userId }, 'Chargement du dashboard');
}

export async function fetchReportsSummary(period) {
  const userId = await requireDataOwnerUserId();
  const data = await callRpc('volako_get_report_summary', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
  return data?.[0] || null;
}

export async function fetchReportsCategoryBreakdown(period) {
  const userId = await requireDataOwnerUserId();
  return callRpc('volako_get_report_category_breakdown', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
}

export async function fetchReportsMonthlyComparison(period) {
  const userId = await requireDataOwnerUserId();
  return callRpc('volako_get_report_monthly_comparison', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
}

export async function fetchReportsExpenseTrend(period) {
  const userId = await requireDataOwnerUserId();
  return callRpc('volako_get_report_expense_trend', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
}

export async function fetchReportsTopExpenses(period) {
  const userId = await requireDataOwnerUserId();
  return callRpc('volako_get_report_top_expenses', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
}

export async function fetchReportsWeekly(period) {
  const userId = await requireDataOwnerUserId();
  return callRpc('volako_get_report_weekly', { p_user_id: userId, p_period: period }, 'Chargement des rapports');
}

export async function fetchBudgetProgress() {
  const userId = await requireDataOwnerUserId();
  return callRpc('volako_get_budget_progress', { p_user_id: userId }, 'Chargement des budgets');
}

export async function fetchSavingsStats() {
  const userId = await requireDataOwnerUserId();
  const data = await callRpc('volako_get_savings_stats', { p_user_id: userId }, 'Chargement de l epargne');
  return data?.[0] || null;
}

export async function applySavingsTransaction(payload) {
  const userId = await requireDataOwnerUserId();
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
    const userId = await requireSessionUserId();
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
    const userId = await requireSessionUserId();
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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

const JOINT_ACCOUNT_ERROR_MESSAGES = {
  NOT_AUTHENTICATED: 'Session expiree. Veuillez vous reconnecter.',
  EMAIL_NOT_FOUND: 'Aucun compte trouve avec cet email exact.',
  SELF_INVITE_NOT_ALLOWED: 'Vous ne pouvez pas vous inviter vous-meme.',
  REQUESTER_IS_ADMIN_WITH_ACTIVE_MEMBER: 'Vous etes deja admin d un compte conjoint. Retirez d abord votre conjoint actuel.',
  REQUESTER_IS_ALREADY_MEMBER: 'Vous etes deja conjoint d un autre compte. Vous devez etre retire avant une nouvelle demande.',
  TARGET_IS_ADMIN_WITH_ACTIVE_MEMBER: 'Vous avez recu la demande, mais vous devez d abord retirer votre conjoint actuel puis supprimer toutes vos donnees avant de pouvoir accepter.',
  TARGET_IS_ALREADY_MEMBER: 'Vous avez recu la demande, mais vous devez d abord etre retire de votre compte conjoint actuel avant de pouvoir accepter.',
  REQUEST_NOT_FOUND: 'Demande introuvable.',
  REQUEST_NOT_PENDING: 'Cette demande n est plus en attente.',
  REQUEST_NOT_FOUND_OR_ALREADY_HANDLED: 'Cette demande est introuvable ou deja traitee.',
  TARGET_DATA_NOT_EMPTY: 'Avant d accepter, vous devez supprimer toutes vos donnees personnelles.',
  ACTIVE_LINK_NOT_FOUND: 'Aucun lien conjoint actif a retirer pour ce membre.',
  ACTIVE_MEMBER_LINK_NOT_FOUND: 'Vous n etes lie a aucun compte conjoint actif.'
};

function mapJointAccountError(error, fallbackMessage) {
  const message = String(error?.message || '').toUpperCase();
  for (const [code, translated] of Object.entries(JOINT_ACCOUNT_ERROR_MESSAGES)) {
    if (message.includes(code)) {
      return new Error(translated);
    }
  }

  return new Error(error?.message || fallbackMessage);
}

export async function findJointAccountCandidateByEmail(email) {
  return withGlobalLoader(async () => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new Error('Email requis');
    }

    const sessionUserId = await requireSessionUserId();
    const { data, error } = await supabase.rpc('volako_find_user_by_exact_email', {
      p_email: normalized
    });
    handleDbError(error, 'Impossible de verifier cet email');

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.user_id || row.user_id === sessionUserId) {
      return null;
    }

    return {
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name || row.email
    };
  }, { message: 'Verification de l email...' });
}

export async function sendJointAccountRequest(email) {
  const normalized = normalizeEmail(email);
  try {
    return await callRpc('volako_send_joint_account_request', {
      p_target_email: normalized
    }, 'Envoi de la demande de compte conjoint');
  } catch (error) {
    throw mapJointAccountError(error, 'Impossible d envoyer la demande conjointe.');
  }
}

export async function fetchReceivedJointAccountRequests() {
  return withGlobalLoader(async () => {
    const sessionUserId = await requireSessionUserId();
    const { data, error } = await supabase
      .from(SUPABASE_TABLES.JOINT_ACCOUNT_REQUESTS)
      .select('id, requester_user_id, requester_email, target_email, status, created_at')
      .eq('target_user_id', sessionUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    handleDbError(error, 'Impossible de charger les demandes recues');
    return data || [];
  }, { message: 'Chargement des demandes recues...' });
}

export async function fetchSentJointAccountRequests() {
  return withGlobalLoader(async () => {
    const sessionUserId = await requireSessionUserId();
    const { data, error } = await supabase
      .from(SUPABASE_TABLES.JOINT_ACCOUNT_REQUESTS)
      .select('id, requester_email, target_email, status, created_at')
      .eq('requester_user_id', sessionUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    handleDbError(error, 'Impossible de charger les demandes envoyees');
    return data || [];
  }, { message: 'Chargement des demandes envoyees...' });
}

export async function fetchPendingJointRequestCount() {
  const sessionUserId = await requireSessionUserId();
  const { count, error } = await supabase
    .from(SUPABASE_TABLES.JOINT_ACCOUNT_REQUESTS)
    .select('id', { count: 'exact', head: true })
    .eq('target_user_id', sessionUserId)
    .eq('status', 'pending');

  handleDbError(error, 'Impossible de verifier les demandes en attente');
  return Number(count || 0);
}

export async function acceptJointAccountRequest(requestId) {
  try {
    return await callRpc('volako_accept_joint_account_request', {
      p_request_id: requestId
    }, 'Acceptation de la demande conjointe');
  } catch (error) {
    throw mapJointAccountError(error, 'Impossible d accepter la demande conjointe.');
  }
}

export async function rejectJointAccountRequest(requestId) {
  try {
    return await callRpc('volako_reject_joint_account_request', {
      p_request_id: requestId
    }, 'Refus de la demande conjointe');
  } catch (error) {
    throw mapJointAccountError(error, 'Impossible de refuser la demande conjointe.');
  }
}

export async function fetchJointAccountState() {
  return withGlobalLoader(async () => {
    const { data, error } = await supabase.rpc('volako_get_joint_account_state');
    handleDbError(error, 'Impossible de charger l etat du compte conjoint');

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return null;
    }

    return row;
  }, { message: 'Chargement du compte conjoint...' });
}

export async function removeJointAccountMember(memberUserId) {
  try {
    return await callRpc('volako_admin_remove_joint_member', {
      p_member_user_id: memberUserId
    }, 'Retrait du compte conjoint');
  } catch (error) {
    throw mapJointAccountError(error, 'Impossible de retirer ce conjoint.');
  }
}

export async function leaveJointAccountAsMember() {
  try {
    return await callRpc('volako_member_leave_joint_account', null, 'Retrait du compte conjoint (membre)');
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('PGRST202') && message.includes('volako_member_leave_joint_account')) {
      throw new Error('La fonction SQL de retrait membre est absente dans Supabase. Executez la migration volako_joint_member_leave_patch.sql puis reessayez.');
    }
    throw mapJointAccountError(error, 'Impossible de vous retirer du compte conjoint.');
  }
}
