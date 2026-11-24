-- OvenHire chef talent and private contact migration.
-- Apply only to a dedicated OvenHire PostgreSQL database after reviewing backups.
-- This migration is not run against the existing Amdavad Oven database.

create table if not exists public.chef_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  headline text not null,
  years_experience integer not null default 0 check (years_experience between 0 and 60),
  cuisines text[] not null default '{}',
  stations text[] not null default '{}',
  oven_skills text[] not null default '{}',
  food_safety text[] not null default '{}',
  languages text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  available_from date,
  discoverable boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  employer_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(job_id,candidate_id,employer_user_id),
  check (candidate_id <> employer_user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);

alter table public.chef_profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Chef details are visible only when the chef opts into discovery; owners can always manage their own profile.
drop policy if exists chef_profiles_public_discovery on public.chef_profiles;
create policy chef_profiles_public_discovery on public.chef_profiles
for select using (discoverable = true or user_id = auth.uid());
drop policy if exists chef_profiles_owner_insert on public.chef_profiles;
create policy chef_profiles_owner_insert on public.chef_profiles
for insert with check (user_id = auth.uid());
drop policy if exists chef_profiles_owner_update on public.chef_profiles;
create policy chef_profiles_owner_update on public.chef_profiles
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A conversation is visible only to its candidate and the employer account that owns the related job.
drop policy if exists conversations_participant_read on public.conversations;
create policy conversations_participant_read on public.conversations
for select using (
  candidate_id = auth.uid() or employer_user_id = auth.uid()
);
drop policy if exists conversations_candidate_start on public.conversations;
create policy conversations_candidate_start on public.conversations
for insert with check (
  candidate_id = auth.uid()
  and exists (
    select 1 from public.jobs j
    join public.employers e on e.id = j.employer_id
    where j.id = conversations.job_id
      and j.status = 'published'
      and e.owner_id = conversations.employer_user_id
      and e.verification_status = 'verified'
  )
);

drop policy if exists messages_participant_read on public.messages;
create policy messages_participant_read on public.messages
for select using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.candidate_id = auth.uid() or c.employer_user_id = auth.uid())
  )
);
drop policy if exists messages_participant_send on public.messages;
create policy messages_participant_send on public.messages
for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.candidate_id = auth.uid() or c.employer_user_id = auth.uid())
  )
);

create index if not exists chef_profiles_discoverable_idx on public.chef_profiles(discoverable) where discoverable = true;
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);
