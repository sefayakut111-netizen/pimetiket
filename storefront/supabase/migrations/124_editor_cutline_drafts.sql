-- Pre-order editör bıçak taslakları (sipariş öncesi, cutline_designs order_id zorunlu)
create table if not exists public.editor_cutline_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  temp_design_id uuid references public.design_temp_uploads(id) on delete set null,
  svg_key text not null,
  preview_key text,
  source text not null check (source in ('raster','vector','vector-with-cutline','psd')),
  mode text not null check (mode in ('contour','hull','rect','circle')),
  offset_mm numeric(4,2),
  width_mm numeric(8,2),
  height_mm numeric(8,2),
  cutline_width_mm numeric(8,2),
  cutline_height_mm numeric(8,2),
  placement_json jsonb,
  material_type text,
  meta jsonb not null default '{}'::jsonb,
  promoted_to uuid references public.cutline_designs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists editor_cutline_drafts_user_id_idx
  on public.editor_cutline_drafts(user_id);

alter table public.editor_cutline_drafts enable row level security;

drop policy if exists editor_cutline_drafts_owner on public.editor_cutline_drafts;
create policy editor_cutline_drafts_owner
  on public.editor_cutline_drafts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.editor_cutline_drafts is
  'Pre-order /editor cutline SVG drafts — promoted to cutline_designs after payment.';
