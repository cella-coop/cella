+++
title = "8. Medium Government"
updated = 2026-10-25
source = "seedling specs/user/08-medium-gov.md, carried verbatim"
+++

# 8. Medium Government

Bodies with 50-250 members or participants. Larger scale, more formal committee structures, often proportional representation.

## 8.1 Regional Assemblies

Sub-national government bodies — county, regional, or provincial assemblies.

**Primary modules:** Governance | **Related:** [§7.1 Municipal councils](#71-municipal-councils) (same model, smaller)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Assembly size | 20-200 elected members |
| Committee structure | 5-15 standing committees |
| Meeting frequency | Weekly to monthly |
| Decision volume | Hundreds annually |

### Governance

- Same principles as municipal councils but at larger scale
- Coalition or majority rule depending on electoral system
- More professional staff support and secretariat
- Higher volume of legislation and policy
- Proportional representation common in European regional assemblies
- Committee specialization deeper; members serve on fewer committees

### Financial Context

Budget oversight at regional level — larger budgets, more complex appropriations, intergovernmental transfers. Public transparency requirements similar to municipal level but with more formal reporting obligations.

### Workflows

**Committee-driven legislative process:**

1. Legislation referred to standing committee
2. Committee schedules hearings, expert testimony, public input
3. Committee deliberates; drafts amendments
4. Committee report with recommendations to plenary
5. Plenary debate: amendments proposed and voted
6. Final vote (may require multiple readings)
7. Implementation assigned to executive; progress monitored
8. Annual review of legislation effectiveness

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Volume of legislation and amendments at scale — dozens of bills in parallel | High |
| Committee coordination across 10+ parallel workstreams with interdependencies | High |
| Amendment tracking through multiple readings and committee stages | High |
| Citizen input collected but not systematically incorporated into deliberation | Medium |
| Institutional memory loss after elections; new members overwhelmed | Medium |

**Current tools:** Same as municipal councils, or enterprise solutions like Granicus. Some European regional assemblies use bespoke parliamentary information systems.

### Individual Personas

**Assembly Clerk / Secretary General** — Manages legislative workflow, committee scheduling, document management, official records. Needs legislative tracking system that handles parallel committee workstreams, amendment chains, and public record requirements. Volume is the key challenge vs. municipal level.

**Committee Chair** — Leads committee work program, schedules hearings, manages deliberation. Needs structured workflow for evidence gathering, expert testimony, public input, and report drafting.

**Assembly Member** — Participates in plenary and 2-3 committees; reviews legislation, proposes amendments. Needs consolidated view of active legislation, voting schedule, and committee obligations.

### References

- [Decidim](https://decidim.org/) — Used by regional governments (Catalonia) for citizen participation alongside legislative processes
- [Granicus](https://granicus.com/) — Enterprise government meeting and legislative management; dominant in English-speaking markets

---

## 8.2 Participatory Budgeting Bodies

Citizen assemblies specifically focused on allocating portions of public budgets. May be city-wide or neighborhood-level.

**Primary modules:** Governance | **Related:** [§7.2 Citizen assemblies](#72-citizen-assemblies) (similar deliberative format), [§7.1 Municipal councils](#71-municipal-councils) (commissioning body)

### Context

| Dimension | Typical Range |
|-----------|---------------|
| Participants | 50-500+ citizens |
| Budget scope | €100K-€10M+ |
| Cycle | Annual |

### Workflows

**Participatory budgeting:**

1. Define scope and rules (funds available, eligibility, timeline)
2. Idea collection (online submissions, community meetings)
3. Staff feasibility review and costing
4. Proposal development with proponent input
5. Public exhibition of viable proposals
6. Deliberation events (optional)
7. Voting period (in-person and/or online)
8. Results announcement and fund allocation
9. Implementation monitoring
10. Report back to community on outcomes

### Pain Points

| Pain Point | Severity |
|------------|----------|
| Proposal collection and feasibility assessment at scale | High |
| Public voting logistics (accessibility, fraud prevention, transparency) | High |
| Implementation tracking and reporting back to community | Medium |

**Current tools:** Consul/Decidim for citizen participation — purpose-built for PB but not integrated with government operations.

### Individual Personas

**PB Coordinator** — Designs process, manages timeline, coordinates with city departments. Needs proposal management, feasibility workflow, voting infrastructure, implementation tracking.

**Citizen Proposer** — Submits ideas, develops proposals, advocates during deliberation. Needs simple submission interface, status tracking, deliberation tools.

### References

- [Decidim](https://decidim.org/) — Purpose-built for participatory budgeting and democratic processes; used by Barcelona, Helsinki, and 40+ cities. Open source, Ruby on Rails, AGPL
- [Consul](https://consuldemocracy.org/) — Open-source citizen participation platform originating from Madrid; used for PB in 130+ institutions worldwide
- [Participatory Budgeting Project](https://www.participatorybudgeting.org/) — Resources on PB implementation, case studies, and process design

---

