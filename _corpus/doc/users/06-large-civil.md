+++
title = "6. Large Civil Society"
type = "doc"
updated = 2026-10-25
source = "seedling specs/user/06-large-civil.md, carried verbatim"
+++

# 6. Large Civil Society

Organizations with 250+ member organizations or thousands of individual members. Professional staff, delegate governance, complex multi-level structures.

## 6.1 Cooperative Federations

Second-tier organizations whose members are cooperatives (or other organizations) rather than individuals. Provide services, advocacy, and coordination for member cooperatives.

**Primary modules:** Membership, Governance | **Related:** [§5.2 Trade unions](#52-trade-unions) (similar federated structure), [§6.2 Large membership associations](#62-large-membership-associations) (individual-member equivalent)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Member organizations | 20-500+ |
| Staff | 2-50 |
| Types | National, sectoral, regional, thematic |

### Governance

- Delegate assemblies: member organizations send representatives
- Voting may be equal (one member, one vote) or weighted by size/dues
- Board elected from member organizations
- Committees and working groups for specific issues

### Financial Model

- Dues from member organizations (often tiered by size)
- Service fees for training, consulting, back-office
- Grants for development programs
- May manage shared funds (loan funds, guarantee funds)

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Organization-as-member (not individual) — most membership tools don't support this | High |
| Delegate assembly management with weighted representation | High |
| Inter-cooperative collaboration has no infrastructure | Medium |
| Annual federation reporting requires manual data gathering | Low |

**Current tools:** CRM systems adapted awkwardly for org-as-member, spreadsheets for dues and delegates.

### Workflows

**Delegate assembly:**

1. Determine delegate allocation per member organization (by size, dues, or equal)
2. Member organizations nominate delegates
3. Credentials verified
4. Assembly agenda circulated with proposals from member organizations
5. Debate and vote (equal or weighted by organization size)
6. Decisions recorded and communicated to all member organizations

### Individual Personas

**Federation Director** — Strategic coordination, advocacy, member relations. Needs aggregate reporting across member cooperatives, delegate management.

**Federation Administrator** — Membership records, dues collection, event coordination. Needs org-as-member database, tiered dues management, delegate allocation calculations.

### References

- [Cooperatives Europe](https://coopseurope.coop/) — ICA European regional office; 141 million cooperators across Europe
- [ICA: International Cooperative Alliance](https://ica.coop/en) — 315 cooperative federations across 107 countries; represents 1 billion members globally
- [ICA World Cooperative Monitor 2025](https://monitor.coop/en) — Annual data on cooperative economy; 3 million cooperatives, $2.79T combined turnover of top 300

---

## 6.2 Large Membership Associations

*Draft — less validated than primary segments.*

Broad-based organizations with thousands of individual members — environmental NGOs with democratic governance, large consumer cooperatives, national cooperative associations, faith-based organizations with congregational polity. Distinguished from federations by having individuals (not organizations) as primary members.

**Primary modules:** Membership, Governance | **Related:** [§6.1 Cooperative federations](#61-cooperative-federations) (org-as-member equivalent), [§3.1 Consumer coops](#31-consumer-cooperatives) (similar scale, private sector), [§5.1 Political parties](#51-political-parties-and-movements) (similar delegate structures)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Members | 1,000-100,000+ |
| Staff | 10-200 |
| Legal forms | Registered association, society, cooperative |
| Examples | Greenpeace national sections, Sierra Club chapters, large credit unions, RSPB, mutual building societies |

### Governance

- Representative democracy: members elect delegates or regional representatives
- Annual general meeting or congress (often hundreds of delegates)
- Elected board governs between assemblies
- Regional/local branches with their own governance
- Multi-level: local → regional → national, each with its own elections and budgets
- Some adopt hybrid models: direct member votes on key issues, delegate votes on operational matters

### Financial Model

- Individual membership dues (often low per-member, high in aggregate)
- Donations and fundraising
- Service revenue (financial products for credit unions, shop sales for consumer coops)
- Grant funding for program work
- Tiered giving programs beyond basic membership

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Scale of membership data — tens of thousands of records, joins, lapses, renewals, contact updates | High |
| Multi-level governance — local, regional, national elections and decisions must be coordinated | High |
| Delegate apportionment across branches based on membership counts — errors cause legitimacy crises | High |
| Member engagement funnel — most members are passive; identifying and nurturing active members is critical | Medium |
| Compliance and reporting — charity regulators, electoral commissions, financial authorities | Medium |
| Integration with payment systems — direct debits, online payments, payroll giving | Medium |
| Branch autonomy vs. national consistency — local groups want freedom, national needs data | Low |

**Current tools:** Salesforce (expensive, over-engineered for governance), CiviCRM (powerful but needs technical staff), bespoke databases, NationBuilder for advocacy-oriented groups. Governance is almost always managed outside the CRM — paper ballots, separate voting platforms, manual delegate tracking.

### Workflows

**Multi-level election cycle:**

1. National office sets election timeline and rules
2. Branch-level nominations open
3. Local elections held; results reported to regional
4. Regional delegate allocation calculated from branch membership
5. Regional elections held
6. National credentials committee verifies all delegates
7. National AGM/congress convened
8. National board elected from delegates
9. Results certified and published at all levels

### Individual Personas

**National Secretary** — Oversees governance compliance, manages AGM/congress logistics, certifies elections, maintains constitutional records. Needs multi-level election management, delegate credentialing, motion tracking across levels.

**Membership Director** — Responsible for recruitment, retention, engagement metrics. Needs large-scale membership analytics, segmentation, renewal automation, lapsed member campaigns. Currently stitching together CRM, email platform, and payment processor.

**Branch Chair (volunteer)** — Runs local meetings, recruits members, sends delegates to regional/national events. Needs simple local governance tools, visibility into branch membership data, easy reporting to national office. Often has minimal technical skills.

### References

- [CiviCRM](https://civicrm.org/) — Open-source CRM for nonprofits; 11,000+ organizations. Strong membership, events, and communications; no governance module. The gap between CiviCRM's capabilities and what democratic organizations actually need is Seedling's opportunity
- [Salesforce Nonprofit Cloud](https://www.salesforce.com/solutions/nonprofit/) — Enterprise CRM adapted for nonprofits; powerful but expensive and governance-blind
- [Decidim](https://decidim.org/) — Open-source participatory democracy platform; some large membership organizations use it for internal consultations alongside their CRM

---

