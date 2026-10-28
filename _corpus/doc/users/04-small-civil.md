+++
title = "4. Small Civil Society"
type = "doc"
updated = 2026-10-25
source = "seedling specs/user/04-small-civil.md, carried verbatim"
+++

# 4. Small Civil Society

Organizations with 1-50 members. Informal or semi-formal, governance is direct and often intense. Limited or no paid staff.

## 4.1 Collectives

Informal or semi-formal groups operating shared enterprises or projects with flat hierarchy, consensus governance, and values-driven missions. May or may not have formal legal structure.

**Primary modules:** Governance | **Related:** [§4.3 Mutual aid networks](#43-mutual-aid-networks) (even more informal), [§4.2 Housing coops](#42-housing-cooperatives) (similar scale, property focus)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Headcount | 3-30 members |
| Decision-making | Consensus or consent-based |
| Distribution | Equal or needs-based (if any surplus) |
| Legal status | Often informal, may use fiscal sponsors |
| Sectors | Activist spaces, arts, alternative economies, housing, tech |

**Geographic presence:** Strong tradition in Germany (Kollektive), Netherlands, UK. Squatter and housing movements across Europe. Tech and creative collectives growing internationally.

### Governance

- Flat or rotating facilitation (no permanent leadership)
- Consensus preferred; may use consent or modified consensus
- Working groups for specific functions
- High meeting frequency; decisions made collectively
- Strong culture of participation; active resistance to hierarchy
- Blocking and stand-aside mechanisms

### Financial Model

- Often minimal or no individual compensation
- Shared resources; pooled funds
- Equal distribution if any surplus exists
- Radical transparency: all members see all finances
- Anti-accumulation ethos; surplus often reinvested or donated

### Workflows

**Consensus process:**

1. Proposal introduced by any member
2. Clarifying questions (no debate yet)
3. Initial reactions / temperature check
4. Discussion of concerns and modifications
5. Call for consensus: consent / stand aside / block
6. If blocked: return to discussion or withdraw
7. If consent: record decision and assign actions
8. Rotating note-taker documents for institutional memory

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Decisions take too long; burnout from endless meetings | High |
| Software assumes hierarchy; collectives work around it | High |
| Need radically open finances; most tools don't support this | Medium |
| Knowledge and process lives in people's heads; continuity difficult | Medium |
| Everyone participates in everything; no delegation path | Medium |

**Current tools:** Loomio for some governance, shared spreadsheets for finances, informal communication channels. Most tools feel wrong because they assume roles and hierarchy.

### Individual Personas

**Facilitator (rotating)** — Prepares and runs meetings, manages stack (speaking order), guides group toward decisions. Needs meeting templates, consensus process guidance, timer and stack management, handoff documentation for next facilitator. This role rotates; the tool must support easy handoff.

**Member** — Participates in all decisions, contributes labor, shares resources. Needs transparent finances, simple proposal submission, clear view of all pending decisions.

### References

- [Loomio](https://www.loomio.com/) — Cooperative-built decision-making tool born from the Occupy movement; supports consensus, consent, and multiple voting methods. Used by cooperatives and collectives worldwide
- [Loomio on GitHub](https://github.com/loomio/loomio) — Open source (AGPL); Ruby on Rails; the closest existing tool to what Seedling's governance module needs to provide
- [Democracy Technologies: Loomio overview](https://democracy-technologies.org/tool/loomio/) — Analysis of Loomio's features in the context of democratic technology

---

## 4.2 Housing Cooperatives

*Draft — less validated than primary segments.*

Resident-owned housing where tenants collectively govern their building or estate. Members are the people who live there. Common across Northern Europe, with deep traditions in Germany (Wohnungsgenossenschaften), Scandinavia (bostadsrättsförening), and growing interest in UK community-led housing.

**Primary modules:** Governance, Membership | **Related:** [§4.1 Collectives](#41-collectives) (similar governance challenges), [§6.2 Large membership associations](#62-large-membership-associations) (larger housing associations)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Households | 5-50 |
| Governance participants | 5-30 active |
| Legal forms | eG (Germany), bostadsrättsförening (Sweden), CBS/CLT (UK) |

### Governance

- One household, one vote
- Elected board (often volunteer, often reluctant)
- Annual general meeting for major decisions (budgets, repairs, rules)
- Committees for maintenance, finance, social activities
- High-stakes decisions: building maintenance, rent levels, new members

### Financial Model

- Monthly contributions (rent or service charges) from members
- Reserve funds for maintenance and major works
- Member shares (often linked to apartment value or flat fee)
- No profit distribution — surplus goes to reserves or reduced contributions

### Workflows

**Annual general meeting cycle:**

1. Board prepares annual report and financial statements
2. Agenda published with required notice period
3. Members receive documents (budget, maintenance plans, rule changes)
4. Meeting held: reports presented, budget voted, board elected
5. Decisions recorded and distributed to all residents
6. Action items assigned (maintenance contracts, rule enforcement)

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Building maintenance decisions require transparent budgeting and vote tracking | High |
| Volunteer board turnover — institutional knowledge lost constantly | High |
| Financial transparency demanded but delivered via annual PDF report | Medium |
| Member onboarding when new residents join — rights, obligations, history | Medium |
| Conflict resolution between neighbors with governance implications | Medium |

**Current tools:** Email, WhatsApp groups, shared folders. Occasional use of property management software (Hausverwalter in Germany, Fastighetsförvaltning in Sweden) that has no governance features.

### Individual Personas

**Board Chair (volunteer)** — Runs meetings, coordinates maintenance, interfaces with property managers. Needs simple meeting management, decision tracking, maintenance request workflow. Often overwhelmed and undertrained.

**Treasurer (volunteer)** — Manages contributions, reserves, contractor payments. Needs transparent financial reporting that members can access, budget tracking for major works.

**Resident-Member** — Lives there, votes at assemblies, raises maintenance issues. Needs visibility into decisions, finances, and upcoming votes. Often disengaged until something affects them directly.

### References

- [Housing Europe](https://www.housingeurope.eu/) — Federation of 43,000 public/social/cooperative housing providers across 25 countries, managing 25 million homes (~11% of European housing stock)
- [Eurostat: Housing in Europe 2024](https://ec.europa.eu/eurostat/web/interactive-publications/housing-2024) — EU-wide housing statistics including tenure, cost burden, and dwelling types
- [CECODHAS: Cooperative housing as key model for sustainable housing](https://coopseurope.coop/cooperative-housing-key-model-sustainable-housing-europe-organised-cecodhas-housing/) — Cooperatives Europe analysis of cooperative housing's role in European housing policy

---

## 4.3 Mutual Aid Networks

*Draft — less validated than primary segments.*

Solidarity-based groups where members provide direct support to each other — food distribution, childcare swaps, tool libraries, skill shares, emergency funds. Grew significantly during COVID-19 and have persisted as ongoing community infrastructure.

**Primary modules:** Governance (minimal) | **Related:** [§4.1 Collectives](#41-collectives) (more structured version)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Active members | 5-40 |
| Legal status | Almost always informal; no legal entity |
| Revenue | Near-zero; pooled resources and donations |
| Sectors | Neighborhood solidarity, migrant support, disability mutual aid, queer community care |

### Governance

- Radically flat — even more so than collectives
- Decisions by consensus or informal agreement
- Roles are fluid and often unnamed
- Accountability is relational, not structural
- Anti-institutional ethos; suspicion of formalization

### Financial Model

- Pooled funds from donations or member contributions
- Direct resource sharing (not monetized)
- Radical transparency — everyone sees everything
- No surplus, no accumulation

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Coordination at speed — mutual aid responds to crises, not meeting cycles | High |
| No institutional memory; everything in group chats and people's heads | High |
| Resource tracking (who has what, who needs what) is manual | Medium |
| Burnout — a few people do everything; no way to surface this | Medium |
| Tools feel extractive or surveilling; trust is paramount | Medium |

**Current tools:** WhatsApp/Signal/Telegram groups, shared spreadsheets, occasionally Airtable. Any tool that requires accounts or data collection faces resistance.

### Workflows

**Need-response cycle:**

1. Someone signals a need (food, transport, childcare, crisis support)
2. Coordinator(s) broadcast to network
3. Available members respond
4. Match made; logistics coordinated
5. Support delivered; no formal tracking (but informal reciprocity expected)

### Individual Personas

**Coordinator (informal)** — Matches needs with resources, organizes logistics. Not a leader — would reject the title. Needs lightweight coordination tools that don't impose structure.

**Participant** — Offers or receives support. Needs simple way to signal needs or availability. Privacy-conscious; won't use tools that feel like surveillance.

### References

- [Sustainable Economies Law Center: Mutual Aid Toolkit](https://www.theselc.org/mutual_aid_toolkit) — Practical guide for starting and sustaining mutual aid groups; legal structures, governance patterns
- [PMC: Sustaining Mutual Aid Groups During and Beyond the Pandemic](https://pmc.ncbi.nlm.nih.gov/articles/PMC8563598/) — Research on how mutual aid groups evolve, govern themselves, and persist post-crisis
- [Charles et al. (2023): Mutual aid proliferation and collective responsibility](https://pubmed.ncbi.nlm.nih.gov/37975206/) — How COVID-era mutual aid developed solidarity and governance norms

---

