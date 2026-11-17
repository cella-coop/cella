-- A circle's own icon: a cosmetic setting beside its name, purpose and
-- procedure, but decided apart from them, under the same power as its
-- features, `arrange-features` (`012-features.sql`): arranged at once by
-- whoever holds it over the circle by a seat, replacing its collection's
-- icon before its title, in its cells, its chips and its header, drawn in
-- its own ink. A short slug of the curated set the picker offers
-- (`core/ui/ts/src/record-icons.ts`), or none, which draws the
-- collection's icon instead, as today.
ALTER TABLE circle.circle ADD COLUMN icon text CHECK (icon IS NULL OR icon ~ '^[a-z0-9-]{1,40}$');

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('circle:circle:icon', 'arrange-features', NULL, 'circle');

-- circle:circle:icon: the icon the entry names, or none.
CREATE FUNCTION circle.fold_icon(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE circle.circle SET icon = fold_icon.entry -> 'payload' ->> 'icon'
  WHERE id = fold_icon.entry -> 'payload' ->> 'circle';
END;

SELECT cella.lets_fold('circle:circle:icon', 1, 'circle.fold_icon(jsonb)', 'circle');
