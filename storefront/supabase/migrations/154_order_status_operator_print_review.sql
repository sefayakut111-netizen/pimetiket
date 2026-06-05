-- ============================================================
-- Migration 154: order_status → operator_print_review
-- Baskı öncesi operatör onayı aşaması (FAZ 1 — tanım, henüz akışta değil).
-- proof_approved → operator_print_review → ready_to_ship (FAZ 1b'de aktif).
-- ============================================================

-- PostgreSQL: ALTER TYPE ADD VALUE transaction-safe değil bazı sürümlerde;
-- tek statement, ayrı migration. IF NOT EXISTS idempotent (PG 12+).
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'operator_print_review';
