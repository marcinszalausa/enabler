create table private.zernio_webhook_receipts (
  event_id uuid primary key,
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  event_name text not null,
  processed_at timestamptz not null default now()
);
alter table private.zernio_webhook_receipts enable row level security;
revoke all on private.zernio_webhook_receipts from public, anon, authenticated, service_role;
alter table public.posts add column zernio_event_at timestamptz;

-- One transaction owns both the event receipt and its side effect.
-- A failure rolls the receipt back so Zernio's next delivery can try again.
create function public.apply_zernio_webhook(
  event_id uuid, body_hash text, event_name text, event_time timestamptz,
  target_id text, post_status text, post_results jsonb, profile_id text
)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '1500ms'
as $$
declare
  existing_hash text;
  affected public.posts%rowtype;
begin
  if event_id is null or body_hash is null or body_hash !~ '^[0-9a-f]{64}$'
    or event_name is null or event_time is null or target_id is null or target_id = '' then
    raise exception 'Invalid webhook operation' using errcode='22023';
  end if;
  insert into private.zernio_webhook_receipts(event_id,body_hash,event_name)
    values(event_id,body_hash,event_name) on conflict do nothing;
  if not found then
    select r.body_hash into existing_hash from private.zernio_webhook_receipts r
      where r.event_id=apply_zernio_webhook.event_id;
    if existing_hash is distinct from body_hash then
      raise exception 'Event ID reused with different body' using errcode='22023';
    end if;
    return false;
  end if;

  if event_name in ('post.scheduled','post.published','post.partial','post.failed',
    'post.cancelled','post.platform.published','post.platform.failed',
    'post.platform.deleted','post.tiktok.url_resolved') then
    if post_status is null or post_status not in ('scheduled','publishing','published','partial','failed','cancelled')
      or post_results is null or jsonb_typeof(post_results) <> 'array' then
      raise exception 'Invalid post update' using errcode='22023';
    end if;
    select p.* into affected from public.posts p where p.zernio_post_id=target_id for update;
    if not found then
      -- A webhook can beat createPost's local linkage update. Retry later.
      raise exception 'Post not linked yet' using errcode='P0002';
    end if;
    if affected.zernio_event_at is null or event_time > affected.zernio_event_at
      or (event_time = affected.zernio_event_at and not (
        affected.status in ('published','partial','failed','cancelled')
        and post_status in ('scheduled','publishing'))) then
      update public.posts set status=post_status, results=post_results,
        error=(select item->>'error' from jsonb_array_elements(post_results) item
          where item->>'error' is not null limit 1),
        zernio_event_at=event_time, updated_at=now() where id=affected.id;
    end if;
  elsif event_name='account.disconnected' then
    if profile_id is null or profile_id='' then
      raise exception 'Missing account profile' using errcode='22023';
    end if;
    delete from public.social_accounts a using public.social_profiles p
      where a.id=target_id and a.workspace_id=p.workspace_id and p.zernio_profile_id=profile_id;
  else
    raise exception 'Unsupported webhook operation' using errcode='22023';
  end if;
  return true;
end;
$$;

revoke execute on function public.apply_zernio_webhook(uuid,text,text,timestamptz,text,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.apply_zernio_webhook(uuid,text,text,timestamptz,text,text,jsonb,text)
  to service_role;
