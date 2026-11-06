-- A rule's adoption copies the capital's terms it marks, an effect citing
-- it.
SELECT cella.lets_follow('motion:policy:adopt', 'account:terms:adopt', 'account-motion');
