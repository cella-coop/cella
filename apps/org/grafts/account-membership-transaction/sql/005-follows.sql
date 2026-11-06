-- An admission subscribes the member's shares, an effect it requires:
-- refused, it forgoes the admission. An exclusion or a withdrawal
-- withdraws what the associate held, an effect citing it.
SELECT cella.lets_follow('membership:member:admit', 'account:capital:subscribe', 'account-membership-transaction', true);
SELECT cella.lets_follow('membership:member:exclude', 'account:capital:withdraw', 'account-membership-transaction');
SELECT cella.lets_follow('membership:member:withdraw', 'account:own:withdraw', 'account-membership-transaction');
