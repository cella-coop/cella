+++
title = "membership-project"
updated = 2026-11-04
+++

Shares of a project's budget: a right granted to a member to spend up to
an amount for the project, on suppliers, print or photography. Shares add
up per member, and together never exceed the budget; and which projects
a power covers ([circles](#circles)). Declared by `project`.

## Schema

`membership_project` (`sql/`):

- `membership_project.share`: a project, a member, an amount in cents and the
  day it was granted, with no foreign key into either feat. A trigger
  refuses a share to a member who is not active, from a project that is
  archived or has no budget, or beyond what is left of the budget
  (SQLSTATE `09000`). It locks the project's row for the check, so two
  shares granted at once are counted one after the other, and a budget
  set meanwhile waits for them.
- `membership_project.pot`: each project's budget, what was shared from it
  and what remains, in cents.

The app role may select and insert; the guards role may select.

## Actions

| Action | Label | Power | Why |
|---|---|---|---|
| `membership-project:project:share` | bounded on `budget` | `set-budget`, capped by its limit on `amount` | spends a right set in advance; waits only when what is left runs out |

Two shares granted at once each pass a check of what is left, and
together may exceed it: the label is bounded, the budget the right they
spend. At rung 1 the server serialises them under the project's lock; at
rung 2 a device holds its share of the budget offline.

The graft also attaches `membership_project.covers` to
`project:project:budget`: a budget never falls below the shares already
granted from it, which is why setting a budget is ordered.

`002-powers.sql` registers the power in `cella.power`, and the
membership feat checks it.

## Invariants

- a share goes to an active member (`membership.active` on the verdict
  date), from a live project with a budget;
- shares never exceed the budget (`membership_project.within`), and the
  budget never falls below them (`membership_project.covers`).

What a share is spent on is not recorded: spending against a share waits
for the expense feat.

## Shell

Adds to each project what was shared out (a hidden column), and to a
project's overview its shares, what is left, and the form that grants
one; to a person's page, the shares they hold.

## Lanterne

| Project | Member | Share | For |
|---|---|---|---|
| Les Halles Paysannes, online shop | Yusuf | 1 500 € | hosting and plugins |
| Nuvola Énergie, marketing retainer | Malik | 1 200 € | photo shoots |
| Maison Ferrand, packaging | Hugo | 2 000 € | colour proofs and press checks |
| Fondation Terres Vives, annual report and microsite | Camille | 3 000 € | printing the report |

A share of 13 000 € from Ferrand's budget, 12 000 € of which is left, is
refused.

## Circles

Which projects a power covers: a lead runs their own circle's projects,
since what a project write concerns is its circle (`004-runs.sql`).

- `membership_project.runs`, on `project:project:create`,
  `project:milestone:add`, `project:milestone:complete`,
  `project:project:budget`, `project:project:archive` and
  `membership-project:project:share`: the actor holds the action's power
  (`manage-project`, `set-budget`) by a mandate whose scope covers the
  project's circle, through `membership.over`; a project of no circle is
  the whole co-op's, run by a mandate on the whole co-op. A project the
  payload does not name, or that does not exist, is left to its own
  feat's guards.

In Lanterne, Hugo, Brand's lead, budgets Ferrand's packaging, Brand's;
Yusuf, Web's, the Halles shop, and is refused Brand's, since the lead's
mandates are on their own circle; Camille, whose gérante mandates are on
the whole co-op, any project. Its tests are the membership feat's of
`over`, and the `work` and `governance` scenarios.

## Analytics

Its [analytical contract](../../../../_corpus/doc/architecture.md#analytical-contracts), `sql/analytics.sql`, publishes `membership_project.shares` to the analytics shell: the shares of each project's pot granted to members.
