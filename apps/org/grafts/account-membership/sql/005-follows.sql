-- A member's exclusion or withdrawal freezes their capital accounts, an
-- effect citing it.
SELECT cella.lets_follow('membership:member:exclude', 'account:account:freeze', 'account-membership');
SELECT cella.lets_follow('membership:member:withdraw', 'account:own:freeze', 'account-membership');
