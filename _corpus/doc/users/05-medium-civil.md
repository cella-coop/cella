+++
title = "5. Medium Civil Society"
type = "doc"
updated = 2026-10-25
source = "seedling specs/user/05-medium-civil.md, carried verbatim"
+++

# 5. Medium Civil Society

Organizations with 50-250 active governance participants. Formal structures with elected leadership, delegate systems, and procedural rules.

## 5.1 Political Parties and Movements

Membership organizations pursuing political goals through electoral participation, advocacy, direct action, or movement building. Range from formal registered parties to informal movements and coalitions.

**Primary modules:** Membership, Governance | **Related:** [§5.2 Trade unions](#52-trade-unions) (similar delegate/conference governance), [§6.2 Large membership associations](#62-large-membership-associations) (similar at larger scale)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Active members (local level) | 20-500 |
| Active members (national) | Thousands to millions |
| Types | Registered parties, local chapters, political movements, campaign orgs, advocacy coalitions |

**Geographic considerations:** Strong party membership traditions in Germany, UK, Nordics. Movement-based politics growing across Europe. Public funding for parties common in EU. Strict electoral compliance requirements vary by country.

### Governance

- Elected leadership (executive committee, secretary, treasurer)
- Congresses or conventions for major decisions (annual or biennial)
- Delegate systems linking local → regional → national
- Policy development through motions and amendments
- Faction/tendency management within broader organization
- Often highly procedural (standing orders, points of order, formal debate)

### Financial Model

- Membership dues (often tiered by income or self-declared)
- Donations (subject to electoral law limits and disclosure requirements)
- Public funding in many European countries (based on votes or seats)
- Campaign fundraising cycles with spending limits
- Strict reporting requirements for electoral compliance

### Workflows

**Membership lifecycle:** Join → welcome → renew → lapse → win back

**Dues collection:** Billing, reminders, payment processing, status reconciliation

**Policy development:**

1. Motion submitted by member, branch, or working group
2. Formal seconding (if required by standing orders)
3. Policy committee review and recommendation
4. Amendments submitted by deadline
5. Compositing of similar motions (if applicable)
6. Debate at congress/conference with time limits
7. Vote on amendments, then substantive motion
8. Adopted policy added to platform
9. Implementation assigned to relevant body

**Delegate selection:**

1. Determine delegate allocation per branch (based on membership)
2. Open nominations with eligibility check
3. Candidate statements circulated
4. Election at branch meeting or online ballot
5. Results certified by returning officer
6. Credentials submitted to congress organizers
7. Attendance tracked; alternates seated if needed

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Outdated membership records, duplicates, lapsed members voting — no single source of truth | High |
| Manual dues tracking, chasing renewals, reconciling payments with membership status | High |
| Contested votes, unclear procedures, lack of audit trails undermine democratic legitimacy | High |
| Delegate representation formulas based on membership — manual calculation errors | Medium |
| Donation limits, disclosure requirements, spending caps tracked in spreadsheets | Medium |
| Local, regional, national levels with different permissions and data needs | Medium |

**Current tools:** NationBuilder, Action Network, CiviCRM for membership/CRM — strong on mobilization but weak on internal democracy and financial compliance. Various national party-specific tools, often outdated with poor UX.

### Individual Personas

**Branch Secretary** — Membership records, dues collection, local meetings, coordinating with regional/national, delegate selection. Frustrated by membership data spread across spreadsheets, email lists, and payment systems. No visibility into who's lapsed vs. active.

**Party Treasurer** — Party finances, electoral compliance, processing donations within legal limits, regulatory filings. Needs donation tracking with limit enforcement, automated compliance checks, disclosure report generation. Electoral law compliance is manual and error-prone; fear of inadvertent violations.

### References

- [CiviCRM](https://civicrm.org/) — Leading open-source CRM for nonprofits and advocacy organizations; used by 11,000+ organizations. Used by the National Democratic Institute for emerging political parties. Strong on membership/CRM, weak on internal governance
- [NationBuilder](https://nationbuilder.com/) — Political organizing platform used by parties worldwide; strong on mobilization and supporter management, limited internal democracy features
- [Decidim](https://decidim.org/) — Open-source participatory democracy platform; used by political parties (Podemos, Barcelona en Comú) for internal policy development and voting

---

## 5.2 Trade Unions

*Draft — less validated than primary segments.*

Worker organizations that collectively bargain with employers, represent members in disputes, and campaign for labor rights. Range from single-workplace locals to sectoral unions with dozens of branches.

**Primary modules:** Membership, Governance | **Related:** [§5.1 Political parties](#51-political-parties-and-movements) (similar delegate governance), [§6.1 Cooperative federations](#61-cooperative-federations) (similar federated structure)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Members | 50-250 (local/regional level) |
| Staff | 2-20 paid organizers and administrators |
| Legal forms | Registered trade union, labor organization |
| Sectors | Manufacturing, services, public sector, creative industries |

### Governance

- Elected executive committees at branch and regional levels
- Shop stewards and workplace representatives
- Annual or biennial delegate conferences
- Motions and resolutions system — proposals from branches debated and voted at conference
- Voting typically one member, one vote; delegate apportionment by branch size

### Financial Model

- Dues as percentage of wages (often collected via payroll deduction)
- Strike funds and hardship funds
- Affiliation fees to federations and political bodies
- Income from training, legal services, member benefits

### Workflows

**Grievance/casework:**

1. Member reports workplace issue to shop steward or organizer
2. Case opened: details recorded, category assigned
3. Informal resolution attempted with employer
4. If unresolved, formal grievance filed per collective agreement
5. Case escalated through stages (local → regional → legal)
6. Resolution recorded; outcome tracked for pattern analysis

**Conference cycle:**

1. Branches submit motions by deadline
2. Motions published; similar motions composited
3. Delegate allocation calculated from branch membership
4. Branches elect delegates
5. Credentials verified; delegates seated
6. Debate and vote on motions
7. Adopted policy recorded; implementation assigned

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Membership records out of sync with employer payroll — joiners, leavers, and dues deductions don't match | High |
| Branch-level delegate allocation requires accurate membership counts; errors delegitimize conferences | High |
| Grievance and casework tracking scattered across emails, notebooks, and individual organizers' files | High |
| Ballot and voting compliance — legal requirements for union elections are strict and auditable | Medium |
| Organizer workload invisible — no way to see case distribution, campaign assignments, or capacity | Medium |
| Communication with members relies on outdated contact info and mass email with poor deliverability | Medium |

**Current tools:** Legacy membership databases (often bespoke or decades old), spreadsheets for dues reconciliation, generic CRM for communications. Some use tools like Unionware or bespoke systems, but these are expensive and inflexible.

### Individual Personas

**Branch Secretary** — Maintains local membership records, organizes meetings, submits motions to conference, coordinates with regional office. Frustrated by duplicate records and manual dues reconciliation with employer payroll.

**Organizer** — Recruits members, supports workplace disputes, builds campaigns. Needs casework tracking, contact management, and campaign coordination. Currently keeps everything in personal notebooks and email folders.

**Treasurer** — Manages branch finances, dues income, hardship fund disbursements. Needs transparent fund tracking, reconciliation with payroll deductions, and financial reporting to members and national office.

### References

- [ETUC: Digital Trade Unionism Toolkit](https://www.etuc.org/en/publication/digital-trade-unionism-toolkit) — EU-funded project on digital tools for union organizing, communication, and membership management
- [UnionWare](https://unionware.com/) — Comprehensive union management software (membership, dues, grievances, elections); primarily North American market, expensive
- [Solidarity Tech](https://www.solidarity.tech/solutions/membership-management-software) — Union membership management software; represents the niche market Seedling could serve in Europe

---

## 5.3 Professional Associations

*Draft — less validated than primary segments.*

Membership bodies for practitioners in a specific profession — engineers, architects, accountants, nurses, social workers. Provide credentialing, continuing education, ethical standards, and professional advocacy. Governance is member-driven but often with low engagement.

**Primary modules:** Membership, Governance | **Related:** [§5.2 Trade unions](#52-trade-unions) (similar structure, different mission), [§6.2 Large membership associations](#62-large-membership-associations) (larger scale)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Members | 50-250 (local/regional chapters) |
| Staff | 1-10 |
| Legal forms | Professional body, chartered institute, registered association |
| Sectors | Regulated professions, technical fields, creative industries |

### Governance

- Elected council or board from membership
- Annual general meeting, often with low turnout
- Committees for standards, ethics, education, membership
- Regional chapters with some autonomy
- Code of conduct enforcement via disciplinary panels

### Financial Model

- Annual membership fees (often tiered by career stage: student, early career, fellow)
- Event and conference revenue
- Accreditation and certification fees
- CPD (continuing professional development) course fees
- Sponsorship income

### Workflows

**Membership lifecycle:**

1. Application submitted with credentials/qualifications
2. Eligibility verified; membership tier assigned
3. Annual renewal cycle: reminder → payment → confirmation
4. Tier transitions (student → early career → full member → fellow)
5. Lapsed member follow-up and re-engagement

**Ethics/disciplinary process:**

1. Complaint received against member
2. Initial screening by ethics officer (confidential)
3. Investigation panel appointed
4. Evidence gathered; member given opportunity to respond
5. Hearing (if warranted)
6. Decision: dismissed, warning, suspension, or expulsion
7. Appeal process
8. Outcome recorded (with appropriate confidentiality)

### Pain Points

| Pain Point | Severity |
|------------|----------|
| CPD tracking is manual — members self-report, association has no verification | High |
| Member engagement is low; governance elections struggle for quorum | High |
| Tiered membership with different benefits and fee levels — hard to manage transitions | Medium |
| Accreditation and credentialing workflows are paper-based or bespoke | Medium |
| Event management and registration bolted on separately from membership database | Medium |
| Ethics complaints and disciplinary cases need structured workflow with confidentiality | Medium |

**Current tools:** Wild Apricot, MemberClicks, or bespoke membership databases. Separate systems for events (Eventbrite), CPD tracking (spreadsheets), and communications (Mailchimp). Nothing integrates governance.

### Individual Personas

**Executive Director** — Runs day-to-day operations, manages staff, reports to elected council. Needs membership analytics, engagement metrics, and financial oversight. Frustrated by fragmented systems and manual reporting to the board.

**Membership Coordinator** — Processes applications, renewals, fee collection, member inquiries. Needs tiered membership management, automated renewal reminders, and lapsed member follow-up.

**Standards Committee Chair (volunteer)** — Oversees CPD requirements, accreditation reviews, ethical complaints. Needs structured case workflows, document management, and confidential deliberation spaces.

### References

- [Wild Apricot](https://www.wildapricot.com/) — Popular membership management for small-medium associations; events, dues, website. No governance features
- [ASAE: Challenges and Keys to Successful Association Partnerships](https://www.asaecenter.org/resources/articles/an_plus/2025/02-february/challenges-and-keys-to-successful-association-partnerships) — Association management research: 50% churn from lack of engagement, 39% from lack of perceived value
- [Agarwal (2016): How can professional associations stay relevant?](https://asistdl.onlinelibrary.wiley.com/doi/10.1002/pra2.2016.14505301028) — Research on knowledge management as key to association relevance

---

