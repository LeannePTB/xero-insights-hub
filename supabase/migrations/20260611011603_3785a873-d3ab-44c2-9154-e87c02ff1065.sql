CREATE TYPE public.report_basis AS ENUM ('accrual','cash');
ALTER TABLE public.clients ADD COLUMN report_basis public.report_basis NOT NULL DEFAULT 'accrual';