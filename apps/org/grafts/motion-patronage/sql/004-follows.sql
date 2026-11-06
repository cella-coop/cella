-- A rule's adoption copies the patronage terms it marks, an effect citing
-- it.
SELECT cella.lets_follow('motion:policy:adopt', 'patronage:terms:adopt', 'motion-patronage');
