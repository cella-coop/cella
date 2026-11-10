+++
title = "Legal forms"
updated = 2026-11-09
+++

# Legal forms

A **legal form** is a kind of co-op the law of a region knows, such as a
SCOP SARL in France, and in cella a set of ready-made policies, its
**default policies**: the rights the law gives, the procedures it asks,
the rules with the law's floors, and the mandates and rights cella
suggests where no law speaks. Cella offers the forms; a co-op chooses
one, and cella makes keeping to it easy without choosing for it. The
register keeps each form and its defaults (`policy.form`,
`policy.default`, [the register](../../apps/org/core/policy/index.md)).

**Every sentence here that states the law is the building lane's
reading, not settled law.** The sources below are its reading of loi
n° 47-1775 of 10 September 1947, loi n° 78-763 of 19 July 1978, the Code
de commerce and the GDPR, through the permission study of 1 November
2026, with Légifrance and EUR-Lex only partly reachable from the box;
each waits on a co-op lawyer's review before the pilot. The register
says so of each default: `policy.default.reviewed` is the day a lawyer
reviewed it, and is empty for every default today.

## Defaults

A default policy has an id, its form's and its own (`scop-sarl-fr:ordinary`),
a kind, a legal wording with its values marked, perhaps a friendly one,
perhaps the procedure that alone changes it, and where it comes from:
the law it states, by its article, or none, where it is cella's
practice. A default names no circle: every one is the root's, the
assembly's, and a collective mandate in it names the assembly as the
form's founding makes it.

**Taking.** A co-op takes a default by adopting a policy that takes it,
the policy action's `takes`, worded and protected as the default reads:
a motion that takes one worded otherwise is refused as it is proposed
and again as it is carried out, saying so. A co-op takes its form's
defaults at founding; Lanterne's founding motion takes the SCOP SARL's.

**Leaving.** A co-op leaves a default by motion: one that replaces the
policy taking it with a policy that takes none, or ends it. Each
default stands one of four ways in a circle that took any of its form's
(`policy.standing`):

- **taken**: a policy in force takes it as it reads now;
- **updated**: a policy in force takes it, but cella has since changed
  the default's wording;
- **left**: the last policy that took it was replaced by one that takes
  none, or ended, by the motion's action named;
- **not taken**: no policy of the circle ever took it.

**Updates.** A form changes only with cella, which offers its defaults
again in a release (`policy.offer`). An update changes no policy, since a
policy changes only by motion: a default taken stands as updated until a
motion takes its new wording, replacing the policy that took the old one.
A default left stays left: no update restores it, and only a motion
that takes it again does, in the open.

