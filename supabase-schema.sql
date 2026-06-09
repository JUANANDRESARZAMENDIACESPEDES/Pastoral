-- Supabase schema required by Pastoral
-- Run this SQL in the Supabase SQL editor for your project.

create extension if not exists "pgcrypto";

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_uid text not null unique,
  name text not null,
  email text not null unique,
  role text not null default 'viewer',
  status text not null default 'pendiente',
  permissions jsonb not null default '["dashboard"]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pjl_store (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);
