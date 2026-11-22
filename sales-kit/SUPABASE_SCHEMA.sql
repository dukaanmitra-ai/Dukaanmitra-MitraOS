-- Mitra System — Supabase schema for design-partner pilots
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
-- (Orders + leads tables backing the shared API store)

create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id text primary key,
  biz text not null,
  city text not null,
  customer jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  delivery numeric not null default 0,
  total numeric not null default 0,
  currency text not null default 'INR',
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id text primary key,
  name text not null default '',
  phone text not null default '',
  business text,
  city text,
  need text not null default 'other',
  budget text not null default 'unknown',
  timeline text not null default 'exploring',
  source text not null default 'other',
  score integer not null default 0,
  band text not null default 'nurture',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_biz_city on public.orders (biz, city);
