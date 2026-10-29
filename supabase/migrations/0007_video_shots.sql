-- Video ads with several shots, a voiceover and music: a job now waits on
-- one video-model request per shot, and keeps its sound files until the
-- shots are put together.

alter table public.video_jobs
  add column request_ids text[] not null default '{}',
  add column voiceover text,
  add column voice_path text,
  add column music_path text;

alter table public.video_jobs drop column request_id;
