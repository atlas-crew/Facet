---
id: decision-9
title: Salary preferences use floor and target inputs
date: '2026-05-02 15:45'
status: accepted
---
## Context

The Research workspace filters and ranks jobs based on salary preferences. The UI question was how to capture the user's preferences — slider, single value, range, or two named fields.

Sliders for salary are common but usually wrong: salary isn't continuous in user mental models (people think "low 150s" not "$152,000"), sliders are hard on touch/mobile, two-handle range sliders are even harder, and sliders hide actual values until interaction.

Different users have different mental models for salary preferences: "I won't take less than $X" (floor), "I'm targeting around $Y" (target), "I'd be happy at $Z or above" (satisfying threshold), or "anything in $A-$B works" (range). The data must support both filtering (hard threshold) and ranking (proximity-to-target signal).

## Decision

**Two labeled number inputs: Floor (filters) and Target (ranks). Both optional. USD/annual assumed for v1.**

UI shape:

```
Salary preferences

Floor (optional)
[ $    ] /year
Filter out roles below this. Leave blank to see all.

Target (optional)
[ $    ] /year
Roles near this rank higher. Leave blank to skip ranking by salary.
```

Behavior:
- Floor filters: jobs with max salary below the floor are excluded.
- Target ranks: jobs whose range overlaps the target score highest; jobs near target rank next; jobs far from target rank lowest.
- Jobs without listed salary default to include + neutral ranking.
- User can fill neither, just floor, just target, or both. Each field independent.

Data model fragment:

```
SalaryPreferences {
  floor_usd_annual: number?
  target_usd_annual: number?
  // Future-extensible: total_comp_floor, total_comp_target, currency, frequency, equity_required
}
```

The naming does the explanatory work — labels "Floor / The minimum you'd consider" and "Target / What you're aiming for" tell the user what each field does. No slider, no ambiguous range bounds.

## Consequences

- No slider in the salary preferences UI.
- Two named inputs, both optional, with explanatory helper text under each.
- Floor and target do independent work downstream (filter vs rank); the data model captures both.
- Future extensibility: the data model leaves room for total comp, multi-currency, frequency variations (hourly/contract). Not built for v1.
- Salary preferences UI is part of the Research workspace; does not block the Pipeline/Build/Letters refactor work in flight.
- Edge cases (job-listed range overlap with floor/target, missing salary, currency assumptions) are agent-decided defaults during implementation; surface for review only if the defaults feel wrong in practice.
