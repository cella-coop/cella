-- What kind of account a code of the French chart opens, by its class
-- (Plan comptable général, art. 932-1, the list of accounts): class 1
-- equity, but provisions and borrowings (15 to 19) liabilities; classes
-- 2, 3 and 5 assets; class 4 liabilities, but what others owe the coop
-- (409 advances to suppliers, 41 clients, 4456 deductible VAT, 4562
-- capital called and unpaid) assets; class 6 expenses; class 7 income.
-- Classes 8 and 9 hold no account of the books here. A write that opens
-- an account opens it of this kind, as an imported entry does.
CREATE FUNCTION account.kind_of(code text) RETURNS text
LANGUAGE sql IMMUTABLE
RETURN CASE
  WHEN code ~ '^1[0-4]' THEN 'equity'
  WHEN code ~ '^1' THEN 'liability'
  WHEN code ~ '^[235]' THEN 'asset'
  WHEN code ~ '^(409|41|4456|4562)' THEN 'asset'
  WHEN code ~ '^4' THEN 'liability'
  WHEN code ~ '^6' THEN 'expense'
  WHEN code ~ '^7' THEN 'income'
END;
