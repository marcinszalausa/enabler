-- One pending connection per user; tokens are random and stored only as hashes.
create table private.social_connect_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nonce_hash text not null unique check (nonce_hash ~ '^[0-9a-f]{64}$'),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id text not null,
  platform text not null,
  expires_at timestamptz not null
);
alter table private.social_connect_states enable row level security;
revoke all on private.social_connect_states from public, anon, authenticated, service_role;

create function public.register_social_connect_state(
  p_nonce_hash text, p_user_id uuid, p_workspace_id uuid,
  p_profile_id text, p_platform text
)
returns void language plpgsql security definer set search_path='' set lock_timeout='1500ms'
as $$
begin
  if p_nonce_hash is null or p_nonce_hash !~ '^[0-9a-f]{64}$'
    or p_user_id is null or p_workspace_id is null
    or p_profile_id is null or p_profile_id='' or p_platform is null or p_platform='' then
    raise exception 'Invalid connection state' using errcode='22023';
  end if;
  if not exists(select 1 from public.workspace_members m where m.user_id=p_user_id
    and m.workspace_id=p_workspace_id and m.role in ('owner','editor'))
    or not exists(select 1 from public.social_profiles p where p.workspace_id=p_workspace_id and p.zernio_profile_id=p_profile_id) then
    raise exception 'Connection not authorized' using errcode='42501';
  end if;
  insert into private.social_connect_states(user_id,nonce_hash,workspace_id,profile_id,platform,expires_at)
    values(p_user_id,p_nonce_hash,p_workspace_id,p_profile_id,p_platform,now()+interval '10 minutes')
    on conflict(user_id) do update set nonce_hash=excluded.nonce_hash,
      workspace_id=excluded.workspace_id,profile_id=excluded.profile_id,
      platform=excluded.platform,expires_at=excluded.expires_at;
end;
$$;

create function public.consume_social_connect_state(p_nonce_hash text,p_user_id uuid)
returns table(workspace_id uuid,profile_id text,platform text)
language sql security definer set search_path='' set lock_timeout='1500ms'
as $$
  delete from private.social_connect_states s
  where s.user_id=p_user_id and s.nonce_hash=p_nonce_hash and s.expires_at>now()
    and exists(select 1 from public.workspace_members m where m.workspace_id=s.workspace_id
      and m.user_id=p_user_id and m.role in ('owner','editor'))
    and exists(select 1 from public.social_profiles p where p.workspace_id=s.workspace_id
      and p.zernio_profile_id=s.profile_id)
  returning s.workspace_id,s.profile_id,s.platform;
$$;

revoke execute on function public.register_social_connect_state(text,uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.consume_social_connect_state(text,uuid) from public,anon,authenticated;
grant execute on function public.register_social_connect_state(text,uuid,uuid,text,text) to service_role;
grant execute on function public.consume_social_connect_state(text,uuid) to service_role;
