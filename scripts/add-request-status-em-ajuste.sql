-- PARTE 1 — Execute primeiro no Supabase SQL Editor
-- Depois execute: add-request-status-em-ajuste-part2.sql

ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'em_ajuste';
