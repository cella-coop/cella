CREATE SCHEMA expense_invoice_project_timesheet;

-- When a project is watched, from a day on: once its billable time has
-- spent `burn` percent of its budget, or once what it invoiced keeps less
-- than `margin` percent after its costs. A parameter, seeded with the
-- co-op's figures; a threshold per project is not built.
CREATE TABLE expense_invoice_project_timesheet.threshold (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  since date PRIMARY KEY,
  burn numeric NOT NULL CHECK (burn > 0),
  margin numeric NOT NULL CHECK (margin < 100)
);

-- Each project's margin on a day, in cents: what it invoiced, net of VAT
-- and of its voided invoices, less what its time cost the co-op and its
-- approved expenses; that margin as a percent of what it invoiced; its
-- budget burn and the spend forecast at completion (project-timesheet's);
-- the margin forecast at completion, its budget, or what it invoiced when
-- it has none, less its costs so far at the pace so far; and whether it is
-- watched: its budget spent past the threshold while it is under way, its
-- forecast over its budget, or its margin under the threshold. An archived
-- project is watched no more.
CREATE FUNCTION expense_invoice_project_timesheet.margin(day date)
RETURNS TABLE (
  project text, invoiced bigint, cost bigint, expenses bigint, margin bigint, percent numeric,
  budget bigint, spent bigint, burn numeric, forecast bigint, landing bigint, watch text
)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT p.id, m.invoiced, m.cost, m.expenses, m.invoiced - m.cost - m.expenses,
         CASE WHEN m.invoiced > 0 THEN round(100.0 * (m.invoiced - m.cost - m.expenses) / m.invoiced, 1) END,
         f.budget, f.spent, f.burn, f.forecast,
         CASE WHEN f.elapsed > 0 THEN (coalesce(f.budget, m.invoiced) - round((m.cost + m.expenses) / f.elapsed))::bigint END,
         CASE
           WHEN p.archived IS NOT NULL THEN NULL
           WHEN f.burn >= t.burn AND coalesce(f.elapsed, 0) < 1 THEN 'budget spent'
           WHEN f.forecast > f.budget THEN 'over budget'
           WHEN m.invoiced > 0 AND 100.0 * (m.invoiced - m.cost - m.expenses) / m.invoiced < t.margin THEN 'thin margin'
           ELSE 'on track'
         END
  FROM project.project p
  JOIN project_timesheet.forecast(margin.day) f ON f.project = p.id
  LEFT JOIN project_timesheet.burn b ON b.project = p.id
  LEFT JOIN invoice_project.invoiced i ON i.project = p.id
  LEFT JOIN expense_project.spent s ON s.project = p.id
  CROSS JOIN LATERAL (
    SELECT coalesce(i.net, 0)::bigint AS invoiced, coalesce(b.cost, 0)::bigint AS cost, coalesce(s.approved, 0)::bigint AS expenses
  ) m
  LEFT JOIN LATERAL (
    SELECT h.burn, h.margin FROM expense_invoice_project_timesheet.threshold h WHERE h.since <= margin.day ORDER BY h.since DESC LIMIT 1
  ) t ON true;
END;

GRANT USAGE ON SCHEMA expense_invoice_project_timesheet TO cella_app, cella_guards;
GRANT SELECT ON expense_invoice_project_timesheet.threshold TO cella_app, cella_guards;
