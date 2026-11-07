-- Inventory has its own watermark: a stock refresh must not hide a later
-- catalog edit, and an old product webhook must not undo newer stock data.
alter table public.catalog_items add column inventory_updated_at timestamptz;
update public.catalog_items set inventory_updated_at=source_updated_at;
create index catalog_items_stock_lookup_idx on public.catalog_items(workspace_id,product_url);
create table public.catalog_inventory_signals(
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.shopify_stores(id) on delete cascade,
 installation_id uuid not null,
 event_id text not null check(length(event_id) between 1 and 180),
 resource_id text not null check(resource_id ~ '^gid://shopify/(InventoryItem|Product)/[0-9]+$'),
 status text not null default 'pending' check(status in ('pending','processed')),
 created_at timestamptz not null default now(),processed_at timestamptz,
 unique(store_id,installation_id,event_id)
);
create index catalog_inventory_pending_idx on public.catalog_inventory_signals(created_at) where status='pending';
alter table public.catalog_inventory_signals enable row level security;
revoke all on public.catalog_inventory_signals from public,anon,authenticated;
grant all on public.catalog_inventory_signals to service_role;
create policy service_access on public.catalog_inventory_signals for all to service_role using(true) with check(true);
create function public.apply_catalog_inventory(connection uuid,external text,quantity integer,observed timestamptz) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if quantity<0 or observed>now()+interval '5 minutes' then raise exception 'INVENTORY_INVALID';end if;
 if not exists(select 1 from public.catalog_connections where id=connection and enabled) then raise exception 'CATALOG_CONNECTION_DISABLED';end if;
 update public.catalog_items set inventory_quantity=quantity,inventory_updated_at=observed,updated_at=now()
 where connection_id=connection and external_id=external and (inventory_updated_at is null or inventory_updated_at<observed);
 return found;
