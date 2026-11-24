-- OvenHire initial PostgreSQL schema (apply only after provisioning a database and reviewing security).
create extension if not exists pgcrypto;
create type public.account_role as enum ('candidate','employer','admin');
create type public.job_status as enum ('draft','pending_review','published','rejected','expired','paused');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role public.account_role not null,
 display_name text not null,
 email text,
 country_code text,
 created_at timestamptz not null default now()
);
create table public.employers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 business_name text not null,
 website text,
 country text not null,
 verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
 created_at timestamptz not null default now()
);
create table public.jobs (
 id uuid primary key default gen_random_uuid(),
 employer_id uuid not null references public.employers(id) on delete cascade,
 title text not null,
 department text not null,
 description text not null,
 location_city text not null,
 location_country text not null,
 salary_min numeric,
 salary_max numeric,
 salary_currency char(3),
 employment_type text not null,
 visa_sponsorship text not null default 'not_stated',
 status public.job_status not null default 'draft',
 published_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 check (salary_min is null or salary_min >= 0),
 check (salary_max is null or salary_max >= 0),
 check (salary_min is null or salary_max is null or salary_max >= salary_min)
);
create table public.candidate_profiles (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 headline text,
 skills text[] not null default '{}',
 cuisines text[] not null default '{}',
 languages text[] not null default '{}',
 preferred_countries text[] not null default '{}',
 updated_at timestamptz not null default now()
);
create table public.applications (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 candidate_id uuid not null references public.profiles(id) on delete cascade,
 cover_note text,
 status text not null default 'submitted' check (status in ('submitted','reviewing','interview','declined','hired','withdrawn')),
 created_at timestamptz not null default now(),
 unique(job_id,candidate_id)
);
create table public.job_credits (
 id uuid primary key default gen_random_uuid(),
 employer_id uuid not null references public.employers(id) on delete cascade,
 quantity integer not null check (quantity > 0),
 amount_minor bigint not null check (amount_minor >= 0),
 currency char(3) not null default 'INR',
 payment_provider text,
 provider_payment_id text unique,
 status text not null default 'pending' check (status in ('pending','paid','refunded','failed')),
 created_at timestamptz not null default now()
);
-- Security is intentionally fail-closed until role-aware RLS policies and server-side payment webhooks are implemented.
alter table public.profiles enable row level security;
alter table public.employers enable row level security;
alter table public.jobs enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.applications enable row level security;
alter table public.job_credits enable row level security;

-- Private chef-to-employer contact workflow. No public contact details are exposed.
create table public.chef_contact_requests (
 id uuid primary key default gen_random_uuid(),
 chef_user_id uuid not null references public.profiles(id) on delete cascade,
 employer_user_id uuid not null references public.profiles(id) on delete cascade,
 employer_business_id uuid references public.employers(id) on delete set null,
 job_id uuid references public.jobs(id) on delete set null,
 message text not null check (char_length(message) between 20 and 1200),
 status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn','closed')),
 chef_consented_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (chef_user_id <> employer_user_id)
);
create table public.chef_contact_messages (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.chef_contact_requests(id) on delete cascade,
 sender_user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 4000),
 created_at timestamptz not null default now()
);
alter table public.chef_contact_requests enable row level security;
alter table public.chef_contact_messages enable row level security;
-- Intentionally no client policies yet. Add tested participant-only policies and server-side rate limits before enabling messaging.
