-- Execute uma única vez no Supabase > SQL Editor.
-- Segurança: Row Level Security (RLS) habilitada em todas as tabelas.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  created_at timestamptz not null default now()
);

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  address text not null default '' check (char_length(address) <= 180),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create unique index if not exists friendship_unordered_unique on public.friendships (least(sender_id,recipient_id),greatest(sender_id,recipient_id));

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  rating numeric(2,1) not null check (rating between 0.5 and 5 and (rating*2) = trunc(rating*2)),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique(user_id,restaurant_id)
);
create index if not exists reviews_restaurant_idx on public.reviews(restaurant_id);
create index if not exists reviews_user_idx on public.reviews(user_id);

-- Criação automática de perfis com os dados informados no cadastro.
create or replace function public.create_new_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  desired_username text;
begin
  desired_username := lower(coalesce(new.raw_user_meta_data ->> 'username',''));
  if desired_username !~ '^[a-z0-9_]{3,30}$' then
    desired_username := 'user_' || substr(replace(new.id::text,'-',''),1,12);
  end if;
  insert into public.profiles (id,username,display_name)
  values(new.id,desired_username,left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''),'Visitante'),50));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_new_user_profile();

-- Um usuário só pode aceitar ou rejeitar convites recebidos; demais campos ficam imutáveis.
create or replace function public.protect_friendship_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.sender_id is distinct from new.sender_id or old.recipient_id is distinct from new.recipient_id or old.created_at is distinct from new.created_at then
    raise exception 'Não é permitido modificar os participantes do convite';
  end if;
  if old.status <> 'pending' or new.status not in ('accepted','declined') then
    raise exception 'Apenas convites pendentes podem ser respondidos';
  end if;
  return new;
end;
$$;
drop trigger if exists on_friendship_update on public.friendships;
create trigger on_friendship_update before update on public.friendships for each row execute function public.protect_friendship_update();

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.friendships enable row level security;
alter table public.reviews enable row level security;

-- Os perfis são visíveis apenas para pessoas autenticadas (necessário para buscar @usuário).
drop policy if exists "Profiles readable by authenticated" on public.profiles;
create policy "Profiles readable by authenticated" on public.profiles for select to authenticated using (true);

-- Locais cadastrados são compartilhados, mas as avaliações obedecem às regras sociais abaixo.
drop policy if exists "Restaurants readable by authenticated" on public.restaurants;
create policy "Restaurants readable by authenticated" on public.restaurants for select to authenticated using (true);
drop policy if exists "Restaurants insert own" on public.restaurants;
create policy "Restaurants insert own" on public.restaurants for insert to authenticated with check ((select auth.uid()) = created_by);

drop policy if exists "Friendships visible to members" on public.friendships;
create policy "Friendships visible to members" on public.friendships for select to authenticated using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);
drop policy if exists "Friendships sender can invite" on public.friendships;
create policy "Friendships sender can invite" on public.friendships for insert to authenticated with check ((select auth.uid()) = sender_id and status = 'pending');
drop policy if exists "Friendships recipient can respond" on public.friendships;
create policy "Friendships recipient can respond" on public.friendships for update to authenticated using ((select auth.uid()) = recipient_id and status = 'pending') with check ((select auth.uid()) = recipient_id and status in ('accepted','declined'));

-- Cada usuário vê apenas suas próprias reviews e as reviews de amizades aceitas.
drop policy if exists "Reviews visible to self and friends" on public.reviews;
create policy "Reviews visible to self and friends" on public.reviews for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.friendships f
    where f.status = 'accepted' and (
      (f.sender_id = (select auth.uid()) and f.recipient_id = reviews.user_id)
      or (f.recipient_id = (select auth.uid()) and f.sender_id = reviews.user_id)
    )
  )
);
drop policy if exists "Reviews insert own" on public.reviews;
create policy "Reviews insert own" on public.reviews for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Reviews update own" on public.reviews;
create policy "Reviews update own" on public.reviews for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
