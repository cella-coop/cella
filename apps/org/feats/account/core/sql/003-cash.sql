-- A cash account holds the coop's money: the bank, the till. Which
-- accounts are cash is the chart's to say; the writes that may move money
-- out of one, each with its own power and limit, are checked against it by
-- the account-transaction graft.
ALTER TABLE account.account ADD COLUMN cash boolean NOT NULL DEFAULT false;
