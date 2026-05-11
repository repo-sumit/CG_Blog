-- Security helper functions + profile bootstrap.

-- ============================================================
-- Helpers (security definer; locked search_path).
-- All read public.profiles only; safe to call from policies.
-- ============================================================
create or replace function public.current_user_email()
returns text language sql stable security definer set search_path = public, auth as $$
  select lower(coalesce((auth.jwt() ->> 'email'), ''));
$$;

create or replace function public.is_convegenius_user()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select case
    when auth.uid() is null then false
    else split_part(public.current_user_email(), '@', 2) =
         lower((select allowed_domain from public.app_settings where id = 1))
  end;
$$;

create or replace function public.current_user_role()
returns app_role language sql stable security definer set search_path = public, auth as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce(public.current_user_role() = 'manager', false);
$$;

create or replace function public.is_author_or_manager()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce(public.current_user_role() in ('author', 'manager'), false);
$$;

create or replace function public.is_authorized_author()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.authorized_users
    where lower(email) = public.current_user_email()
      and role in ('author', 'manager')
  );
$$;

-- ============================================================
-- Profile bootstrap: ensure a profile row exists for the
-- current auth user with the correct role from authorized_users.
-- Called from the auth callback (server-side).
-- ============================================================
create or replace function public.bootstrap_profile()
returns public.profiles
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user auth.users%rowtype;
  v_email text;
  v_domain text;
  v_allowed_domain text;
  v_role app_role;
  v_weekday smallint;
  v_full_name text;
  v_avatar text;
  v_profile public.profiles%rowtype;
begin
  select * into v_user from auth.users where id = auth.uid();
  if not found then
    raise exception 'not authenticated';
  end if;

  v_email := lower(v_user.email);
  v_domain := split_part(v_email, '@', 2);
  select lower(allowed_domain) into v_allowed_domain from public.app_settings where id = 1;
  if v_domain <> v_allowed_domain then
    raise exception 'domain_not_allowed' using errcode = '42501';
  end if;

  -- Determine role from allowlist; fallback to viewer.
  select role, weekly_post_day
    into v_role, v_weekday
    from public.authorized_users
    where lower(email) = v_email;
  if v_role is null then
    v_role := 'viewer';
  end if;

  v_full_name := coalesce(
    v_user.raw_user_meta_data ->> 'full_name',
    v_user.raw_user_meta_data ->> 'name',
    split_part(v_email, '@', 1)
  );
  v_avatar := coalesce(
    v_user.raw_user_meta_data ->> 'avatar_url',
    v_user.raw_user_meta_data ->> 'picture'
  );

  insert into public.profiles (id, email, full_name, avatar_url, role, weekly_post_day)
  values (v_user.id, v_email, v_full_name, v_avatar, v_role, v_weekday)
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        -- Re-sync role from allowlist on every login (cheap, keeps things consistent).
        role = case
          when public.profiles.role = 'manager' then 'manager'
          else excluded.role
        end,
        weekly_post_day = coalesce(excluded.weekly_post_day, public.profiles.weekly_post_day)
  returning * into v_profile;

  return v_profile;
end $$;

revoke all on function public.bootstrap_profile() from public;
grant execute on function public.bootstrap_profile() to authenticated;

-- Manager-only: assign weekday to an author and keep authorized_users in sync.
create or replace function public.assign_weekday(p_user_id uuid, p_weekday smallint)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'only managers can assign weekdays' using errcode = '42501';
  end if;
  if p_weekday is not null and (p_weekday < 1 or p_weekday > 5) then
    raise exception 'weekday must be between 1 and 5';
  end if;
  update public.profiles set weekly_post_day = p_weekday where id = p_user_id;
  update public.authorized_users
    set weekly_post_day = p_weekday
    where email = (select email from public.profiles where id = p_user_id);
end $$;

grant execute on function public.assign_weekday(uuid, smallint) to authenticated;
