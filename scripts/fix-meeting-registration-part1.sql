-- PARTE 1 de 2 — Execute primeiro e aguarde "Success"
-- Depois execute: fix-meeting-registration-part2.sql
--
-- Corrige: invalid input value for enum report_status: "registrado"

ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'registrado';
