-- A policy adopted or ended generates the documents made from its
-- circle's policies, each an effect citing it.
SELECT cella.lets_follow('motion:policy:adopt', 'document:document:generate', 'document-motion');
SELECT cella.lets_follow('motion:policy:end', 'document:document:generate', 'document-motion');
