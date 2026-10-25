-- Each worker's split reads as their part does.
ALTER VIEW account_membership_patronage.split SET (security_invoker = true);
