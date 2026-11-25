-- Guille W is the same owner as Administración and must see the company cashbox.
-- All other drivers retain row-level access to their own income and expenses only.

drop policy if exists westvill_income_driver_read on public.westvill_income;
create policy westvill_income_driver_read
on public.westvill_income
for select
to authenticated
using (
  driver_id = (select auth.uid())
  or (select auth.uid()) = '38102722-f229-4672-8491-5dec7c276632'::uuid
);

drop policy if exists westvill_expenses_driver_read_own on public.westvill_expenses;
create policy westvill_expenses_driver_read_own
on public.westvill_expenses
for select
to authenticated
using (
  created_by = (select auth.uid())
  or (select auth.uid()) = '38102722-f229-4672-8491-5dec7c276632'::uuid
);
