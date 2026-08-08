-- ============================================================
-- Migration: Módulo Tarefas (gestão compartilhada entre sócias)
-- Data: 2026-08-07
-- Tabelas: tarefas, tarefa_comentarios
-- ============================================================

-- ===== Tabela: tarefas =====
create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  tipo text not null default 'tarefa' check (tipo in ('tarefa', 'decisao')),
  responsavel text not null default 'Ambas',
  status text not null default 'a_fazer' check (status in ('a_fazer', 'em_andamento', 'aguardando_decisao', 'concluida')),
  urgencia text not null default 'media' check (urgencia in ('baixa', 'media', 'alta', 'urgente')),
  data_inicio date,
  data_entrega date,
  criado_por text,
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ===== Tabela: tarefa_comentarios (comunicação e registro de decisões) =====
create table if not exists public.tarefa_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas(id) on delete cascade,
  autor text not null,
  texto text not null,
  created_at timestamptz not null default now()
);

-- ===== Índices =====
create index if not exists tarefas_status_idx on public.tarefas (status) where deleted_at is null;
create index if not exists tarefas_data_entrega_idx on public.tarefas (data_entrega) where deleted_at is null;
create index if not exists tarefa_comentarios_tarefa_id_idx on public.tarefa_comentarios (tarefa_id);

-- ===== Trigger: updated_at automático =====
create or replace function public.tarefas_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tarefas_updated_at on public.tarefas;
create trigger tarefas_updated_at
  before update on public.tarefas
  for each row execute function public.tarefas_set_updated_at();

-- ===== RLS: somente usuários autenticados (mesmo padrão das demais tabelas) =====
alter table public.tarefas enable row level security;
alter table public.tarefa_comentarios enable row level security;

drop policy if exists tarefas_autenticados on public.tarefas;
create policy tarefas_autenticados on public.tarefas
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists tarefa_comentarios_autenticados on public.tarefa_comentarios;
create policy tarefa_comentarios_autenticados on public.tarefa_comentarios
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- ===== Realtime: sincronização ao vivo entre as duas sócias =====
do $$
begin
  alter publication supabase_realtime add table public.tarefas;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tarefa_comentarios;
exception when duplicate_object then null;
end $$;
