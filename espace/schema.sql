-- =====================================================================
--  Espace client Coup de Com' : base de données Supabase
--  À coller UNE fois dans Supabase > SQL Editor > New query > Run.
--  Peut être relancé sans risque : rien n'est effacé.
--
--  Sécurité (vérifiée par la base, pas seulement cachée dans la page) :
--  - Seuls les administrateurs (table admins) créent et modifient.
--  - Un client ne voit QUE les projets où son adresse est inscrite,
--    et seulement ce que son rôle permet :
--      gérant : tout (valide les posts, accepte les devis, voit les factures)
--      équipe : posts, calendrier, rapports, brief, livrables (pas d'argent)
--      compta : devis et factures uniquement
--  - Un post ne peut plus recevoir de réponse une fois le délai passé :
--    il est alors considéré comme validé.
--  - Les fichiers sources des livrables et le lien de livraison ne
--    s'ouvrent qu'une fois toutes les factures payées.
-- =====================================================================

-- ---------- Administrateurs ----------
create table if not exists public.admins (email text primary key);
insert into public.admins(email) values
  ('coupdecommunication@gmail.com'),
  ('admproduction06@gmail.com')
on conflict do nothing;
alter table public.admins enable row level security;   -- aucune règle : invisible depuis le site

create or replace function public.my_email() returns text
language sql stable set search_path = public as $$
  select lower(coalesce(auth.jwt()->>'email', ''))
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_email() <> '' and exists (select 1 from public.admins a where lower(a.email) = public.my_email())
$$;

-- ---------- Projets ----------
-- "data" : en-tête du projet, tâches, rapports, livrables (lisible par tous les membres du projet).
-- Les posts, les factures et le brief sont dans des tables à part, protégées par rôle.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;

create or replace function public.touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before insert or update on public.projects
  for each row execute function public.touch();

-- ---------- Membres côté client (plusieurs interlocuteurs, avec un rôle) ----------
create table if not exists public.members (
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  role text not null default 'gerant' check (role in ('gerant', 'equipe', 'compta')),
  name text not null default '',
  created_at timestamptz not null default now(),
  primary key (project_id, email)
);
alter table public.members enable row level security;

create or replace function public.members_clean() returns trigger
language plpgsql set search_path = public as $$
begin new.email := lower(trim(new.email)); return new; end $$;
drop trigger if exists members_clean on public.members;
create trigger members_clean before insert or update on public.members
  for each row execute function public.members_clean();

-- Rôle de la personne connectée dans ce projet (null si elle n'en fait pas partie, ou projet archivé)
create or replace function public.my_role(p uuid) returns text
language sql stable security definer set search_path = public as $$
  select m.role from public.members m join public.projects pr on pr.id = m.project_id
  where m.project_id = p and public.my_email() <> '' and m.email = public.my_email() and not pr.archived
$$;
create or replace function public.has_role(p uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role(p) = any(roles), false)
$$;
-- Variante pour les noms de dossiers du stockage (texte, pas forcément un identifiant valide)
create or replace function public.has_role_txt(p text, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m join public.projects pr on pr.id = m.project_id
    where m.project_id::text = p and public.my_email() <> '' and m.email = public.my_email()
      and not pr.archived and m.role = any(roles))
$$;

drop policy if exists "projets : lecture" on public.projects;
create policy "projets : lecture" on public.projects for select to authenticated
  using (public.is_admin() or public.my_role(id) is not null);
drop policy if exists "projets : admin" on public.projects;
create policy "projets : admin" on public.projects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "membres : lecture" on public.members;
create policy "membres : lecture" on public.members for select to authenticated
  using (public.is_admin() or email = public.my_email() or public.has_role(project_id, '{gerant}'));
drop policy if exists "membres : admin" on public.members;
create policy "membres : admin" on public.members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Posts à valider / calendrier éditorial ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  publish_at timestamptz,
  networks text[] not null default '{}',
  format text not null default 'post',
  title text not null default '',
  caption text not null default '',
  media jsonb not null default '[]'::jsonb,
  link text not null default '',
  note text not null default '',
  v int not null default 1 check (v between 1 and 99),
  state text not null default 'draft' check (state in ('draft', 'review', 'published')),
  sent_at timestamptz,
  review_hours int not null default 48 check (review_hours between 1 and 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_project_idx on public.posts (project_id, publish_at);
alter table public.posts enable row level security;

-- L'heure d'envoi au client est fixée par la base (le délai de validation part de là)
create or replace function public.posts_clean() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.state = 'review' and (tg_op = 'INSERT' or old.state <> 'review' or old.v <> new.v) then
    new.sent_at := now();
  end if;
  if new.state = 'draft' then new.sent_at := null; end if;
  return new;
end $$;
drop trigger if exists posts_clean on public.posts;
create trigger posts_clean before insert or update on public.posts
  for each row execute function public.posts_clean();

drop policy if exists "posts : lecture client" on public.posts;
create policy "posts : lecture client" on public.posts for select to authenticated
  using (public.is_admin() or (state <> 'draft' and public.has_role(project_id, '{gerant,equipe}')));
drop policy if exists "posts : admin" on public.posts;
create policy "posts : admin" on public.posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Réponses des clients sur les posts ----------
-- La plus récente pour une version compte. Repères sur l'image : [{m, x, y, t}].
create table if not exists public.post_reviews (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  v int not null,
  decision text not null check (decision in ('ok', 'change')),
  pins jsonb not null default '[]'::jsonb,
  caption_note text not null default '' check (char_length(caption_note) <= 600),
  note text not null default '' check (char_length(note) <= 600),
  author_email text not null default public.my_email(),
  created_at timestamptz not null default now()
);
create index if not exists post_reviews_post_idx on public.post_reviews (post_id, created_at);
alter table public.post_reviews enable row level security;

-- Le post attend-il encore une réponse ? (envoyé, bonne version, délai pas dépassé)
create or replace function public.post_open(pid uuid, proj uuid, ver int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p
    where p.id = pid and p.project_id = proj and p.state = 'review' and p.v = ver
      and p.sent_at is not null and now() <= p.sent_at + make_interval(hours => p.review_hours))
$$;

drop policy if exists "réponses : lecture" on public.post_reviews;
create policy "réponses : lecture" on public.post_reviews for select to authenticated
  using (public.is_admin() or public.has_role(project_id, '{gerant,equipe}'));
drop policy if exists "réponses : envoi client" on public.post_reviews;
create policy "réponses : envoi client" on public.post_reviews for insert to authenticated
  with check (
    author_email = public.my_email()
    and public.has_role(project_id, '{gerant,equipe}')
    and public.post_open(post_id, project_id, v)
    and jsonb_typeof(pins) = 'array' and jsonb_array_length(pins) <= 8
    and pg_column_size(pins) < 8000);
drop policy if exists "réponses : admin" on public.post_reviews;
create policy "réponses : admin" on public.post_reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Devis et factures ----------
create table if not exists public.billing (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null default 'invoice' check (kind in ('invoice', 'quote')),
  label text not null default '',
  number text not null default '',
  amount numeric(12, 2) not null default 0,
  issued date,
  due date,
  status text not null default 'due' check (status in ('due', 'paid')),
  file text not null default '',
  fname text not null default '',
  accepted_at timestamptz,
  accepted_by text,
  lines jsonb not null default '[]'::jsonb,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.billing add column if not exists lines jsonb not null default '[]'::jsonb;
alter table public.billing add column if not exists extra jsonb not null default '{}'::jsonb;
create index if not exists billing_project_idx on public.billing (project_id);
alter table public.billing enable row level security;
drop trigger if exists billing_touch on public.billing;
create trigger billing_touch before insert or update on public.billing
  for each row execute function public.touch();

drop policy if exists "facturation : lecture" on public.billing;
create policy "facturation : lecture" on public.billing for select to authenticated
  using (public.is_admin() or public.has_role(project_id, '{gerant,compta}'));
drop policy if exists "facturation : admin" on public.billing;
create policy "facturation : admin" on public.billing for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Le gérant accepte un devis : la base note la date et l'adresse, et rien d'autre ne change.
create or replace function public.accept_quote(b uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update public.billing set accepted_at = now(), accepted_by = public.my_email()
  where id = b and kind = 'quote' and accepted_at is null and public.has_role(project_id, '{gerant}');
  get diagnostics ok = row_count;
  return ok;
end $$;
revoke all on function public.accept_quote(uuid) from public, anon;
grant execute on function public.accept_quote(uuid) to authenticated;

-- Toutes les factures du projet sont-elles payées ?
create or replace function public.all_paid(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.billing where project_id = p and kind = 'invoice')
     and not exists (select 1 from public.billing where project_id = p and kind = 'invoice' and status <> 'paid')
$$;

-- ---------- Coordonnées de paiement de l'agence (RIB, Revolut) ----------
-- Une seule ligne. Visible seulement des admins et des clients qui voient des factures.
create table if not exists public.agency (
  id int primary key default 1 check (id = 1),
  holder text not null default '',
  iban text not null default '',
  bic text not null default '',
  bank text not null default '',
  revolut text not null default '',
  pay_note text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.agency(id) values (1) on conflict do nothing;
alter table public.agency enable row level security;

create or replace function public.sees_billing() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_email() <> '' and exists (
    select 1 from public.members m join public.projects pr on pr.id = m.project_id
    where m.email = public.my_email() and m.role in ('gerant', 'compta') and not pr.archived)
$$;
drop policy if exists "agence : lecture" on public.agency;
create policy "agence : lecture" on public.agency for select to authenticated
  using (public.is_admin() or public.sees_billing());
drop policy if exists "agence : admin" on public.agency;
create policy "agence : admin" on public.agency for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Brief et questionnaire de démarrage ----------
create table if not exists public.briefs (
  project_id uuid primary key references public.projects(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  submitted boolean not null default false,
  submitted_at timestamptz,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.briefs enable row level security;

create or replace function public.briefs_clean() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_admin() then new.updated_by := public.my_email(); end if;
  if new.submitted and (tg_op = 'INSERT' or not old.submitted) then new.submitted_at := now(); end if;
  if not new.submitted then new.submitted_at := null; end if;
  return new;
end $$;
drop trigger if exists briefs_clean on public.briefs;
create trigger briefs_clean before insert or update on public.briefs
  for each row execute function public.briefs_clean();

drop policy if exists "brief : lecture" on public.briefs;
create policy "brief : lecture" on public.briefs for select to authenticated
  using (public.is_admin() or public.has_role(project_id, '{gerant,equipe}'));
drop policy if exists "brief : ajout client" on public.briefs;
create policy "brief : ajout client" on public.briefs for insert to authenticated
  with check (public.has_role(project_id, '{gerant,equipe}') and pg_column_size(data) < 60000);
-- Un brief envoyé est verrouillé : seul l'admin peut le rouvrir.
drop policy if exists "brief : modif client" on public.briefs;
create policy "brief : modif client" on public.briefs for update to authenticated
  using (public.has_role(project_id, '{gerant,equipe}') and not submitted)
  with check (public.has_role(project_id, '{gerant,equipe}') and pg_column_size(data) < 60000);
drop policy if exists "brief : admin" on public.briefs;
create policy "brief : admin" on public.briefs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Livraison (lien SwissTransfer, WeTransfer…) ----------
create table if not exists public.deliveries (
  project_id uuid primary key references public.projects(id) on delete cascade,
  link text not null default '',
  msg text not null default '',
  after_paid boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.deliveries enable row level security;

-- Les livrables (lien et fichiers sources) sont-ils ouverts pour ce projet ?
create or replace function public.livrables_ouverts(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (public.is_admin() or public.has_role(p, '{gerant,equipe}'))
     and (public.all_paid(p) or exists (select 1 from public.deliveries d where d.project_id = p and not d.after_paid))
$$;

drop policy if exists "livraison : lecture client" on public.deliveries;
create policy "livraison : lecture client" on public.deliveries for select to authenticated
  using (link <> '' and public.livrables_ouverts(project_id));
drop policy if exists "livraison : admin" on public.deliveries;
create policy "livraison : admin" on public.deliveries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Fichiers ----------
-- Bucket privé "espace", liens temporaires uniquement. Rangement : <id du projet>/<dossier>/<fichier>
--   m       visuels des posts               gérant, équipe
--   apercu  aperçus filigranés des livrables gérant, équipe
--   depot   fichiers envoyés par le client   gérant, équipe (et ils peuvent en ajouter)
--   rap     images des rapports              gérant, équipe
--   fact    factures et devis PDF            gérant, compta
--   src     fichiers sources des livrables   gérant, équipe, et seulement si tout est payé
insert into storage.buckets (id, name, public, file_size_limit)
values ('espace', 'espace', false, 52428800)
on conflict (id) do nothing;

create or replace function public.can_read_file(n text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare f text[] := storage.foldername(n); pid uuid;
begin
  if f is null or array_length(f, 1) < 2 then return false; end if;
  if f[2] = 'fact' then return public.has_role_txt(f[1], '{gerant,compta}'); end if;
  if f[2] in ('m', 'apercu', 'depot', 'rap') then return public.has_role_txt(f[1], '{gerant,equipe}'); end if;
  if f[2] = 'src' then
    if not public.has_role_txt(f[1], '{gerant,equipe}') then return false; end if;
    pid := f[1]::uuid;   -- sûr : has_role_txt a vérifié que c'est un projet existant
    return public.livrables_ouverts(pid);
  end if;
  return false;
end $$;

drop policy if exists "espace : admin" on storage.objects;
create policy "espace : admin" on storage.objects for all to authenticated
  using (bucket_id = 'espace' and public.is_admin())
  with check (bucket_id = 'espace' and public.is_admin());

drop policy if exists "espace : lecture client" on storage.objects;
create policy "espace : lecture client" on storage.objects for select to authenticated
  using (bucket_id = 'espace' and public.can_read_file(name));

drop policy if exists "espace : dépôt client" on storage.objects;
create policy "espace : dépôt client" on storage.objects for insert to authenticated
  with check (bucket_id = 'espace' and (storage.foldername(name))[2] = 'depot'
    and public.has_role_txt((storage.foldername(name))[1], '{gerant,equipe}'));

-- ---------- Fonctions de vérification : réservées aux personnes connectées ----------
revoke execute on function public.is_admin(), public.my_role(uuid), public.has_role(uuid, text[]), public.has_role_txt(text, text[]),
  public.post_open(uuid, uuid, int), public.sees_billing(), public.all_paid(uuid), public.can_read_file(text),
  public.livrables_ouverts(uuid), public.my_email(), public.accept_quote(uuid) from public, anon;
grant execute on function public.is_admin(), public.my_role(uuid), public.has_role(uuid, text[]), public.has_role_txt(text, text[]),
  public.post_open(uuid, uuid, int), public.sees_billing(), public.can_read_file(text),
  public.livrables_ouverts(uuid), public.my_email(), public.accept_quote(uuid) to authenticated;
revoke execute on function public.all_paid(uuid) from authenticated;
