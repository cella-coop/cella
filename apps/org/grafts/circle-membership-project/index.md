+++
title = "circle-membership-project"
updated = 2026-11-03
+++

Which projects a power covers: a lead runs their own circle's projects.
Declared by the `circle` feat. It joins circle, member and project, since
what a project write concerns is its circle, and reads `circle-membership`
beneath it; it has no table of its own, and no shell.

## Guards

- `circle_membership_project.runs`, on `project:project:create`,
  `project:milestone:add`, `project:milestone:complete`,
  `project:project:budget`, `project:project:archive` and
  `membership-project:project:share`: the actor holds the action's power
  (`manage-project`, `set-budget`) by a mandate whose scope covers the project's circle, through
  `circle_membership.over`; a project of no circle is the whole co-op's, run by
  a mandate on the whole co-op. A project the payload does not name, or that does
  not exist, is left to its own feat's guards.

## Lanterne

Hugo, Brand's lead, budgets Ferrand's packaging, Brand's; Yusuf, Web's,
the Halles shop, and is refused Brand's, since the lead's mandates are on their own circle; Camille, whose gérante mandates are on the whole co-op, any project.

Slice tests: none of its own; the guard is `circle-membership`'s `over` and
its tests, and the `work` and `governance` scenarios.
