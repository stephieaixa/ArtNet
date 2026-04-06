-- ============================================================
-- ArtNet: Messaging System Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- applications: artist applies to a scraped job
create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.scraped_jobs(id) on delete cascade,
  artist_user_id uuid not null references auth.users(id) on delete cascade,
  cover_message text,
  status        text not null default 'pending'
                  check (status in ('pending','viewed','accepted','rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(job_id, artist_user_id)
);

alter table public.applications enable row level security;

-- Artist can read/insert their own applications
create policy "app_artist_select" on public.applications
  for select using (artist_user_id = auth.uid());

create policy "app_artist_insert" on public.applications
  for insert with check (artist_user_id = auth.uid());

-- Job poster can read + update status
create policy "app_poster_select" on public.applications
  for select using (
    exists (
      select 1 from public.scraped_jobs j
      where j.id = job_id and j.user_id = auth.uid()
    )
  );

create policy "app_poster_update" on public.applications
  for update using (
    exists (
      select 1 from public.scraped_jobs j
      where j.id = job_id and j.user_id = auth.uid()
    )
  );

-- ============================================================

-- conversations: opened after match (accepted application or business invite)
create table if not exists public.conversations (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete set null,
  job_id         uuid references public.scraped_jobs(id) on delete set null,
  artist_user_id uuid not null references auth.users(id) on delete cascade,
  other_user_id  uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "conv_participant_select" on public.conversations
  for select using (
    artist_user_id = auth.uid() or other_user_id = auth.uid()
  );

create policy "conv_participant_insert" on public.conversations
  for insert with check (
    artist_user_id = auth.uid() or other_user_id = auth.uid()
  );

create policy "conv_participant_update" on public.conversations
  for update using (
    artist_user_id = auth.uid() or other_user_id = auth.uid()
  );

-- ============================================================

-- messages
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "msg_participant_select" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.artist_user_id = auth.uid() or c.other_user_id = auth.uid())
    )
  );

create policy "msg_sender_insert" on public.messages
  for insert with check (sender_id = auth.uid());

create policy "msg_recipient_mark_read" on public.messages
  for update using (
    sender_id != auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.artist_user_id = auth.uid() or c.other_user_id = auth.uid())
    )
  );

-- ============================================================

-- source_suggestions (for "Suggest a source" modal)
create table if not exists public.source_suggestions (
  id           uuid primary key default gen_random_uuid(),
  url          text not null,
  name         text,
  type         text,
  description  text,
  submitted_by uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

alter table public.source_suggestions enable row level security;

create policy "suggest_anyone_insert" on public.source_suggestions
  for insert with check (true);

-- ============================================================

-- Helper function: update last_message_at on conversations
create or replace function public.update_conversation_last_message()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_new_message
  after insert on public.messages
  for each row execute function public.update_conversation_last_message();

-- Helper function: update applications updated_at
create or replace function public.update_application_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_application_update
  before update on public.applications
  for each row execute function public.update_application_timestamp();
