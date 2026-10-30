-- All fixtures and mutations in this suite are rolled back.
begin;

insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000001', 'credit-tests@example.invalid');

do $$
declare
  ws uuid;
  missing_ws uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  balance integer;
  bad_amount integer;
  role_name text;
  rpc text;
begin
  select id into strict ws from public.workspaces
    where owner_id = '10000000-0000-0000-0000-000000000001';

  -- Reject invalid input for both existing and nonexistent workspaces.
  foreach bad_amount in array array[null, 0, -1, -2147483648]::integer[] loop
    foreach rpc in array array['spend_credits', 'refund_credits'] loop
      begin
        execute format('select public.%I($1, $2)', rpc) using ws, bad_amount;
        raise exception '% accepted invalid amount %', rpc, bad_amount;
      exception when invalid_parameter_value then null;
      end;
      begin
        execute format('select public.%I($1, $2)', rpc) using missing_ws, bad_amount;
        raise exception '% accepted invalid amount for nonexistent workspace', rpc;
      exception when invalid_parameter_value then null;
      end;
    end loop;
  end loop;

  select credits into balance from public.workspaces where id = ws;
  if balance <> 100 then raise exception 'Invalid input mutated balance: %', balance; end if;
  if not public.spend_credits(ws, 30) then raise exception 'Valid spend failed'; end if;
  if public.spend_credits(ws, 71) then raise exception 'Overspend succeeded'; end if;
  if public.spend_credits(missing_ws, 1) then raise exception 'Missing workspace spend succeeded'; end if;
  perform public.refund_credits(ws, 10);
  perform public.refund_credits(missing_ws, 1); -- Preserve existing no-op behavior.
  select credits into balance from public.workspaces where id = ws;
  if balance <> 80 then raise exception 'Incorrect spend/refund balance: %', balance; end if;
  if not public.spend_credits(ws, 80) then raise exception 'Exact-balance spend failed'; end if;
  if public.spend_credits(ws, 1) then raise exception 'Empty balance spend succeeded'; end if;

  -- Overflow must fail atomically, leaving the balance unchanged.
  perform public.refund_credits(ws, 2147483647);
  begin
    perform public.refund_credits(ws, 1);
    raise exception 'Overflow unexpectedly succeeded';
  exception when numeric_value_out_of_range then null;
  end;
  select credits into balance from public.workspaces where id = ws;
  if balance <> 2147483647 then raise exception 'Overflow mutated balance'; end if;

  foreach rpc in array array['spend_credits', 'refund_credits'] loop
    if not has_function_privilege('service_role', format('public.%I(uuid,integer)', rpc), 'EXECUTE') then
      raise exception 'service_role cannot execute %', rpc;
    end if;
    foreach role_name in array array['anon', 'authenticated', 'credit_unprivileged'] loop
      if has_function_privilege(role_name, format('public.%I(uuid,integer)', rpc), 'EXECUTE') then
        raise exception '% can execute %', role_name, rpc;
      end if;
    end loop;
  end loop;
end;
$$;

-- Exercise actual positive mutations as service_role through SECURITY DEFINER.
select set_config('credit_test.workspace_id', (
  select id::text from public.workspaces
    where owner_id = '10000000-0000-0000-0000-000000000001'
), true);
set local role service_role;
do $$
begin
  if not public.spend_credits(current_setting('credit_test.workspace_id')::uuid, 1) then
    raise exception 'Service-role spend failed';
  end if;
  perform public.refund_credits(current_setting('credit_test.workspace_id')::uuid, 1);
end;
$$;
reset role;
rollback;
