// Query: only members of the operations circle pay suppliers.
permit (principal in Circle::"operations", action == Action::"pay_supplier", resource);