**Where it shows.** The circle's page marks each of its policies that
takes a default, and lists every default it left or never took, each
with the motion that left it ([motion](../../apps/org/feats/motion/index.md#circles)).
A motion's page says the default each policy it adopts takes, and each
default it leaves ([the motion feat](../../apps/org/feats/motion/index.md)).
The statutes say, after their policies, every default the co-op left
and by which motion ([generated documents](../../apps/org/feats/document/index.md#generated-documents)).

## SCOP SARL, France

`scop-sarl-fr`, a société coopérative et participative that is a société
à responsabilité limitée à capital variable, in France
(`core/policy/sql/002-scop-sarl-fr.sql`). Its assembly is the circle
`ag`. Every default stating the law is unreviewed.

| Default | Kind | Says | Comes from |
|---|---|---|---|
| `consent` | procedure | a motion passes if no one on its roll objects | cella |
| `majority` | procedure | a motion passes with more for than against | cella |
| `two-thirds` | procedure | a motion passes with two thirds of the votes cast | cella |
| `election` | procedure | a person is elected by a majority, by secret ballot | cella |
| `ordinary` | procedure | the ordinary assembly: a majority of the votes cast, a quorum of a quarter of the associates | Code de commerce art. L223-29; loi n° 47-1775 art. 4, one member one vote |
| `extraordinary` | procedure | the extraordinary assembly, which amends the statutes: two thirds of the votes cast, a quorum of half | Code de commerce art. L223-30; loi n° 47-1775 art. 4 |
| `propose` | mandate | every seat proposes and closes its circle's motions | cella |
| `discuss` | mandate | every seat discusses its circle's motions | cella |
| `admit-member` | mandate | the assembly admits members, by motion | loi n° 47-1775 art. 7 |
| `suspend-member` | mandate | the assembly suspends a member, by motion | cella |
| `exclude-member` | mandate | the assembly excludes a member, by motion | loi n° 47-1775 art. 7; Code de commerce art. L231-6 |
| `erase-own-data` | right, protected | every person who has left erases their own personal data, within the holds the law keeps | GDPR art. 17 |
| `adopt-policy` | mandate, protected | the assembly adopts policies, the statutes' among them | Code de commerce art. L223-30 |
| `end-policy` | mandate, protected | the assembly ends policies | Code de commerce art. L223-30 |
| `approve-distribution` | mandate | the assembly approves a year's distribution | loi n° 47-1775 art. 8; loi n° 78-763 art. 33 |
| `adopt-document` | mandate | the assembly adopts a document's version | cella |
| `seat-member` | mandate, protected | the assembly gives and ends seats | cella |
| `create-circle` | mandate | the assembly creates a circle, by motion, which holds the default bundle from that day | cella |
| `amend-circle` | mandate | the assembly changes a circle's name, purpose or procedure, by motion, its id kept | cella |
| `withdraw-membership` | right, protected | every member withdraws from the co-op by their own action | Code de commerce art. L231-6 |
| `keep-profile` | right, protected | every person keeps their own profile | GDPR art. 16 |
| `keep-devices` | right, protected | every person enrols and revokes their own devices | cella |
| `upload-file` | right, protected | every person uploads a file | cella |
| `accept-invitation` | right, protected | every person takes up their invitation | cella |
| `file-record` | right, protected | every person files a record of their own | cella |
| `mark-read` | right, protected | every person marks an adopted text read | cella |
| `record-import` | right, protected | every person records an import of their own | cella |
| `draw-account` | right, protected | every member draws on their own account | cella |
| `spread-capital` | right, protected | every member spreads what they owe for their shares | cella |
| `mark-attendance` | right, protected | every member marks their own attendance | cella |
| `save-report` | right, protected | every member saves a report of their own | cella |
| `log-time` | right, protected | every employee logs their own time | cella |
| `claim-expense` | right, protected | every employee claims their expenses | cella |
| `apply-membership` | right, protected | every employee employed a year applies to join, and the assembly must rule on it | loi n° 78-763, as the CG Scop's model statutes put it |
| `work-share` | rule | at least 25 % of each year's surplus goes to all the employees as the work share | loi n° 78-763 art. 33 |
| `reserves` | rule | at least 15 % of each year's surplus goes to the reserves | loi n° 78-763 art. 33 |

Every protected default is protected by `extraordinary`. The right to
withdraw is worded on every person, `{right: person}`, since the
withdrawal ends the membership on its own verdict date: the guard that
the membership is the actor's own, active or suspended until then, is
the membership feat's, so only a member withdraws. The right to erase
is every person's too: the membership feat's guard holds it to one's
own data, once one has left, and the notary keeps restricted what the
law keeps (GDPR art. 17(3)(b) and (e);
[personal data](trust.md#personal-data)). The right to apply is every
employee's: the application is the applicant's own, by the membership
feat's guard, made once they have worked a year, by the
employment-membership graft's, and puts the motion to admit them to the
assembly in the same write, by membership-motion's, so the
assembly must rule on it as it rules on any motion. The year is the
guard's and not a value of the policy's: a co-op that rewords it changes
no guard ([the membership feat](../../apps/org/feats/person/feats/membership/index.md)). A rule's
values are named for no feat, so no guard reads them: they bind by the
members' judgement, as the law's floors do until a feat reads them.

Not yet defaults, since the law's reading of them is not settled: the
cap on the interest capital earns (loi n° 47-1775 art. 14), the
employee associates' 65 % of the votes and 51 % of the capital (loi n°
78-763 art. 3 bis, found only in secondary sources), and the repayment
of a departed associate's shares within five years (loi n° 47-1775 art.
18; loi n° 78-763 art. 42). The capital's and the work share's terms are
each co-op's own rules, read by the account and patronage feats.
