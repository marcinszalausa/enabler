begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
do $$begin
 if (select count(*) from public.creative_favorites)<>2 then raise exception 'Personal favorites leaked';end if;
 begin insert into public.creative_favorites(user_id,creative_id) values('81000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000004');raise exception 'Forged owner accepted';exception when insufficient_privilege then null;end;
 begin insert into public.creative_favorites(creative_id) values('84000000-0000-4000-8000-000000000099');raise exception 'Other workspace accepted';exception when insufficient_privilege then null;end;
 insert into public.creative_favorites(creative_id) values('84000000-0000-4000-8000-000000000004') on conflict do nothing;
 insert into public.creative_favorites(creative_id) values('84000000-0000-4000-8000-000000000004') on conflict do nothing;
 if (select count(*) from public.creative_favorites)<>3 then raise exception 'Idempotent save failed';end if;
 begin update public.creative_favorites set user_id='81000000-0000-4000-8000-000000000002';raise exception 'Ownership reassigned';exception when insufficient_privilege then null;end;
 delete from public.creative_favorites where user_id='81000000-0000-4000-8000-000000000002';
end$$;
reset role;
do $$begin
 if not exists(select from public.creative_favorites where user_id='81000000-0000-4000-8000-000000000002') then raise exception 'Deleted another user favorite';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
insert into public.creative_favorites(creative_id) values('84000000-0000-4000-8000-000000000004');
do $$begin
 if (select count(*) from public.creative_favorites)<>2 then raise exception 'Viewer cannot save privately';end if;
end$$;
reset role;
delete from public.workspace_members where user_id='81000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$begin
 if exists(select from public.creative_favorites) then raise exception 'Removed member sees old favorites';end if;
 begin insert into public.creative_favorites(creative_id) values('84000000-0000-4000-8000-000000000005');raise exception 'Removed member can save';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role anon;
do $$begin
 begin perform count(*) from public.creative_favorites;raise exception 'Anonymous favorites readable';exception when insufficient_privilege then null;end;
end$$;
reset role;
delete from public.creatives where id='84000000-0000-4000-8000-000000000004';
do $$begin
 if exists(select from public.creative_favorites where creative_id='84000000-0000-4000-8000-000000000004') then raise exception 'Creative deletion left orphaned favorites';end if;
end$$;
rollback;
