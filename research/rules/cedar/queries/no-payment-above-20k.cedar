// Query: no one pays a supplier more than 20 000 € without a decision.
permit (principal, action == Action::"pay_supplier", resource)
when { context.amount <= 2000000 };
