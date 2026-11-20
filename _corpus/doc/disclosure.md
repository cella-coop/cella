+++
title = "When a coop's shared totals expose a member"
name = "disclosure"
type = "doc"
updated = 2026-11-05
reviewed = 2026-11-05
+++

# When a coop's shared totals expose a member

A disclosure-control study for the operator and the open-books settings. This
is a recommendation, not a claim that a threshold anonymises a coop. The
reader sees their own rows and the circles their mandates open **without
suppression**; only totals shared beyond those rights are candidates for
suppression. A shared view has declared groupings and no report filter below
that grain. Every member may read it, including someone who knows their own
contribution, their colleagues' work or last month's total. In a cell of
*n* contributors, each contributor who subtracts their own amount learns the
sum of the other *n* − 1, and any *n* − 1 who pool theirs learn the last
one's exactly; at two, each learns the other's. In a coop of 200, a
five-person cell can still be almost entirely one person's pay. Count distinct
*contributors to the underlying sensitive measure*, not rows (five invoices
from one person are one contributor), and exclude public or already-authorised
rows from the claim that a published total protects them.

## What the techniques actually buy

| Method | Protects against | Cost and fit for 5–200 members |
|---|---|---|
| Minimum cell size (the threshold, or minimum-frequency, rule; loosely likened to k-anonymity) | A direct singleton or tiny group. A threshold of 5 means at least five distinct contributors to each released cell, **not** that five people are anonymous. | Small coops may have no publishable breakdown at all; at 5, even the coop total barely qualifies. Repeated values and known contributions still expose individuals. Classical k-anonymity applies to indistinguishable *records* under quasi-identifiers; a cell-size rule alone is not k-anonymity or a DP guarantee [1, 2]. |
| Primary suppression and complementary (secondary) suppression | Hide a risky cell **and** at least one other cell (or its margin) so subtracting the published cells from a published total does not reconstruct it. | Other safe cells or totals must be withheld. Suppression must consider the whole published table, its margins and every related breakdown, not just each cell independently; often nothing useful remains for five members [2, 3]. |
| Differencing controls | Fixed grouping and no filters below the declared grain prevent a reader from querying the same total once with and once without one member. | They do **not** prevent subtraction between two allowed groupings, a margin and its cells, overlapping periods, repeated reports or successive releases after a member joins/leaves or a correction posts. A threshold must be checked on the *difference* of any publicly reconstructible totals. Either publish a reviewed, non-overlapping release set with secondary suppression across it, or withhold the conflicting totals. A fresh query's local threshold check cannot guarantee this [2, 3]. |
| Dominance (largest contributor's share, optionally top two) | A large cell in which one person's value almost equals the sum, even though many contributors exist. | Suppresses a large project whose revenue or compensation is concentrated; count is insufficient. Test on sensitive nonnegative contributions (and on both positive and negative parts of signed figures); zero or cancelling sums are not a meaningful denominator. Do not apply a percent to a zero, signed or netted denominator. These are risk heuristics, not anonymity proofs [2, 3]. The handbooks prefer the p% rule, which marks a cell where the second-largest contributor, subtracting their own amount, learns the largest to within p% (total − largest − second < p% of largest); a two-largest maximum of 80% marks every cell the p% rule marks at p = 10% [2, 3]. |
| Rounding or ad-hoc noise | Coarse rounding hides exact cents in *one* observation. | A known rounded value still narrows an amount to an interval; differences and repeated overlapping sums narrow it further. Random noise that changes each run can be averaged away. Neither method alone is a safe toggle for small coops. Rounding makes books fail to reconcile unless shown explicitly as approximate, never as a journal balance [2, 4]. |
| Differential privacy (DP) with a bounded contribution and an epsilon/delta budget | A formally bounded change in output distribution when one person's bounded contribution changes, **if** the entire public release, repeated queries included, spends one enforced budget. | Requires a definition of a person, clipping bounds, accounting across all releases, and noise; a smaller epsilon protects more but gives less accurate figures. A fixed published noisy snapshot spends once, but every fresh release consumes more budget. At 5–200 people a useful small budget can swamp a small cell, and independent noisy cells need not add to their published margin. No DP budget can keep the books' exact cents and at the same time protect an arbitrary member's contribution: exact outputs with an observable change have unbounded privacy loss. DP suits separately labelled approximate exploration, **not** reconciling statements [4, 5]. |

## Recommendation for the open-books policy

The coop chooses what to share by motion; these are proposed defaults for
*additional shared totals*, not restrictions on authorised scoped rows or on
core figures everyone already has the right to see. A default is conservative
rather than a certificate of safety. The page states these sentences beside
each control and never labels a value “anonymous” or “safe”. The lower end of
a range is a product choice, not a research-proven boundary.

| Setting (range; default) | Words beside the setting, including exposure |
|---|---|
| Share sensitive breakdowns (off/on; **off**) | “Off: only figures you already have a right to see are shown. On: other members may work out a person's figure from totals, even when small groups are hidden. Check what is published together before turning this on.” At 5 members, leave it off unless the coop knowingly accepts that risk. |
| Minimum distinct contributors (2–200, capped at the coop's contributor count; **5**) | “Fewer than this many people contributing to a total hides it from members without permission to see its rows. Five is a starting precaution, not a promise: knowing other people's amounts can still reveal yours. At two, each of the two can work out the other's exact amount; three or four expose more than five.” A threshold equal to the coop's size shows only totals every contributor is in, and when members leave and the count falls below it, those are hidden too. Count contributors after joins and before rounding, with the same identity across releases. |
| Largest contributor maximum (20–100%, **50%**) | “If one person's amount is more than this share of a total, hide it. 100% turns this check off and can expose almost all of one person's amount; a lower number hides more totals.” Use alongside the minimum count, never instead of it. Reject or withhold cells with a zero or signed/netted denominator; test positive and negative contributions separately. |
| Two largest contributors maximum (40–100%, **80%**) | “If two people's amounts together exceed this share, hide the total. 100% turns this check off; the other contributors' known amounts can then reveal those two.” Do not claim the rule prevents collusion: even 80% can expose the remainder. |
| Publication across related totals and periods (reviewed release set only; **required**) | “Hiding one number is not enough if other totals let someone subtract it back. Related breakdowns and updates stay hidden until the whole set has been checked.” This is a release rule, not a switch one can turn off without knowingly exposing data. Complementary suppression withholds extra cells or a margin. If the port cannot account for overlapping groupings, historical versions and successive releases, it does **not** promise non-disclosure from the thresholds above: leave sensitive shared totals off. |

These proposed values need the next change's typed policy columns and port
checks; a bare SQL `HAVING count(*) >= 5` is **not** an implementation of
this recommendation. The rules read, for each cell, its distinct
contributors and its two largest contributions; those inputs are
themselves a person's figures, so they are computed where no reader reads
them and are never a column of a shared view. Suppress the entire cell for readers without its rows,
never replace an authorised reader's scoped result with a suppressed shared
value. Preserve one stable released version per period, consider all views
that publish the same contributors together, and recheck after corrections.
A period's current books can still be shown to an authorised reader at exact
precision. Whether a whole-coop figure is already open to every member by
mandate is an authority question, not something a threshold silently
revokes. If releases cannot be checked together, say “This figure may reveal
someone's data” rather than “private”.

No setting prevents inference from outside the books: a member who knows all
but one colleague's pay, knows who left a team, or holds their own unsuppressed
rows can subtract those facts from an otherwise publishable total. Nor does a
threshold repair an owner-rights view, missing reader filter, or access to
raw SQL. Those are separate access controls. The coop's decision to publish
is informed consent to **residual risk**, not a proof that individuals cannot
be identified.

## The org app's shared views

Each view a contract declares `audience: shared` is one of three kinds,
and the settings above bind only the first.

- **A person's measure, summed**: `payslip.months` (pay, by month);
  `timesheet.months` and `project_timesheet.months`, `.burn` and
  `.forecasts` (members' time, and its cost at one rate);
  `patronage.parts` and `account_membership_patronage_transaction.credits`
  (workers' parts); `account_membership_transaction.capital_months`
  (members' capital moves); `expense_project.spent` and `.totals` (what
  members filed); and `account_transaction.movements` and
  `account_membership_patronage_transaction.posted`, where a held account
  is summed into its parent's code, so a day on which one member's capital
  moved is that member's row. In a small coop each is often a cell of one
  or a few contributors, and a month's or a day's grain is differenced at
  every join, leave or correction. These are the totals the minimum, the
  dominance maxima and the release rule govern.
- **The books' statements**: `account.totals`, `account.report`,
  `account.spans`, `account_transaction.statement` and
  `transaction.months`, sums over the whole journal at a sheet's or a
  month's grain. Whether the members' right to the accounts opens these
  whatever the settings say is the authority question above, not a
  threshold's.
- **Figures that are no one's**: `circle.*`, `motion.procedures`,
  `file.classes`, `analytics.head`, `invoice_project.*` (what clients are
  charged) and `membership_motion.tally` (a motion's counts, for whoever
  reads the motion). No setting here applies to them.

The views that keep each part for the reader its personal row opens it to
(`patronage_payslip.work_share`, `patronage_timesheet.time_share`,
`account_membership.capital` and their functions) show a reader only their
own part, and are not shared totals in this sense.

## Sources

1. Sweeney, “k-Anonymity: A Model for Protecting Privacy”, *International
   Journal on Uncertainty, Fuzziness and Knowledge-based Systems* 10(5),
   2002, [doi:10.1142/S0218488502001648](https://doi.org/10.1142/S0218488502001648).
   Defines indistinguishability of records under quasi-identifiers, not a
   sufficient threshold for additive totals.
2. Hundepool et al., *Statistical Disclosure Control*, Wiley, 2012,
   [doi:10.1002/9781118348239](https://doi.org/10.1002/9781118348239),
   chapters on tabular data and suppression (including primary/secondary
   suppression, dominance and linked tables).
3. Hundepool et al., *Handbook on Statistical Disclosure Control*, ESSnet
   on SDC, second edition, 2024,
   [sdctools.github.io/HandbookSDC](https://sdctools.github.io/HandbookSDC).
   By the authors of [2], so not an independent source: cell-frequency,
   dominance and p% rules, complementary suppression and linked-table
   protection; statistical release guidance, not a numeric guarantee for a
   coop.
4. NIST, *De-Identifying Government Datasets: Techniques and Governance*,
   SP 800-188, 2023, [doi:10.6028/NIST.SP.800-188](https://doi.org/10.6028/NIST.SP.800-188).
   De-identification risk, attacks via auxiliary information, limitations
   of suppression and noise, and differential privacy.
5. Dwork and Roth, *The Algorithmic Foundations of Differential Privacy*,
   Foundations and Trends in Theoretical Computer Science 9(3–4), 2014,
   [doi:10.1561/0400000042](https://doi.org/10.1561/0400000042),
   especially definitions, sensitivity and composition. A privacy budget
   covers the sequence of releases, not each query independently.
