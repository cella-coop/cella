+++
title = "1. Small Private Sector"
updated = 2026-10-25
source = "seedling specs/user/01-small-private.md, carried verbatim"
+++

# 1. Small Private Sector

Organizations with 1-50 headcount. Typically single-site, everyone knows everyone, governance is direct rather than delegated. Administrative burden falls on a few people wearing multiple hats.

## 1.1 Professional Services Worker Cooperatives

Enterprises owned and democratically controlled by their employees, operating in professional and business services: IT, consulting, creative, architecture, engineering, education.

**Primary modules:** Allocation, Projects, Billing, Governance | **Related:** [§1.2 Partnerships](#12-professional-partnerships) (similar allocation complexity), [§1.4 Freelancers](#14-professional-freelancers) (cooperative on-ramp)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Headcount | 10-50 |
| Member ratio | 70-85% of workers are members |
| Revenue | €500K-€5M annually |
| Legal forms | SCOP (France), Cooperativa di lavoro (Italy), CTA (Spain) |

**Geographic concentration:** Italy, Spain, France account for 80%+ of European worker cooperatives. National federations: Legacoop, Confcooperative (Italy); CG SCOP (France); COCETA (Spain); Co-operatives UK.

### Governance

- One member, one vote (regardless of seniority or investment)
- Elected board of directors from membership
- Regular member assemblies (monthly or quarterly)
- Committees for specific functions (finance, HR, strategy)
- Proposals can be raised by any member

### Financial Model

- Surplus distributed based on patronage (hours worked, wages earned, or revenue generated)
- Legally mandated allocation to indivisible reserves (20-30% depending on country)
- Individual member capital accounts tracking contributions and accumulated patronage
- Capital returned on member departure (often over multiple years)

### Workflows

**Member lifecycle:** Values-aligned hiring → employee probation (6-12 mo) → member vote + capital contribution → full rights and patronage accrual → role changes → resignation/retirement with capital payout

**Governance cycle:** Proposal creation → asynchronous deliberation → voting (majority/supermajority) → immutable decision log → task assignment and tracking

**Financial year cycle:** Monthly reporting → quarterly review → year-end patronage calculation → surplus distribution → general assembly

**Patronage distribution:**

1. Calculate total distributable surplus (after reserves)
2. Determine patronage basis for each member (hours, wages, or revenue)
3. Calculate individual patronage percentage
4. Allocate surplus: cash distribution vs. capital account credit
5. Update member capital accounts
6. Generate member statements
7. File required federation/regulatory reports

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Year-end allocation is a spreadsheet nightmare; error-prone and opaque to members | Critical |
| Capital account tracking requires individual ledgers no standard accounting software handles | Critical |
| 5-8 disconnected tools; no single source of truth; manual data re-entry | Critical |
| Cannot see real-time project margins; discover overruns after completion | High |
| Democratic decisions need documentation, discussion, voting — scattered across channels | High |
| Workers resist time tracking yet accurate time is essential for patronage | Medium |
| New members need to understand ownership model, rights, obligations — no standard onboarding | Medium |
| Buy-in/buyout formulas done ad-hoc; often requires outside accountants | Medium |

**Current tools:** Notion/Asana/Monday for projects, Toggl/Harvest for time, QuickBooks/Xero for accounting, Loomio/Google Forms for governance — none integrated, none cooperative-aware.

### Individual Personas

**Managing Director / President** — Strategic direction, board meeting leadership, financial oversight. Needs dashboards, meeting prep tools, governance records. Frustrated by hours compiling reports from multiple systems.

**Treasurer / Finance Manager** — Accounting, patronage calculations, capital account management, compliance. Needs automated allocation per bylaws, capital account ledgers, configurable formulas. Year-end close is 40-80 hours of spreadsheet work.

**Project Lead** — Client delivery, team coordination, budget monitoring. Needs project management linked to time tracking, resource scheduling, profitability visibility. Toggles between 4-5 disconnected tools.

**Worker-Member** — Billable work, governance participation. Needs simple time entry, voting and proposals, visibility into own capital account. Feels disconnected from ownership when calculations are opaque.

**Office Manager** — Member records, onboarding/offboarding, document management. Information scattered across email, Drive, and paper. Context lost when people leave.

### References

- [CECOP report on industry and service cooperatives in Europe](https://www.cicopa.coop/news/cecop-new-report-on-industry-and-service-cooperatives-in-europe/) — CICOPA/CECOP data: 43,000 cooperatives, 1.3M workers, 72% worker coops, 69% in services
- [CG SCOP key figures 2024](https://www.les-scop.coop/chiffres-cles-2024) — 2,723 SCOPs in France, 62,685 employees, €10.2B revenue, 79% five-year survival rate (vs 61% national average)
- [CICOPA network data portrait 2022-2023](https://www.cicopa.coop/publications/a-portrait-of-the-cicopa-network-a-data-driven-overview-of-industrial-and-service-cooperatives-2022-2023/) — 52,767 cooperatives globally, 76% of workers are members, 85% permanent contracts

---

## 1.2 Professional Partnerships

Businesses owned by licensed or skilled professionals who share profits according to partnership agreements. Includes **professional corporations** (SEL, PartG, Sociedad Profesional) which despite a corporate legal wrapper operate identically.

**Primary modules:** Allocation, Governance | **Related:** [§1.1 Worker coops](#11-professional-services-worker-cooperatives) (similar but simpler allocation)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Partners | 2-50 |
| Revenue per partner | €150K-€500K+ |
| Staff-to-partner ratio | 3:1 to 10:1 |
| Legal forms | LLP, GP, PartG (Germany), SCP (France) |

**Subsectors:** Law firms, accounting/audit, architecture, medical/dental groups, engineering, management consulting. Profit models range from lockstep to eat-what-you-kill to complex hybrid formulas.

### Governance

- Partnership agreement defines all rights and obligations
- Voting often weighted by equity percentage or seniority
- Management committee or managing partner handles day-to-day
- Full partner meetings for major decisions (new partners, mergers, strategy)
- Supermajority requirements for fundamental changes

### Financial Model

Profit allocation formulas often include 10+ variables: base/equal component, seniority or lockstep progression, origination credit, billable credit, collections responsibility, business development, management roles, specialization premiums.

Partner capital accounts track: initial buy-in, accumulated undistributed earnings, draws and distributions, partner loans. Buy-in for new partners often based on goodwill (multiple of earnings). Buyout on retirement paid over 3-10 years.

### Workflows

**Partner lifecycle:** Associate/counsel years → partner vote + buy-in → profit participation + voting → equity tier changes → retirement with buyout over years

**Compensation cycle:**

1. Gather contribution data across all dimensions
2. Apply partnership agreement formula
3. Model scenarios and adjustments
4. Compensation committee review
5. Partner meeting approval (if required)
6. Calculate draws vs. distributions
7. Update capital accounts
8. Generate K-1s or equivalent tax documents

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Allocation formulas with 10+ variables computed in spreadsheets; error-prone | Critical |
| Capital accounts with buy-in, draws, loans — standard accounting can't handle it | Critical |
| No integrated tool connects origination tracking, billing, allocation, and governance | Critical |
| Buy-in/buyout calculations are complex, ad-hoc, require outside accountants | High |
| Compensation disputes lack data transparency and audit trail | High |

**Current tools:** Clio/CCH for practice management (industry-specific but no partnership economics), QuickBooks/Xero for accounting, spreadsheets for allocation.

### Individual Personas

**Managing Partner** — Strategic direction, partner meeting leadership. Needs scenario modeling for partner economics, easy access to governance records.

**Finance Lead / CFO** — Allocation calculations, capital accounts, compliance. Needs configurable multi-factor formulas, capital account ledgers with buy-in/buyout tracking.

**Compensation Committee Member** — Evaluating partner contributions, recommending allocation adjustments. Needs contribution metrics across dimensions (origination, billing, collections, management), historical benchmarking, confidential deliberation space, scenario modeling.

**Partner** — Client work, governance participation. Needs visibility into own allocation calculation, voting on major decisions, understanding of how formula changes affect them.

### References

- [PwC Law Firms' Survey 2024](https://image.uk.info.pwc.com/lib/fe31117075640475701c74/m/1/Law+Firms+Survey+2024_FINAL+version.pdf) — Annual survey of partnership economics, profitability, and management trends
- [Law Society Financial Benchmarking Survey 2024](https://communities.lawsociety.org.uk/law-management-news/the-results-are-in-financial-benchmarking-survey-2024/6002905.article) — UK law firm financial and operational benchmarks
- [Thomson Reuters & Georgetown Law: 2024 Report on State of the Legal Market](https://www.lawnext.com/2025/01/report-from-thomson-reuters-and-georgetown-law-says-2024-was-the-beginning-of-the-end-for-the-traditional-law-firm-business-model.html) — Partnership model evolution; equity partner share declining (43% equity vs 57% non-equity in AmLaw 100)

---

## 1.3 Producer and Freelancer Cooperatives

Independent producers, freelancers, or micro-businesses who collectively own infrastructure providing shared services — marketing, invoicing, back-office, purchasing, or equipment.

**Primary modules:** Allocation, Billing | **Related:** [§1.4 Freelancers](#14-professional-freelancers) (pre-cooperative individuals), [§2.3 Agricultural producer coops](#23-agricultural-producer-cooperatives) (same model, larger scale)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Headcount | 5-50 producer-members |
| Member relationship | Independent (not employed by coop) |
| Revenue model | Fees/commissions on transactions |

**Types:** Artisan collectives (shared retail/marketing), freelancer cooperatives (invoicing, contracts, insurance), purchasing cooperatives (bulk buying), marketing cooperatives (branding, distribution).

### Governance

- Democratic but lighter-weight than worker cooperatives
- Members are busy running their own businesses
- General assembly annually; board handles routine decisions
- May use consent-based or lazy consensus models

### Financial Model

- Patronage based on transactions with the cooperative (volume sold, purchases made, revenue processed)
- Fee or commission structure for coop services
- Simpler member accounts than full capital accounts
- Surplus distributed as patronage refunds or reinvested

### Workflows

**Patronage cycle:**

1. Members transact with cooperative (sell through, purchase through, use services)
2. Cooperative records transactions per member
3. At period end, calculate fees/commissions owed
4. Calculate patronage share per member based on transaction volume
5. Distribute surplus as patronage refunds or retain in member accounts

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Transaction-based patronage tracking across many independent producers | High |
| Members too busy for governance; need very lightweight processes | Medium |
| Fee/commission tracking and reconciliation | Medium |

**Current tools:** Generic invoicing platforms, spreadsheets for patronage, email for governance. CoopCycle (for delivery cooperatives) provides a sector-specific platform but most producer coops have nothing purpose-built.

### Individual Personas

**Coordinator / Manager** — Runs cooperative services, tracks transactions, handles admin. Needs transaction-based patronage tracking, lightweight member management.

**Producer-Member** — Uses coop services, participates minimally in governance. Needs visibility into own transactions and patronage, simple voting interface.

### References

- [SMart Belgium — CECOP case study](https://www.cecop.coop/stories/smart-belgium) — Umbrella cooperative for 120,000+ freelancers across 9 European countries; provides employment status, invoicing, and social protection
- [Charles, Ferreras & Lamine (2020): A freelancers' cooperative as democratic institutional experimentation](https://journals.sagepub.com/doi/10.1177/1024258920919686) — Academic study of SMart-Belgium's governance model and its implications for precarious workers
- [Smart Coop network](https://smart.coop/) — Pan-European network of freelancer cooperatives operating in Belgium, France, Italy, Spain, Austria, Germany, Netherlands, Sweden

---

## 1.4 Professional Freelancers

Sole traders and independent professionals — developers, designers, consultants, translators, coaches — who are not (yet) part of a cooperative. They use Seedling for the same project delivery and billing tools that cooperatives use, making the platform a natural on-ramp to cooperative formation.

**Primary modules:** Projects, Billing | **Related:** [§1.3 Producer/freelancer coops](#13-producer-and-freelancer-cooperatives) (what freelancers become when they cooperate), [§1.1 Worker coops](#11-professional-services-worker-cooperatives) (larger cooperative destination)

*Note: This is the only segment that is not a member-governed organization. It is included because freelancers are the primary feeder population for cooperative formation, and they use Projects and Billing features from day one.*

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Headcount | 1 |
| Revenue | €20K-€150K annually |
| Legal forms | Sole trader, self-employed, auto-entrepreneur, freelancer |
| Sectors | IT, design, consulting, translation, coaching, creative services |

**Strategic role:** Professional freelancers are not member-governed organizations, but they represent a funnel into the cooperative ecosystem. Many freelancers already collaborate informally — sharing clients, subcontracting to each other, co-working. Seedling can support these collaborations and, when the time is right, offer a path to formalize them as cooperatives.

### Workflows

**Project delivery cycle:**

- Find/receive work, scope it, agree terms
- Track time, manage deliverables, communicate with clients
- Invoice, chase payment, manage expenses
- Handle taxes, contracts, insurance (varies by jurisdiction)
- Repeat — often juggling 2-5 clients simultaneously

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Time tracking across multiple clients with different billing arrangements | High |
| Invoicing and payment tracking — manual, error-prone, time-consuming | High |
| Project visibility — no single view of active work, deadlines, and capacity | Medium |
| Isolation — no peer support, no knowledge sharing, no collective bargaining power | Medium |
| Administrative overhead eats into billable hours | Medium |
| No path to collaboration — even when freelancers want to team up, there's no infrastructure | Low |

**Current tools:** Toggl/Clockify for time tracking, FreshBooks/Invoice Ninja for invoicing, Notion/Trello for project management, spreadsheets for everything else. Tools are siloed — time doesn't flow into invoices, projects don't connect to billing.

### Individual Personas

**Independent Consultant** — Experienced professional with steady clients. Needs integrated time tracking → invoicing → payment pipeline. Interested in collaboration but not willing to sacrifice autonomy. Would consider a cooperative if it meant shared clients, reduced admin, and collective benefits without losing independence.

**Early-Career Freelancer** — Recently independent, still building a client base. Needs simple project and billing tools. Craves community and mentorship. Most likely to join or form a cooperative — if they knew how and had the tools.

### References

- [Eurostat: Self-employment statistics](https://ec.europa.eu/eurostat/statistics-explained/index.php/Self-employment_statistics) — 28M self-employed in the EU; baseline data for the freelancer population
- [Malt & BCG: Freelancing in Europe 2024](https://25044521.fs1.hubspotusercontent-eu1.net/hubfs/25044521/FIE_2024/FILES/pdf_FIE-2024_digital_en.pdf) — Comprehensive survey of European freelancer demographics, motivations, and working conditions
- [Smart Coop network](https://smart.coop/) — Demonstrates the freelancer → cooperative pipeline: 120,000+ freelancers across 9 countries using cooperative infrastructure for invoicing, contracts, and social protection

---

