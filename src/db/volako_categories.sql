-- ============================================================
-- VOLAKO_CATEGORIES - Table des catégories de dépenses
-- Permet des catégories système (user_id IS NULL) visibles
-- par tous les utilisateurs, et des catégories personnalisées
-- (user_id = auth.uid()) pour chaque utilisateur.
-- ============================================================

create table if not exists public.volako_categories (
  id           uuid        primary key default gen_random_uuid(),
  slug         text        not null,
  name         text        not null,
  icon         text        not null default '📦',
  color        text        not null default '#6b7280',
  is_default   boolean     not null default false,
  user_id      uuid        references auth.users(id) on delete cascade,
  sort_order   integer     not null default 99,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Unicité : un slug ne peut exister qu'une fois parmi les défauts système
create unique index if not exists volako_categories_slug_default_idx
  on public.volako_categories(slug)
  where user_id is null;

-- Unicité : un slug ne peut exister qu'une fois par utilisateur (catégories custom)
create unique index if not exists volako_categories_slug_user_idx
  on public.volako_categories(slug, user_id)
  where user_id is not null;

-- Index pour récupérer rapidement toutes les catégories d'un utilisateur
create index if not exists volako_categories_user_id_idx
  on public.volako_categories(user_id);

-- ============================================================
-- RLS - Row Level Security
-- ============================================================

alter table public.volako_categories enable row level security;

-- Lecture : catégories système (user_id IS NULL) + propres catégories custom
create policy "Lire catégories système et propres catégories"
  on public.volako_categories
  for select
  using (user_id is null or user_id = auth.uid());

-- Création : uniquement des catégories custom (user_id = soi-même)
create policy "Créer ses propres catégories"
  on public.volako_categories
  for insert
  with check (user_id = auth.uid());

-- Modification : uniquement ses propres catégories custom (pas les défauts système)
create policy "Modifier ses propres catégories"
  on public.volako_categories
  for update
  using (user_id = auth.uid() and is_default = false)
  with check (user_id = auth.uid() and is_default = false);

-- Suppression : uniquement ses propres catégories custom (pas les défauts système)
create policy "Supprimer ses propres catégories"
  on public.volako_categories
  for delete
  using (user_id = auth.uid() and is_default = false);

-- ============================================================
-- DONNÉES INITIALES - Catégories système par défaut
-- ============================================================

insert into public.volako_categories (slug, name, icon, color, is_default, user_id, sort_order) values
  ('alimentation', 'Alimentation',  '🛒', '#10b981', true, null, 1),
  ('transport',    'Transport',      '🚗', '#3b82f6', true, null, 2),
  ('logement',     'Logement',       '🏠', '#f59e0b', true, null, 3),
  ('sante',        'Santé',          '💊', '#ef4444', true, null, 4),
  ('beaute',       'Beauté & Soins', '💄', '#ec4899', true, null, 5),
  ('vetements',    'Vêtements',      '👔', '#8b5cf6', true, null, 6),
  ('loisirs',      'Loisirs',        '🎮', '#6366f1', true, null, 7),
  ('imprevus',     'Imprévus',       '⚡', '#f97316', true, null, 8),
  ('epargne',      'Épargne',        '💾', '#7c3aed', true, null, 9),
  ('autre',        'Autre',          '📦', '#6b7280', true, null, 10)
on conflict do nothing;
