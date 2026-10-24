// Rule 1: mandates. Amounts are in cents.
@id("finance pays suppliers up to 3 000 €")
permit (principal in Role::"finance", action == Action::"pay_supplier", resource)
when { context.amount <= 300000 };

@id("finance issues invoices and closes periods")
permit (
  principal in Role::"finance",
  action in [Action::"issue_invoice", Action::"close_period"],
  resource
);

@id("the gérante commits up to 20 000 €")
permit (
  principal in Role::"manager",
  action in [Action::"pay_supplier", Action::"spend", Action::"quote"],
  resource
)
when { context.amount <= 2000000 };

@id("a lead spends up to 1 000 € for their own circle")
permit (principal in Role::"lead", action == Action::"spend", resource is Circle)
when { principal.leads.contains(resource) && context.amount <= 100000 };

@id("a lead sends quotes up to 15 000 €")
permit (principal in Role::"lead", action == Action::"quote", resource)
when { context.amount <= 1500000 };

@id("members of the deciding circle vote")
permit (principal, action == Action::"vote", resource is Decision)
when { principal in resource.circle };

// Rule 2: invariants. Finance posts and records; forbids override permits.
@id("finance posts entries and records payments")
permit (
  principal in Role::"finance",
  action in [Action::"post_entry", Action::"record_payment"],
  resource
);

@id("closed_period")
forbid (principal, action == Action::"post_entry", resource)
when { resource.closed };

@id("unbalanced")
forbid (principal, action == Action::"post_entry", resource)
when { context.debit != context.credit };

@id("voided")
forbid (principal, action == Action::"record_payment", resource)
when { resource.voided };

@id("overpaid")
forbid (principal, action == Action::"record_payment", resource)
when { resource.paid + context.amount > resource.total };

// Rule 4: the legal bounds on a SCOP surplus split, in basis points.
// Cedar has no division, so it checks the split but cannot compute it.
@id("finance proposes a surplus split")
permit (principal in Role::"finance", action == Action::"allocate_surplus", resource);

@id("sum")
forbid (principal, action == Action::"allocate_surplus", resource)
when { context.work + context.reserves + context.interest != 10000 };

@id("work_min")
forbid (principal, action == Action::"allocate_surplus", resource)
when { context.work < 2500 };

@id("reserves_min")
forbid (principal, action == Action::"allocate_surplus", resource)
when { context.reserves < 1600 };

@id("interest_max")
forbid (principal, action == Action::"allocate_surplus", resource)
when { context.interest > 3300 };

@id("interest_le_work")
forbid (principal, action == Action::"allocate_surplus", resource)
when { context.interest > context.work };

@id("interest_le_reserves")
forbid (principal, action == Action::"allocate_surplus", resource)
when { context.interest > context.reserves };
