// Query: a vote on an AG decision comes from a member of the AG.
permit (principal, action == Action::"vote", resource)
when { resource.circle != Circle::"ag" || principal in Circle::"ag" };
