-- Milestone 2: brand kit (logo, button color, headline font) per workspace.

create table public.brand_kits (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  -- Path in the private "creatives" bucket, under <workspace_id>/brand/.
  logo_path text,
  accent_color text not null default '#ffffff'
    check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  font text not null default 'inter'
    check (font in ('inter', 'poppins', 'montserrat', 'playfair')),
  updated_at timestamptz not null default now()
);

alter table public.brand_kits enable row level security;

create policy "members read brand kit" on public.brand_kits
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "editors write brand kit" on public.brand_kits
  for all to authenticated
  using (public.is_workspace_member(workspace_id, 'editor'))
  with check (public.is_workspace_member(workspace_id, 'editor'));
