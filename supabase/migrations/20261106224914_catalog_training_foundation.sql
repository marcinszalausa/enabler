
create table public.catalog_connections (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 platform text not null check (platform in ('shopify','woocommerce','custom','wix')),
 store_origin text not null check (store_origin ~ '^https://[a-z0-9.-]+$'),
 webhook_domain text not null,
 enabled boolean not null default false,
 training_allowance integer not null default 0 check (training_allowance between 0 and 1),
 created_at timestamptz not null default now(),
 unique(id,workspace_id)
);
create index catalog_connections_workspace_idx on public.catalog_connections(workspace_id);
create table public.catalog_connection_keys (
 connection_id uuid primary key references public.catalog_connections(id) on delete cascade,
 encrypted_secret text not null
);
create table public.catalog_deliveries (
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null,
 workspace_id uuid not null,
 event_id text not null check(length(event_id) between 1 and 200),
 body_hash text not null check(body_hash ~ '^[a-f0-9]{64}$'),
 products jsonb not null check(jsonb_typeof(products)='array' and jsonb_array_length(products) between 1 and 250),
 status text not null default 'pending' check(status in ('pending','processed','failed')),
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 foreign key(connection_id,workspace_id) references public.catalog_connections(id,workspace_id) on delete cascade,
 unique(connection_id,event_id)
);
create index catalog_deliveries_pending_idx on public.catalog_deliveries(received_at) where status='pending';
create index catalog_deliveries_workspace_idx on public.catalog_deliveries(workspace_id);
create unique index products_id_workspace_catalog_idx on public.products(id,workspace_id);
create table public.catalog_items (
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null,
 workspace_id uuid not null,
 external_id text not null,
 product_id uuid,
 product_url text not null,
 name text not null,
 images jsonb not null check(jsonb_typeof(images)='array' and jsonb_array_length(images)<=30),
 inventory_quantity integer check(inventory_quantity>=0),
 source_updated_at timestamptz not null,
 image_revision text not null check(image_revision ~ '^[a-f0-9]{64}$'),
 updated_at timestamptz not null default now(),
 foreign key(connection_id,workspace_id) references public.catalog_connections(id,workspace_id) on delete cascade,
 foreign key(product_id,workspace_id) references public.products(id,workspace_id) on delete set null(product_id),
 unique(connection_id,external_id),
 unique(id,workspace_id)
);
create index catalog_items_workspace_idx on public.catalog_items(workspace_id);
create index catalog_items_product_idx on public.catalog_items(product_id,workspace_id);
create table public.catalog_training_jobs (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 item_id uuid not null,
 image_revision text not null,
 trainer_version text not null check(trainer_version ~ '^[a-f0-9]{64}$'),
 destination text not null check(destination ~ '^[-a-z0-9_]+/[-a-z0-9_]+$'),
 base_family text not null default 'flux.1-dev' check(base_family='flux.1-dev'),
 status text not null default 'queued' check(status in ('queued','blocked','dataset_ready','submitting','submission_unknown','running','succeeded','failed','cancel_pending','canceled')),
 dataset_path text,
 dataset_hash text,
 image_count integer,
 provider_training_id text unique,
 candidate_version text,
 review_status text not null default 'pending' check(review_status in ('pending','approved','rejected')),
 error_code text,
 submitted_at timestamptz,
 finished_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(item_id,workspace_id) references public.catalog_items(id,workspace_id) on delete cascade,
 unique(item_id,image_revision,trainer_version)
);
create unique index catalog_training_dataset_idx on public.catalog_training_jobs(item_id,dataset_hash,trainer_version) where dataset_hash is not null;
create index catalog_training_workspace_idx on public.catalog_training_jobs(workspace_id);
create index catalog_training_pending_idx on public.catalog_training_jobs(created_at) where status in ('queued','dataset_ready','submitting','submission_unknown','running','cancel_pending');
do $policy$
declare tab text;
begin
 foreach tab in array array['catalog_connections','catalog_connection_keys','catalog_deliveries','catalog_items','catalog_training_jobs'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated',tab);
 execute format('grant all on public.%I to service_role',tab);
 execute format('create policy service_access on public.%I for all to service_role using (true) with check (true)',tab);
 if tab<>'catalog_connection_keys' then
 execute format('grant select on public.%I to authenticated',tab);
 execute format('create policy workspace_read on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',tab);
 end if;
 end loop;
end
$policy$;
create function public.apply_catalog_delivery(delivery uuid) returns boolean
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
 insert into public.catalog_items(connection_id,workspace_id,external_id,product_id,product_url,name,images,inventory_quantity,source_updated_at,image_revision)
 values(receipt.connection_id,receipt.workspace_id,p->>'externalId',existing_product,p->>'url',p->>'name',p->'images',(p->>'inventoryQuantity')::integer,(p->>'updatedAt')::timestamptz,p->>'imageRevision')
 on conflict(connection_id,external_id) do update set
 product_id=coalesce(excluded.product_id,catalog_items.product_id),
 product_url=excluded.product_url,name=excluded.name,images=excluded.images,
 inventory_quantity=excluded.inventory_quantity,source_updated_at=excluded.source_updated_at,
 image_revision=excluded.image_revision,updated_at=now()
 where excluded.source_updated_at>catalog_items.source_updated_at;
 end loop;
 update public.catalog_deliveries set status='processed',processed_at=now() where id=delivery;
 return true;
end
$fn$;
revoke all on function public.apply_catalog_delivery(uuid) from public,anon,authenticated;
grant execute on function public.apply_catalog_delivery(uuid) to service_role;
create function public.claim_catalog_training(job uuid) returns boolean
language plpgsql security invoker set search_path='' as $fn$
declare current_job public.catalog_training_jobs; source_id uuid; allowance integer;
begin
 select * into current_job from public.catalog_training_jobs where id=job;
 if not found then raise exception 'CATALOG_JOB_MISSING'; end if;
 perform pg_advisory_xact_lock(hashtextextended(current_job.workspace_id::text,708));
 select * into current_job from public.catalog_training_jobs where id=job for update;
 if current_job.status<>'dataset_ready' then return false; end if;
 select connection_id into source_id from public.catalog_items where id=current_job.item_id;
 select training_allowance into allowance from public.catalog_connections where id=source_id and enabled for update;
 if not found or allowance<1 then return false; end if;
 if exists(select 1 from public.catalog_training_jobs where workspace_id=current_job.workspace_id and id<>job and
 (status in ('submitting','submission_unknown','running','cancel_pending') or submitted_at>now()-interval '24 hours')) then return false; end if;
 update public.catalog_connections set training_allowance=training_allowance-1 where id=source_id;
 update public.catalog_training_jobs set status='submitting',submitted_at=now() where id=job;
 return true;
end
$fn$;
revoke all on function public.claim_catalog_training(uuid) from public,anon,authenticated;
grant execute on function public.claim_catalog_training(uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('catalog-training','catalog-training',false,41943040,array['application/zip'])
on conflict(id) do nothing;
