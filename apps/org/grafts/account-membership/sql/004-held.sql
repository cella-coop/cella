-- No write names an account's holder but the subscription of a member
-- admitted, account-membership-transaction's, which names that member:
-- the seed carries the rest in, and the fixture check holds each holder
-- to a member. So the trigger that checked it on the account feat's
-- table goes; a write that names another holder will be refused by this
-- graft's rule on its op.
DROP TRIGGER held ON account.account;
DROP FUNCTION account_membership.held();
