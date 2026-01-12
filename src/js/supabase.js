/**
 * SUPABASE.JS - Supabase Client Initialization
 * Configuration et initialisation du client Supabase
 */

import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
// Les clés sont configurées directement (la clé anon est publique et sécurisée par RLS)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jzabkrztgkayunjbzlzj.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6YWJrcnp0Z2theXVuamJ6bHpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTEzNjQsImV4cCI6MjA4MzI4NzM2NH0.C2z2JLVtLh8oPv9zBAOjjp3Geqrpf4O-k9ATYYzw1cE';

// Créer et exporter le client Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'volako-auth-token',
    storage: window.localStorage
  }
});

/**
 * Tables Supabase utilisées dans l'application
 */
export const SUPABASE_TABLES = {
  USER_SETTINGS: 'volako_user_settings',
  INCOMES: 'volako_incomes',
  EXPENSES: 'volako_expenses',
  BUDGETS: 'volako_budgets',
  SAVINGS: 'volako_savings',
  SAVINGS_TRANSACTIONS: 'volako_savings_transactions'
};

/**
 * Vérifier si Supabase est correctement configuré
 */
export function isSupabaseConfigured() {
  return SUPABASE_URL !== 'https://your-project.supabase.co' && 
         SUPABASE_ANON_KEY !== 'your-anon-key';
}

/**
 * Obtenir l'utilisateur actuellement connecté
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return null;
  }
  return user;
}

/**
 * Obtenir la session actuelle
 */
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Erreur lors de la récupération de la session:', error);
    return null;
  }
  return session;
}
