begin;
insert into auth.users(id,email) values('60000000-0000-0000-0000-000000000001','webhook-tests@example.invalid');
do $$
declare
  ws uuid; post uuid; event uuid := gen_random_uuid(); second_event uuid := gen_random_uuid();
  hash text := repeat('a',64); changed timestamptz; role_name text;
begin
  select id into strict ws from public.workspaces where owner_id='60000000-0000-0000-0000-000000000001';
  insert into public.posts(workspace_id,zernio_post_id,account_ids) values(ws,'webhook-post','{}') returning id into post;
  if not public.apply_zernio_webhook(event,hash,'post.published','2026-10-30T15:00:00Z','webhook-post','published','[]',null) then raise exception 'Update failed'; end if;
  select updated_at into changed from public.posts where id=post;
  if public.apply_zernio_webhook(event,hash,'post.published','2026-10-30T15:00:00Z','webhook-post','published','[]',null) then raise exception 'Duplicate applied'; end if;
  if (select updated_at from public.posts where id=post) is distinct from changed then raise exception 'Duplicate rewrote timestamp'; end if;
  begin
    perform public.apply_zernio_webhook(event,repeat('b',64),'post.published','2026-10-30T15:00:00Z','webhook-post','published','[]',null);
    raise exception 'Conflicting event accepted';
  exception when invalid_parameter_value then null; end;

  perform public.apply_zernio_webhook(gen_random_uuid(),hash,'post.scheduled','2026-10-30T14:59:00Z','webhook-post','scheduled','[]',null);
  perform public.apply_zernio_webhook(gen_random_uuid(),hash,'post.platform.published','2026-10-30T15:00:00Z','webhook-post','publishing','[]',null);
  if (select status from public.posts where id=post) <> 'published' then raise exception 'Late event regressed status'; end if;
  -- A later intentional retry is allowed to schedule a previously terminal post.
  perform public.apply_zernio_webhook(gen_random_uuid(),hash,'post.scheduled','2026-10-30T15:01:00Z','webhook-post','scheduled','[]',null);
  if (select status from public.posts where id=post) <> 'scheduled' then raise exception 'Valid later event rejected'; end if;

  begin
    perform public.apply_zernio_webhook(second_event,hash,'post.published',now(),'not-linked','published','[]',null);
    raise exception 'Missing post acknowledged';
  exception when no_data_found then null; end;
  if exists(select 1 from private.zernio_webhook_receipts r where r.event_id=second_event) then raise exception 'Failed update consumed receipt'; end if;
  insert into public.posts(workspace_id,zernio_post_id,account_ids) values(ws,'not-linked','{}');
  if not public.apply_zernio_webhook(second_event,hash,'post.published',now(),'not-linked','published','[]',null) then raise exception 'Retry failed'; end if;

  insert into public.social_profiles(workspace_id,zernio_profile_id) values(ws,'webhook-profile');
  insert into public.social_accounts(id,workspace_id,platform) values('webhook-account',ws,'instagram');
  perform public.apply_zernio_webhook(gen_random_uuid(),hash,'account.disconnected',now(),'webhook-account',null,'[]','wrong-profile');
  if not exists(select 1 from public.social_accounts where id='webhook-account') then raise exception 'Wrong-profile disconnect deleted account'; end if;
  event:=gen_random_uuid();
  perform public.apply_zernio_webhook(event,hash,'account.disconnected',now(),'webhook-account',null,'[]','webhook-profile');
  if exists(select 1 from public.social_accounts where id='webhook-account') then raise exception 'Disconnect failed'; end if;
  insert into public.social_accounts(id,workspace_id,platform) values('webhook-account',ws,'instagram');
  perform public.apply_zernio_webhook(event,hash,'account.disconnected',now(),'webhook-account',null,'[]','webhook-profile');
  if not exists(select 1 from public.social_accounts where id='webhook-account') then raise exception 'Replay deleted reconnected account'; end if;

  foreach role_name in array array['anon','authenticated','credit_unprivileged'] loop
    if has_function_privilege(role_name,'public.apply_zernio_webhook(uuid,text,text,timestamptz,text,text,jsonb,text)','EXECUTE') then raise exception 'Unsafe function grant'; end if;
  end loop;
  if not has_function_privilege('service_role','public.apply_zernio_webhook(uuid,text,text,timestamptz,text,text,jsonb,text)','EXECUTE') then raise exception 'Missing service grant'; end if;
  if has_table_privilege('service_role','private.zernio_webhook_receipts','INSERT,UPDATE,DELETE') then raise exception 'Direct receipt writes allowed'; end if;
end;
$$;
rollback;