end $$;
revoke all on function public.apply_catalog_inventory(uuid,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_catalog_inventory(uuid,text,integer,timestamptz) to service_role;

-- Provider credentials and ad ownership are established by the paid-account
-- connector. Browsers cannot register bindings or choose an arbitrary ad ID.
create table public.catalog_ad_accounts(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 provider text not null check(provider in ('meta','tiktok')),external_account_id text not null check(external_account_id ~ '^[0-9]{1,30}$'),
 credentials_cipher text not null,enabled boolean not null default false,unique(id,workspace_id),unique(provider,external_account_id)
);
create table public.catalog_ad_bindings(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,item_id uuid not null,account_id uuid not null,
 external_ad_id text not null check(external_ad_id ~ '^[0-9]{1,30}$'),status text not null default 'active' check(status in ('active','paused','archived')),
 foreign key(item_id,workspace_id) references public.catalog_items(id,workspace_id) on delete cascade,
 foreign key(account_id,workspace_id) references public.catalog_ad_accounts(id,workspace_id) on delete cascade,
 unique(account_id,external_ad_id)
);
create index catalog_ad_bindings_stock_idx on public.catalog_ad_bindings(item_id) where status='active';
create index catalog_ad_bindings_workspace_idx on public.catalog_ad_bindings(workspace_id);
create index catalog_ad_bindings_item_idx on public.catalog_ad_bindings(item_id,workspace_id);
create table public.catalog_stock_pauses(
 id uuid primary key default gen_random_uuid(),binding_id uuid not null references public.catalog_ad_bindings(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','confirmed')),
 requested_at timestamptz not null default now(),confirmed_at timestamptz,error_code text,
 unique(binding_id)
);
create index catalog_stock_pauses_pending_idx on public.catalog_stock_pauses(requested_at) where status='pending';
do $$ declare tab text;begin
 foreach tab in array array['catalog_ad_accounts','catalog_ad_bindings','catalog_stock_pauses'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated',tab);
 execute format('grant all on public.%I to service_role',tab);
 execute format('create policy service_access on public.%I for all to service_role using(true) with check(true)',tab);
 end loop;
end $$;
create function public.catalog_queue_stock_pauses() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.inventory_quantity=0 then
 insert into public.catalog_stock_pauses(binding_id)
 select id from public.catalog_ad_bindings where item_id=new.id and workspace_id=new.workspace_id and status='active'
 on conflict(binding_id) do update set status='pending',requested_at=now(),confirmed_at=null where catalog_stock_pauses.status='confirmed';
 end if;return new;
end $$;
create trigger catalog_zero_stock after insert or update of inventory_quantity on public.catalog_items for each row execute function public.catalog_queue_stock_pauses();
create function public.catalog_guard_ad_binding() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status='active' and exists(select 1 from public.catalog_items where id=new.item_id and inventory_quantity=0) then
 raise exception 'CATALOG_PRODUCT_OUT_OF_STOCK';end if;return new;
end $$;
create trigger catalog_binding_stock_guard before insert or update of status,item_id on public.catalog_ad_bindings for each row execute function public.catalog_guard_ad_binding();
revoke all on function public.catalog_queue_stock_pauses(),public.catalog_guard_ad_binding() from public,anon,authenticated;
grant execute on function public.catalog_queue_stock_pauses(),public.catalog_guard_ad_binding() to service_role;

-- Private, supplementary product photos never replace the store's originals.
create table public.catalog_training_photos(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,item_id uuid not null,
 storage_path text not null unique,content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 width integer not null check(width>=768),height integer not null check(height>=768),created_by uuid not null,
 created_at timestamptz not null default now(),
 foreign key(item_id,workspace_id) references public.catalog_items(id,workspace_id) on delete cascade,
 unique(item_id,content_hash)
);
create index catalog_training_photos_workspace_idx on public.catalog_training_photos(workspace_id);
alter table public.catalog_training_photos enable row level security;
revoke all on public.catalog_training_photos from public,anon,authenticated;
grant all on public.catalog_training_photos to service_role;
grant select on public.catalog_training_photos to authenticated;
create policy service_access on public.catalog_training_photos for all to service_role using(true) with check(true);
create policy owner_read on public.catalog_training_photos for select to authenticated using(public.is_workspace_member(workspace_id,'owner') and public.can_connect_store(workspace_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('catalog-photos','catalog-photos',false,6291456,array['image/jpeg']),('catalog-model-review','catalog-model-review',false,8388608,array['image/jpeg']) on conflict(id) do nothing;

alter table public.catalog_training_jobs add column source_revision text;
alter table public.catalog_training_jobs add column training_photos jsonb check(training_photos is null or (jsonb_typeof(training_photos)='array' and jsonb_array_length(training_photos) between 10 and 20));
alter table public.catalog_training_jobs add column source_reviewed_at timestamptz;
alter table public.catalog_training_jobs add column consent_user_id uuid;
alter table public.catalog_training_jobs add column training_requested_at timestamptz;
alter table public.catalog_training_jobs add column budget_cents integer check(budget_cents between 1 and 1000);
create table public.catalog_training_limits(
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 max_budget_cents integer not null check(max_budget_cents between 1 and 1000),
 remaining_runs integer not null default 0 check(remaining_runs between 0 and 1),
 authorized_at timestamptz not null default now()
);
alter table public.catalog_training_limits enable row level security;
revoke all on public.catalog_training_limits from public,anon,authenticated;
grant all on public.catalog_training_limits to service_role;
create policy service_access on public.catalog_training_limits for all to service_role using(true) with check(true);
create table public.catalog_model_samples(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,job_id uuid not null references public.catalog_training_jobs(id) on delete cascade,
 scenario integer not null check(scenario between 0 and 2),prediction_id text,
 status text not null default 'queued' check(status in ('queued','submitting','unknown','running','succeeded','failed')),
 storage_path text,error_code text,created_at timestamptz not null default now(),unique(job_id,scenario)
);
alter table public.catalog_training_jobs add constraint catalog_training_job_workspace_unique unique(id,workspace_id);
alter table public.catalog_model_samples add constraint catalog_model_sample_workspace_fk foreign key(job_id,workspace_id) references public.catalog_training_jobs(id,workspace_id) on delete cascade;
create index catalog_model_samples_workspace_idx on public.catalog_model_samples(workspace_id);
alter table public.catalog_model_samples enable row level security;
revoke all on public.catalog_model_samples from public,anon,authenticated;
grant all on public.catalog_model_samples to service_role;
grant select on public.catalog_model_samples to authenticated;
create policy service_access on public.catalog_model_samples for all to service_role using(true) with check(true);
create policy owner_read on public.catalog_model_samples for select to authenticated using(public.is_workspace_member(workspace_id,'owner') and public.can_connect_store(workspace_id));

create function public.is_workspace_member_for_catalog(ws uuid,actor uuid) returns boolean
language sql stable security invoker set search_path='' as $$select exists(select 1 from public.workspace_members where workspace_id=ws and user_id=actor and role='owner')$$;
revoke all on function public.is_workspace_member_for_catalog(uuid,uuid) from public,anon,authenticated;
grant execute on function public.is_workspace_member_for_catalog(uuid,uuid) to service_role;

create or replace function public.claim_catalog_training(job uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j public.catalog_training_jobs;source_id uuid;begin
 select * into j from public.catalog_training_jobs where id=job;if not found then raise exception 'CATALOG_JOB_MISSING';end if;
 perform pg_advisory_xact_lock(hashtextextended(j.workspace_id::text,708));
 select * into j from public.catalog_training_jobs where id=job for update;
 if j.status<>'dataset_ready' or j.training_requested_at is null or j.source_reviewed_at is null or j.consent_user_id is null or j.budget_cents is null then return false;end if;
 select connection_id into source_id from public.catalog_items where id=j.item_id and image_revision=j.source_revision;
 if source_id is null or not public.can_connect_store(j.workspace_id) or not public.is_workspace_member_for_catalog(j.workspace_id,j.consent_user_id) then return false;end if;
 if not exists(select 1 from public.catalog_connections where id=source_id and enabled) then return false;end if;
 if exists(select 1 from public.catalog_training_jobs where workspace_id=j.workspace_id and id<>job and (status in ('submitting','submission_unknown','running','cancel_pending') or submitted_at>now()-interval '24 hours')) then return false;end if;
 update public.catalog_training_limits set remaining_runs=remaining_runs-1 where workspace_id=j.workspace_id and remaining_runs>0 and max_budget_cents>=j.budget_cents;
 if not found then return false;end if;
 update public.catalog_training_jobs set status='submitting',submitted_at=now() where id=job;return true;
end $$;
-- This service-only predicate uses the recorded, authenticated actor, rather
-- than a privileged service JWT pretending to be the customer.

create function public.register_catalog_training_photo(ws uuid,item uuid,path text,hash text,width integer,height integer,actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare saved public.catalog_training_photos;begin
 perform pg_advisory_xact_lock(hashtextextended(item::text,713));
 if not public.can_connect_store(ws) or not public.is_workspace_member_for_catalog(ws,actor) or not exists(select 1 from public.catalog_items i join public.catalog_connections c on c.id=i.connection_id where i.id=item and i.workspace_id=ws and c.enabled) then raise exception 'CATALOG_OWNER_REQUIRED';end if;
 if path not like ws::text||'/'||item::text||'/%' then raise exception 'PHOTO_PATH_INVALID';end if;
 select * into saved from public.catalog_training_photos p where p.item_id=item and p.content_hash=hash;
 if found then return jsonb_build_object('id',saved.id,'storage_path',saved.storage_path);end if;
 if (select count(*) from public.catalog_training_photos where item_id=item)>=20 then raise exception 'PHOTO_LIMIT';end if;
 insert into public.catalog_training_photos(workspace_id,item_id,storage_path,content_hash,width,height,created_by) values(ws,item,path,hash,width,height,actor) returning * into saved;
 return jsonb_build_object('id',saved.id,'storage_path',saved.storage_path);
end $$;
create function public.queue_catalog_training(ws uuid,item uuid,revision text,source text,photos jsonb,trainer text,destination text,actor uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare saved uuid;p jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(ws::text,708));
 if not public.can_connect_store(ws) or not public.is_workspace_member_for_catalog(ws,actor) or not exists(select 1 from public.catalog_items i join public.catalog_connections c on c.id=i.connection_id where i.id=item and i.workspace_id=ws and i.image_revision=source and c.enabled) then raise exception 'CATALOG_OWNER_REQUIRED';end if;
 if jsonb_typeof(photos)<>'array' or jsonb_array_length(photos) not between 10 and 20 then raise exception 'PHOTO_SELECTION_INVALID';end if;
 for p in select value from jsonb_array_elements(photos) loop
  if p ? 'path' then
   if not exists(select 1 from public.catalog_training_photos where item_id=item and workspace_id=ws and storage_path=p->>'path') then raise exception 'PHOTO_SELECTION_INVALID';end if;
  elsif not exists(select 1 from public.catalog_items where id=item and images ? (p->>'url')) then raise exception 'PHOTO_SELECTION_INVALID';end if;
 end loop;
 select id into saved from public.catalog_training_jobs where item_id=item and image_revision=revision and trainer_version=trainer;if found then return saved;end if;
 if (select count(*) from public.catalog_training_jobs where workspace_id=ws and source_reviewed_at>now()-interval '24 hours')>=3 then raise exception 'PREPARATION_LIMIT';end if;
 insert into public.catalog_training_jobs(workspace_id,item_id,image_revision,source_revision,training_photos,source_reviewed_at,consent_user_id,trainer_version,destination)
 values(ws,item,revision,source,photos,now(),actor,trainer,destination) returning id into saved;return saved;
end $$;
create function public.request_catalog_training(job uuid,item uuid,actor uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j public.catalog_training_jobs;b integer;begin
 select * into j from public.catalog_training_jobs where id=job and item_id=item for update;
 if not found or j.status<>'dataset_ready' or j.source_reviewed_at is null or not public.can_connect_store(j.workspace_id) or not public.is_workspace_member_for_catalog(j.workspace_id,actor) then return false;end if;
 select max_budget_cents into b from public.catalog_training_limits where workspace_id=j.workspace_id and remaining_runs>0;if b is null then return false;end if;
 update public.catalog_training_jobs set training_requested_at=now(),budget_cents=b,consent_user_id=actor where id=job;return true;
end $$;
create function public.review_catalog_model(job uuid,item uuid,actor uuid,verdict text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j public.catalog_training_jobs;begin
 select * into j from public.catalog_training_jobs where id=job and item_id=item for update;
 if not found or j.status<>'succeeded' or j.candidate_version is null or not public.can_connect_store(j.workspace_id) or not public.is_workspace_member_for_catalog(j.workspace_id,actor) or verdict not in ('approved','rejected') then return false;end if;
 if verdict='approved' and ((select count(*) from public.catalog_model_samples where job_id=job and workspace_id=j.workspace_id and status='succeeded' and storage_path is not null)<>3 or not exists(select 1 from public.catalog_items i join public.catalog_connections c on c.id=i.connection_id where i.id=item and i.image_revision=j.source_revision and c.enabled)) then return false;end if;
 update public.catalog_training_jobs set review_status=verdict where id=job;return true;
end $$;
revoke all on function public.register_catalog_training_photo(uuid,uuid,text,text,integer,integer,uuid),public.queue_catalog_training(uuid,uuid,text,text,jsonb,text,text,uuid),public.request_catalog_training(uuid,uuid,uuid),public.review_catalog_model(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.register_catalog_training_photo(uuid,uuid,text,text,integer,integer,uuid),public.queue_catalog_training(uuid,uuid,text,text,jsonb,text,text,uuid),public.request_catalog_training(uuid,uuid,uuid),public.review_catalog_model(uuid,uuid,uuid,text) to service_role;

create function public.ensure_csv_catalog_connection(ws uuid,origin text,encrypted_key text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare source uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(ws::text||origin,714));
 if not public.can_connect_store(ws) then raise exception 'CATALOG_UPGRADE_REQUIRED';end if;
 select c.id into source from public.catalog_connections c where c.workspace_id=ws and c.platform='custom' and c.store_origin=origin and c.enabled and not exists(select 1 from public.platform_stores s where s.connection_id=c.id) order by c.created_at limit 1;
 if found then return source;end if;
 insert into public.catalog_connections(workspace_id,platform,store_origin,webhook_domain,enabled) values(ws,'custom',origin,substring(origin from 9),true) returning id into source;
 insert into public.catalog_connection_keys(connection_id,encrypted_secret) values(source,encrypted_key);return source;
end $$;
revoke all on function public.ensure_csv_catalog_connection(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ensure_csv_catalog_connection(uuid,text,text) to service_role;

create or replace function public.apply_catalog_delivery(delivery uuid) returns boolean
language plpgsql security invoker set search_path='' as $fn$
declare receipt public.catalog_deliveries; p jsonb; existing_product uuid;
begin
 select * into receipt from public.catalog_deliveries where id=delivery for update;
 if not found then raise exception 'CATALOG_DELIVERY_MISSING'; end if;
 if receipt.status='processed' then return false; end if;
 if not exists(select 1 from public.catalog_connections where id=receipt.connection_id and enabled) then raise exception 'CATALOG_CONNECTION_DISABLED'; end if;
 for p in select value from jsonb_array_elements(receipt.products) loop
 existing_product:=null;
 select id into existing_product from public.products where workspace_id=receipt.workspace_id and url=p->>'url' order by created_at limit 1;
 insert into public.catalog_items(connection_id,workspace_id,external_id,product_id,product_url,name,images,inventory_quantity,source_updated_at,image_revision,inventory_updated_at)
 values(receipt.connection_id,receipt.workspace_id,p->>'externalId',existing_product,p->>'url',p->>'name',p->'images',(p->>'inventoryQuantity')::integer,(p->>'updatedAt')::timestamptz,p->>'imageRevision',coalesce((p->>'inventoryUpdatedAt')::timestamptz,(p->>'updatedAt')::timestamptz))
 on conflict(connection_id,external_id) do update set
 product_id=coalesce(excluded.product_id,catalog_items.product_id),
 product_url=case when excluded.source_updated_at>catalog_items.source_updated_at then excluded.product_url else catalog_items.product_url end,
 name=case when excluded.source_updated_at>catalog_items.source_updated_at then excluded.name else catalog_items.name end,
 images=case when excluded.source_updated_at>catalog_items.source_updated_at then excluded.images else catalog_items.images end,
 image_revision=case when excluded.source_updated_at>catalog_items.source_updated_at then excluded.image_revision else catalog_items.image_revision end,
 inventory_quantity=case when excluded.inventory_updated_at>coalesce(catalog_items.inventory_updated_at,'-infinity') then excluded.inventory_quantity else catalog_items.inventory_quantity end,
 inventory_updated_at=greatest(catalog_items.inventory_updated_at,excluded.inventory_updated_at),
 source_updated_at=greatest(catalog_items.source_updated_at,excluded.source_updated_at),updated_at=now();
 end loop;
 update public.catalog_deliveries set status='processed',processed_at=now() where id=delivery;
 return true;
end
$fn$;
revoke all on function public.apply_catalog_delivery(uuid) from public,anon,authenticated;
grant execute on function public.apply_catalog_delivery(uuid) to service_role;

alter table public.catalog_ad_accounts add column name text not null default '';
alter table public.catalog_ad_accounts add column token_expires_at timestamptz;
create index catalog_ad_accounts_workspace_idx on public.catalog_ad_accounts(workspace_id);
create table public.catalog_ad_connect_intents(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,user_id uuid not null,
 provider text not null check(provider in ('meta','tiktok')),state_hash text not null unique check(state_hash ~ '^[a-f0-9]{64}$'),nonce_hash text not null check(nonce_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'pending' check(status in ('pending','exchanging','authorized','consumed')),
 credentials_cipher text,expires_at timestamptz not null,created_at timestamptz not null default now()
);
create index catalog_ad_connect_intents_expiry_idx on public.catalog_ad_connect_intents(expires_at);
create index catalog_ad_connect_intents_workspace_idx on public.catalog_ad_connect_intents(workspace_id);
alter table public.catalog_ad_connect_intents enable row level security;
revoke all on public.catalog_ad_connect_intents from public,anon,authenticated;
grant all on public.catalog_ad_connect_intents to service_role;
create policy service_access on public.catalog_ad_connect_intents for all to service_role using(true) with check(true);
create function public.finalize_catalog_ad_account(intent_id uuid,actor uuid,nonce text,external text,account_name text,encrypted_token text,expiry timestamptz) returns uuid
language plpgsql security invoker set search_path='' as $$
declare intent public.catalog_ad_connect_intents;existing public.catalog_ad_accounts;saved uuid;begin
 select * into intent from public.catalog_ad_connect_intents where id=intent_id and user_id=actor and nonce_hash=nonce and expires_at>now() and status='authorized' for update;
 if not found or not public.can_connect_store(intent.workspace_id) or not public.is_workspace_member_for_catalog(intent.workspace_id,actor) then raise exception 'PAID_CONNECT_STATE_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(intent.provider||external,715));
 select * into existing from public.catalog_ad_accounts where provider=intent.provider and external_account_id=external;
 if found and existing.workspace_id<>intent.workspace_id then raise exception 'PAID_ACCOUNT_WORKSPACE_CONFLICT';end if;
 insert into public.catalog_ad_accounts(workspace_id,provider,external_account_id,credentials_cipher,enabled,name,token_expires_at)
 values(intent.workspace_id,intent.provider,external,encrypted_token,true,left(account_name,200),expiry)
 on conflict(provider,external_account_id) do update set credentials_cipher=excluded.credentials_cipher,enabled=true,name=excluded.name,token_expires_at=excluded.token_expires_at returning id into saved;
 update public.catalog_ad_connect_intents set status='consumed',credentials_cipher=null where id=intent_id;return saved;
end $$;
create function public.bind_catalog_paid_ad(item uuid,account uuid,external text,actor uuid,binding_status text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare ws uuid;saved uuid;previous public.catalog_ad_bindings;begin
 select i.workspace_id into ws from public.catalog_items i join public.catalog_connections c on c.id=i.connection_id where i.id=item and c.enabled;
 if ws is null or not public.can_connect_store(ws) or not public.is_workspace_member_for_catalog(ws,actor) or not exists(select 1 from public.catalog_ad_accounts where id=account and workspace_id=ws and enabled) or binding_status not in ('active','paused') then raise exception 'PAID_AD_ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended(account::text||external,716));
 select * into previous from public.catalog_ad_bindings where account_id=account and external_ad_id=external;
 if found and (previous.workspace_id<>ws or previous.item_id<>item) then raise exception 'PAID_AD_ALREADY_BOUND';end if;
 insert into public.catalog_ad_bindings(workspace_id,item_id,account_id,external_ad_id,status) values(ws,item,account,external,binding_status)
 on conflict(account_id,external_ad_id) do update set status=excluded.status returning id into saved;return saved;
end $$;
revoke all on function public.finalize_catalog_ad_account(uuid,uuid,text,text,text,text,timestamptz),public.bind_catalog_paid_ad(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.finalize_catalog_ad_account(uuid,uuid,text,text,text,text,timestamptz),public.bind_catalog_paid_ad(uuid,uuid,text,uuid,text) to service_role;
