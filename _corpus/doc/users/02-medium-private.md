+++
title = "2. Medium Private Sector"
type = "doc"
updated = 2026-10-25
source = "seedling specs/user/02-medium-private.md, carried verbatim"
+++

# 2. Medium Private Sector

Organizations with 50-250 headcount. Multiple teams or departments, some delegation of governance, more formal processes. Often multi-site or multi-shift. Administrative complexity increases significantly.

## 2.1 Industrial Worker Cooperatives

*Draft — less validated than primary segments.*

Worker cooperatives in manufacturing, construction, facilities management, logistics, or other non-services sectors. Same democratic ownership as services cooperatives but with different operational characteristics.

**Primary modules:** Allocation, Governance | **Related:** [§1.1 Services worker coops](#11-professional-services-worker-cooperatives) (same model, smaller/services), [§2.2 Multi-stakeholder coops](#22-multi-stakeholder-cooperatives) (more complex governance)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Headcount | 50-250 |
| Member ratio | 60-80% of workers are members |
| Revenue | €5M-€50M annually |
| Legal forms | Same as services cooperatives by country |

**Key difference from services cooperatives:** Patronage basis is typically hours worked or wages rather than revenue generated. Shift scheduling, shop-floor safety, and equipment management are core operations. Less project-based, more continuous production.

### Governance

- Same democratic principles as smaller cooperatives (one member, one vote)
- Larger assemblies require more formal procedures
- Departmental or shift-based delegates may supplement direct democracy
- Works councils or shop-floor committees alongside cooperative governance
- Board composition may include department representation

### Financial Model

- Patronage typically based on hours worked or wages earned
- Same reserve requirements as smaller cooperatives
- Capital accounts track larger buy-in amounts (physical capital is expensive)
- Equipment depreciation and capital investment decisions are major governance items

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Patronage calculation across shifts, departments, and roles at scale | Critical |
| Capital accounts for 100+ members with different tenure and contribution levels | Critical |
| Governance at scale — assemblies with 100+ members need delegation and structure | High |
| Shift scheduling and availability tracking integrated with patronage | High |
| Equipment and asset tracking tied to department budgets | Medium |

**Current tools:** Generic ERP (Odoo, ERPNext) for operations — complex setup, no cooperative modules. Same accounting gaps as services cooperatives.

### Workflows

**Patronage calculation at scale:**

1. Collect hours/wages data across shifts, departments, and roles
2. Verify member vs. non-member status for each worker
3. Apply patronage formula (typically hours-based or wage-based)
4. Calculate reserve allocations per bylaws
5. Split between cash distribution and capital account credit
6. Generate statements for 100+ individual members
7. Present results at general assembly for approval

### Individual Personas

**General Manager** — Operations oversight, board leadership. Needs production dashboards combined with member governance tools. Straddles operational management and democratic accountability.

**Treasurer / Finance Manager** — Same role as in services cooperatives but at higher volume and complexity. Capital investment decisions are larger and more frequent.

**Department Lead / Shift Supervisor** — Production coordination, worker scheduling. May serve as department delegate to larger governance bodies. Needs scheduling tools that understand member vs. non-member status.

**Worker-Member** — Production work, governance participation. Often less computer-literate than services counterparts; needs mobile-first, simple interfaces for time entry and voting.

### References

- [Mondragon Corporation: €11.2B turnover, 70,000+ workers](https://www.thenews.coop/mondragon-worker-co-op-federation-reports-sales-of-e11-213bn/) — World's largest worker cooperative federation; 81 cooperatives, 3:1-9:1 wage ratios, industrial core
- [Reuten (2022): Employment Performance of Mondragon Worker Cooperatives 1983-2019](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3992304) — Longitudinal study of cooperative employment resilience vs. conventional firms
- [CG SCOP 2024: Industrial cooperatives](https://www.les-scop.coop/chiffres-cles-2024) — French data: industry represents 12% of SCOP employment; construction 17%

---

## 2.2 Multi-Stakeholder Cooperatives

Cooperatives with multiple classes of members — typically workers, customers/beneficiaries, investors, and community supporters — each with defined governance rights. Also covers **social enterprises and community businesses** (community pubs, energy cooperatives, work integration social enterprises) which share most structural characteristics.

**Primary modules:** Allocation, Governance, Membership | **Related:** [§1.1 Worker coops](#11-professional-services-worker-cooperatives) (single-class variant), [§3.1 Consumer coops](#31-consumer-cooperatives) (consumer-class dominated)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Total members | 50-250 across all classes |
| Worker-members | 10-50 |
| Legal forms | SCIC (France), Social cooperative (Italy), CBS (UK) |

**Stakeholder classes:**

| Class | Role | Typical Voting Weight |
|-------|------|----------------------|
| Workers | Employees of the cooperative | 40-65% |
| Beneficiaries | Customers, clients, users | 20-35% |
| Supporters | Investors, funders, community | 10-25% |
| Public interest | Local government, NGOs | 0-10% |

### Governance

- College-based voting: each stakeholder class votes within their college
- No single college can dominate (French SCIC requires workers ≤50%, any single college ≤50%)
- Board composition reflects stakeholder mix
- Different quorum rules may apply per decision type

### Financial Model

- Surplus allocation differs by stakeholder class: workers get labor-based patronage, beneficiaries get rebates or service credits, supporters get limited return (capped by law)
- Indivisible reserves typically higher than standard cooperatives
- Asset lock provisions common (assets stay with mission)
- Community shares: withdrawable capital from local investors, often capped returns (3-5%)

### Workflows

**College-based decision:**

1. Proposal raised and assigned to relevant colleges
2. Each college deliberates internally
3. College representatives share positions
4. Cross-college negotiation if needed
5. Formal vote within each college
6. Aggregate results per bylaws
7. Record decision with college-level breakdown

**Stakeholder onboarding:** Different tracks for workers vs. beneficiaries vs. supporters, each with class-specific processes.

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Different rules per class; college-based voting; differentiated reporting — extreme complexity | High |
| Per-class patronage calculations with different bases per class | High |
| No tools support multi-college governance natively | High |
| Each class needs different metrics and visibility | Medium |

**Current tools:** Same fragmented stack as worker cooperatives, with added complexity of managing multiple stakeholder classes across disconnected tools.

### Individual Personas

**Leader** — Must balance interests across stakeholder classes. Needs cross-college dashboards and differentiated reporting.

**Finance Lead** — Per-class allocation with different rules per class. Needs configurable per-class patronage calculations and community share management.

**College Representative** — Represents stakeholder class interests, facilitates within-college deliberation, participates in cross-college governance. Needs college-specific communication channels, aggregated feedback from class members, visibility into other college positions.

### References

- [The SCIC in France (HAL)](https://shs.hal.science/halshs-01468643/document) — Academic analysis of the French SCIC model; 557 SCICs by 2016, growing steadily
- [Social cooperative (Wikipedia)](https://en.wikipedia.org/wiki/Social_cooperative) — Overview of Italian social cooperatives: 11,000+ entities, pioneering multi-stakeholder model since 1991
- [CG SCOP: SCIC key figures](https://www.les-scic.coop/chiffres-cles) — 1,417 SCICs in France by end 2024, rapid growth from the original 557 in 2016

---

## 2.3 Agricultural Producer Cooperatives

*Draft — less validated than primary segments.*

Cooperatives of farmers, growers, or ranchers who pool resources for purchasing, processing, marketing, or distribution. Members are independent agricultural businesses.

**Primary modules:** Allocation, Billing | **Related:** [§1.3 Producer/freelancer coops](#13-producer-and-freelancer-cooperatives) (same model, smaller/non-agricultural)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Member farms | 50-250 |
| Staff (coop employees) | 10-50 |
| Revenue | €5M-€100M+ (commodity-dependent) |
| Legal forms | Country-specific agricultural cooperative statutes |

**Key difference from freelancer/producer cooperatives:** Larger scale, seasonal cycles, commodity pricing, quality grading, and often significant shared physical infrastructure (processing plants, storage, logistics).

### Governance

- One member, one vote (common) or weighted by volume delivered
- Elected board from membership
- Annual general assembly; board handles operations
- Commodity-specific committees (quality, pricing, logistics)

### Financial Model

- Patronage based on volume delivered to or purchased through the cooperative
- Pool pricing: revenue from commodity sales divided among members after costs
- Retained patronage: portion of payment withheld to build cooperative equity
- Revolving capital: oldest retained patronage returned as new equity comes in
- Seasonal advances and final settlement payments

### Workflows

**Seasonal settlement cycle:**

1. Members deliver product throughout season; cooperative records volume, grade, and timing
2. Cooperative issues advance payments based on estimated pool price
3. Cooperative sells aggregated product on market
4. At season end, calculate total revenue per commodity pool
5. Deduct cooperative operating costs and reserve allocations
6. Calculate per-unit pool price and individual member settlements
7. Issue final settlement payments (or collect shortfalls)
8. Update revolving capital accounts — return oldest retained patronage, retain new

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Patronage calculation based on volume, quality grade, and delivery timing | Critical |
| Pool pricing across multiple commodity pools with different cost structures | High |
| Revolving capital schedules with hundreds of members at different tenure levels | High |
| Seasonal cash flow — advances and settlements need careful tracking | Medium |
| Quality grading linked to payment; disputes need audit trail | Medium |

**Current tools:** Levridge, CenterPoint for agricultural patronage (expensive, US-focused), or generic accounting with heavy spreadsheet overlay.

### Individual Personas

**General Manager** — Operations, member relations, market strategy. Needs commodity dashboards, pool pricing tools, member communication.

**Bookkeeper / Finance Manager** — Patronage calculations, pool accounting, revolving capital schedules. Needs volume-based allocation, seasonal settlement workflows, retained patronage tracking.

**Farmer-Member** — Delivers product, receives payment, votes at assembly. Needs delivery records, payment statements, simple governance participation. Often low digital literacy; mobile-first essential.

### References

- [Copa-Cogeca](https://copa-cogeca.eu/) — 22,000+ agricultural cooperatives representing 7 million farmers across the EU
- [EU Parliament: Development of Agricultural Cooperatives 2014](https://www.europarl.europa.eu/meetdocs/2014_2019/documents/agri/dv/copa-cogecareport_/copa-cogecareport_en.pdf) — Copa-Cogeca report on agricultural cooperative development, structure, and challenges

---

