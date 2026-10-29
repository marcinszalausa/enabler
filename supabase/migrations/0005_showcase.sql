-- Ad runs the Gooidy team picks to show on the public /use-cases page.
-- Null means private. Only the server (service role) sets it, after checking
-- the caller is on SHOWCASE_ADMIN_EMAILS.

alter table public.generations add column showcased_at timestamptz;

create index generations_showcased_at_idx on public.generations (showcased_at)
  where showcased_at is not null;
