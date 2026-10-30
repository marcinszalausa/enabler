begin;
insert into auth.users(id,email) values
 ('91000000-0000-0000-0000-000000000001','oauth-owner@example.invalid'),
 ('91000000-0000-0000-0000-000000000002','oauth-editor@example.invalid'),
 ('91000000-0000-0000-0000-000000000003','oauth-viewer@example.invalid'),
 ('91000000-0000-0000-0000-000000000004','oauth-outsider@example.invalid');
do $$
declare
  actor_owner uuid:='91000000-0000-0000-0000-000000000001';
  editor_id uuid:='91000000-0000-0000-0000-000000000002';
  viewer_id uuid:='91000000-0000-0000-0000-000000000003';
  outsider_id uuid:='91000000-0000-0000-0000-000000000004';
  ws uuid; n integer; context record; rpc text; role_name text;
begin
  select id into strict ws from public.workspaces where workspaces.owner_id=actor_owner;
  insert into public.workspace_members(workspace_id,user_id,role) values(ws,editor_id,'editor'),(ws,viewer_id,'viewer');
  insert into public.social_profiles(workspace_id,zernio_profile_id) values(ws,'oauth-profile');

  perform public.register_social_connect_state(repeat('a',64),actor_owner,ws,'oauth-profile','instagram');
  if (select expires_at from private.social_connect_states where user_id=actor_owner) <> now()+interval '10 minutes' then raise exception 'Wrong expiry'; end if;
  select count(*) into n from public.consume_social_connect_state(repeat('a',64),outsider_id);
  if n<>0 then raise exception 'Wrong user consumed state'; end if;
  select * into context from public.consume_social_connect_state(repeat('a',64),actor_owner);
  if context.workspace_id is distinct from ws or context.profile_id is distinct from 'oauth-profile' or context.platform is distinct from 'instagram' then raise exception 'Wrong context'; end if;
  select count(*) into n from public.consume_social_connect_state(repeat('a',64),actor_owner);
  if n<>0 then raise exception 'Replay consumed twice'; end if;

  perform public.register_social_connect_state(repeat('b',64),actor_owner,ws,'oauth-profile','instagram');
  perform public.register_social_connect_state(repeat('c',64),actor_owner,ws,'oauth-profile','linkedin');
  select count(*) into n from public.consume_social_connect_state(repeat('b',64),actor_owner);
  if n<>0 then raise exception 'Superseded attempt accepted'; end if;
  select * into context from public.consume_social_connect_state(repeat('c',64),actor_owner);
  if context.platform is distinct from 'linkedin' then raise exception 'New attempt lost binding'; end if;

  perform public.register_social_connect_state(repeat('d',64),actor_owner,ws,'oauth-profile','instagram');
  update private.social_connect_states set expires_at=now()-interval '1 second' where user_id=actor_owner;
  select count(*) into n from public.consume_social_connect_state(repeat('d',64),actor_owner);
  if n<>0 then raise exception 'Expired attempt accepted'; end if;

  perform public.register_social_connect_state(repeat('e',64),editor_id,ws,'oauth-profile','instagram');
  update public.workspace_members set role='viewer' where workspace_id=ws and user_id=editor_id;
  select count(*) into n from public.consume_social_connect_state(repeat('e',64),editor_id);
  if n<>0 then raise exception 'Revoked editor completed callback'; end if;

  begin
    perform public.register_social_connect_state(repeat('f',64),viewer_id,ws,'oauth-profile','instagram');
    raise exception 'Viewer registered state';
  exception when insufficient_privilege then null; end;
  begin
    perform public.register_social_connect_state(repeat('f',64),outsider_id,ws,'oauth-profile','instagram');
    raise exception 'Outsider registered state';
  exception when insufficient_privilege then null; end;
  begin
    perform public.register_social_connect_state(repeat('f',64),actor_owner,ws,'foreign-profile','instagram');
    raise exception 'Foreign profile registered';
  exception when insufficient_privilege then null; end;
  begin
    perform public.register_social_connect_state('bad-hash',actor_owner,ws,'oauth-profile','instagram');
    raise exception 'Malformed nonce hash accepted';
  exception when invalid_parameter_value then null; end;

  foreach rpc in array array[
    'public.register_social_connect_state(text,uuid,uuid,text,text)',
    'public.consume_social_connect_state(text,uuid)'
  ] loop
    if not has_function_privilege('service_role',rpc,'EXECUTE') then raise exception 'Service permission missing'; end if;
    foreach role_name in array array['anon','authenticated','credit_unprivileged'] loop
      if has_function_privilege(role_name,rpc,'EXECUTE') then raise exception 'Client can call state function'; end if;
    end loop;
  end loop;
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if has_table_privilege(role_name,'private.social_connect_states','SELECT,INSERT,UPDATE,DELETE') then raise exception 'State table directly accessible'; end if;
  end loop;
end;
$$;
rollback;
