-- ============================================================
-- MAJ CATEGORIES (DEFAULT + CUSTOM PAR UTILISATEUR)
-- Compatible avec une base existante.
-- ============================================================

begin;

create extension if not exists pgcrypto;

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

-- Renforcement schema pour une base deja existante
alter table public.volako_categories
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists icon text default '📦',
  add column if not exists color text default '#6b7280',
  add column if not exists is_default boolean default false,
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists sort_order integer default 99,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.volako_categories
set icon = coalesce(icon, '📦'),
    color = coalesce(color, '#6b7280'),
    is_default = coalesce(is_default, false),
    sort_order = coalesce(sort_order, 99),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now())
where icon is null
   or color is null
   or is_default is null
   or sort_order is null
   or created_at is null
   or updated_at is null;

create unique index if not exists volako_categories_slug_default_idx
  on public.volako_categories(slug)
  where user_id is null;

create unique index if not exists volako_categories_slug_user_idx
  on public.volako_categories(slug, user_id)
  where user_id is not null;

create index if not exists volako_categories_user_id_idx
  on public.volako_categories(user_id);

alter table public.volako_categories enable row level security;

drop policy if exists "Lire catégories système et propres catégories" on public.volako_categories;
drop policy if exists "Créer ses propres catégories" on public.volako_categories;
drop policy if exists "Modifier ses propres catégories" on public.volako_categories;
drop policy if exists "Supprimer ses propres catégories" on public.volako_categories;

create policy "Lire catégories système et propres catégories"
  on public.volako_categories
  for select
  using (user_id is null or user_id = auth.uid());

create policy "Créer ses propres catégories"
  on public.volako_categories
  for insert
  with check (user_id = auth.uid() and is_default = false);

create policy "Modifier ses propres catégories"
  on public.volako_categories
  for update
  using (user_id = auth.uid() and is_default = false)
  with check (user_id = auth.uid() and is_default = false);

create policy "Supprimer ses propres catégories"
  on public.volako_categories
  for delete
  using (user_id = auth.uid() and is_default = false);

-- Forcer les categories par defaut en global (tous utilisateurs)
update public.volako_categories
set user_id = null,
    is_default = true,
    updated_at = now()
where slug in (
  'alimentation','transport','logement','sante','beaute',
  'vetements','loisirs','imprevus','epargne','autre'
);

-- Normaliser labels/icones/couleurs/ordre des categories par defaut
update public.volako_categories set name='Alimentation',   icon='🛒', color='#10b981', sort_order=1,  updated_at=now() where slug='alimentation' and user_id is null;
update public.volako_categories set name='Transport',      icon='🚗', color='#3b82f6', sort_order=2,  updated_at=now() where slug='transport' and user_id is null;
update public.volako_categories set name='Logement',       icon='🏠', color='#f59e0b', sort_order=3,  updated_at=now() where slug='logement' and user_id is null;
update public.volako_categories set name='Santé',          icon='💊', color='#ef4444', sort_order=4,  updated_at=now() where slug='sante' and user_id is null;
update public.volako_categories set name='Beauté & Soins', icon='💄', color='#ec4899', sort_order=5,  updated_at=now() where slug='beaute' and user_id is null;
update public.volako_categories set name='Vêtements',      icon='👔', color='#8b5cf6', sort_order=6,  updated_at=now() where slug='vetements' and user_id is null;
update public.volako_categories set name='Loisirs',        icon='🎮', color='#6366f1', sort_order=7,  updated_at=now() where slug='loisirs' and user_id is null;
update public.volako_categories set name='Imprévus',       icon='⚡', color='#f97316', sort_order=8,  updated_at=now() where slug='imprevus' and user_id is null;
update public.volako_categories set name='Épargne',        icon='💾', color='#7c3aed', sort_order=9,  updated_at=now() where slug='epargne' and user_id is null;
update public.volako_categories set name='Autre',          icon='📦', color='#6b7280', sort_order=10, updated_at=now() where slug='autre' and user_id is null;

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

-- Migration des anciennes lignes si jamais un user_id a été stocké sur une catégorie par défaut.
update public.volako_categories
set user_id = null,
    is_default = true
where slug in ('alimentation','transport','logement','sante','beaute','vetements','loisirs','imprevus','epargne','autre');

commit;
