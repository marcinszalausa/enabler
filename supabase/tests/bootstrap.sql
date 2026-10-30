-- Minimal Supabase dependencies for a DISPOSABLE vanilla PostgreSQL database.
-- This is a test fixture, never a production migration.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role credit_unprivileged nologin;
grant usage on schema public to anon, authenticated, service_role, credit_unprivileged;

create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key, bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/');
$$;
