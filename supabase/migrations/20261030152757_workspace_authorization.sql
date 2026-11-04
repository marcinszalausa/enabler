-- Clients edit copy/approval only. Tenant identity, generation linkage and
-- storage keys remain immutable to clients even when RLS allows row updates.
revoke update on public.creatives from public, anon, authenticated;
revoke update(id,workspace_id,generation_id,kind,aspect,storage_path,angle,created_at,headline,primary_text,cta,status)
  on public.creatives from public, anon, authenticated;
grant update(headline,primary_text,cta,status) on public.creatives to authenticated;

-- Admin rendering may sign this path for public showcase assets. Never let a
-- user-controlled brand kit point at another workspace's storage.
alter table public.brand_kits add constraint brand_kits_logo_workspace_path
  check (logo_path is null or logo_path ~
    ('^' || workspace_id::text || '/brand/[A-Za-z0-9][A-Za-z0-9._-]*$'));
