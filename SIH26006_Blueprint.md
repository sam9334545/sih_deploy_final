# SIH26006 — Complete Solution Blueprint

**Development of an Intelligent Freight Forecasting Model for Optimized Vessel Chartering and Bulk Cargo Procurement from Overseas to the East Coast of India**

Ministry of Steel · Software · Transportation & Logistics · SIH 2026
Team size: 3 · Document version: 1.0 · Prepared: 15 September 2026

> **How to read this document.** Every data source below has been checked against the live web in September 2026, and each is marked 🟢 / 🟡 / 🟠 / 🔴 for how obtainable it actually is. Where a dataset does not exist in public form, this document says so plainly and gives a fallback. Nothing here assumes data we have not confirmed. Demonstration numbers are labelled `[DEMO]` wherever they appear.

---

## 1. Executive Summary

### 1.1 What we are building

A decision-support system for the people who charter bulk carriers to bring coal and other dry bulk into India's East Coast ports. It does four things in sequence:

**Forecast the market → understand the constraints → simulate charter strategies → recommend the best decision.**

The system is not a freight price oracle. It is a *constrained decision engine* that treats the freight forecast as an uncertain input, not as the answer.

### 1.2 The strategic reading of this problem statement

The naïve reading is "build an ML model that predicts freight rates." That reading loses. Dry bulk freight is a liquid, heavily traded market; Baltic Exchange panellists, FFA traders and the research desks at Clarksons, Braemar and SSY have been forecasting it for decades with proprietary order-book data we will never have. A jury member with any shipping exposure will ask *"why should your XGBoost beat the forward freight agreement curve?"* and there is no good answer.

The statement itself points elsewhere. It names four vessel classes by name (Handysize, Supramax, Panamax, Capesize). It names seven Indian discharge ports with wildly different physical limits — Paradip can now take a 16.5 m draft Capesize, while Haldia is effectively a ~9 m draft Handysize port that needs Sandheads lighterage for anything bigger. It names five origin geographies with completely different loading infrastructure. And its stated objective is *contractual*: move from many single spot fixtures to short-term / medium-term multiple-voyage contracts.

That is a **constraints and decisions problem wearing a forecasting problem's clothes**. The cost savings live in: not chartering a vessel that cannot physically berth; not part-loading a Panamax to 55% at Haldia when two Supramaxes would have been cheaper; not entering the market on a day when the forward curve and the congestion signal both say wait; and consolidating three separate spot fixtures into one multi-voyage contract.

So our position is:

- Forecast freight as a **range with a confidence level**, not a point estimate. Be explicit that we are forecasting a *band*, and validate that the band's coverage is honest.
- Put the engineering effort into the **port–vessel–cargo feasibility layer** and the **strategy simulator**, which is where we have an information advantage nobody else at the hackathon will bother to build.
- Make the **data provenance slide** a weapon, not an apology. Every number traces to a named official source.

### 1.3 The one USP

**Charter Decision Digital Twin** (product name: *Charter Strategy Simulator*). Given a cargo requirement, the system enumerates feasible chartering strategies — 1×Panamax, 2×Supramax, 3×Handysize, spot vs. 3-voyage contract, direct berth vs. Sandheads lighterage — and for each one simulates the full voyage-and-port lifecycle to a **risk-adjusted landed logistics cost**, then recommends one with a stated reason and a stated uncertainty.

It is a *decision* twin, not a physics twin. Section 6 explains exactly what that claim does and does not include, because overclaiming here is how teams lose.

### 1.4 What is real and what is simulated (stated up front)

| Layer | Status for the SIH demo |
|---|---|
| Baltic indices (BDI/BCI/BPI/BSI/BHSI) history | **Real**, obtainable free |
| Indian East Coast port physical constraints | **Real**, from port authority PDFs |
| Paradip berth-level congestion & turnaround | **Real**, from PPA daily traffic PDFs |
| Port tariffs (port dues, berth hire, pilotage) | **Real**, from TAMP-approved Scale of Rates PDFs |
| Bunker / coal / iron-ore prices, FX | **Real**, World Bank + RBI + EIA |
| Weather / wave / cyclone risk | **Real**, Open-Meteo Marine API + IMD |
| Route-level $/tonne voyage freight, Australia→Paradip | **Derived** — no free public source exists; we build a documented Shadow Freight Model (§17.4) |
| Live AIS in the Bay of Bengal | **Not obtainable free** — we do not pretend otherwise; we derive congestion from port reports instead (§16) |
| Individual vessel open positions / availability | **Not obtainable free** — modelled as a fleet-supply proxy, clearly labelled (§15.5) |

---

## 2. Problem Deconstruction

### 2.1 The real-world problem

A steel producer (the Ministry of Steel context strongly implies SAIL, RINL and similar PSUs plus their private peers) needs to land tens of millions of tonnes per year of imported coking coal, thermal coal, limestone and occasionally iron ore at East Coast ports. Today the chartering desk works like this:

1. Cargo requirement arrives from the raw-materials/procurement group: *X tonnes of coking coal, from origin Y, needed at plant Z by date D*.
2. The chartering manager goes to the market — brokers, WhatsApp groups, Baltic reports — and asks for offers.
3. Offers come back as spot voyage fixtures, priced in $/tonne, quoted separately for each parcel.
4. The manager compares a handful of offers, often on the same day, and fixes.

Every step is reactive. The decision horizon is one day. The market is the only input. Port constraints are handled by tribal knowledge — "we don't put Capes into Haldia" — rather than by a model. And because each parcel is fixed separately, the desk never captures the discount, schedule reliability and demurrage protection that comes from committing volume across several voyages.

### 2.2 Who the actual end user is

Not "the Ministry." Name the person:

**Primary user — the Chartering / Shipping Manager** in the raw-materials or logistics division of a steel producer or a power utility. Sits in Kolkata, Bhubaneswar, Delhi or Visakhapatnam. Fixes vessels. Answers to a cost number. Has 20 minutes, not 2 hours. Trusts brokers more than software, which is exactly the trust problem the product has to solve.

**Secondary user — the Raw Materials / Procurement Head.** Wants to know: should we go to a 6-month COA for the Australia lane? What is the expected cost band and downside?

**Tertiary user — Ministry of Steel policy analyst.** Wants aggregate: what is the import logistics cost across PSUs, where is congestion eating money, which port needs investment.

Design implication: Page 2 (Charter Planner) is for the manager and must answer in one screen. Page 1 (Executive Dashboard) is for the head. Page 4 (Port Intelligence) is for the ministry analyst.

### 2.3 Decisions currently made manually

| Decision | How it is made today | What goes wrong |
|---|---|---|
| When to enter the market | Gut feel + today's broker quotes | Fixes at a local peak; no view of next 4–8 weeks |
| Which vessel class | Rules of thumb, prior fixtures | Over- or under-sized; part-loading penalties |
| One big ship or several small | Usually the biggest that "fits" | Ignores that a bigger ship may wait longer at berth |
| Spot vs. contract | Default to spot because it feels safer | Never captures multi-voyage discount |
| Which discharge port | Determined by plant, rarely re-optimised | Misses that a nearby port could be cheaper all-in |
| Laycan / delivery window | Negotiated per fixture | Weather and congestion seasonality not priced |

### 2.4 Why daily spot-market exploration is inefficient

- **It is a sampling problem with n=1.** Each day you see today's offers. You have no counterfactual for what next Tuesday would have cost.
- **It confuses price with cost.** A low $/tonne fixture into a congested berth with 9 days of waiting is more expensive than a higher fixture into a free berth.
- **It has no memory.** The same manager re-derives the same port constraints every time.
- **It creates negotiating asymmetry.** The broker knows the forward curve. You know today's quote.
- **It cannot support volume commitments**, because volume commitments require a forward view you never formed.

### 2.5 Why short- and medium-term multiple-voyage contracts are hard

A multiple-voyage contract (consecutive voyage charter, or a Contract of Affreightment) commits you to move N parcels over a window at an agreed rate or formula. It is hard because:

- **You must form a view on the market across the whole window**, not one day. If you fix a 6-month COA one week before the market falls 30%, you have locked in the loss.
- **You must commit to a vessel class** for all the voyages, which means every port in the rotation must accept that class in every season.
- **Delivery obligations become hard constraints.** Miss a laycan and you owe money.
- **You need volume certainty** from the plant side, which procurement may not be able to give.
- **Counterparty and performance risk** — the owner must actually deliver ships across the window.

This is precisely why a simulator is the right tool: it lets you stress a contract commitment against forecast bands and congestion scenarios *before* you sign.

### 2.6 Why freight forecasting alone is insufficient

Five independent reasons, each worth saying to a jury:

1. **The forecast is not the cost.** Landed cost = freight + bunkers + port dues + berth hire + waiting/demurrage + lighterage + repositioning. Freight is typically the largest term but far from the only one.
2. **A forecast without feasibility is dangerous advice.** "Capesize freight is cheap this month" is actively harmful if the discharge berth cannot take a Capesize.
3. **Forecast error has asymmetric consequences.** Being wrong on the high side costs money; being wrong on the low side costs a missed delivery, which can cost a blast furnace.
4. **The decision is discrete, the forecast is continuous.** You choose a class and a count. Two forecasts 5% apart can imply the same decision — or opposite ones. Only a decision model tells you which.
5. **The market already forecasts itself.** FFA curves exist. Our edge is not price; it is the combination of price uncertainty with physical constraints that FFA traders do not model and our user cannot compute by hand.

### 2.7 Why vessel size and port infrastructure constraints matter

Physically, a vessel can enter a berth only if:

```
vessel_arrival_draft  ≤  berth_permissible_draft  −  under_keel_clearance  +  tide_allowance
vessel_LOA            ≤  berth_permissible_LOA
vessel_beam           ≤  berth_permissible_beam
vessel_DWT            ≤  berth_permissible_DWT   (where notified)
```

Concrete, verified examples of why this bites on the East Coast:

- **Paradip** publishes berth-by-berth permissible LOA / beam / draft. Its coal berths have historically been in the 230–300 m LOA, 33–48 m beam, 14.0–14.5 m draft range depending on berth, with an explicit note that the 300 m coal berth is only usable *subject to the adjacent Iron Ore Berth being vacant* — a coupling constraint most models would miss entirely. In September 2026 PPA berthed its first Capesize at 16.5 m draft at Western Dock-1, carrying 152,702 t of coking coal from Hay Point. So Paradip's capability is genuinely changing, and any hard-coded constraint table goes stale.
- **Visakhapatnam** has two harbours with different envelopes — an Outer Harbour taking substantially larger vessels and an Inner Harbour where many berths are capped around 240 m LOA and 14.5 m draft, several with explicit *tide* allowances (some berths carry a "+0.5 m / +1.0 m tide" note, meaning the vessel can only sail on a tide window).
- **Haldia** is a river-lock port around 9 m maximum draft. Panamaxes are accepted only part-loaded at roughly 40–50% of capacity, and larger parcels are lightened at the **Sagar / Sandheads** anchorages using floating cranes. SMPK's Marine Department issues trade notices that change permissible drafts for operational reasons — including fog-season night-tide restrictions down to ~7.2 m. A static port table is simply wrong for Haldia.
- **Gangavaram and Dhamra** are deep-draft private ports that take fully laden Capesize, which means for the same cargo the *choice of discharge port* changes the optimal vessel class.

This is the core of the constraints problem and it is where our system earns its keep.

### 2.8 What causes vessel idle time

| Cause | Mechanism | Modelled in our system as |
|---|---|---|
| Berth congestion | More arrivals than berths | Waiting-time distribution per port × month × cargo |
| Tidal windows | Deep-draft vessel can only sail on high tide | Tide penalty hours in turnaround model |
| Cargo not ready | Stock, documentation, receiver not ready | Paradip daily reports literally code these (A–H reasons) |
| Equipment / terminal not ready | Unloader breakdown, terminal maintenance | Handling-rate derate factor |
| Weather | Cyclone, swell, wind stops cargo work | Weather-stop probability by month |
| Draft survey / part-discharge | Lightening before berthing | Lighterage time term |
| Waiting for a laycan | Ship arrives before the contractual window | Early-arrival penalty in simulator |

### 2.9 What causes deadheading (ballast legs)

A ship earns only when laden. Deadheading — sailing empty to reposition — happens when:

- The discharge port has no outbound cargo for that class (East Coast India discharges far more dry bulk than it loads, so ships often ballast out).
- The next load port is in a different basin (discharge Paradip, next load Hay Point → ~5,000+ nm of ballast).
- Timing mismatch: cargo available, but three weeks later.
- Class mismatch: the only outbound cargo suits a different size.

For a *charterer* (our user) deadheading matters because owners price expected ballast into the freight rate. A route with a good backhaul gets a better rate. This is a real, defensible feature for the shadow freight model.

### 2.10 Risks to consider

Market (freight volatility, bunker spikes), Port (congestion, berth outage, draft restriction change), Weather (cyclone season in the Bay of Bengal, swell at Gopalpur, fog on the Hooghly), Vessel availability (thin supply in a class on a lane), Route (canal/chokepoint, war-risk zones, sanctions exposure — relevant for the Russia origin), Demand (plant offtake changes), Counterparty (owner performance), and Regulatory (tariff revisions, import policy).

### 2.11 What "moving from spot to multi-voyage contracts" means operationally

Practically it means the desk changes four things:

1. **Aggregation.** Stop treating each parcel as a standalone tender; bundle a quarter's requirement into one negotiation.
2. **Forward view.** Form and defend an explicit opinion about the next 4–26 weeks, with a number and a confidence.
3. **Standardisation.** Fix a vessel class and a port rotation that works across the whole window — which forces the constraint analysis to be done once, properly.
4. **Risk transfer.** Negotiate laytime/demurrage terms with knowledge of expected waiting at the discharge port, so you stop paying for congestion you could have predicted.

Our system produces exactly the artefacts needed for all four.

### 2.12 Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | Ingest and store historical freight indices by vessel class, daily |
| FR-2 | Produce short-term (1–4 week) and medium-term (1–6 month) freight forecasts per vessel class |
| FR-3 | Express every forecast as a prediction interval plus a confidence score and a trend label |
| FR-4 | Maintain a structured port constraint dataset for 7 East Coast Indian ports and ≥8 origin ports |
| FR-5 | Screen vessel classes for hard feasibility against origin and destination port constraints |
| FR-6 | Recommend vessel class, number of voyages and approximate parcel size for a cargo requirement |
| FR-7 | Estimate voyage duration, turnaround and expected waiting time per port |
| FR-8 | Estimate total landed logistics cost with a component breakdown |
| FR-9 | Recommend market entry timing: charter now / wait / target window |
| FR-10 | Recommend contract structure: spot / short-term / medium-term multi-voyage |
| FR-11 | Simulate ≥5 alternative charter strategies and rank them on risk-adjusted cost |
| FR-12 | Produce a 0–100 Charter Opportunity Score with component attribution |
| FR-13 | Produce LOW/MEDIUM/HIGH risk with per-category breakdown and a stated main driver |
| FR-14 | Predict low-demand / idle windows and suggest repositioning or alternative employment |
| FR-15 | Provide a map-based port intelligence view with constraints and congestion |
| FR-16 | Expose all of the above as versioned REST APIs consumable by a frontend that contains no ML code |
| FR-17 | Provide explanations, in words, for every recommendation |
| FR-18 | Show data provenance and last-updated timestamp for every displayed figure |

### 2.13 Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Any interactive API call returns in < 2 s (p95); simulation endpoint < 5 s |
| NFR-2 | System runs fully offline from a local database snapshot for demo (no live-internet dependency on stage) |
| NFR-3 | Every dataset carries source URL, licence, retrieval date, and a verification flag |
| NFR-4 | No scraping of any source that forbids it; no bypassing of login, CAPTCHA, paywall or robots directives |
| NFR-5 | Derived/estimated values are visually distinguished from measured values in the UI |
| NFR-6 | Models are reproducible: fixed seeds, pinned requirements, committed training config |
| NFR-7 | Frontend never imports ML or optimisation code; communicates only over HTTP/JSON |
| NFR-8 | Port constraint data is editable via a config table, not hard-coded, so infrastructure changes are a data edit |
| NFR-9 | All monetary outputs shown in both USD and INR with the FX rate and date stated |

---

## 3. User Personas

**P1 — Ravi, Chartering Manager, integrated steel producer, Kolkata.**
14 years in shipping. Fixes 40–60 vessels a year. Measures himself on $/tonne landed and on never stopping the blast furnace. Distrusts black boxes. Will use the tool if it tells him something his broker didn't, and if it shows its working. *Needs:* Charter Planner, Strategy Simulator, and a one-line "why."

**P2 — Meera, Head of Raw Material Procurement, Bhubaneswar.**
Decides whether to go to a COA. Thinks in quarters and in budget variance. *Needs:* Executive Dashboard, forecast bands, contract-structure comparison, downside scenario.

**P3 — Arjun, Analyst, Ministry of Steel.**
Wants a defensible national picture: import logistics cost, congestion hotspots, which port constraint is binding most often. *Needs:* Port Intelligence, historical congestion, aggregate savings estimates with methodology.

**P4 — Kavita, Operations / Ship Agent coordinator, Paradip.**
Lives in the daily traffic report. Cares about berth availability next 72 hours. *Needs:* Port Intelligence + Risk & Alerts.

Persona → page mapping is enforced in §30.

---

## 4. Official PS Requirements → Feature Mapping

| # | Official Requirement (from PS) | Our Feature | Data Required | ML / Algorithm | Dashboard Output |
|---|---|---|---|---|---|
| R1 | Predict future freight rates for various vessel types and trade routes | Freight Forecast Engine | BDI, BCI, BPI, BSI, BHSI daily; bunker; coal & iron-ore prices; FX; seasonality | Seasonal-naïve baseline → gradient boosting on lagged features (LightGBM) → quantile regression for intervals; SARIMA benchmark | Page 3: history + forecast fan chart per class |
| R2 | Historical freight rate data for various vessel sizes across relevant trade routes | Freight Data Warehouse + Shadow Freight Model | Baltic indices; Baltic route definitions; distances; bunker; port cost | Index → route $/tonne translation (§17.4) | Page 3: route-level $/t band with "derived" badge |
| R3 | Global economic indicators, commodity price trends | Macro Feature Store | Brent/Dubai, Australian & South African coal, iron ore, USD/INR, IIP | Feature selection with time-aware CV; keep only features that improve validation | Page 1: market state tiles |
| R4 | Seasonal variations in demand and supply | Seasonality module | Monthly port traffic; monthly coal imports; monsoon/cyclone calendar | Fourier terms + month dummies; STL decomposition | Page 3: seasonal profile; Page 1: "seasonal position" |
| R5 | Real-time port congestion at origin and destination | Congestion Estimator | PPA daily traffic PDFs; VPA berthing programme; IPA monthly performance; origin-port queue reports | Waiting-time distribution model; EWMA of recent queue; gradient boosting on arrivals/berth-days | Page 4: congestion heat + expected wait |
| R6 | Infrastructure constraints of Indian East Coast ports (LOA, beam, draft, handling rates) | Port Constraint Registry | Port authority berth notifications; Scale of Rates; port handbooks | Deterministic rules engine | Page 4: berth table; Page 5: feasibility badges |
| R7 | Similar data for loading ports in Australia, US, Mozambique, Indonesia (+Russia) | Origin Port Registry | MSQ Port Procedures manuals; terminal handbooks; port authority pages | Same rules engine | Page 4: origin tab |
| R8 (a) | Optimal market entry timing for short/mid-term charter contracts | Timing Recommender + Charter Opportunity Score | Forecast distribution; volatility; congestion; deadline slack | Expected-cost-minimising stopping rule over the feasible window | Page 2: recommended charter window bar |
| R9 (b) | Vessel type optimisation for cargo volume + O/D pair under port limits | Vessel Selection Engine | Port registry; vessel class profiles; cargo parcel | Hard-constraint filter → MILP over (class, count) | Page 5: class comparison table |
| R10 (c) | Idle scenario management: forecast low demand, suggest alternative employment / positioning, reduce deadheading | Idle & Repositioning Module | Class-level index trend; seasonal traffic; port pair distances; backhaul availability | Low-demand classifier + ballast-cost ranking | Page 2/6: idle risk and repositioning note |
| R11 (d) | Early warnings for volatility, congestion, disruptions | Risk Engine + Alerts | Realised volatility; congestion trend; IMD/marine weather; class supply proxy | Z-score thresholds + rule ensemble, calibrated | Page 7: alert feed with severity |
| R12 | User-friendly dashboard; input cargo, ports, contract duration; get forecasts + recommendations | React Dashboard (7 pages) | — | — | Entire frontend |
| R13 | **Objective:** move from multiple single spot contracts to short/medium-term multiple voyage contracts | **Charter Strategy Simulator (USP)** | Everything above | Monte-Carlo over forecast + congestion + weather distributions; risk-adjusted cost ranking | Page 6: strategy comparison with winner |

Nothing in the official statement is unmapped. The coverage audit in §43 re-verifies this line by line.

---

## 5. Proposed Solution

### 5.1 One-paragraph description

A web application backed by a Postgres warehouse of maritime, freight, macro and port data. The user states a cargo requirement. The system forecasts the relevant freight indices as distributions, translates them into route-level $/tonne bands, screens every vessel class against the hard physical limits of the loading and discharge ports, enumerates a set of chartering strategies (class × count × contract structure × timing), simulates each strategy's full cost and schedule under uncertainty, scores each on risk-adjusted landed cost, and returns a ranked recommendation with an explanation, a confidence level, and the data sources behind every number.

### 5.2 Core design principles

1. **Uncertainty is first-class.** Nothing in the UI shows a point estimate without a band.
2. **Hard constraints are hard.** Feasibility is a filter, never a soft penalty. An infeasible strategy is never ranked.
3. **Derived ≠ measured.** Anything we computed rather than observed is badged in the UI and in the API response (`"provenance": "derived"`).
4. **The frontend has no intelligence.** All logic lives behind the API.
5. **A wrong recommendation must be diagnosable.** Every output carries the inputs that produced it.

### 5.3 The decision flow

```
Cargo requirement
      │
      ├─► Freight Forecast Engine ──► distribution of $/t per class per week
      │
      ├─► Port Constraint Registry ─► feasible (class, port) pairs
      │
      ├─► Congestion Estimator ─────► waiting-time distribution per port/month
      │
      ├─► Weather Risk ─────────────► weather-stop probability per month/route
      │
      └─► Strategy Enumerator ──────► candidate strategies
                    │
                    ▼
         Monte-Carlo Cost Simulator (USP)
                    │
                    ▼
         MILP / enumeration optimiser  ──► best strategy
                    │
                    ▼
         Risk Engine + Explanation ───► recommendation
```

---

## 6. Unique USP — Charter Decision Digital Twin

### 6.1 What it is

Given a requirement, the system builds candidate **strategies** and simulates each one thousands of times against sampled futures.

**Worked example structure** (values are `[DEMO]` placeholders; real figures come from the pipeline):

```
INPUT
  Cargo        : 120,000 t coking coal
  Origin       : Hay Point, Australia
  Destination  : Paradip, India
  Deadline     : 25 October
  Horizon      : 3 voyages (short-term contract considered)

CANDIDATE STRATEGIES
  A  1 × Capesize          (1 voyage,  ~120,000 t)
  B  1 × Panamax + part    (2 voyages, ~75,000 + 45,000 t)
  C  2 × Supramax          (2 voyages, ~60,000 t each)
  D  3 × Handysize         (3 voyages, ~40,000 t each)
  E  Spot fixtures, per parcel
  F  3-voyage short-term contract on the winning class
  G  Discharge split: Paradip + Dhamra
```

For each strategy the simulator computes, per Monte-Carlo draw:

| Component | How it is computed |
|---|---|
| Freight cost | sampled $/t from forecast distribution × tonnes; contract structures get a negotiated-discount parameter with a stated assumed range |
| Fuel / bunker | distance (searoute) ÷ speed × daily consumption × bunker price — consumption from Baltic standard vessel descriptions |
| Port costs (both ends) | port dues + pilotage + berth hire + wharfage from the port's published Scale of Rates, as a function of GRT and hours alongside |
| Waiting cost | sampled waiting hours × (berth hire or demurrage rate) |
| Expected demurrage | P(laytime exceeded) × excess hours × demurrage rate |
| Lighterage | only for Haldia/Sandheads routing: tonnes lightened × lighterage rate + extra days |
| Congestion risk | expected waiting from the congestion model, by port × month × class |
| Weather risk | P(weather stop) × expected stopped hours, from marine climatology |
| Vessel–port compatibility | hard filter; strategy dropped if infeasible |
| Voyages / turnaround | laden days + port days + ballast days |
| Idle time | slack between arrival and laycan, and between voyages |
| Deadheading | ballast leg distance to the next plausible load port |
| Total expected cost | sum of the above |
| **Risk-adjusted cost** | see §6.3 |

Output: a distribution of total cost per strategy, plus P(miss deadline).

### 6.2 Why this is genuinely useful (not decoration)

Three concrete reasons a real chartering manager would open it:

1. **It prices the thing brokers don't quote.** A broker quotes $/tonne. Nobody quotes you "expected waiting at Paradip coal berth in October for a 82,500 dwt vessel." That term can swing the comparison between a Panamax and two Supramaxes.
2. **It makes the spot-vs-contract question answerable.** The contract only wins if the discount exceeds the value of the optionality you give up. That is a distributional comparison, and humans are bad at it without a tool.
3. **It converts a constraint into money.** "Haldia can't take that ship" is useful. "Routing via Haldia costs an extra $X/t in lighterage and 2.3 days, versus Paradip" is decision-grade.

### 6.3 Risk-adjusted cost — the formula

We rank on a mean-plus-tail objective, which is standard, defensible, and avoids arbitrary "risk points":

```
RiskAdjustedCost(s) = E[C_s] + λ · (CVaR_α[C_s] − E[C_s]) + M · P(deadline_miss_s)
```

- `C_s` = simulated total landed cost for strategy *s*
- `CVaR_α` = conditional value at risk at α = 0.90 (mean of the worst 10% of draws)
- `λ` = risk aversion, exposed to the user as a slider (0 = risk-neutral, 1 = strongly risk-averse), default 0.5
- `M` = deadline-miss penalty, set by the user in $/occurrence (default: a stated plant-stoppage cost assumption, clearly labelled)

This has exactly two tunable numbers, both surfaced to the user, both with defensible defaults. That is much stronger than a weighted score with seven invented weights.

### 6.4 How to describe it without overclaiming

**Say this:** "It is a decision twin. We simulate the *cost and schedule consequences* of chartering choices using published vessel performance profiles, published port constraints and tariffs, and statistical distributions for freight, waiting and weather. It answers 'what would this decision have cost, and how badly could it go wrong.'"

**Do not say:** that it simulates hull hydrodynamics, real-time vessel telemetry, actual berth allocation logic, or that it mirrors a live physical system. It does not. It has no live AIS in the Bay of Bengal (§16) and we say so.

**If a juror pushes:** "It's a discrete-event cost simulator with Monte-Carlo uncertainty propagation. We call it a decision twin because it twins the decision, not the ship. The physical fidelity we do have is the published vessel and berth envelope — Baltic standard vessel descriptions and port authority berth notifications — and we're explicit that vessel performance is a class-representative profile, not a specific hull."

### 6.5 Minimum viable version of the USP

For the hackathon, the simulator must do at least: 5 strategies × 1,000 Monte-Carlo draws × full cost breakdown, in under 5 seconds, with a ranked table and a winner card. Everything else (port splitting, backhaul optimisation) is Should-Have.

---

## 7. System Architecture

### 7.1 Diagram

```
┌──────────────────────── DATA SOURCES ────────────────────────┐
│ Baltic indices │ Port authority PDFs │ Scale of Rates │ World │
│ Bank Pink Sheet│ RBI FX │ Open-Meteo Marine │ IMD │ data.gov.in│
│ IPA monthly    │ MSQ port manuals │ UN Comtrade │ EIA        │
└───────────────────────────┬──────────────────────────────────┘
                            ▼
              ┌──────────── DATA ACQUISITION ────────────┐
              │ scheduled Python jobs: requests / pdfplumber │
              │ pandas.read_html / read_excel / official APIs │
              │ + manual curation with verification log      │
              └───────────────────┬──────────────────────┘
                                  ▼
              ┌──────────── DATA CLEANING / VALIDATION ──┐
              │ schema checks, unit normalisation,        │
              │ outlier flags, provenance stamping        │
              └───────────────────┬──────────────────────┘
                                  ▼
              ┌──────────── POSTGRESQL WAREHOUSE ────────┐
              │ raw_* │ clean_* │ dim_* │ fact_* │ feat_* │
              └───────────────────┬──────────────────────┘
                                  ▼
              ┌──────────── FEATURE ENGINEERING ─────────┐
              │ lags, rolls, vol, seasonality, spreads    │
              └───────────────────┬──────────────────────┘
                                  ▼
    ┌──────────────────┬──────────────────┬──────────────────┐
    │  FREIGHT         │  PORT / VESSEL   │  RISK SIGNALS    │
    │  FORECASTING     │  CONSTRAINTS     │  / CONGESTION    │
    │  (LightGBM +     │  (rules engine + │  (waitineather, vol)  │
    │                  │   scores)        │                g model, │
    │   quantiles)     │   compatibility  │   w  │
    └────────┬─────────┴─────────┬────────┴────────┬─────────┘
             └──────────────────┬┴─────────────────┘
                                ▼
                    ┌──────── COST MODEL ────────┐
                    │ freight+bunker+port+wait+  │
                    │ demurrage+lighterage+ballast│
                    └──────────────┬─────────────┘
                                   ▼
                    ┌──── OPTIMIZATION ENGINE ───┐
                    │ feasibility filter → MILP   │
                    │ (OR-Tools CP-SAT / CBC)     │
                    └──────────────┬─────────────┘
                                   ▼
                    ┌─ CHARTER STRATEGY SIMULATOR ┐
                    │  Monte-Carlo, risk-adjusted │
                    └──────────────┬─────────────┘
                                   ▼
                    ┌──────── FASTAPI LAYER ─────┐
                    │ versioned REST, Pydantic    │
                    │ schemas, OpenAPI docs       │
                    └──────────────┬─────────────┘
                                   ▼
                    ┌──── REACT FRONTEND (Vite) ──┐
                    │ ECharts │ Leaflet │ Tailwind │
                    └──────────────┬─────────────┘
                                   ▼
                            USER DASHBOARD
```

### 7.2 Component responsibilities

| Component | Responsibility | Owner |
|---|---|---|
| **Acquisition jobs** | Fetch, stamp provenance, write to `raw_*` | M2 (freight/macro), M3 (port) |
| **Cleaning layer** | Unit normalisation, schema enforcement, dedup, outlier flagging | M2 |
| **Warehouse** | Single source of truth; all modules read from here, never from files | M3 |
| **Feature store** | Deterministic, leak-free feature construction with a cutoff timestamp | M2 |
| **Forecast service** | Train offline, serve pre-computed forecasts from a table; retrain on command | M2 |
| **Constraint registry** | Port × berth × class feasibility; editable data, not code | M3 |
| **Congestion model** | Waiting-time distributions; refreshed from port daily reports | M3 |
| **Cost model** | Pure function: (strategy, sampled params) → cost breakdown | M3 |
| **Optimiser** | Chooses class/count/window subject to hard constraints | M3 |
| **Simulator** | Monte-Carlo wrapper over cost model; produces distributions | M3 |
| **API** | Only interface the frontend sees; stable contracts | M3 (owner), M2 (ML endpoints) |
| **Frontend** | Presentation, interaction, explanation rendering | M1 |

### 7.3 Technology stack (and why each is there)

| Layer | Choice | Justification |
|---|---|---|
| Language (backend/ML) | **Python 3.11** | Ecosystem; team familiarity |
| Data | **pandas, NumPy** | Standard |
| Database | **PostgreSQL 16** | Relational constraint data + time series; JSONB for provenance; free |
| API | **FastAPI + Pydantic + Uvicorn** | Auto OpenAPI docs → the frontend dev gets a contract without asking |
| Forecasting | **LightGBM** (primary), **statsmodels SARIMA** (benchmark), **scikit-learn** (baselines, quantile regression) | Tabular time-series with exogenous features; fast; interpretable via SHAP |
| Intervals | **LightGBM quantile objective** + conformal calibration | Honest coverage, cheap |
| Optimisation | **OR-Tools** (CP-SAT for the discrete assignment; `pywraplp`/CBC for MILP) | Free, well-documented, handles integer counts naturally |
| Routing / distance | **searoute** (Python, Apache-2.0) | Free sea distances; caveat noted in §17.6 |
| PDF extraction | **pdfplumber** (text/tables), **camelot** only if needed | PPA/VPA reports are text PDFs, not scans |
| HTTP | **requests** + **httpx** | Standard |
| Scheduling | **APScheduler** (in-process) | No Airflow; overkill for 3 people |
| Frontend | **React 18 + Vite + TypeScript** | Fast dev loop; typed API client |
| Styling | **Tailwind CSS** | Speed |
| Charts | **Apache ECharts** (via `echarts-for-react`) | Excellent fan/confidence-band charts, candlesticks, heatmaps |
| Maps | **Leaflet + react-leaflet** with OpenStreetMap tiles | Free, no token needed (Mapbox needs a key; avoid a stage-day dependency) |
| Testing | **pytest**, **Vitest** | — |
| Packaging | **Docker Compose** (postgres + api + web) | One command demo |

**Deliberately excluded:** Kafka, Spark, Airflow, Kubernetes, a vector DB, an LLM chatbot, deep learning frameworks. None are justified by the data volume (megabytes, not terabytes) or the team size, and each is a thing that can break on stage.

---

## 8. Data Architecture

### 8.1 Layered model

```
raw_*     → exactly as fetched, plus (source_url, fetched_at, sha256, licence)
clean_*   → typed, unit-normalised, deduplicated, validated
dim_*     → slowly-changing reference: ports, berths, vessel classes, routes
fact_*    → time series: freight indices, prices, port calls, weather
feat_*    → model-ready features with an explicit as_of timestamp
model_*   → forecasts, intervals, scores, model metadata
```

### 8.2 Provenance contract (NFR-3)

Every row in `clean_*` and `dim_*` carries:

```sql
source_name     TEXT NOT NULL,   -- 'Paradip Port Authority'
source_url      TEXT NOT NULL,
source_type     TEXT NOT NULL,   -- api|csv|excel|pdf|html|manual
retrieved_at    TIMESTAMPTZ NOT NULL,
licence         TEXT,            -- 'GoI OGDL', 'NLOD', 'CC-BY-4.0', 'unspecified-public'
verification    TEXT NOT NULL,   -- 'auto'|'manually_verified'|'unverified'
verified_by     TEXT,
notes           TEXT
```

The dashboard reads `verification` and shows a badge. This single design decision answers jury questions 1, 2, 3 and 9 at once.

### 8.3 Update cadence

| Layer | Cadence | Mechanism |
|---|---|---|
| Freight indices | Daily (business days) | Scheduled fetch |
| Bunker / crude | Daily/weekly | Scheduled fetch |
| Commodity prices | Monthly | Pink Sheet release |
| FX | Daily | RBI reference rate |
| Port daily traffic | Daily | PPA/VPA PDF fetch + parse |
| Port monthly performance | Monthly | IPA release |
| Port constraints | On change (rare, but *does* change) | Manual review + trade-notice watch |
| Weather | 6-hourly for forecast; monthly climatology cached | Open-Meteo API |

---

## 9. Complete Data Dictionary

Availability key: 🟢 easily obtainable · 🟡 obtainable with effort · 🟠 possibly restricted · 🔴 commercial/proprietary

### 9.1 Freight

| Dataset | Key columns | Why needed | Source | Free? | Format | Method | Frequency | Depth | Avail | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| Baltic Dry Index | date, bdi | Market state; headline feature; BDI is a composite of dry bulk timecharter averages with a continuous series since 1985 | Baltic Exchange (definitions); Stooq / public index mirrors for history | Index values widely republished free; Baltic's own licensed feed is paid | CSV | Download | Daily | 1985→ | 🟢 | P0 |
| BCI / BPI / BSI / BHSI | date, value, tc_avg | Class-specific signal — this is what actually drives class choice | Same as above | Free values; paid for licensed real-time | CSV | Download | Daily | Varies by index | 🟢/🟡 | P0 |
| Baltic standard vessel descriptions | class, dwt, draft, loa, beam, speed, consumption | **Gives us defensible representative vessel profiles** (e.g. BHSI 38: 38,200 dwt on 10.538 m, LOA 180 m, beam 29.8 m, 14 kn laden on 26 mt IFO; BPI 82: 82,500 dwt on 14.43 m, LOA 229 m, beam 32.25 m, 13.5 kn laden on 33 mt) | balticexchange.com dry services page | Free to read | HTML | Manual transcription + verify | Once (re-check yearly) | Current | 🟢 | P0 |
| Baltic route definitions (C5, C3, P1A, S1B etc.) | route_code, description, vessel, load, discharge | Lets us map an index route to a real trade lane and justify the shadow model | Baltic Exchange public route descriptions | Free to read | HTML | Manual | Once | 🟢 | P0 |
| Route-level voyage freight $/t Australia→East Coast India | date, route, usd_per_tonne | The ideal target variable | Platts / Argus / Baltic licensed | ❌ Paid | — | — | — | 🔴 | Fallback → §17.4 |
| Time-charter equivalent earnings by class | date, class, usd_per_day | Cross-check on index levels | Reported alongside index values in public market reports | Free (reported), 🔴 for licensed series | HTML | Read | Daily | Recent | 🟡 | P1 |
| FFA forward curve | tenor, class, price | Would be the honest benchmark for our forecast | Exchange/broker | ❌ Paid | — | — | — | 🔴 | Acknowledge, don't fake |

### 9.2 Indian East Coast Ports

| Dataset | Key columns | Why needed | Source | Free? | Format | Method | Freq | Avail | Pri |
|---|---|---|---|---|---|---|---|---|---|
| Paradip berth-wise permissible LOA/beam/draft | berth, loa_m, beam_m, draft_m, remarks | Hard feasibility | paradipport.gov.in Marine Dept notification PDF | Free | PDF | pdfplumber + manual verify | On change | 🟢 | P0 |
| Paradip daily traffic report | vessel, cargo, berth, arrival, ready-for-berth, berthed, ETD, draft, LOA, beam, tonnage, delay reason code | **Our single best congestion/turnaround dataset** — gives observed waiting time per vessel | paradipport.gov.in daily traffic PDFs | Free | PDF | Scheduled fetch + parse | Daily | 🟢 | P0 |
| Visakhapatnam allowable LOA/beam/draft, inner & outer harbour | berth, loa, draft, tide_allowance, remarks | Hard feasibility incl. tide windows | vizagport.com / vpt.shipping.gov.in Marine Dept PDF | Free | PDF | Download + parse | On change | 🟢 | P0 |
| Visakhapatnam berthing programme (working & expected vessels) | vessel, cargo, berth, status | Congestion at Vizag | Visakhapatnam Port Authority site | Free | PDF | Fetch + parse | Daily | 🟢/🟡 | P1 |
| Port Scale of Rates (port dues, pilotage, berth hire, wharfage, anchorage) | charge_type, basis, rate_foreign_usd, rate_coastal_inr, slab | **Real port cost model** | Each port authority site (TAMP-approved SoR PDFs) | Free | PDF | Download + manual table entry | On revision | 🟢 | P0 |
| SMPK / Haldia marine trade notices (draft restrictions) | date, restriction, applies_to | Haldia draft changes with fog/tide; static table would be wrong | SMPK Marine Dept notices | Free | PDF/HTML | Fetch + manual read | Ad hoc | 🟡 | P1 |
| Dhamra / Gangavaram / Gopalpur specs | draft, loa, beam, berths, handling rate | Deep-draft alternatives | Adani Ports port pages; Odisha Commerce & Transport Dept (Directorate of Ports & IWT) | Free | HTML | Read + manual entry | Rare | 🟡 | P0 |
| IPA monthly major-port performance (traffic, commodity split, turnaround, pre-berthing detention) | port, month, commodity, tonnes, trt_days, pbd_days | Demand series + congestion baseline | Indian Ports Association — **note: the official site has moved to ipa.org.in** (reports/statistics section) | Free for the monthly releases | PDF/Excel | Download | Monthly | 🟡 | P0 |
| MoPSW macro port indicators (turnaround, pre-berthing detention, capacity) | year, port, indicator, value | Long history for congestion normalisation | data.gov.in (OGD Platform), MoPSW annual reports | Free, GoI Open Data Licence | CSV | API/download | Annual | 🟢 | P1 |
| "Major Ports of India: A Profile" (IPA) | comprehensive port infrastructure | Would be ideal one-stop reference | IPA | ❌ **Paid** — sold for a demand draft (Rs 4,000 order) | Print | — | — | 🔴 | Skip; assemble from port sites instead |

### 9.3 Origin Ports

| Dataset | Source | Free? | Format | Avail | Notes |
|---|---|---|---|---|---|
| Hay Point (DBCT + HPCT) port procedures & berth limits | Maritime Safety Queensland "Port Procedures and Information for Shipping — Hay Point"; DBCT shipping page | Free | PDF/HTML | 🟢 | Authoritative; MSQ is the state regulator |
| Gladstone port procedures + handbook | MSQ Gladstone procedures; Gladstone Ports Corporation Port Handbook PDF | Free | PDF | 🟢 | GPC also publishes trade/shipping statistics |
| Abbot Point | MSQ port procedures | Free | PDF | 🟢 | |
| Port of Newcastle limits | Port of Newcastle / Port Authority of NSW; terminal handbooks (PWCS, NCIG) | Free | PDF/HTML | 🟢 | Newcastle max conventional vessel ≈ 300 m LOA, 55 m beam, ~16.2 m draft + tide − UKC (verify on the port's own page before citing) |
| Newcastle coal vessel queue | HVCCC weekly report (member-facing); queue figures appear in public market reporting | Partly | HTML | 🟠 | Treat as indicative; don't scrape a paywalled feed |
| Indonesian coal ports (Taboneo, Tanjung Bara, Balikpapan, Samarinda) | Kementerian Perhubungan / Pelindo; terminal operator pages | Free | HTML/PDF | 🟡 | Much is anchorage/barge-transhipment — model that explicitly |
| Mozambique (Maputo, Beira, Nacala) | CFM / Maputo Port Development Company; terminal pages | Free | HTML/PDF | 🟡 | Draft is the binding constraint at Maputo |
| Russia (Vostochny, Nakhodka, Taman) | Port authority / operator sites | Free | HTML | 🟠 | **Also a sanctions/route-risk flag; surface it as a risk, don't ignore it** |
| US (Hampton Roads/Norfolk, Baltimore, New Orleans) | Port authority sites; US Army Corps of Engineers channel depths | Free | HTML/PDF | 🟢 | USACE publishes authoritative channel depths |

### 9.4 Vessels

| Dataset | Source | Free? | Avail | Notes |
|---|---|---|---|---|
| Standard class profiles (dwt, draft, LOA, beam, speed, consumption) | Baltic Exchange index vessel descriptions | Free | 🟢 | **Use this as the primary vessel dataset** — it is published, citable, and standard |
| Individual vessel particulars (IMO, name, dwt, dims) | IMO GISIS (free account), Equasis (free account, ToS-limited) | Free w/ registration | 🟡 | Registration is allowed; bulk redistribution is not |
| Fleet size by class over time | UNCTAD Review of Maritime Transport / UNCTADstat | Free | 🟢 | Use as the **supply proxy** |
| Live vessel positions / open positions | AIS providers, broker position lists | ❌ Paid | 🔴 | Do not fake. See §16 |

### 9.5 Commodity & Macro

| Dataset | Source | Free? | Format | Avail | Notes |
|---|---|---|---|---|---|
| India coal imports, country-wise | data.gov.in resource "Country-wise Details of Import of Coal" (2019-20 → 2023-24) | Free (GoI OGDL) | CSV | 🟢 | Confirmed live |
| Coal import/export statistics | Coal Controller's Organisation (coalcontroller.gov.in) | Free | PDF/HTML | 🟡 | **Note: CCO states Provisional Coal Statistics have been discontinued since 2021-22** — use Ministry of Coal statistics pages and IPA monthly port data instead |
| Monthly coking/thermal coal handled by major ports | IPA monthly release | Free | PDF | 🟡 | This is the most usable *monthly* demand series for our lanes |
| India import trade by HS code & partner | Ministry of Commerce Export-Import Data Bank (tradestat); UN Comtrade (free tier + API key) | Free | Web/API | 🟡 | HS 2701 (coal), 2601 (iron ore) |
| Coal prices (Australia, South Africa, Colombia), iron ore, crude (Brent/Dubai/WTI) | **World Bank "Pink Sheet"** monthly workbook | Free, no key | XLSX | 🟢 | Confirmed: 71 monthly series back to 1960; note the download URL carries a hash that changes monthly — discover it from the Commodity Markets page rather than hard-coding |
| Bunker fuel prices (VLSFO/IFO380, Singapore) | Public bunker price pages; EIA for crude proxies | Free to view | HTML | 🟡 | If the bunker series is hard to license, **derive bunker from Brent with a fitted spread and label it derived** |
| USD/INR | RBI reference rate | Free | CSV/HTML | 🟢 | |
| India IIP / steel production | MoSPI; Joint Plant Committee | Free | Excel | 🟢 | Demand-side feature |
| China steel/coal demand indicators | National Bureau of Statistics of China; World Bank | Free | Web | 🟡 | Optional — include only if it improves validation |

### 9.6 Weather

| Dataset | Source | Free? | Avail | Notes |
|---|---|---|---|---|
| Wave height/period/direction, swell, ocean currents | **Open-Meteo Marine Weather API** | Free, **no API key**, non-commercial | 🟢 | Confirmed: global wave models, hourly variables, includes historical access |
| Wind, visibility, precipitation | Open-Meteo Forecast + Historical (ERA5-backed) API | Free, no key | 🟢 | Historical back to 1940 for climatology |
| Cyclone warnings & bulletins, Bay of Bengal | India Meteorological Department (mausam.imd.gov.in), RSMC New Delhi | Free | 🟡 | Authoritative for Indian waters; bulletins are HTML/PDF |
| Historical cyclone tracks | IBTrACS (NOAA) | Free | 🟢 | Perfect for building a monthly cyclone-risk climatology |

---

## 10. Data Sources — annotated and verified

Consolidated list with what each is actually good for. All checked September 2026.

**Freight**
- `balticexchange.com` — index methodology and the **standard vessel descriptions**. This is the single most valuable free page for our project: it hands us defensible Handysize/Supramax/Panamax/Capesize physical and consumption profiles, published by the body that defines the market.
- Public index mirrors (e.g. Stooq-backed chart sites) — daily BDI history. Verify a sample against a second source before trusting.
- ⚠️ Investing.com, Barchart, Statista: values are visible but **historical download is gated** (Barchart requires a Premier membership; Statista requires a paid account). Do not scrape around those gates. Use them for eyeball verification only.

**Indian ports**
- `paradipport.gov.in` — berth-wise draft notification PDFs **and** daily traffic reports. The daily reports are the crown jewel: each row carries vessel name, cargo, berth, draft, LOA, beam, tonnage, arrival time, ready-for-berth time, ETD, and a delay reason code (A = inadequate cargo stock, B = importer not ready, … H = terminal not ready). That single file lets us compute *observed* waiting time and turnaround and attribute delays to causes. Note the site has reorganised its file paths over time (older `/Writereaddata/...`, newer `/wp-content/uploads/...`) — write the fetcher to discover links from the listing page, not to guess URLs.
- `vizagport.com` / `vpt.shipping.gov.in` — allowable LOA/beam/draft tables for Inner and Outer Harbour including tide allowances; berth details; berthing programme.
- `ipa.org.in` — **the IPA site has migrated from ipa.nic.in**; reports and statistics live here. Monthly major-port performance is the source for commodity-wise traffic, turnaround time and pre-berthing detention.
- `shipmin.gov.in` (MoPSW) — annual reports, TAMP material, policy.
- `data.gov.in` — OGD Platform: port macro indicators, coal import by country.
- `ct.odisha.gov.in` — Odisha Directorate of Ports & IWT: official state description of Dhamra and Gopalpur including status and operator.
- Adani Ports pages for Dhamra, Gangavaram, Gopalpur — operator-published specifications.

**Origin ports**
- `msq.qld.gov.au` — Maritime Safety Queensland "Port Procedures and Information for Shipping" for Hay Point, Gladstone, Abbot Point. Government-published, downloadable in full or in sections. This is the gold standard for Queensland coal ports.
- `dbct.com.au` — Dalrymple Bay Coal Terminal shipping page: berth restrictions and terminal information booklet.
- `gpcl.com.au` — Gladstone Ports Corporation Port Handbook and trade statistics.
- `portofnewcastle.com.au` / Port Authority of NSW — Newcastle vessel size limits.
- USACE and US port authority pages for Hampton Roads / Baltimore channel depths.

**Macro & commodity**
- World Bank Commodity Markets ("Pink Sheet") — monthly XLSX, free, no key.
- RBI — FX reference rates.
- UN Comtrade — bilateral trade by HS code (free tier, API key by registration — registering is fine and is not circumvention).
- MoSPI, Joint Plant Committee — Indian industrial and steel output.
- UNCTADstat — world fleet by vessel type (our supply proxy).

**Weather**
- `open-meteo.com` Marine API — free, keyless, wave height/direction/period, swell components, ocean currents; global coverage; historical available.
- `mausam.imd.gov.in` — IMD cyclone warnings for the Bay of Bengal.
- NOAA IBTrACS — historical cyclone tracks for climatology.

**Routing**
- `searoute` (PyPI, Apache-2.0) — shortest sea route and distance between coordinates. **Read the caveat honestly:** the library states it is intended for realistic-looking route generation and visualisation, not for navigation. For distance-based fuel estimation at ±few-percent accuracy this is acceptable, and we say so in the UI and to the jury. Eurostat's `searoute` (Java) is the alternative if we want a second opinion.

**Competitive note.** Public GitHub repositories from other teams already exist for this exact problem statement. Assume the jury may have seen a generic "BDI forecast + port table" solution before ours. Our differentiation must be the simulator, the derived compatibility dataset, and the data provenance discipline — not the forecast.

---

## 11. Data Acquisition Strategy

### 11.1 Method selection rules

| If the source offers… | Use | Never |
|---|---|---|
| A documented API | API client with backoff and caching | Scraping the HTML front-end of that API |
| A downloadable CSV/XLSX | `requests` → `pandas.read_csv/read_excel` | Copy-paste |
| A well-formed HTML table on a public page that permits it | `pandas.read_html` | Headless browser automation to defeat protections |
| A text PDF | `pdfplumber` | OCR guessing when text extraction works |
| A scanned PDF | Manual transcription + a second-person check | Fabricating values |
| Login/paywall/CAPTCHA | **Stop.** Find an alternative or declare it unavailable | Any form of bypass |

### 11.2 Data Acquisition Matrix

| Data | Source | Method | Frequency | Owner |
|---|---|---|---|---|
| Baltic indices (BDI/BCI/BPI/BSI/BHSI) | Public index history | Scheduled download → CSV | Daily | M2 |
| Baltic standard vessel descriptions | Baltic Exchange page | Manual transcription, double-checked | Once | M3 |
| World Bank Pink Sheet | Commodity Markets page | Discover current XLSX link → `read_excel` | Monthly | M2 |
| Brent / bunker proxy | EIA / public price pages | Scheduled fetch | Daily | M2 |
| USD/INR | RBI | Scheduled fetch | Daily | M2 |
| India coal imports by country | data.gov.in resource | API/CSV download | On release | M2 |
| IPA monthly port performance | ipa.org.in reports | Download PDF → pdfplumber tables | Monthly | M3 |
| Paradip daily traffic report | PPA site listing page | Discover link → download PDF → parse | Daily | M3 |
| Paradip / Vizag berth constraints | Port marine dept PDFs | Download → parse → **manual verification** | On change | M3 |
| Scale of Rates (each port) | Port sites | Download PDF → manual table entry into `dim_port_tariff` | On revision | M3 |
| Origin port constraints | MSQ manuals, terminal handbooks | Download → manual entry | Once, re-check | M3 |
| Marine weather | Open-Meteo Marine API | API, cached | 6-hourly + climatology | M2 |
| Cyclone climatology | IBTrACS | One-time download | Once | M2 |
| Sea distances | `searoute` | Compute locally, cache to `dim_route` | Once | M3 |

### 11.3 Example acquisition patterns

These are *patterns*, not finished scrapers. We deliberately do not write a full scraper for a site whose exact DOM we have not inspected.

**A. Scheduled CSV/XLSX download with provenance**

```python
import hashlib, datetime as dt, requests, pandas as pd

HEADERS = {"User-Agent": "SIH26006-research/1.0 (contact: team@example.edu)"}

def fetch_tabular(url: str, kind: str = "csv", **kw) -> tuple[pd.DataFrame, dict]:
    r = requests.get(url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    meta = {
        "source_url": url,
        "retrieved_at": dt.datetime.now(dt.timezone.utc),
        "sha256": hashlib.sha256(r.content).hexdigest(),
        "status": r.status_code,
        "bytes": len(r.content),
    }
    from io import BytesIO
    df = pd.read_csv(BytesIO(r.content), **kw) if kind == "csv" \
         else pd.read_excel(BytesIO(r.content), **kw)
    return df, meta
```

**B. Discovering a link rather than guessing a URL** (needed for PPA daily reports and the Pink Sheet, both of which change paths)

```python
from bs4 import BeautifulSoup
from urllib.parse import urljoin

def find_links(listing_url: str, must_contain: str, ext: str = ".pdf") -> list[str]:
    r = requests.get(listing_url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    out = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.lower().endswith(ext) and must_contain.lower() in href.lower():
            out.append(urljoin(listing_url, href))
    return sorted(set(out))
```

**C. PDF table extraction (port daily traffic / berth notification)**

```python
import pdfplumber

def tables_from_pdf(path: str) -> list[list[list[str]]]:
    rows = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for tbl in page.extract_tables():
                rows.append(tbl)
    return rows
```

For the PPA daily report, expect a wide, irregular layout. Plan for a **hand-written row parser with explicit column anchors**, plus a strict validator: draft between 3 and 20 m, LOA between 80 and 400 m, beam between 10 and 65 m, arrival ≤ berthed ≤ sailed. Reject and log anything failing, never silently coerce.

**D. HTML tables where permitted**

```python
tables = pd.read_html(requests.get(url, headers=HEADERS, timeout=60).text)
```

**E. Keyless API (Open-Meteo Marine)**

```python
def marine(lat: float, lon: float, start: str, end: str) -> pd.DataFrame:
    p = {
        "latitude": lat, "longitude": lon,
        "start_date": start, "end_date": end,
        "hourly": "wave_height,wave_period,wave_direction,swell_wave_height",
        "timezone": "UTC",
    }
    r = requests.get("https://marine-api.open-meteo.com/v1/marine",
                     params=p, headers=HEADERS, timeout=60)
    r.raise_for_status()
    h = r.json()["hourly"]
    return pd.DataFrame(h).assign(time=lambda d: pd.to_datetime(d["time"]))
```

### 11.4 Manual verification protocol

A scraped number that nobody checked is a liability on stage. Protocol:

1. **Spot-check rule:** 10 randomly sampled rows per new parser, verified against the source PDF/page by a human, recorded in `docs/verification_log.md` with date, checker initials, and pass/fail.
2. **Two-source rule for headline numbers:** any figure that appears on the Executive Dashboard must be confirmed against a second independent source, or badged as single-source.
3. **Range assertions:** every numeric column gets a hard min/max in the cleaning layer. Violations are quarantined into `raw_rejected`, never dropped silently.
4. **Cross-field consistency:** e.g. a vessel with LOA 292 m should not have draft 8 m; a port call's sailed time must be after its berthed time.
5. **Change detection:** store the sha256 of every fetched file; if a constraint PDF changes hash, a human reviews the diff before the constraint table is updated.
6. **Screenshot the source** for anything used in the final pitch and keep it in `docs/evidence/`. If a site goes down on demo day, you still have the evidence.

---

## 12. Scraping / API / Download Strategy

### 12.1 The priority ladder (this is our stated policy)

```
1. Official API or documented open-data download   ← always first
2. Official published file (CSV / XLSX / PDF) from the data owner
3. Public dataset with an explicit open licence (data.gov.in OGDL, NLOD, CC-BY)
4. Permitted, low-rate scraping of a public page that does not forbid it
5. Manual curation by a human, with a verification log
────────────────────────────────────────────────────────────────
✗  Never: anything behind login, paywall, CAPTCHA, or robots disallow
```

### 12.2 Per-dataset method decision

| Dataset | Chosen method | Why not the alternative |
|---|---|---|
| Baltic indices | Download published history | Real-time licensed feed is paid; we don't need intraday |
| Pink Sheet | Download XLSX after link discovery | Hard-coded URL breaks monthly (hash in path) |
| Port berth constraints | PDF download + **manual entry** into a config table | Only ~7 destination + ~8 origin ports × a few berths each. Hand-entering ~150 rows once, verified, is faster *and* more reliable than a fragile parser |
| PPA daily traffic | Automated PDF parse | Daily cadence over months — worth automating |
| Scale of Rates | Manual entry | Complex slab structures; parsing is error-prone and the data rarely changes |
| Weather | API | Obvious |
| Sea distances | Compute locally | No API dependency on stage |

Note the deliberate asymmetry: **automate what is high-frequency, hand-curate what is low-frequency and high-stakes.** A jury asking "how do you know Paradip's coal berth draft?" gets "we read the port's own notification and two of us checked it," not "our scraper said so."

---

## 13. Data Licensing & Ethics

### 13.1 What we are allowed to use

- **Government open data** (data.gov.in under the Government Open Data Licence – India; MoPSW/IPA published reports; MSQ publications; NOAA/IBTrACS in the public domain; Norwegian NLOD data) — permitted, with attribution.
- **Public statistical releases** (World Bank, UNCTAD, RBI) — permitted under their terms, with attribution.
- **Keyless public APIs** with stated free-use terms (Open-Meteo, which is free for non-commercial use without a key) — permitted for a hackathon prototype; note the terms if this were ever commercialised.
- **Publicly posted port documents** (berth notifications, port handbooks, Scale of Rates) — reading and citing is fine; we store extracted *facts* and always link back to the source document.

### 13.2 What we will not do, and will say so

- No bypassing of CAPTCHAs, logins, paywalls or rate-limit protections.
- No scraping of sources whose terms of service forbid automated access (this explicitly rules out bulk-downloading historical index data from financial portals that gate it behind a paid tier).
- No redistribution of licensed datasets.
- No republishing of bulk vessel registry data obtained through a free account whose terms restrict redistribution.
- No "we found it on a torrent / a random aggregator" data.

### 13.3 Operational rules

- **robots.txt:** fetched and respected by every job. Implement with `urllib.robotparser`; if disallowed, the job refuses to run and logs it.
- **Rate limiting:** ≥ 2 s between requests to the same host; exponential backoff on 429/5xx; never parallelise against one host.
- **Identification:** a truthful User-Agent naming the project and a contact address.
- **Caching:** every fetch cached locally so re-runs don't re-hit the source.
- **Attribution:** a `REFERENCES.md` and an in-app "Data Sources" page listing every source, licence and retrieval date.

### 13.4 Commercial datasets — the honest position

Route-level voyage freight assessments (Platts, Argus, Baltic licensed routes), AIS in the Bay of Bengal, and broker position lists are all commercial. **We do not have them, we do not pretend to, and we do not simulate them and call them real.** Where they would improve the system, we say exactly what they would improve and by how much we'd expect (qualitatively). For a Ministry deployment, these are procurable — a 10-line slide on "what a production deployment would license" is a strength, not a weakness.

---

## 14. Port Dataset

### 14.1 Schema — `dim_port`

| Column | Type | Notes |
|---|---|---|
| port_id | TEXT PK | `INPRT`, `INVTZ`, `AUHPT` … (UN/LOCODE where it exists) |
| port_name | TEXT | |
| country | TEXT | |
| role | TEXT | `load` / `discharge` / `both` |
| lat, lon | NUMERIC | For map and distance |
| authority | TEXT | e.g. Paradip Port Authority |
| authority_type | TEXT | `major_port` / `state` / `private` |
| tidal_range_m | NUMERIC | |
| approach_channel_depth_m | NUMERIC | |
| monsoon_closure | BOOL | |
| seasonal_notes | TEXT | e.g. load-line zone, cyclone exposure |
| source_url, retrieved_at, verification | | Provenance (§8.2) |

### 14.2 Schema — `dim_berth` (the table that does the real work)

| Column | Type | Notes |
|---|---|---|
| berth_id | TEXT PK | |
| port_id | TEXT FK | |
| berth_name | TEXT | e.g. "Coal Berth-01", "EQ-7", "Western Dock-1" |
| cargo_types | TEXT[] | `{thermal_coal, coking_coal, iron_ore}` |
| max_loa_m | NUMERIC | |
| min_loa_m | NUMERIC | Some berths have a **minimum** LOA (Paradip's oil jetty does) |
| max_beam_m | NUMERIC | |
| max_draft_m | NUMERIC | |
| tide_allowance_m | NUMERIC | Vizag berths carry explicit +0.5/+1.0 m tide notes |
| max_dwt | NUMERIC | Where notified |
| berth_length_m | NUMERIC | |
| handling_rate_tpd | NUMERIC | Tonnes/day, by cargo |
| mechanised | BOOL | Shiploader/unloader vs. grabs/cranes |
| daylight_only | BOOL | Several berths are daylight-berthing only |
| coupling_constraint | TEXT | **Important.** e.g. "usable at 300 m LOA only if adjacent Iron Ore Berth vacant" |
| status | TEXT | `operational` / `under_construction` / `upgrading` |
| effective_from, effective_to | DATE | So we can version constraint changes |
| source_url, retrieved_at, verification | | |

`coupling_constraint` and the `effective_from/to` versioning are the two fields most teams will not have. They are also the two that make the dataset credible to anyone who has actually worked a port.

### 14.3 The seven PS-named East Coast ports — acquisition plan

| Port | Authority | Primary source for constraints | Congestion source | Tariff source | Status |
|---|---|---|---|---|---|
| **Paradip** | Paradip Port Authority (major) | PPA Marine Dept berth-wise LOA/beam/draft notification PDF | **PPA daily traffic report PDFs** — best-in-class | PPA Scale of Rates PDF | 🟢 All three confirmed available |
| **Visakhapatnam** | Visakhapatnam Port Authority (major) | VPA Marine Dept "restrictions and allowable drafts, inner & outer harbour" PDF + Harbour & Berth Facilities page | VPA berthing programme (working & expected vessels) | VPA Scale of Rates; VSPL indexed SoR for the private terminal | 🟢 / 🟡 |
| **Gangavaram** | Gangavaram Port Ltd (Adani) | Operator port page; Andhra Pradesh Maritime Board | Not published — model from class + traffic | Operator tariff (limited disclosure) | 🟡 constraints, 🟠 congestion |
| **Gopalpur** | Gopalpur Ports Ltd (Adani) | Operator page + Odisha Directorate of Ports & IWT | Not published | Limited | 🟡 / 🟠 |
| **Dhamra** | Dhamra Port Company (Adani) | Operator page + Odisha Directorate of Ports & IWT | Not published | Limited | 🟡 / 🟠 |
| **Sagar / Sandheads** | SMPK (anchorage, not a berth) | SMPK marine notices; pilotage station info | Derived from Haldia | SMPK SoR incl. lighterage/anchorage charges | 🟡 |
| **Haldia (HDC)** | Syama Prasad Mookerjee Port, Kolkata (major) | SMPK Marine Dept trade notices + HDC berth pages | SMPK/IPA monthly; trade notices | SMPK Scale of Rates | 🟡 — **and it changes often** |

### 14.4 Haldia and Sandheads need special treatment

This is the most interesting port in the problem statement and the one most teams will get wrong.

- Haldia is a **river/lock port**, roughly 9 m maximum draft, and is fundamentally a Handysize port. Panamaxes are taken only part-loaded at roughly 40–50% of capacity.
- Larger parcels are **lightened at Sagar / Sandheads anchorages** using floating cranes before the balance goes upriver, or are discharged there entirely into barges.
- Permissible drafts are adjusted by SMPK **trade notices**, including night-tide and fog-season restrictions that have gone as low as ~7.2 m for certain arrivals.
- Haldia sits ~120–130 km from Sandheads, so lighterage adds a real, quantifiable transit and cost term.

Our model therefore treats Haldia as a **two-mode port**:

```
mode = direct_berth       if vessel_draft ≤ current_permissible_draft
mode = lighterage_sandheads otherwise (if cargo allows)

cost_lighterage = tonnes_lightened × rate_per_tonne
                + extra_days × (berth_hire_or_demurrage)
                + anchorage_charges
extra_days      = tonnes_lightened / floating_crane_rate_tpd + transit_allowance
```

Being able to say "our system knows Haldia needs Sandheads lighterage and prices it" is a differentiator no generic dashboard will have.

### 14.5 Handling infrastructure change

Paradip berthed its first Capesize at 16.5 m draft in September 2026, at a Western Dock berth that did not exist in earlier notifications. Ports dredge, mechanise and commission berths continuously. Our design response:

1. Constraints live in `dim_berth` with `effective_from` / `effective_to` — a change is an INSERT, not an UPDATE, so history is preserved and old recommendations remain explainable.
2. A `constraint_watch` job hashes each source PDF weekly; a hash change raises a review task.
3. The UI shows `constraints as of <date>` on the Port Intelligence page.

This is the answer to jury question 10 and it is a *design* answer, not a promise.

---

## 15. Vessel Dataset

### 15.1 Schema — `dim_vessel_class` (the primary table)

| Column | Example (Panamax) | Source |
|---|---|---|
| class | Panamax | — |
| ref_dwt | 82,500 | Baltic BPI standard vessel description |
| ref_draft_m | 14.43 (SSW) | Baltic |
| ref_loa_m | 229 | Baltic |
| ref_beam_m | 32.25 | Baltic |
| speed_laden_kn | 13.5 | Baltic |
| speed_ballast_kn | 14.0 | Baltic |
| cons_laden_mt_day | 33 (IFO 380) + 0.1 MGO | Baltic |
| cons_ballast_mt_day | 31 (IFO 380) + 0.1 MGO | Baltic |
| max_age_yrs | 12 | Baltic |
| geared | false | Baltic |
| typical_dwt_range | 65,000–100,000 | Market convention |
| index_code | BPI | — |

Handysize is populated identically from the BHSI 38 description (38,200 dwt on 10.538 m SSW, LOA 180 m, beam 29.8 m, 5 holds / 5 hatches, 4 × 30 t cranes, 14 kn laden on 26 mt IFO, 12 kn on 18 mt). Supramax and Capesize come from the BSI and BCI standard descriptions on the same page.

**Why this matters enormously:** it gives us vessel physical and fuel-consumption parameters that are *published by the Baltic Exchange as the definition of the index we are forecasting*. That is internally consistent — we forecast BPI, and we cost a vessel that *is* the BPI vessel. No juror can call it made up.

### 15.2 Schema — `dim_vessel` (optional, individual ships)

| Column | Notes |
|---|---|
| imo | From IMO GISIS / Equasis (free registration) |
| name, flag, built_year | |
| dwt, loa_m, beam_m, summer_draft_m | |
| class_inferred | Mapped by DWT bands |
| gross_tonnage | **Needed for port dues and berth hire**, which are charged per GRT |
| source, verification | |

### 15.3 Building a real vessel sample for free — from our own port data

Here is a clean trick that costs nothing. The **Paradip daily traffic reports already contain real vessel names with draft, LOA, beam and tonnage** for every ship that called. Parsing a year of those reports gives us:

- A genuine sample of the vessels actually calling at Paradip
- Their real dimensions as recorded by the port
- Their real cargo types and quantities
- Their real waiting and turnaround times

That is a *real, verifiable, India-specific vessel dataset* derived from an official source, and it is simultaneously our congestion dataset. Very few teams will think to do this.

### 15.4 Recommended approach: **both, in a specific order**

| Option | Verdict |
|---|---|
| 1. Real individual vessels only | ❌ No. Free vessel particulars are obtainable but *availability and open positions are not*, so a "real vessel" list gives false precision about which ships you could actually charter. |
| 2. Standard representative profiles only | ✅ Correct foundation. Baltic standard descriptions. Defensible, consistent with the forecast target, sufficient for cost and feasibility modelling. |
| 3. Both | ✅✅ **Recommended.** Use standard profiles as the modelling backbone; layer the real vessels harvested from PPA daily reports as (a) empirical validation that our class profiles match reality at Paradip, and (b) a compelling "here are actual ships that did this" panel in the demo. |

Stated plainly in the pitch: *"We model at class level using the Baltic Exchange's own standard vessel definitions, and we validate those profiles against the real vessels that actually called at Paradip, taken from the port's published daily traffic reports."*

### 15.5 Vessel availability — the honest treatment

We cannot observe which ships are open and where. So we do not claim to. Instead:

```
availability_proxy(class, month) =
      w1 · z(fleet_size_growth[class])            # UNCTAD world fleet
    + w2 · (−z(index_level[class]))               # high index ⇒ tight supply
    + w3 · (−z(index_momentum[class]))            # rising ⇒ tightening
    + w4 · (−z(port_queue_len[origin_region]))    # ships queued are not available
```

Surfaced in the UI as **"Vessel availability signal: TIGHT / NORMAL / LOOSE (derived indicator — not a live position list)."** Honest, useful, and un-attackable.

---

## 16. AIS Dataset

### 16.1 What AIS would give us

Position, timestamp, SOG, COG, heading, reported destination, draught, MMSI/IMO — from which you derive port arrival, berthing, departure, anchorage dwell, queue length, and therefore congestion and vessel availability.

### 16.2 What is actually free — and the hard finding

Free, openly licensed historical AIS exists, but **only for specific national waters**:

- **Denmark** — Danish Maritime Authority publishes historical AIS for download.
- **Norway** — Norwegian Coastal Administration provides AIS within the Norwegian economic zone, free and without registration, under the Norwegian Licence for Open Government Data (NLOD), with some vessel-size exclusions.
- **United States** — NOAA Office for Coastal Management publishes historical AIS as downloadable CSVs.

**None of these cover the Bay of Bengal, the Indian East Coast, or our origin lanes.** Terrestrial and satellite AIS for our region is a commercial product.

### 16.3 What we do instead

This constraint turns out to be an advantage, because the substitute is *better documented* than AIS would be:

| AIS-derived quantity | Our substitute | Source |
|---|---|---|
| Port arrival time | `arrival` field in PPA daily traffic report | Official port record |
| Ready-for-berth time | Explicit column in the same report | Official |
| Berthing time | Explicit | Official |
| Waiting time | `berthed − ready_for_berth` — **computed from the port's own record, not inferred from GPS** | Official |
| Turnaround | `sailed − arrival` | Official |
| Delay cause | Reason code A–H in the report | Official — **AIS cannot give you this at all** |
| Queue length | Count of "expected/waiting vessels" section | Official |
| Vessel dimensions | Draft/LOA/beam columns | Official |

The pitch line: *"We don't use AIS in the Bay of Bengal because no free, legally usable feed covers it. We use something better for this purpose — the ports' own published daily traffic records, which give us not just how long ships waited but why."*

### 16.4 If we wanted AIS anyway

Options and their honest status:

- **AISHub** — community feed; access is granted in exchange for contributing your own receiving station. We do not have a station on the Odisha coast, so this is not realistically available to us.
- **Commercial providers** (Spire, MarineTraffic, VesselFinder, Kpler) — paid APIs. 🔴
- **Satellite AIS research datasets** — occasionally published for specific studies; region-limited.

We will **not** scrape a vessel-tracking website's map interface. That is exactly the kind of access-control circumvention the rules forbid, and it is also the fastest way to lose credibility with a technically literate juror.

### 16.5 Legal and ethical note (worth one slide)

AIS is a safety-of-navigation broadcast. Using it for logistics analytics is common and legal, but re-publishing vessel-level tracks can raise commercial-confidentiality and, in some jurisdictions, security concerns. Our system aggregates to port-and-class level and never publishes an individual vessel's movement history.

---

## 17. Freight Dataset

### 17.1 What we ingest

| Series | Granularity | Role |
|---|---|---|
| BDI | Daily | Market regime feature; headline tile |
| BCI, BPI, BSI, BHSI | Daily | **Per-class forecast targets** |
| Class TC average earnings ($/day) | Daily | Converts index level into a daily hire cost for the cost model |
| Baltic route definitions | Static | Justifies the lane mapping |

### 17.2 Relevant Baltic routes for our five origins

The Baltic's dry indices are built from named routes. The ones that matter to us:

| Our lane | Closest Baltic reference | Why it is a reasonable anchor |
|---|---|---|
| Australia (Queensland/NSW) → East Coast India | Capesize Australia–China iron ore route (C5-type) and Panamax Pacific round-voyage routes (P3A-type) | Same basin, similar distance class, same fleet competing for the cargo |
| Indonesia → East Coast India | Panamax/Supramax Indonesia-origin coal routes (P5/S-type Pacific) | Direct — Indonesian coal routes are explicitly represented in the Panamax and Supramax baskets |
| Mozambique → East Coast India | Supramax/Panamax South Africa/Indian Ocean routes | Same ocean basin, comparable voyage length |
| US East Coast/Gulf → East Coast India | Panamax Atlantic-to-Far-East routes (P2A-type), Capesize transatlantic legs | Long-haul Atlantic→Pacific; these are the fronthaul routes in the basket |
| Russia (Far East) → East Coast India | Pacific Panamax/Supramax routes | Short Pacific haul; **plus an explicit route-risk flag** |

**Crucially, we state that these are anchors, not exact quotations.** Which leads to the next section.

### 17.3 The honest gap

There is **no free, public, historical, route-level $/tonne voyage freight series for "Hay Point → Paradip, Panamax."** That data is sold by Platts, Argus and the Baltic Exchange under licence. Any team claiming to have it for free either has an unlicensed copy or is confusing an index level with a freight rate.

We say this out loud. Then we solve it.

### 17.4 Shadow Freight Model (our defensible fallback)

**Objective:** produce a route-level $/tonne estimate with an uncertainty band, built only from data we legitimately have.

A voyage rate for a charterer is, economically, the owner's required daily earnings plus voyage costs, spread over the cargo:

```
Freight_$/t (route r, class c, date t)

      TCE_c(t) × Days_r,c   +   Bunker_r,c(t)   +   PortCosts_r,c   +   Ballast_r,c(t)
  =  ───────────────────────────────────────────────────────────────────────────────
                                  Cargo_r,c
      × (1 + margin_r,c)
```

Where:

| Term | How we get it |
|---|---|
| `TCE_c(t)` | Baltic class TC average earnings, $/day — published daily |
| `Days_r,c` | `distance_nm / (speed_kn × 24)` + port days at both ends + weather allowance. Distance from `searoute`; speed from Baltic standard vessel description |
| `Bunker_r,c(t)` | `(laden_days × cons_laden + ballast_days × cons_ballast) × bunker_price(t)` — consumption from Baltic standard description, price from bunker/Brent series |
| `PortCosts_r,c` | From published Scale of Rates at the discharge port + published/estimated load-port dues, as a function of GRT |
| `Ballast_r,c(t)` | Expected repositioning leg, from a backhaul-availability assumption per lane (stated explicitly) |
| `Cargo_r,c` | Min(class capacity, draft-limited intake at the constraining port) — **this is where port constraints enter the freight number itself** |
| `margin_r,c` | A single calibration parameter per lane |

**Calibration and validation — this is the part that makes it defensible:**

1. Apply the identical formula to a **Baltic route whose $/tonne assessment IS publicly reported** (voyage-rate routes such as the Capesize Australia–China iron ore route are widely quoted in public market commentary). Fit `margin` so our reconstruction tracks the published series.
2. Report the reconstruction error (MAPE) on that known route. **That error is our honesty metric**: "our shadow model reproduces a route we can check to within X%; we therefore quote our unchecked routes with a band at least that wide."
3. Propagate that error into the confidence interval for every derived route.

This is a genuinely strong answer to "why should I believe your route freight?" — because we *can* show the method reproducing a route that is publicly observable.

**Everything the shadow model produces is badged `derived` in the API and the UI.**

### 17.5 Feature set for the forecasting models

| Group | Features |
|---|---|
| Autoregressive | lags 1,2,3,5,7,10,14,21,30,60 of the target index; log-returns |
| Rolling | mean/std/min/max over 7/14/30/60/90; realised volatility (std of log returns, 20d) |
| Cross-class | BCI/BPI, BPI/BSI, BSI/BHSI ratios and spreads; BDI level and its deviation from its 90d mean |
| Momentum | 5d, 20d, 60d rate of change; distance from 52-week high/low |
| Energy | Brent level & 30d change; bunker proxy; bunker/freight ratio |
| Commodity | Australian & South African coal prices; iron ore price; 3-month changes |
| FX/macro | USD/INR; India IIP (lagged to publication date) |
| Demand | Monthly coking + thermal coal tonnes at East Coast major ports (lagged to release) |
| Seasonality | month dummies; Fourier terms (K=3, annual); week-of-year |
| Regime | rolling volatility percentile; drawdown from rolling max |

### 17.6 Distance table

Computed once with `searoute` for every (origin_port, destination_port) pair and cached in `dim_route`. Store `distance_nm`, `via_passages`, `computed_by`, `caveat`. The caveat text is shown in a tooltip: *"Great-circle-constrained maritime routing estimate; not for navigation."* Sanity-check three pairs against published nautical distance references and record the deltas in the verification log.

---

## 18. Commodity Dataset

### 18.1 MVP (required)

| Dataset | Why | Source | Avail |
|---|---|---|---|
| Monthly coking coal + thermal coal tonnes handled at Indian major ports | **The demand variable for our lanes.** Directly relevant, monthly, port-level | IPA monthly performance release | 🟡 |
| India coal imports by origin country, annual | Establishes lane shares (Australia, Indonesia, US, Russia, Mozambique) | data.gov.in country-wise coal import resource | 🟢 |
| Australian thermal coal price, South African coal price | Cargo value; drives the willingness to pay freight | World Bank Pink Sheet | 🟢 |
| Iron ore price | Second dry-bulk driver; strongly linked to Capesize | Pink Sheet | 🟢 |

### 18.2 Should-have

| Dataset | Why | Source | Avail |
|---|---|---|---|
| HS-2701 imports by partner country, monthly | Finer lane-level demand | Ministry of Commerce Export-Import Data Bank; UN Comtrade API (free key) | 🟡 |
| Coking coal (hard coking, FOB Australia) price | Distinguishes coking from thermal economics | Public market commentary; Pink Sheet has limited coking coverage | 🟡 |
| Indian steel production (crude steel, monthly) | Demand driver for coking coal | Joint Plant Committee / MoSPI | 🟢 |

### 18.3 Optional / skip for MVP

Bauxite, limestone, fertiliser, grain flows; Chinese port coal inventories (would be genuinely informative but the reliable series are commercial); Indonesian HBA reference price (useful but adds scope).

**Explicit note:** the Coal Controller's Organisation states that **Provisional Coal Statistics have been discontinued since 2021-22**. Do not build a pipeline against that publication expecting current data. Use Ministry of Coal statistics pages plus the IPA monthly port series instead. This is exactly the kind of check that separates a verified blueprint from a guessed one.

---

## 19. Macro Dataset

### 19.1 Which variables actually earn their place

| Variable | Contribution to freight forecasting | Keep? |
|---|---|---|
| **Brent / Dubai crude** | Drives bunker, which is a large voyage cost and directly affects owner economics and speed decisions | ✅ Strong |
| **Bunker fuel price (VLSFO/IFO380)** | The direct cost term; better than crude if obtainable | ✅ Strong (derive from Brent if needed, labelled) |
| **Coal prices (Australia, South Africa)** | Cargo value ⇒ arbitrage ⇒ tonne-mile demand | ✅ Moderate–strong |
| **Iron ore price** | Primary Capesize demand driver | ✅ Strong for BCI |
| **USD/INR** | Doesn't move global freight, but **is essential to convert the answer into rupees for an Indian user** | ✅ Keep for output, not as a predictor |
| **Seasonal indicators** (month, Fourier, monsoon flag) | Real, robust seasonality in both freight and Indian port throughput | ✅ Strong |
| **India IIP / steel production** | Domestic demand for imported coal | ✅ Moderate |
| **China steel PMI / coal imports** | China dominates global dry-bulk demand | 🟡 Include only if it improves time-aware validation — it often adds noise at daily frequency |
| **Global trade volume indices (CPB World Trade Monitor)** | Too low-frequency and too lagged to help a 4-week forecast | ❌ Cut |
| **Interest rates** | Affects ordering and scrapping over years, not a 4-week freight move | ❌ Cut |
| **Equity indices / shipping stocks** | Reflect freight rather than lead it; risk of reverse causality | ❌ Cut |

### 19.2 The discipline

Every macro feature must pass a **time-aware ablation test**: train with and without it on the same expanding-window validation split; keep only if it improves validation MAE for that target by more than the standard error of the estimate. Record the result in `docs/feature_ablation.md`. Then when a juror asks "why is USD/INR in your model?" the answer is "it isn't — we tested it and it didn't help; we use it only to convert the output to rupees."

### 19.3 Publication-lag handling (leakage control)

Macro series are revised and published with a lag. Every macro feature carries a `available_from` date and the feature store uses `available_from ≤ as_of`, never the reference-period date. Getting this wrong is the single most common way a hackathon forecast looks brilliant in validation and fails on stage.

---

## 20. Weather Dataset

### 20.1 Sources

| Need | Source | Access |
|---|---|---|
| Significant wave height, wave period, direction, swell components, ocean currents | **Open-Meteo Marine Weather API** | Free, **no API key**, global 0.25° from NOAA GFS Wave / DWD ICON Wave / ECMWF WAM; historical available |
| Wind speed/gusts/direction, visibility, precipitation | Open-Meteo Forecast + Historical (ERA5) API | Free, no key, historical back to 1940 |
| Cyclone warnings, Bay of Bengal | India Meteorological Department / RSMC New Delhi | Free, HTML/PDF bulletins |
| Historical cyclone tracks | NOAA IBTrACS | Free download |

### 20.2 How weather becomes a feature

Weather enters in three distinct places, and keeping them distinct is what makes it credible.

**(a) Port-level weather-stop climatology** — built once from historical data:

```
P_stop(port, month) = fraction of hours where
        wind_speed > W_thresh  OR  wave_height > H_thresh
```

with thresholds set per port from its exposure (an open roadstead like Gopalpur stops at lower wave heights than a lock-protected berth at Haldia). Feeds the cost model as expected stopped hours during cargo work.

**(b) Route-level voyage weather margin:**

```
weather_days(route, month) = distance_nm / speed_kn / 24 × margin(route, month)
margin = f(mean significant wave height along the route in that month)
```

A monsoon-season Bay of Bengal crossing gets a larger margin than a February one. This lengthens the voyage, which increases both bunker cost and deadline risk.

**(c) Near-term cyclone alert** — a live binary/severity signal from IMD bulletins, shown on Page 7 and applied as a temporary multiplier on the weather-risk component of the Risk Engine.

### 20.3 Seasonal calendar to encode

| Period | Phenomenon | Impact |
|---|---|---|
| Jun–Sep | Southwest monsoon | Swell, cargo-work stoppages, reduced visibility |
| Oct–Dec | **Post-monsoon cyclone peak, Bay of Bengal** | The highest-severity disruption window for East Coast ports |
| Apr–Jun | Pre-monsoon cyclone season | Secondary peak |
| Dec–Feb | Fog on the Hooghly | **Directly causes the Haldia night-tide draft restrictions** |
| Dec 1–Apr 30 | Tropical load-line zone (Paradip area) | Affects permissible loaded draft |

That last row is a nice detail: load-line zones change how deep a ship may legally load, which changes cargo intake, which changes the number of voyages. Almost nobody at a hackathon models this.

---

## 21. Derived Dataset — East Coast India Port–Vessel–Cargo Compatibility

### 21.1 Why build this

This is our second differentiator after the simulator, and it is genuinely proprietary in the sense that matters: it does not exist anywhere as a downloadable file, it requires domain reasoning to construct, it is built entirely from official sources, and it is immediately useful.

### 21.2 Structure

One row per combination:

```
port × berth × vessel_class × cargo_type × season
```

| Column | Type | Source |
|---|---|---|
| port_id, berth_id, vessel_class, cargo_type, season | keys | — |
| feasible | BOOL | Hard constraint evaluation |
| infeasible_reason | TEXT | `draft` / `loa` / `beam` / `cargo_not_handled` / `berth_unavailable` |
| max_intake_t | NUMERIC | Draft-limited cargo intake |
| intake_ratio | NUMERIC | `max_intake_t / class_ref_dwt` |
| handling_rate_tpd | NUMERIC | Berth handling rate for that cargo |
| est_cargo_days | NUMERIC | `max_intake_t / handling_rate_tpd` |
| est_wait_hours_p50 / p90 | NUMERIC | From congestion model |
| est_turnaround_days | NUMERIC | wait + cargo + tide/weather allowances |
| weather_stop_frac | NUMERIC | §20.2(a) |
| requires_lighterage | BOOL | Haldia/Sandheads logic |
| compat_score | 0–100 | §21.4 |

### 21.3 Computing draft-limited intake (the engineering core)

```
allowed_draft = berth.max_draft_m + berth.tide_allowance_m − UKC_m
UKC_m         = max(0.5, 0.10 × vessel_static_draft)     # 10% UKC convention; stated assumption

if allowed_draft ≥ class.ref_draft_m:
        max_intake_t = class.ref_dwt − constants_t       # bunkers, stores, fresh water
else:
        draft_deficit = class.ref_draft_m − allowed_draft
        max_intake_t  = class.ref_dwt − constants_t − (draft_deficit × 100 × TPC_t_per_cm)
```

`TPC` (tonnes per centimetre immersion) is published in the Baltic standard vessel descriptions — BHSI 38 lists TPC 49, BPI 82 lists TPC 70.5. So the deadweight-vs-draft relationship comes from the same authoritative source as everything else, rather than being invented. Clamp at zero and mark infeasible if intake falls below a commercially sensible minimum (e.g. < 50% of class dwt ⇒ flag "severe part-load").

### 21.4 The compatibility score — avoiding arbitrary weights

Do **not** invent seven weights. Build the score as a product of interpretable efficiency ratios, each in [0,1]:

```
compat_score = 100 × feasible
             × U_cargo^a  × U_time^b  × U_cost^c  × U_reliability^d

U_cargo       = max_intake_t / class_ref_dwt                     # how much of the ship you can use
U_time        = est_cargo_days / est_turnaround_days             # productive time ÷ total time
U_cost        = min(1, cost_ref / cost_here)                     # cost vs. best feasible option
U_reliability = 1 − weather_stop_frac × season_exposure
```

with `a=b=c=d=1` by default (pure geometric mean, no tuning at all) and exponents exposed only as an advanced option. Every factor is a ratio with physical meaning, so the score is explainable line by line:

> `[DEMO]` **Paradip + Supramax + Coking Coal + Post-monsoon = 94/100**
> Feasible ✓ · uses 98% of vessel capacity · 81% of port time is productive · cost within 4% of best option · 2% weather-stop exposure
>
> `[DEMO]` **Paradip + Capesize + Coking Coal + Post-monsoon = 71/100**
> Feasible ✓ (Western Dock, 16.5 m) · uses 96% of capacity · but only 58% of port time productive (longer queue, tide window) · 11% weather exposure
>
> `[DEMO]` **Haldia + Panamax + Coking Coal + Winter = 38/100**
> Feasible only at ~45% intake · requires Sandheads lighterage · lighterage adds days and cost · fog-season night-tide draft restriction

Those three cards alone make the point of the entire project in one screen.

### 21.5 Size

7 destination ports × ~4 berths avg × 4 classes × 3 cargo types × 4 seasons ≈ **1,300 rows**, plus origin ports. Small, fast, fully precomputable, and shippable as a CSV artefact the team can show and defend.

---

## 22. Freight Forecasting

### 22.1 Targets

Per vessel class: the class index (BCI, BPI, BSI, BHSI) and, derived from it, the class TC average in $/day. Forecast horizons: **h = 7, 14, 28 days (short-term)** and **h = 60, 90, 180 days (medium-term)**.

We forecast **log-level** (or log-return and cumulate) to keep the series positive and the errors multiplicative.

### 22.2 The model ladder — and the rule about stopping

Build in this order. **Do not advance a rung unless it beats the previous one on the same validation protocol.**

| Rung | Model | Purpose |
|---|---|---|
| 0 | **Naïve** `ŷ(t+h) = y(t)` | The number to beat. For a near-efficient market this is a *strong* baseline at short horizons and admitting so is a mark of competence |
| 1 | **Drift / moving average** | Cheap trend |
| 2 | **Seasonal naïve** | Captures annual pattern |
| 3 | **Ridge / linear on lagged + exogenous** | Interpretable, hard to overfit |
| 4 | **SARIMA / SARIMAX** | Classical benchmark with a principled interval |
| 5 | **LightGBM** (direct multi-horizon, one model per horizon) | Primary; handles nonlinearity and exogenous features |
| 6 | **LightGBM quantile** (α = 0.1, 0.5, 0.9) + conformal calibration | Prediction intervals |
| 7 | LSTM / TFT | **Only if** rungs 5–6 are clearly beaten on the same splits. For ~5,000 daily observations this is very unlikely, and we should say so |

**The rule we state to the jury:** *"The PS mentions AI. We used the simplest model that won. Deep learning did not win on this data size, so we did not ship it. If a naïve baseline beats us at 7 days, we report that rather than hide it."* That answer is far stronger than a neural network nobody can validate.

### 22.3 Splits and leakage control

```
Train           : 2015-01-01 → 2022-12-31
Validation      : 2023-01-01 → 2024-12-31   (expanding-window walk-forward, refit monthly)
Test (held out) : 2025-01-01 → present      (touched exactly once, at the end)
```

Leakage controls, each one a checkbox in the PR template:

- **No shuffling. Ever.** Time-ordered splits only.
- All features at time *t* use only data with `available_from ≤ t`, accounting for publication lags.
- Scalers/encoders fitted on train only, inside the CV fold.
- No target-derived features that peek forward (no centred rolling windows).
- Gap of `h` days between train end and validation start for horizon `h`, so the model cannot see overlapping outcomes.
- The test period is opened once. If we touch it twice, it stops being a test set and we say so.

### 22.4 Metrics

| Metric | Use |
|---|---|
| **MAE** | Primary, in index points — interpretable |
| **RMSE** | Penalises large misses; report alongside |
| **MAPE** | Reportable here because index values are comfortably away from zero |
| **MASE** (vs. naïve) | **The one that matters**: MASE < 1 means we beat the naïve baseline. Report per class per horizon |
| **Directional accuracy** | % of times we got the sign of the move right — this is what a chartering manager actually acts on |
| **Interval coverage** | Does the 80% interval contain the truth 80% of the time? |
| **Pinball loss** | Proper scoring rule for the quantile forecasts |

Publish a full grid: 4 classes × 6 horizons × {MAE, RMSE, MAPE, MASE, coverage}. A completed grid, including the cells where we lose, is more persuasive than a single flattering number.

### 22.5 Prediction intervals and the confidence score

Quantile LightGBM gives raw intervals; these are typically over-confident. Calibrate with **split conformal prediction**:

1. Hold out a calibration slice (the most recent 20% of training).
2. Compute nonconformity scores `s_i = max(q_lo(x_i) − y_i, y_i − q_hi(x_i))`.
3. Take the ⌈(n+1)(1−α)⌉-th smallest score as `Q`.
4. Final interval: `[q_lo − Q, q_hi + Q]`.

This gives intervals with a **finite-sample coverage guarantee under exchangeability**, which is a real, citable property — and a very good answer to "how do I know your confidence number means anything."

**Confidence score shown to the user:**

```
confidence = 100 × (1 − clamp( interval_width / (2 × median_abs_level), 0, 1 ))
             × recent_coverage_factor
```

where `recent_coverage_factor` down-weights confidence if the last 60 days' realised coverage has been below nominal. So confidence falls automatically when the model has recently been wrong — which is exactly when it should.

### 22.6 Output contract

Never a bare number:

```json
{
  "vessel_class": "Supramax",
  "index": "BSI",
  "as_of": "2026-09-15",
  "horizon_days": 28,
  "point": 1652,
  "interval_80": [1548, 1771],
  "confidence": 0.81,
  "trend": "increasing",
  "usd_per_tonne_derived": {"low": 24.1, "point": 25.4, "high": 27.0,
                            "provenance": "derived", "model": "shadow_freight_v1"},
  "baseline_mase": 0.88,
  "drivers": [
    {"feature": "bsi_lag_7", "shap": 0.42},
    {"feature": "coking_coal_tonnes_east_coast_m3", "shap": 0.19},
    {"feature": "bunker_proxy_30d_change", "shap": -0.11}
  ]
}
```

Displayed as: **Forecast $24–27/t · Expected $25.4 · Confidence 81% · Trend: Increasing.**

### 22.7 Explainability

SHAP values per prediction, aggregated to the top 3 drivers and rendered as plain sentences on Page 3: *"Supramax rates are forecast higher mainly because the index has risen over the past week and East Coast coking-coal volumes were above seasonal norm last month; falling bunker prices partly offset this."*

---

## 23. Charter Opportunity Score

### 23.1 What it must not be

A weighted sum of nine hand-picked numbers with weights chosen because they look nice. A juror will ask where 0.15 came from and there will be no answer.

### 23.2 What it is instead: a normalised cost-advantage score

Define the score as the **percentile position of today's expected risk-adjusted cost within the distribution of expected costs across the feasible decision window.** That is, it answers a real question: *how good is today, relative to the other days you could act?*

```
For the requirement Q with deadline D and feasible charter dates t ∈ [today, D − lead_time]:

    C(t) = risk-adjusted total logistics cost if we commit on date t
           (from the simulator, §28)

    COS(today) = 100 × ( 1 − rank_percentile( C(today) among { C(t) } ) )
```

- `COS = 95` ⇒ committing today is better than 95% of the remaining days in the window.
- `COS = 20` ⇒ four out of five remaining days look better; **wait**.

Properties that make this defensible:
- **No invented weights.** The only judgement calls are `λ` (risk aversion) and `M` (deadline-miss penalty), both user-visible.
- **It is decision-relative.** It is not "the market is good," it is "acting today is good *for your cargo, your deadline, your ports*."
- **It degrades gracefully.** If the window is short, the score correctly becomes less meaningful, and we show the window width beside it.

### 23.3 Attribution

We still owe the user a *why*, so decompose the gap between today's cost and the best day's cost:

```
Δ_total = C(today) − min_t C(t)
        = Δ_freight + Δ_waiting + Δ_weather + Δ_bunker + Δ_deadline_risk
```

Each Δ is computed by re-running the simulator holding all other components at today's values (a one-at-a-time decomposition). Rendered as a waterfall chart. This is honest — it is a decomposition of an actual computed quantity, not a made-up weighting.

### 23.4 Sensitivity display

Show how COS moves as `λ` slides from 0 to 1. If the recommendation flips, say so: *"This recommendation is sensitive to your risk tolerance — at low risk aversion, waiting wins; at high risk aversion, charter now."* That single line will impress an experienced juror more than a confident score.

---

## 24. Vessel Selection Engine

### 24.1 Stage 1 — hard feasibility filter (deterministic, no ML)

For each candidate class `c`, load port `L`, discharge port `D`:

```
feasible(c, L, D) ⟺
     ∃ berth b_L ∈ L :  cargo_type ∈ b_L.cargo_types
                     ∧ c.ref_loa  ≤ b_L.max_loa
                     ∧ c.ref_loa  ≥ b_L.min_loa
                     ∧ c.ref_beam ≤ b_L.max_beam
                     ∧ intake(c, b_L) > 0
                     ∧ b_L.status = 'operational'
 ∧   ∃ berth b_D ∈ D :  (same conditions)
 ∧   NOT (b_D.coupling_constraint violated)
```

Anything failing is removed **and the reason is retained** so the UI can say *"Capesize excluded: Haldia maximum draft 9.0 m vs vessel 17.8 m."* Showing the rejected options with reasons is more convincing than showing only the winner.

### 24.2 Stage 2 — voyage count and parcel split

```
intake(c, route) = min( intake(c, b_L), intake(c, b_D) )     # the binding port wins
n_voyages(c)     = ceil( cargo_total / intake(c, route) )
last_parcel      = cargo_total − (n_voyages − 1) × intake(c, route)
```

Flag inefficiency when `last_parcel / intake < 0.6` — a badly stranded final parcel is a real cost the user should see.

### 24.3 Stage 3 — feasibility of the deadline

```
days_per_voyage(c) = ballast_days + laden_days + load_port_days + disch_port_days
                     + weather_margin(route, month)

# Sequential (one ship doing n voyages) vs parallel (n ships, one voyage each)
sequential_completion = n_voyages × days_per_voyage
parallel_completion   = days_per_voyage + (n_voyages − 1) × stagger

deadline_ok = min(sequential, parallel) ≤ days_to_deadline
```

The sequential/parallel distinction is exactly the spot-vs-multi-voyage-contract question in physical form, and surfacing it is a nice touch.

### 24.4 Stage 4 — rank

Rank surviving classes by simulated risk-adjusted cost (§28). Output a table with, per class: feasible ✓/✗, intake, voyages, days, expected cost band, compatibility score, and the binding constraint.

---

## 25. Optimization Engine

### 25.1 Formulation

**Decision variables**

| Variable | Domain | Meaning |
|---|---|---|
| `x[c]` | integer ≥ 0 | number of voyages assigned to class *c* |
| `y[c]` | binary | class *c* is used |
| `z[w]` | binary | commit in charter week *w* |
| `u[c,p]` | binary | class *c* discharges at port *p* |
| `s` | binary | contract structure: 0 = spot, 1 = multi-voyage |
| `l[c]` | integer ≥ 0 | parcels routed via Sandheads lighterage |

**Objective**

```
minimise   Σ_c x[c] · ( freight_c + bunker_c + portcost_c + waitcost_c
                       + E[demurrage_c] + lighterage_c + ballast_c )
         + Σ_w z[w] · timing_premium_w
         − s · contract_discount · Σ_c x[c] · freight_c
         + λ · tail_risk_term
         + M · P(deadline_miss)
```

**Constraints**

```
(C1) Σ_c x[c] · intake[c]        ≥  cargo_total                    cargo covered
(C2) x[c]                        ≤  BigM · y[c]                    linking
(C3) y[c] = 1  ⇒  feasible(c)    (classes are pre-filtered, so infeasible c are simply absent)
(C4) Σ_w z[w]                    =  1                              commit exactly once
(C5) completion_time(x, z)       ≤  deadline                       delivery met
(C6) Σ_c x[c] · intake[c] / handling_rate[p] ≤ port_capacity_days[p]   port throughput
(C7) x[c]                        ≤  max_available[c, w]            supply proxy cap
(C8) s = 1                       ⇒  Σ_c x[c] ≥ min_contract_voyages
(C9) s = 1                       ⇒  Σ_c y[c] ≤ 1                   a COA fixes one class
(C10) l[c]                       ≤  x[c] · 1{port requires lighterage}
(C11) Σ_c y[c]                   ≤  2                              practical fleet-mix cap
```

C9 is an important modelling insight: a multi-voyage contract generally commits you to a single vessel class, so the contract structure decision and the class decision are coupled. Most naïve formulations miss this.

### 25.2 Which solver

| Option | Verdict |
|---|---|
| Pure LP | ❌ Voyage counts are integers; LP would give 2.7 Panamaxes |
| **MILP** | ✅ **Correct primary choice.** Integer counts, binary structure choices, linear-izable objective |
| Constraint Programming (CP-SAT) | ✅ **Also excellent here** — the problem is small, highly combinatorial, and CP-SAT handles logical implications (C8, C9) natively and cleanly |
| Metaheuristics (GA, PSO) | ❌ Unjustified. The search space is tiny; exact methods give proven optimality |

**Recommendation:** **OR-Tools CP-SAT** as the primary solver. Reasons: the model is small (4 classes × ~26 weeks × a handful of binaries — easily under 1,000 variables), CP-SAT expresses implication constraints directly without BigM tricks, it is free, well-documented, and returns proven-optimal solutions in milliseconds at this scale. Keep a CBC/MILP path via `pywraplp` as a cross-check that the two agree.

### 25.3 Handling the nonlinearity honestly

Expected waiting cost and demurrage are nonlinear in the number of voyages (more of your own ships at one port means you queue behind yourself). Two clean options:

1. **Piecewise-linear approximation** of `waitcost(x)` over 3–4 breakpoints, which keeps the MILP exact within the approximation — and we state the approximation error.
2. **Enumerate-then-simulate:** because the feasible space is tiny (≤ 4 classes × ≤ 6 voyage counts × ≤ 26 weeks × 2 structures ≈ a few thousand combinations), just **enumerate all feasible strategies and simulate each one exactly**. No approximation at all.

**For the hackathon, do (2) as the primary path and keep the MILP as the scalable story.** It is exact, it is trivially parallelisable, it is easier to debug at 2 a.m., and it lets the simulator be the truth rather than a post-hoc check. The MILP then becomes the honest answer to "how does this scale to 30 ports and 200 cargoes."

### 25.4 Pseudocode

```python
def optimise(req: Requirement) -> Recommendation:
    classes   = [c for c in VESSEL_CLASSES if feasible(c, req.load_port, req.disch_port, req.cargo)]
    if not classes:
        return infeasible_with_reasons(req)

    windows   = charter_windows(req.today, req.deadline, lead_time_days=10)
    strategies = enumerate_strategies(classes, windows, structures=("spot", "multi_voyage"))

    results = []
    for s in strategies:
        if not deadline_feasible(s, req):
            continue
        sim = monte_carlo(s, req, n=1000)          # §28
        results.append(Result(
            strategy=s,
            mean=sim.mean, p10=sim.p10, p90=sim.p90,
            cvar90=sim.cvar90,
            p_miss=sim.p_deadline_miss,
            risk_adjusted=sim.mean + LAMBDA*(sim.cvar90 - sim.mean) + M*sim.p_deadline_miss,
        ))

    results.sort(key=lambda r: r.risk_adjusted)
    return Recommendation(best=results[0], alternatives=results[1:5],
                          explanation=explain(results), rejected=rejection_reasons(req))
```

---

## 26. Idle Scenario Management

### 26.1 What the PS actually asks for

"Minimise vessel idle time by forecasting periods of low demand and suggesting alternative employment opportunities or optimised positioning to reduce deadheading."

Note the ambiguity: idle time can mean *our chartered vessel sits idle*, or *market-wide low demand*. We address both, and say which is which.

### 26.2 Component A — idle time in our own plan

Directly computed by the simulator:

```
idle_days = Σ_voyages [ max(0, laycan_start − arrival_at_load)      # early arrival
                      + waiting_at_load
                      + waiting_at_discharge
                      + inter_voyage_gap ]
idle_cost = idle_days × (daily_hire OR demurrage_rate)
```

Shown per strategy. A strategy with lower freight but higher idle time loses — and the UI shows exactly that trade.

### 26.3 Component B — low-demand period forecasting

A simple, defensible classifier rather than an elaborate one:

```
low_demand(class, month) = 1  if  index_forecast_p50(class, month)
                                  < percentile_30( index history, same calendar month, last 5 yrs )
```

Features that drive it: forecast index level, seasonal traffic at East Coast ports, coal price momentum, port queue trends. Output: a 6-month strip chart of expected demand regime per class (LOW / NORMAL / HIGH), with the forecast interval shown so the user sees the uncertainty.

**Use for the charterer:** low-demand windows are *good* for a charterer — that is when you want to fix a multi-voyage contract. So the module's user-facing headline is: **"Forecast soft window for Supramax, weeks 44–48 — favourable for committing volume."** That reframes an owner-side concept into charterer value, which is the right thing for a Ministry of Steel user.

### 26.4 Component C — repositioning and deadheading

```
ballast_cost(from_port, to_port, class) =
      distance_nm(from, to) / (speed_ballast × 24) × cons_ballast × bunker_price
    + port_dues(to_port)

best_next_employment(class, at_port, at_date) =
    argmin over candidate load ports P of:
        ballast_cost(at_port, P, class)
      − expected_freight_revenue(P → typical discharge, class, at_date)
      + waiting_at(P, at_date)
```

Candidate load ports are our origin registry plus regional alternatives. For a charterer, the practical output is not "send our ship to X" but the negotiating insight: **"This lane has weak backhaul; expect owners to price ~$Y/t of ballast into the rate. Origins with better backhaul: …"** That is genuinely what a chartering manager would use.

### 26.5 Simplified SIH implementation (be realistic)

For the demo, implement:
- Idle days and idle cost per strategy — **full implementation, it falls out of the simulator for free**
- Low-demand regime strip per class for 6 months — **full implementation, cheap**
- Ballast cost matrix between our ~15 ports × 4 classes — **precomputed table, cheap**
- Backhaul-availability index per lane — **a hand-curated 0–1 score per lane with a documented rationale, clearly labelled as an expert-set parameter**

Do **not** attempt a full fleet-deployment optimiser. It is a different problem (owner-side), it needs vessel position data we don't have, and it will eat the week.

---

## 27. Risk Engine

### 27.1 Six risk components

| Risk | Signal | Computation |
|---|---|---|
| **Market** | Freight volatility & forecast width | `z(realised_vol_20d)` and `z(interval_width / level)`; HIGH if either > 1.0σ |
| **Port** | Congestion vs. normal | `z(expected_wait_hours vs port-month median)` from the congestion model |
| **Weather** | Seasonal + live | `weather_stop_frac(port, month)` and any active IMD cyclone bulletin |
| **Vessel availability** | Supply proxy (§15.5) | `z(availability_proxy)` inverted |
| **Route** | Distance, chokepoints, geopolitical flags | Static per-lane risk with an explicit flag for sanctions-exposed origins |
| **Demand** | Cargo-side volatility | `z(std of monthly port coal tonnes, trailing 12m)` |

Each maps to LOW / MEDIUM / HIGH using **empirical tertiles of its own historical distribution** — not invented cut-offs. That is the key methodological point: the thresholds come from the data.

### 27.2 Combining

```
score_i ∈ {0, 1, 2}   for LOW, MEDIUM, HIGH

overall_raw = Σ_i w_i · score_i,   with w_i derived, not invented:
    w_i ∝ |∂ RiskAdjustedCost / ∂ component_i|
```

The weights come from a **sensitivity analysis of the simulator itself**: perturb each component ±1σ, measure the change in risk-adjusted cost, normalise. So the risk weights are literally "how much each factor actually moves the money in this specific scenario." That is a very strong answer to "where did your weights come from?"

Map `overall_raw` to LOW / MEDIUM / HIGH by tertiles of the same score computed across a large sample of historical scenarios.

### 27.3 Explainability output

```
OVERALL RISK: MEDIUM

  Market risk .............. HIGH     ▲ realised volatility 1.4σ above normal
  Port risk (Paradip) ...... LOW      ▼ expected wait 1.2 days vs 2.1 median
  Weather risk ............. MEDIUM   ■ post-monsoon cyclone window (Oct–Dec)
  Vessel availability ...... MEDIUM   ■ Panamax supply signal tightening
  Route risk ............... LOW
  Demand risk .............. LOW

MAIN DRIVER
  Freight volatility has risen while Panamax availability on the Pacific
  lane is tightening. Market risk contributes 61% of the overall score
  because, in this scenario, a 1σ freight move changes total cost by
  $1.9/t while a 1σ waiting-time move changes it by $0.4/t.

WHAT WOULD CHANGE THIS
  • Volatility returning to its 12-month median → overall LOW
  • Paradip queue exceeding 6 vessels → overall HIGH
```

The "what would change this" block is a small addition that makes the system feel like an analyst rather than a widget.

### 27.4 Alerts

| Alert | Trigger |
|---|---|
| Market volatility spike | 20d realised vol crosses its 90th percentile |
| Forecast revision | New forecast moves > 1 interval-width from the prior run |
| Congestion build-up | Port queue > 80th percentile for 3 consecutive days |
| Cyclone warning | Active IMD bulletin for the Bay of Bengal |
| Constraint change | A port constraint source PDF changed hash |
| Charter window opening | COS crosses 75 for a saved requirement |

---

## 28. Charter Strategy Digital Twin (implementation detail)

### 28.1 Simulation loop

```python
def monte_carlo(strategy, req, n=1000, seed=42):
    rng = np.random.default_rng(seed)
    costs, misses = [], 0

    for _ in range(n):
        # 1. Sample the freight rate from the calibrated forecast distribution
        f = sample_freight(strategy.vessel_class, strategy.charter_week, rng)

        # 2. Sample bunker price (GBM calibrated to historical vol, or bootstrap)
        b = sample_bunker(strategy.charter_week, rng)

        # 3. Sample waiting time at each port from the empirical waiting distribution
        w_load  = sample_wait(req.load_port,  strategy.vessel_class, strategy.month, rng)
        w_disch = sample_wait(req.disch_port, strategy.vessel_class, strategy.month, rng)

        # 4. Sample weather stoppage hours
        wx = sample_weather_stop(req.route, strategy.month, rng)

        # 5. Deterministic physics + tariffs
        c = cost_model(strategy, req, freight=f, bunker=b,
                       wait_load=w_load, wait_disch=w_disch, weather=wx)

        costs.append(c.total)
        if c.completion_date > req.deadline:
            misses += 1

    a = np.array(costs)
    return SimResult(mean=a.mean(), p10=np.percentile(a,10), p90=np.percentile(a,90),
                     cvar90=a[a >= np.percentile(a,90)].mean(),
                     p_deadline_miss=misses/n,
                     breakdown=mean_breakdown())
```

### 28.2 Where each distribution comes from (no hand-waving)

| Sampled quantity | Distribution | Fitted from |
|---|---|---|
| Freight rate | Conformal-calibrated quantiles → fitted lognormal | Forecast model (§22) |
| Bunker price | Lognormal, σ from 90d realised vol | Historical bunker/Brent |
| Waiting time (load) | **Empirical bootstrap** from observed queue data | Origin port queue reports |
| Waiting time (discharge) | **Empirical bootstrap** from PPA daily report waiting times, stratified by month and vessel size | Official port record — this is our best data |
| Weather stoppage | Binomial(hours) with `p` from climatology | Open-Meteo historical |
| Handling rate | Triangular(min, mode, max) around published rate | Port published rate ± observed spread |
| Demurrage rate | Deterministic per class, user-editable | Market convention, labelled as an assumption |

Bootstrapping the discharge waiting time from real Paradip data rather than assuming a distribution is a defensible, checkable choice, and it is the single most valuable thing in the simulator.

### 28.3 Strategy comparison output

```
STRATEGY COMPARISON — 120,000 t coking coal, Hay Point → Paradip, by 25 Oct   [DEMO STRUCTURE]

  #  Strategy                    Voyages  Days  Exp.Cost   P10–P90    CVaR90  P(miss)  Risk-adj
  ─────────────────────────────────────────────────────────────────────────────────────────────
  1  2 × Supramax, 3-voy contract    2     ..     $..        $..–$..     $..     ..%      $..
  2  1 × Panamax, spot               2     ..     $..        $..–$..     $..     ..%      $..
  3  1 × Capesize, spot              1     ..     $..        $..–$..     $..     ..%      $..
  4  3 × Handysize, spot             3     ..     $..        $..–$..     $..     ..%      $..
  ─  1 × Capesize → Haldia           —     —      INFEASIBLE: draft 17.8 m > 9.0 m permissible
```

Numbers deliberately left as `..` in this blueprint — they must come from the pipeline, never from imagination.

---

## 29. Backend / API Architecture

### 29.1 Principles

- **The frontend never imports Python.** Everything crosses an HTTP/JSON boundary.
- **Contracts before code.** The OpenAPI schema is agreed on Day 3 and committed to `docs/api_contract.md`. Member 1 builds against a mock server generated from that schema and is never blocked.
- **Versioned paths** (`/api/v1/...`) so a breaking change never silently breaks the dashboard mid-demo.
- **Every response carries `provenance`, `as_of` and `assumptions`.**

### 29.2 Endpoint catalogue

---

#### `POST /api/v1/forecast`

Freight forecast for a vessel class.

**Request**
```json
{
  "vessel_class": "Supramax",          // required: Handysize|Supramax|Panamax|Capesize
  "horizon_days": 28,                  // required: 7|14|28|60|90|180
  "route": {"origin_port": "AUHPT", "destination_port": "INPRT"},  // optional
  "as_of": "2026-09-15"                // optional, defaults to latest
}
```

**Response 200**
```json
{
  "vessel_class": "Supramax",
  "index": "BSI",
  "as_of": "2026-09-15",
  "horizon_days": 28,
  "index_forecast": {"point": 1652, "interval_80": [1548, 1771]},
  "usd_per_tonne": {"point": 25.4, "interval_80": [24.1, 27.0],
                    "provenance": "derived", "model": "shadow_freight_v1"},
  "confidence": 0.81,
  "trend": "increasing",
  "history": [{"date": "2026-08-15", "value": 1601}],
  "model_meta": {"name": "lgbm_quantile_v3", "trained_on": "2026-09-01",
                 "validation_mase": 0.88, "interval_coverage_80": 0.79},
  "drivers": [{"feature": "bsi_lag_7", "direction": "up", "shap": 0.42}]
}
```

**Errors**
```json
400 {"error": "invalid_vessel_class", "message": "...", "allowed": ["Handysize","Supramax","Panamax","Capesize"]}
404 {"error": "no_model", "message": "No trained model for horizon 45"}
503 {"error": "stale_data", "message": "Latest index data is 9 days old", "as_of": "2026-09-06"}
```

---

#### `POST /api/v1/recommend-vessel`

**Request**
```json
{
  "cargo": {"type": "coking_coal", "quantity_t": 120000},
  "origin_port": "AUHPT",
  "destination_port": "INPRT",
  "required_by": "2026-10-25"
}
```

**Response 200**
```json
{
  "recommended": {
    "vessel_class": "Supramax", "voyages": 2, "parcel_t": 60000,
    "intake_ratio": 0.98, "compatibility_score": 94,
    "estimated_days_per_voyage": 28.4, "deadline_feasible": true
  },
  "alternatives": [
    {"vessel_class": "Panamax", "voyages": 2, "parcel_t": 75000,
     "compatibility_score": 82, "note": "Second parcel only 45,000 t — poor utilisation"}
  ],
  "rejected": [
    {"vessel_class": "Capesize", "reason": "draft",
     "detail": "Requires 17.8 m; Paradip coal berth permissible 14.5 m (Western Dock 16.5 m, but cargo-type mismatch)",
     "source": "https://paradipport.gov.in/... (retrieved 2026-09-10)"}
  ],
  "constraints_as_of": "2026-09-10"
}
```

---

#### `POST /api/v1/optimize-charter`

**Request**
```json
{
  "cargo": {"type": "coking_coal", "quantity_t": 120000},
  "origin_port": "AUHPT", "destination_port": "INPRT",
  "required_by": "2026-10-25",
  "contract_horizon_voyages": 3,
  "risk_aversion": 0.5,
  "deadline_miss_penalty_usd": 500000
}
```

**Response 200**
```json
{
  "recommendation": {
    "vessel_class": "Supramax", "voyages": 3,
    "contract_structure": "short_term_multi_voyage",
    "charter_window": {"start": "2026-09-18", "end": "2026-09-23"},
    "expected_cost_usd": 3120000, "expected_cost_inr": 259000000,
    "fx_rate": 83.0, "fx_date": "2026-09-15",
    "interval_80_usd": [2960000, 3340000],
    "risk": "MEDIUM",
    "charter_opportunity_score": 78
  },
  "cost_breakdown_usd": {"freight": 2480000, "bunker": 0, "port_costs": 312000,
                         "waiting": 148000, "expected_demurrage": 96000,
                         "lighterage": 0, "repositioning": 84000},
  "explanation": [
    "Port compatible: Supramax clears Paradip coal berth limits with 98% intake",
    "Freight outlook favourable: BSI forecast band is below its 3-year median for October",
    "Lower expected waiting than Panamax at Paradip in October",
    "Meets 25 October deadline with 6 days of slack",
    "Lower risk-adjusted cost than all feasible alternatives"
  ],
  "assumptions": ["contract discount 5% (user-editable)", "10% under-keel clearance",
                  "demurrage $18,000/day for Supramax"],
  "provenance": {"freight": "derived", "port_costs": "measured", "waiting": "measured"}
}
```

---

#### `POST /api/v1/simulate-strategy`

The USP endpoint.

**Request**
```json
{
  "cargo": {"type": "coking_coal", "quantity_t": 120000},
  "origin_port": "AUHPT", "destination_port": "INPRT",
  "required_by": "2026-10-25",
  "strategies": ["auto"],
  "n_simulations": 1000,
  "risk_aversion": 0.5
}
```

**Response 200**
```json
{
  "results": [
    {"id": "S1", "label": "2 × Supramax, 3-voyage contract",
     "voyages": 2, "total_days": 56.8,
     "cost": {"mean": 3120000, "p10": 2960000, "p50": 3105000, "p90": 3340000,
              "cvar_90": 3420000},
     "p_deadline_miss": 0.04, "risk_adjusted_cost": 3290000,
     "breakdown": {"freight": 2480000, "port_costs": 312000, "waiting": 148000,
                   "expected_demurrage": 96000, "repositioning": 84000},
     "feasible": true}
  ],
  "infeasible": [
    {"label": "1 × Capesize → Haldia", "reason": "draft",
     "detail": "17.8 m required vs 9.0 m permissible"}
  ],
  "winner": "S1",
  "n_simulations": 1000, "seed": 42,
  "runtime_ms": 2840
}
```

---

#### `GET /api/v1/ports`  ·  `GET /api/v1/ports/{port_id}`

```json
{
  "port_id": "INPRT", "name": "Paradip", "country": "IN",
  "lat": 20.2654, "lon": 86.6763,
  "authority": "Paradip Port Authority", "authority_type": "major_port",
  "berths": [
    {"berth_id": "INPRT-CB1", "name": "Coal Berth-01", "max_loa_m": 300,
     "max_beam_m": 48, "max_draft_m": 14.5, "cargo_types": ["thermal_coal","coking_coal"],
     "coupling_constraint": "Subject to Iron Ore Berth being vacant",
     "handling_rate_tpd": null, "status": "operational"}
  ],
  "congestion": {"expected_wait_hours_p50": 28, "p90": 96, "as_of": "2026-09-14",
                 "sample_days": 365},
  "vessel_compatibility": [
    {"vessel_class": "Supramax", "cargo_type": "coking_coal",
     "feasible": true, "max_intake_t": 61200, "compat_score": 94}
  ],
  "source_url": "https://paradipport.gov.in/...", "retrieved_at": "2026-09-10",
  "verification": "manually_verified"
}
```

---

#### `GET /api/v1/vessels` · `GET /api/v1/market` · `GET /api/v1/risks`

```
GET /api/v1/vessels
  → the four class profiles with dwt/draft/loa/beam/speed/consumption + source attribution

GET /api/v1/market
  → { indices: {BDI, BCI, BPI, BSI, BHSI} with latest value, 1d/7d/30d change,
      volatility percentile, bunker, coal & iron ore prices, usd_inr,
      charter_opportunity_score_generic, as_of }

GET /api/v1/risks?port_id=INPRT&vessel_class=Panamax&month=10
  → { overall: "MEDIUM", components: {...}, main_driver: "...",
      what_would_change: [...], alerts: [...] }
```

---

#### `GET /api/v1/sources`

Returns the full provenance registry. Powers the in-app Data Sources page and the References slide. Having this as an *endpoint* rather than a static page is a subtle flex — the data lineage is live.

### 29.3 Standard error envelope

```json
{ "error": "<machine_code>", "message": "<human readable>",
  "field": "<offending field, if any>", "request_id": "uuid",
  "hint": "<what to do about it>" }
```

Codes: `invalid_input`, `infeasible_request`, `no_model`, `stale_data`, `not_found`, `internal_error`.

**`infeasible_request` is a first-class success-shaped failure.** If no vessel class can serve the cargo, that is a *useful answer*, and the response must explain why per class.

### 29.4 Project layout (backend)

```
backend/
├── app/
│   ├── main.py                 # FastAPI app, CORS, routers
│   ├── config.py               # pydantic-settings, reads .env
│   ├── db.py                   # SQLAlchemy engine/session
│   ├── schemas/                # Pydantic request/response models  ← the API contract
│   ├── routers/                # forecast.py, vessels.py, ports.py, optimize.py, market.py, risks.py, sources.py
│   ├── services/
│   │   ├── forecast_service.py     # reads model_forecast table
│   │   ├── constraint_service.py   # feasibility rules
│   │   ├── congestion_service.py
│   │   ├── cost_model.py           # pure functions, heavily unit-tested
│   │   ├── optimizer.py            # OR-Tools
│   │   ├── simulator.py            # Monte-Carlo
│   │   └── risk_engine.py
│   └── repositories/           # SQL access only, no business logic
└── tests/
```

---

## 30. Frontend Architecture

### 30.1 Stack

React 18 + Vite + TypeScript · Tailwind · Apache ECharts · React-Leaflet (OSM tiles) · TanStack Query for fetching/caching · Zustand for the small amount of shared state · Axios with a generated TypeScript client.

### 30.2 The seven pages

---

**Page 1 — Executive Dashboard** *(persona: Meera, Arjun)*

- Top row: 5 index tiles (BDI, BCI, BPI, BSI, BHSI) with sparkline, 1d/7d/30d change, volatility percentile badge
- Charter Opportunity Score gauge (0–100) with the current window width shown beside it
- Freight trend chart: 12 months history + forecast fan, class selector
- Alerts strip: top 3 active alerts, severity-coloured
- Market context tiles: bunker, Australian coal, iron ore, USD/INR
- Footer: "Data as of <date> · <n> sources · view lineage →"

---

**Page 2 — Charter Planner** *(persona: Ravi — the hero page)*

Left rail (inputs): cargo type, quantity (t), origin port, destination port, required-by date, contract horizon (voyages), risk-aversion slider.

Right panel (outputs), rendered in a single scroll:
1. **Recommendation card** — vessel class, voyages, contract structure, charter window (as a date-range bar over a calendar strip), expected cost in ₹ and $, risk pill
2. **Why** — 5 bulleted reasons with ✓ marks
3. **Cost breakdown** — horizontal stacked bar, hover for each component
4. **Uncertainty** — the P10–P90 band drawn as a horizontal range, with CVaR marked
5. **Rejected options** — collapsible, with the binding constraint for each
6. **Assumptions** — collapsible, editable

Every number has a tooltip showing its source and whether it is measured or derived.

---

**Page 3 — Freight Forecast** *(Meera, Ravi)*

- Historical line + forecast fan chart (80% band) with horizon selector
- Class comparison: 4 small multiples, same y-scale
- Model scorecard table: per class per horizon — MAE, MASE, coverage. **Showing where we lose to the naïve baseline builds more credibility than hiding it**
- Driver panel: top SHAP features rendered as sentences

---

**Page 4 — Port Intelligence** *(Arjun, Kavita)*

- Leaflet map, East Coast India + origin ports, markers scaled by throughput, coloured by current congestion
- Click a port → side panel with: berth table (LOA/beam/draft/handling/coupling notes), congestion history chart, expected waiting distribution, vessel-class compatibility chips, source link and `constraints as of` date
- Toggle: origin ports / destination ports
- Congestion heatmap: port × month

---

**Page 5 — Vessel Optimizer** *(Ravi)*

Four columns, one per class: profile (dwt, draft, LOA, beam, speed, consumption, with a "source: Baltic Exchange standard vessel description" footnote), feasibility badge per selected port pair, max intake, voyages required, estimated days, estimated cost band, compatibility score ring. Infeasible columns are greyed with the reason overlaid.

---

**Page 6 — Charter Strategy Simulator** *(the USP page)*

- Strategy table (sortable by any column) with the winner highlighted
- **Cost distribution overlay chart** — kernel density of simulated total cost, one curve per strategy, deadline-miss probability annotated. This is the single most visually persuasive artefact in the whole project; make it beautiful
- Tornado chart: sensitivity of the winner's cost to each sampled input
- Risk-aversion slider that **re-ranks live** — dragging it and watching the recommendation flip is the demo moment
- "Explain this ranking" text panel

---

**Page 7 — Risk & Alerts** *(all)*

Alert feed (severity, time, affected port/class/route, one-line explanation, link to the relevant page), risk matrix (6 components × LOW/MED/HIGH), "what would change this" panel, cyclone bulletin card when active.

### 30.3 Frontend rules of engagement

1. **Zero business logic.** No cost formulas, no thresholds, no feasibility rules in TypeScript. If the frontend needs a number, the API provides it.
2. **Mock-first.** `src/api/mock/` holds JSON fixtures matching the contract exactly. Member 1 builds all seven pages against mocks and flips a single env var to go live.
3. **Loading, empty, error and infeasible states** designed for every panel. The `infeasible_request` state in particular should look deliberate, not broken.
4. **Derived-value badge** rendered by a shared `<ProvenanceTag>` component wherever `provenance === "derived"`.
5. **Demo mode** — a URL flag that pins `as_of` to a fixed date and serves from a frozen snapshot, so the stage demo is deterministic.

---

## 31. Database Schema

```sql
-- ═══════ DIMENSIONS ═══════
CREATE TABLE dim_port (
  port_id TEXT PRIMARY KEY, port_name TEXT NOT NULL, country CHAR(2) NOT NULL,
  role TEXT CHECK (role IN ('load','discharge','both')),
  lat NUMERIC(9,6), lon NUMERIC(9,6),
  authority TEXT, authority_type TEXT,
  approach_channel_depth_m NUMERIC(5,2), tidal_range_m NUMERIC(4,2),
  seasonal_notes TEXT,
  source_url TEXT NOT NULL, retrieved_at TIMESTAMPTZ NOT NULL,
  licence TEXT, verification TEXT NOT NULL DEFAULT 'unverified'
);

CREATE TABLE dim_berth (
  berth_id TEXT PRIMARY KEY,
  port_id TEXT NOT NULL REFERENCES dim_port(port_id),
  berth_name TEXT NOT NULL, cargo_types TEXT[] NOT NULL,
  max_loa_m NUMERIC(6,2), min_loa_m NUMERIC(6,2),
  max_beam_m NUMERIC(5,2), max_draft_m NUMERIC(5,2),
  tide_allowance_m NUMERIC(4,2) DEFAULT 0, max_dwt NUMERIC(10,0),
  berth_length_m NUMERIC(7,2), handling_rate_tpd NUMERIC(8,0),
  mechanised BOOLEAN, daylight_only BOOLEAN DEFAULT FALSE,
  coupling_constraint TEXT, status TEXT DEFAULT 'operational',
  effective_from DATE NOT NULL, effective_to DATE,
  source_url TEXT NOT NULL, retrieved_at TIMESTAMPTZ NOT NULL,
  verification TEXT NOT NULL DEFAULT 'unverified'
);
CREATE INDEX ON dim_berth (port_id, effective_from, effective_to);

CREATE TABLE dim_vessel_class (
  vessel_class TEXT PRIMARY KEY, index_code TEXT,
  ref_dwt NUMERIC(10,0), ref_draft_m NUMERIC(5,2),
  ref_loa_m NUMERIC(6,2), ref_beam_m NUMERIC(5,2), tpc NUMERIC(6,2),
  speed_laden_kn NUMERIC(4,1), speed_ballast_kn NUMERIC(4,1),
  cons_laden_mt_day NUMERIC(5,1), cons_ballast_mt_day NUMERIC(5,1),
  geared BOOLEAN, dwt_min NUMERIC(10,0), dwt_max NUMERIC(10,0),
  source_url TEXT NOT NULL, retrieved_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE dim_route (
  route_id TEXT PRIMARY KEY,
  origin_port TEXT REFERENCES dim_port(port_id),
  destination_port TEXT REFERENCES dim_port(port_id),
  distance_nm NUMERIC(8,1), via_passages TEXT[],
  backhaul_index NUMERIC(3,2),   -- expert-set 0..1, documented
  baltic_reference_route TEXT,
  computed_by TEXT, caveat TEXT
);

CREATE TABLE dim_port_tariff (
  tariff_id BIGSERIAL PRIMARY KEY,
  port_id TEXT REFERENCES dim_port(port_id),
  charge_type TEXT NOT NULL,        -- port_dues|pilotage|berth_hire|wharfage|anchorage|lighterage
  basis TEXT NOT NULL,              -- per_grt|per_grt_hour|per_tonne|flat
  slab_min NUMERIC, slab_max NUMERIC,
  rate_foreign_usd NUMERIC(12,5), rate_coastal_inr NUMERIC(12,5),
  min_charge_usd NUMERIC(12,2), notes TEXT,
  effective_from DATE NOT NULL, effective_to DATE,
  source_url TEXT NOT NULL, verification TEXT NOT NULL
);

-- ═══════ FACTS ═══════
CREATE TABLE fact_freight_index (
  obs_date DATE NOT NULL, index_code TEXT NOT NULL,
  value NUMERIC(10,2) NOT NULL, tc_avg_usd_day NUMERIC(10,2),
  source_url TEXT, retrieved_at TIMESTAMPTZ,
  PRIMARY KEY (obs_date, index_code)
);

CREATE TABLE fact_commodity_price (
  obs_date DATE NOT NULL, series_code TEXT NOT NULL,
  value NUMERIC(14,4) NOT NULL, unit TEXT,
  available_from DATE NOT NULL,     -- publication lag control
  source_url TEXT, PRIMARY KEY (obs_date, series_code)
);

CREATE TABLE fact_port_call (
  call_id BIGSERIAL PRIMARY KEY,
  port_id TEXT REFERENCES dim_port(port_id),
  report_date DATE NOT NULL,
  vessel_name TEXT, cargo_type TEXT, cargo_tonnes NUMERIC(10,0),
  berth_name TEXT, vessel_draft_m NUMERIC(5,2),
  vessel_loa_m NUMERIC(6,2), vessel_beam_m NUMERIC(5,2),
  arrival_ts TIMESTAMPTZ, ready_for_berth_ts TIMESTAMPTZ,
  berthed_ts TIMESTAMPTZ, sailed_ts TIMESTAMPTZ,
  waiting_hours NUMERIC(7,2) GENERATED ALWAYS AS
     (EXTRACT(EPOCH FROM (berthed_ts - ready_for_berth_ts))/3600) STORED,
  delay_reason_code CHAR(1),   -- A..H from the port's own legend
  source_url TEXT, verification TEXT
);
CREATE INDEX ON fact_port_call (port_id, report_date);

CREATE TABLE fact_port_traffic_monthly (
  port_id TEXT, month DATE, commodity TEXT, tonnes NUMERIC(14,0),
  turnaround_days NUMERIC(6,2), pre_berthing_detention_days NUMERIC(6,2),
  source_url TEXT, PRIMARY KEY (port_id, month, commodity)
);

CREATE TABLE fact_weather_climatology (
  port_id TEXT, month SMALLINT, mean_wave_height_m NUMERIC(4,2),
  p90_wave_height_m NUMERIC(4,2), mean_wind_kn NUMERIC(5,2),
  weather_stop_fraction NUMERIC(4,3), cyclone_freq_per_decade NUMERIC(5,2),
  PRIMARY KEY (port_id, month)
);

-- ═══════ DERIVED / MODEL ═══════
CREATE TABLE derived_compatibility (
  port_id TEXT, berth_id TEXT, vessel_class TEXT, cargo_type TEXT, season TEXT,
  feasible BOOLEAN NOT NULL, infeasible_reason TEXT,
  max_intake_t NUMERIC(10,0), intake_ratio NUMERIC(4,3),
  est_cargo_days NUMERIC(6,2), est_wait_hours_p50 NUMERIC(7,2),
  est_wait_hours_p90 NUMERIC(7,2), est_turnaround_days NUMERIC(6,2),
  weather_stop_frac NUMERIC(4,3), requires_lighterage BOOLEAN,
  compat_score NUMERIC(5,2), computed_at TIMESTAMPTZ,
  PRIMARY KEY (port_id, berth_id, vessel_class, cargo_type, season)
);

CREATE TABLE model_forecast (
  forecast_id BIGSERIAL PRIMARY KEY,
  as_of DATE NOT NULL, index_code TEXT NOT NULL, horizon_days INT NOT NULL,
  point NUMERIC(10,2), lo_80 NUMERIC(10,2), hi_80 NUMERIC(10,2),
  confidence NUMERIC(4,3), trend TEXT,
  model_name TEXT, model_version TEXT, validation_mase NUMERIC(5,3),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (as_of, index_code, horizon_days, model_version)
);

CREATE TABLE data_source_registry (
  source_id SERIAL PRIMARY KEY, source_name TEXT, organisation TEXT,
  url TEXT, licence TEXT, access_method TEXT, update_frequency TEXT,
  availability_rating CHAR(1),     -- G|Y|O|R
  last_checked DATE, notes TEXT
);
```

---

## 32. GitHub Structure

```
sih26006-charter-intelligence/
├── README.md                     # what it is, how to run in 3 commands
├── docker-compose.yml            # postgres + api + web
├── .env.example                  # every env var, no secrets
├── .gitignore
├── docs/
│   ├── api_contract.md           # ← agreed Day 3, frozen
│   ├── data_dictionary.md
│   ├── verification_log.md       # manual data checks, signed
│   ├── feature_ablation.md
│   ├── model_card.md             # what the model is, what it isn't
│   ├── assumptions.md            # every parameter we set by judgement
│   ├── REFERENCES.md             # every source + licence + date
│   └── evidence/                 # screenshots of sources
├── data/
│   ├── raw/                      # gitignored except small samples
│   ├── reference/                # hand-curated CSVs, COMMITTED
│   │   ├── ports.csv
│   │   ├── berths.csv            # the constraint registry — the crown jewel
│   │   ├── vessel_classes.csv
│   │   ├── port_tariffs.csv
│   │   └── routes.csv
│   └── snapshots/                # frozen demo-day database dump
├── ingestion/
│   ├── freight/  macro/  ports/  weather/
│   ├── common/   {http.py, provenance.py, robots.py, validate.py}
│   └── schedule.py               # APScheduler jobs
├── ml/
│   ├── features/   models/   evaluation/   notebooks/
│   └── train.py                  # CLI: python -m ml.train --index BSI --horizon 28
├── optimization/
│   ├── constraints.py   cost_model.py   optimizer.py   simulator.py   risk.py
├── backend/                      # see §29.4
├── frontend/
│   ├── src/{pages,components,api,hooks,store,types}
│   ├── src/api/mock/             # fixtures matching the contract
│   ├── package.json
│   └── vite.config.ts
└── scripts/
    ├── bootstrap_db.sh
    ├── load_reference_data.py
    └── rebuild_compatibility.py
```

### 32.1 Git workflow

- Branches: `main` (always demo-ready) ← `dev` ← `feat/<area>-<short-desc>`
- Prefix by owner area: `feat/ml-`, `feat/opt-`, `feat/fe-`, `feat/data-`
- PRs into `dev` need one review. **PRs into `main` need both other members.**
- Commit style: `feat(ml): add conformal calibration for BSI intervals`
- **Tag `v0.1-demo` as soon as something end-to-end works**, and keep tagging. On demo day you present a tag, never `HEAD`.

### 32.2 PR checklist (in `.github/pull_request_template.md`)

```
- [ ] No data leakage: all features respect available_from ≤ as_of
- [ ] New data has source_url, retrieved_at, licence, verification
- [ ] No hard-coded constraint values in code (config/CSV only)
- [ ] API change? → docs/api_contract.md updated AND frontend notified
- [ ] New assumption? → docs/assumptions.md updated
- [ ] Tests pass; `docker compose up` still works from clean
```

### 32.3 Environment

`.env.example`:
```
DATABASE_URL=postgresql://sih:sih@localhost:5432/charter
API_HOST=0.0.0.0
API_PORT=8000
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_USE_MOCKS=false
DEMO_MODE=false
DEMO_AS_OF=2026-09-15
FETCH_USER_AGENT="SIH26006-research/1.0 (contact: team@college.edu)"
FETCH_MIN_INTERVAL_SECONDS=2
COMTRADE_API_KEY=        # free-tier registration
```

No API key is required for Open-Meteo, the World Bank Pink Sheet, RBI, or data.gov.in downloads — a deliberate design choice so the demo has almost no external-credential failure modes.

---

## 33. Team Responsibilities

### 33.1 Member 1 — Frontend / Product

**Owns:** the entire `frontend/` directory, UX, all seven pages, charts, maps, forms, the recommendation and what-if interfaces, demo-day presentation flow, and the pitch deck's product narrative.

**Explicitly does NOT own:** any model code, any cost formula, any feasibility rule, any data pipeline. If a number is needed, it comes from an endpoint.

**Unblocking:** by end of Day 3, Member 1 has `docs/api_contract.md` and a mock server. From that point they are never blocked by the backend — a hard rule.

**Deliverables:** mock-driven UI (Week 1), live-wired UI (Week 2), polish + demo mode + responsive layout (Week 3), rehearsed 6-minute demo (Week 4).

### 33.2 Member 2 — Data + ML

**Owns:** `ingestion/freight`, `ingestion/macro`, `ingestion/weather`, the whole of `ml/`, the feature store, forecasting, intervals, confidence, the Shadow Freight Model, SHAP explanations, and the ML-backed endpoints (`/forecast`, `/market`).

**Deliverables:** freight + macro + weather ingestion with provenance (Week 1), baseline ladder with a full metrics grid (Week 2), calibrated quantile model + shadow freight calibration + forecast table populated (Week 3), model card + validation write-up (Week 4).

### 33.3 Member 3 — Maritime Optimization + Backend

**Owns:** `ingestion/ports`, the port and berth registries, the tariff tables, `optimization/` in full, the compatibility dataset, the risk engine, and the FastAPI application including every non-ML endpoint.

**Deliverables:** port/berth/tariff reference data verified and loaded (Week 1), constraint + cost model + compatibility dataset (Week 2), optimiser + simulator + risk engine wired to endpoints (Week 3), performance tuning and the frozen demo snapshot (Week 4).

### 33.4 How the three modules communicate

```
                 PostgreSQL  (the only shared state)
                        ▲          ▲
            writes      │          │      writes
      ┌─────────────────┘          └───────────────┐
      │                                            │
 ML pipeline (M2)                         Port/opt pipeline (M3)
 writes model_forecast,                   writes dim_*, fact_port_call,
 feat_*, fact_freight_index               derived_compatibility
      │                                            │
      └──────────────► FastAPI (M3 owns app, ─────┘
                       M2 owns /forecast router)
                              │
                         HTTP + JSON
                              │
                       React (M1) — read-only consumer
```

**Three contracts, agreed in writing:**

1. **DB contract (M2 ↔ M3):** table schemas in `docs/data_dictionary.md`. Neither writes to the other's tables. ML reads `dim_*` and `fact_*`; optimisation reads `model_forecast`.
2. **API contract (M3 ↔ M1):** `docs/api_contract.md`, versioned. A breaking change requires a new version path and a Slack/WhatsApp message.
3. **Assumption contract (all three):** any judgement-set parameter goes into `docs/assumptions.md` with a rationale. If it isn't written down, it doesn't exist and cannot be defended on stage.

**Daily 15-minute standup.** Non-negotiable: what I shipped, what I need, what's blocked.

---

## 34. Development Roadmap

Assume a ~4-week build window before the internal deadline, with the SIH idea-submission deadline of **30 September 2026** for the write-up.

### Week 0 (now — 3 days): Foundations, no code that matters

| Day | Everyone | M1 | M2 | M3 |
|---|---|---|---|---|
| 1 | Read the PS aloud together; agree the positioning (constraints > prediction) | Wireframe 7 pages on paper | List every dataset + check availability | List every port + find its official constraint page |
| 2 | Agree the API contract draft | Set up Vite + Tailwind + routing shell | Get BDI/BCI/BPI/BSI/BHSI history downloading | Download berth notification PDFs for all 7 ports |
| 3 | **Freeze `docs/api_contract.md` v1** | Build mock server from the contract | Postgres up, `fact_freight_index` loaded | `dim_port` + `dim_berth` hand-entered and verified |

### Week 1: Data and skeleton

- M1: Pages 1–3 built against mocks
- M2: Macro + weather ingestion; feature store; naïve/MA/seasonal baselines with the metrics grid
- M3: Tariff tables; cost model with unit tests; feasibility rules; `derived_compatibility` v1
- **Milestone:** `GET /api/v1/ports` returns real, verified data. First real thing on a screen.

### Week 2: Intelligence

- M1: Pages 4–5; map working; provenance badges
- M2: LightGBM + quantiles; conformal calibration; Shadow Freight Model calibrated against a publicly observable route
- M3: Simulator v1 (5 strategies × 1,000 draws); optimiser; PPA daily-report parser running and backfilled
- **Milestone:** `POST /api/v1/simulate-strategy` returns a ranked list. **The USP exists.**

### Week 3: Integration and the risk layer

- M1: Pages 6–7; live wiring; loading/error/infeasible states
- M2: SHAP drivers; model card; full validation grid on the held-out test period
- M3: Risk engine; alerts; performance tuning to hit < 5 s simulation
- **Milestone:** the full demo scenario runs end-to-end without a manual step.

### Week 4: Harden, validate, rehearse

- All: freeze features. Build `data/snapshots/` demo database. Tag `v1.0-demo`.
- M1: polish, demo mode, rehearse the 6-minute run three times
- M2: write the validation section with real numbers, including the losses
- M3: write the limitations section; prepare the constraint-source evidence pack
- **Milestone:** a rehearsed demo that works with the wifi off.

### Risk buffer

Reserve the last 2 days entirely for the unexpected. Every hackathon team that doesn't, regrets it.

---

## 35. MVP (MUST HAVE)

These are required for the demo to make sense. If something here is at risk, cut from §36 first.

| # | Feature | Why it is non-negotiable |
|---|---|---|
| M1 | Freight forecast per class with interval + confidence + trend | PS core requirement (a) |
| M2 | Baseline comparison showing MASE vs naïve | Credibility; answers "why trust it" |
| M3 | Port + berth constraint registry, 7 East Coast ports, verified | PS core requirement (b); our foundation |
| M4 | Origin port registry, ≥ 5 ports across the 5 named geographies | PS names all five |
| M5 | Vessel class profiles from Baltic standard descriptions | Defensible physics |
| M6 | Feasibility filter with rejection reasons | The differentiator, in its simplest form |
| M7 | Cost model with real port tariffs | Turns constraints into money |
| M8 | Charter Strategy Simulator, ≥ 5 strategies, ≥ 1,000 draws | **The USP** |
| M9 | Charter Opportunity Score + timing recommendation | PS requirement (a) |
| M10 | Risk engine with 6 components and an explanation | PS requirement (d) |
| M11 | Pages 1, 2, 3, 4, 6 | Persona coverage |
| M12 | All endpoints in §29 returning real data | Architecture claim |
| M13 | Provenance badges + Data Sources page | Wins jury questions 1–3 outright |
| M14 | The end-to-end demo scenario (§38) | The pitch |

## 36. Advanced Features (SHOULD HAVE)

| # | Feature | Value |
|---|---|---|
| S1 | PPA daily-report parser with 12 months backfilled | **Highest value/effort ratio in the whole project** — real observed waiting times |
| S2 | Empirical bootstrap of waiting times in the simulator | Makes the USP quantitatively real, not assumed |
| S3 | Sandheads lighterage model for Haldia | Nobody else will have it; deeply PS-relevant |
| S4 | Compatibility dataset exported as a downloadable artefact | A tangible deliverable to hand the Ministry |
| S5 | Idle/low-demand regime strip | PS requirement (c) |
| S6 | Ballast/backhaul cost matrix | PS requirement (c) |
| S7 | Risk-aversion slider with live re-ranking | The best 10 seconds of the demo |
| S8 | Pages 5 and 7 | Completeness |
| S9 | SHAP-based plain-English drivers | Explainability |
| S10 | Alerting with thresholds from empirical percentiles | PS requirement (d) |

## 37. Nice to Have (only if genuinely ahead)

| # | Feature | Cut first if |
|---|---|---|
| N1 | Multi-port discharge splitting in the optimiser | Time pressure |
| N2 | Vizag berthing-programme parser | PPA parser is enough to prove the concept |
| N3 | Scenario save/compare across sessions | Demo doesn't need persistence |
| N4 | PDF export of a recommendation | Nice, not decisive |
| N5 | Hindi/Odia UI labels | Only if a Ministry-deployment angle is being emphasised |
| N6 | Individual real-vessel panel from PPA data | Charming, optional |

**Explicitly NOT building:** an AI chatbot, a generic "insights" LLM panel, live AIS, a mobile app, user auth/multi-tenancy, a recommendation "engine" for anything other than chartering. Every one of these costs days and adds nothing a juror will reward.

---

## 38. Validation

### 38.1 What we validate, and how

| Component | Method | Ground truth | Metric |
|---|---|---|---|
| **Freight forecast** | Walk-forward validation, then a single held-out test period | Actual index values | MAE, RMSE, MAPE, **MASE vs naïve**, directional accuracy |
| **Prediction intervals** | Coverage test on the test period | Actual values | Empirical coverage vs nominal 80%; pinball loss |
| **Shadow Freight Model** | Reconstruct a publicly observable voyage route and compare | Published route assessments | MAPE of reconstruction; this becomes our stated uncertainty floor |
| **Vessel selection** | Historical constraint replay | Real vessels that actually called at Paradip (from daily reports) | % of real calls our feasibility filter would have permitted. **Target: ~100% — if we would have rejected a ship that really berthed, our constraints are wrong** |
| **Congestion / waiting** | Backtest the waiting model | Observed `berthed − ready_for_berth` from PPA reports | MAE in hours; calibration plot of predicted vs observed deciles |
| **Turnaround** | Same | Observed `sailed − arrival` | MAE in days |
| **Cost model** | Reconcile against published tariff schedules | Scale of Rates arithmetic | Exact match on the tariff components; the rest is estimate |
| **Optimisation** | Counterfactual replay (§38.2) | Historical fixtures we can reconstruct | Cost delta, with the caveat stated |

### 38.2 The counterfactual comparison — done honestly

**The trap:** claiming "our system saves 12%." You cannot substantiate that without real fixture data, and a juror who has worked in shipping will know it.

**What we do instead — a historical replay with explicit scope:**

1. Take the real Paradip port calls from the daily reports for the last 12 months, filtered to coal imports.
2. For each call, reconstruct the requirement: cargo type, tonnage, date, discharge port.
3. Compute what our system would have recommended, using **only data available before that date** (strict as-of discipline).
4. Compute the simulated cost of our recommendation vs. the simulated cost of the actual choice (actual vessel class, actual arrival timing) — **using the identical cost model for both**, so the comparison is apples to apples.
5. Report the distribution of deltas, not a single headline.

**What this legitimately shows:** whether our recommended class and window would have had lower modelled cost than the class and window actually used — under our cost model. That is a real, meaningful, and *bounded* claim.

**What it does not show:** actual money saved, because we don't know the actual fixture rates. **We say this in the same breath as the result.** For example:

> `[DEMO — structure only]` "Across N=312 reconstructed coal calls at Paradip over 12 months, our recommendation differed from the actual vessel class in X% of cases. In those cases, our modelled total logistics cost was lower by a median of Y% (IQR A–B%). This is a comparison under our own cost model using publicly available freight and tariff data — it is not a claim about realised commercial savings, which would require access to the actual fixture terms."

That paragraph is worth more than any inflated percentage, and it is the kind of thing a Ministry evaluator actually respects.

### 38.3 Additional validation we can genuinely do

| Claim | Validation |
|---|---|
| "We prevent infeasible recommendations" | Replay: 100% of real vessels that berthed pass our filter; and we can enumerate classes that never called at Haldia and confirm our model also excludes them |
| "We predict waiting time" | Backtest MAE against observed PPA waiting times, with a calibration plot |
| "Our intervals are honest" | Coverage plot: nominal vs empirical across horizons |
| "Our compatibility score is meaningful" | Show that ports/classes with higher scores have empirically shorter observed turnaround in the PPA data — a rank correlation with a p-value |
| "Our constraints are current" | Show the constraint-change detection catching a real change (e.g. the Paradip Western Dock capability) |

That fourth row is excellent: a Spearman correlation between our derived compatibility score and *observed* turnaround from independent port records is genuine external validation of a dataset we invented.

### 38.4 What we will label as simulation

- Any cost figure (we have no real fixture prices)
- Any route-level $/tonne (derived, not observed)
- Vessel availability (proxy)
- Origin-port waiting for ports that don't publish queue data
- Contract discount percentage (an assumption, user-editable)

Each of these is `provenance: "derived"` in the API and carries a badge in the UI. **Consistency between what we say on stage and what the UI says is itself a credibility signal.**

---

## 39. Demo Scenario

### 39.1 The scenario

```
Cargo        : 120,000 tonnes coking coal
Origin       : Hay Point, Queensland, Australia
Destination  : Paradip, Odisha
Required by  : 25 October
Contract     : considering a 3-voyage short-term contract
```

Chosen deliberately: it is realistic (Paradip genuinely receives Hay Point coking coal — its first Capesize call in September 2026 carried exactly that), it is large enough that the vessel-class question is non-trivial, and the deadline is tight enough that timing matters.

### 39.2 The 6-minute run

**0:00–0:30 — The problem, through one person.**
"Ravi charters coal for a steel plant. Today he calls three brokers, compares three quotes, and fixes. He has no view of next month, and no model of whether the ship he just fixed can actually berth efficiently at Paradip in October."

**0:30–1:15 — Page 1, Executive Dashboard.**
Market state. Indices, volatility, the alert strip. *"This is the market. Now watch what we do with it that a market screen doesn't."*

**1:15–2:15 — Page 2, Charter Planner. Enter the requirement.**
Show the inputs going in. Show the recommendation card appear. Read the five reasons aloud. Point at the cost breakdown bar.

**2:15–3:00 — Page 4, Port Intelligence. The constraints.**
Click Paradip. Show the berth table with real LOA/beam/draft, including the coupling constraint. Click Haldia. Show the 9 m draft and the lighterage flag. *"This is why the answer isn't just 'charter the cheapest ship.'"*

**3:00–4:15 — Page 6, Charter Strategy Simulator. The USP.**
Show the five strategies. Show the cost distribution overlay. Point at the infeasible row with its reason. **Then drag the risk-aversion slider** and let the ranking re-order live. *"At low risk tolerance the Panamax wins on expected cost. At high risk tolerance, two Supramaxes win because the tail is thinner. Most tools can't even ask this question."*

**4:15–5:00 — Page 3 + Page 7. Honesty and risk.**
Show the model scorecard *including the horizon where the naïve baseline beats us*. *"We report where we lose. At 7 days the market is close to a random walk and we say so. Our edge is at 4 weeks and beyond, and in the decision layer."* Then the risk panel with its main driver.

**5:00–5:45 — Data provenance.**
Open the Data Sources page. *"Every number traces to a named source with a retrieval date. Port constraints from Paradip Port Authority's own marine notifications. Port costs from the TAMP-approved Scale of Rates. Vessel profiles from the Baltic Exchange's published standard vessel descriptions. Waiting times computed from Paradip's own daily traffic reports. Weather from Open-Meteo. Nothing here is invented."*

**5:45–6:00 — The close.**
*"Forecast the market, understand the constraints, simulate the strategies, recommend the decision. That's the move from reactive spot fixing to proactive contracting, which is exactly what the problem statement asks for."*

### 39.3 The output card format

```
╔══════════════════════════════════════════════════════════════════╗
║  RECOMMENDED STRATEGY                              [DEMO FORMAT] ║
╠══════════════════════════════════════════════════════════════════╣
║  3 × Supramax                                                    ║
║  Contract: Short-term multiple-voyage (3 voyages)                ║
║                                                                  ║
║  Charter window       18 – 23 September                          ║
║  Expected cost        ₹ <computed>   ($ <computed>)              ║
║  Cost range (80%)     ₹ <lo> – ₹ <hi>                            ║
║  Deadline risk        <p>%  of simulations miss 25 Oct           ║
║  Overall risk         MEDIUM                                     ║
║  Opportunity score    78 / 100                                   ║
║                                                                  ║
║  WHY                                                             ║
║   ✓ Port compatible — clears Paradip coal berth limits at 98%    ║
║     of vessel capacity                                           ║
║   ✓ Freight outlook favourable — BSI forecast band sits below    ║
║     its 3-year October median                                    ║
║   ✓ Lower expected waiting than Panamax at Paradip in October    ║
║   ✓ Meets the 25 October deadline with slack                     ║
║   ✓ Lowest risk-adjusted cost among feasible options             ║
║                                                                  ║
║  NOT RECOMMENDED                                                 ║
║   ✗ Capesize via Haldia — draft 17.8 m vs 9.0 m permissible      ║
║   ✗ 3 × Handysize — meets deadline but higher per-tonne cost     ║
║                                                                  ║
║  Freight figures derived (shadow model) · Port costs from        ║
║  published Scale of Rates · Waiting times from PPA daily reports ║
╚══════════════════════════════════════════════════════════════════╝
```

Every `<computed>` is filled by the pipeline. **Nothing is typed in by hand.** If a number isn't ready by demo day, the card shows a loading state — which is still better than a fabricated figure a juror might probe.

---

## 40. Jury Questions

### 1. Where did you get the data?

Named, per dataset. Port constraints from the port authorities' own marine department notifications — Paradip's berth-wise permissible LOA/beam/draft notice, Visakhapatnam's allowable drafts table for inner and outer harbour. Port costs from the TAMP-approved Scale of Rates published by each port. Vessel profiles from the Baltic Exchange's published standard vessel descriptions for each index. Congestion and turnaround from Paradip Port Authority's daily traffic reports. Commodity and energy prices from the World Bank Pink Sheet. Coal import volumes from data.gov.in and the IPA monthly releases. Weather from the Open-Meteo Marine API and IMD. We have a live `/api/v1/sources` endpoint that lists all of it with licences and retrieval dates.

### 2. Is the data publicly available?

Yes for everything we use, and we distinguish four tiers in our documentation: open government data under the GoI Open Data Licence, publicly published documents from port authorities, free keyless APIs, and hand-curated data we transcribed from public PDFs and verified. Where a dataset is commercial — route-level freight assessments, Bay of Bengal AIS, broker position lists — we say so and do not use it.

### 3. Can you legally scrape it?

We wrote a policy and we follow it: official API > official download > open-licensed dataset > permitted low-rate scraping > manual curation. Every fetcher checks robots.txt, rate-limits to one request every two seconds per host, and sends a truthful User-Agent with our contact address. We do not bypass logins, paywalls or CAPTCHAs — which is exactly why we do not have Baltic's licensed feed or MarineTraffic's AIS, and why our design works without them.

### 4. Why should anyone trust your freight forecast?

Two reasons. First, because we validate it against the naïve baseline and report MASE, and we show you the horizons where we lose. Second, and more importantly, because **we don't ask you to trust a point estimate.** We give a calibrated interval whose coverage we test, and the decision layer consumes the whole distribution. If our forecast is uncertain, the recommendation gets more conservative automatically.

### 5. Why not simply use the Baltic index?

The Baltic index is an input to our system, not a competitor to it. The index tells you the market level. It does not tell you whether a Capesize can berth at Haldia, what Paradip's coal berth will cost you in berth hire, how long you'll wait in October, whether two Supramaxes beat one Panamax for your parcel, or whether to commit to three voyages now. The index is one of about fifteen inputs to the decision we actually make.

### 6. What happens if your forecast is wrong?

Three answers. Design: the interval is calibrated, so "wrong" mostly means "inside the band we told you about." Decision: the risk-adjusted objective includes a CVaR term, so we deliberately prefer strategies whose *tails* are thinner, which protects you precisely when the forecast is wrong. Product: the sensitivity view shows you whether the recommendation would flip under a different freight outcome — if it would, we tell you it's a close call.

### 7. How is this different from existing maritime software?

Existing tools split cleanly into two camps: market data terminals (Baltic, Clarksons, Platts) that tell you prices but know nothing about Paradip's berth coupling constraints; and port/terminal operating systems that manage a port but know nothing about the freight market. Nothing in either camp answers a charterer's question — *for this cargo, to this port, by this date, what should I do?* — with both the market and the physical constraints in one model. Also: those are commercial products priced for shipowners. This is built for a Ministry user, on public data, and it runs from a local snapshot with no external subscription.

### 8. How do you calculate vessel compatibility?

Hard constraints first: LOA, beam and draft against the specific berth, with under-keel clearance and tide allowance. Then draft-limited cargo intake using tonnes-per-centimetre from the Baltic standard vessel description. Then a score that is the geometric mean of four interpretable ratios — capacity utilisation, productive-time fraction, cost relative to the best feasible option, and weather reliability. No invented weights. And we validate it: ports and classes with higher scores show empirically shorter observed turnaround in Paradip's own records.

### 9. How do you handle incomplete data?

Explicitly, in four ways. Missing is not zero — every numeric field distinguishes null from zero. Every value carries a `verification` flag and the UI badges anything unverified. Where a dataset doesn't exist, we build a documented proxy and label it `derived`, never `measured`. And where we have no basis at all — origin-port waiting times for ports that publish nothing — we widen the uncertainty rather than guess a number, which makes the recommendation appropriately less confident.

### 10. What happens when port infrastructure changes?

It already has — Paradip berthed its first 16.5 m draft Capesize this month at a dock that wasn't in the older notifications. Our design anticipates this: constraints live in a versioned table with `effective_from`/`effective_to`, so a change is an insert and history is preserved. A weekly job hashes each source document and raises a review when it changes. And the UI always shows "constraints as of" so a user never acts on a stale limit without knowing it.

### 11. How do you handle uncertainty?

Conformal prediction for the forecast intervals, which gives a finite-sample coverage guarantee rather than a model-dependent one. Empirical bootstrap for waiting times, drawn from real observed port data rather than an assumed distribution. Monte-Carlo propagation through the entire cost model. And a decision objective that includes conditional value at risk, so uncertainty changes the *answer*, not just the error bar.

### 12. Why ML?

Only where it earns its place. We use gradient boosting for the freight forecast because it beats the linear and classical baselines on our validation protocol, and quantile regression for the intervals. We do not use ML for feasibility — that's physics and regulation, and it should be deterministic. We do not use deep learning, because on roughly 5,000 daily observations it did not beat LightGBM and we're not going to ship complexity that doesn't win.

### 13. Why not just use optimization?

Because the inputs to the optimisation are uncertain. An optimiser fed a point-estimate freight rate will confidently produce the wrong plan. The forecast supplies the distribution; the simulator propagates it; the optimiser chooses under it. Take either half away and you get a system that is confidently wrong or descriptively useless.

### 14. How do you calculate cost savings?

Carefully, and with a stated boundary. We replay historical coal calls at Paradip reconstructed from the port's own daily reports, compute what our system would have recommended using only data available at the time, and compare *modelled* total logistics cost between our choice and the actual choice using the identical cost model for both. That gives a defensible relative comparison. It does not give realised commercial savings, because we don't have the actual fixture terms — and we say so every time we quote the number.

### 15. Who is the actual end user?

The chartering manager in the raw-materials division of a steel producer — someone who fixes 40 to 60 vessels a year and is measured on landed cost per tonne and on never stopping the furnace. Secondarily the procurement head deciding whether to go to a contract of affreightment, and the Ministry analyst who wants to know where congestion is eating money across the sector. We designed a different page for each.

### 16. Can this work for real Ministry operations?

The architecture can: it's a standard Postgres + FastAPI + React stack that runs on a single server and works from a local snapshot with no internet dependency. What a production deployment would add is licensed data — route-level freight assessments, AIS coverage of the Bay of Bengal, and an integration with the port community system for live berth status. We've scoped exactly what each would improve. The constraint and cost layer, which is the hard part, is already built on the real official sources a Ministry deployment would use.

### 17. What happens if AIS data isn't available?

It isn't, and the system is designed around that. There is no free, legally usable AIS feed covering the Bay of Bengal — the open AIS datasets are Danish, Norwegian and American waters. So we derive congestion from something better for this purpose: the ports' own published daily traffic records, which give us observed arrival, ready-for-berth, berthing and sailing times, *and* the port's own coded reason for each delay. AIS can't tell you a ship waited because the terminal wasn't ready. The port's record can.

### 18. What is your USP?

The Charter Strategy Simulator. We don't just predict freight — we enumerate the chartering strategies you could actually execute, filter them against the real physical limits of both ports, simulate each one thousands of times across sampled freight, bunker, waiting and weather outcomes, and rank them on risk-adjusted landed cost with an explicit deadline-miss probability. The output isn't a price. It's a decision, with its downside quantified.

### 19. Why would a chartering manager trust your recommendation?

Because we show our working at every level. Every recommendation lists the options we rejected and the exact constraint that killed each one. Every number has a source and a date. Every assumption is visible and editable. The risk-aversion slider lets him see whether the answer is robust or marginal. And we tell him when we don't know — the confidence score drops automatically when our recent forecasts have been poorly calibrated. He doesn't have to trust us; he can check us.

### 20. How would the system scale to other ports?

Adding a port is a data operation, not a code change — insert rows into `dim_port`, `dim_berth` and `dim_port_tariff` from that port's published notifications and Scale of Rates. The feasibility rules, cost model, simulator and optimiser are all port-agnostic. The cost is the hand-verification of the constraint data, which is roughly an hour per port and is exactly the kind of work that should be verified by a human anyway. For 12 major ports plus significant non-major ports, that is a day or two of careful work, not a rewrite.

### Bonus: "Three teams have already submitted ideas on this PS. Why yours?"

Most submissions on a forecasting PS build a forecast plus a dashboard. We assume that's the field. Our answer is that the forecast is the commodity part — anyone can fit a model to the BDI. The parts that are hard and that we actually built are the verified port constraint registry including berth coupling and tidal restrictions, the Sandheads lighterage model for Haldia, waiting-time distributions bootstrapped from the ports' own daily records, and a simulator that ranks strategies on risk-adjusted cost rather than expected cost. Those are the things a chartering manager would pay for and the things that take real work.

---

## 41. Limitations

We state these before a juror finds them. Owning a limitation converts it from a weakness into evidence of rigour.

1. **No route-level freight ground truth.** Our $/tonne figures are derived from index levels, distances, vessel consumption and published tariffs, calibrated against a publicly observable route. They are estimates with a stated error band, not assessments.
2. **No AIS in our region of interest.** Congestion is derived from published port records, which cover Paradip well, Visakhapatnam partially, and the private ports (Dhamra, Gangavaram, Gopalpur) not at all. For those, waiting times are modelled from class and traffic, with wider uncertainty.
3. **No vessel availability data.** Our availability signal is a derived proxy, not a position list. It can be wrong about a specific ship on a specific date.
4. **Class-level, not ship-level.** We model a representative Panamax, not the actual vessel you'll be offered. Real ships vary in consumption, age and gear.
5. **No fixture data means no realised-savings claim.** We can compare modelled costs. We cannot claim rupees saved.
6. **Port tariffs are complex.** Scale of Rates documents have slabs, concessions, penal rates and coastal/foreign distinctions. We implement the principal vessel-related charges and approximate the rest, and we list what we approximate.
7. **Contract discount is an assumption.** The benefit of a multi-voyage contract is a negotiated commercial term. We expose it as a user-editable parameter with a documented default range rather than pretending to know it.
8. **Constraints go stale.** Ports dredge and commission berths. We version and monitor, but there is a lag between a change and our table.
9. **The simulator assumes independence** between some sampled quantities (e.g. freight and waiting) that are in reality weakly correlated. We note this; a copula-based extension is future work.
10. **Sea distances are estimates.** `searoute` is explicitly documented as a visualisation-grade router, not a navigation tool. Fuel estimates inherit that error.
11. **Origin-port modelling is uneven.** Australian ports are excellently documented by Maritime Safety Queensland; Mozambican and Russian ports much less so, and the Russian lane carries route-risk considerations we flag but do not fully model.
12. **Not a real-time system.** Data refreshes daily at best. This is a planning tool on a days-to-weeks horizon, not an operational one.

---

## 42. Future Scope

| Horizon | Extension | Why it matters |
|---|---|---|
| Immediate | License route-level freight assessments (Baltic/Platts) | Replaces the shadow model with ground truth; collapses our largest uncertainty |
| Immediate | License regional AIS | Live congestion and genuine vessel availability; turns the proxy into a measurement |
| Near | Integrate with the Port Community System / Sagar Setu | Live berth allocation and vessel status direct from the source |
| Near | Extend to all 12 major ports + significant non-major ports | Pure data work; architecture already supports it |
| Near | Multi-cargo, multi-port portfolio optimisation | Optimise a quarter's entire import programme, not one parcel |
| Medium | FFA-aware hedging recommendations | Suggest paper hedges alongside physical fixtures |
| Medium | Copula-based dependence in the simulator | More honest tail risk |
| Medium | Demurrage/laytime clause optimiser | Recommend laytime terms given predicted waiting — directly monetisable |
| Medium | Inland leg integration (rail to plant) | True door-to-door landed cost, which is what the Ministry actually cares about |
| Longer | Emissions and CII-aware routing | Speed/consumption trade-offs under carbon regulation |
| Longer | Counterparty performance scoring | Owner reliability as a risk input |
| Longer | Federated deployment across steel PSUs | Shared congestion intelligence without sharing commercial terms |

---

## 43. Coverage Audit — every PS requirement

| # | PS Requirement (verbatim intent) | Covered? | Where |
|---|---|---|---|
| 1 | Predict future freight rates with accuracy for various vessel types | ✅ | §22, §29 `/forecast`, Page 3 |
| 2 | …and trade routes | ✅ (derived) | §17.4 Shadow Freight Model; badged `derived` |
| 3 | Historical freight rate data for various vessel sizes | ✅ | §9.1, §17.1 — BCI/BPI/BSI/BHSI |
| 4 | Across relevant trade routes | ✅ | §17.2 route anchoring |
| 5 | Global economic indicators | ✅ | §19, with an ablation test so we only keep what helps |
| 6 | Commodity price trends | ✅ | §18, §19 — Pink Sheet |
| 7 | Seasonal variations in demand and supply | ✅ | §17.5 seasonality features, §20.3 calendar, §26.3 |
| 8 | Real-time port congestion, origin and destination | ✅ (daily, not real-time) | §16.3, §9.2 — PPA daily reports; limitation stated |
| 9 | Infrastructure constraints: max LOA, beam, draft | ✅ | §14, `dim_berth` |
| 10 | Cargo handling rates | ✅ | `dim_berth.handling_rate_tpd`, §21 |
| 11 | Similar data for loading ports (Australia, US, Mozambique, Indonesia) | ✅ | §9.3, §14 origin registry |
| 12 | Russia as an origin | ✅ | §9.3 + explicit route-risk flag (§27.1) |
| 13 | (a) Optimal market entry timing for short/mid-term contracts | ✅ | §23 COS, §25 timing variable, Page 2 |
| 14 | (a) Minimising freight costs | ✅ | §25 objective |
| 15 | (b) Recommend most suitable vessel type for cargo volume + O/D | ✅ | §24, `/recommend-vessel`, Page 5 |
| 16 | (b) Considering port infrastructure at BOTH loading and discharge | ✅ | §24.1 — feasibility evaluated at both ends |
| 17 | (b) Factoring draft, LOA, handling to prevent idle time | ✅ | §21 intake calc, §26.2 |
| 18 | (b) Ensure efficient turnaround | ✅ | §21 turnaround estimate, §38 validated against PPA data |
| 19 | (c) Minimise idle time | ✅ | §26.2 |
| 20 | (c) Forecast periods of low demand | ✅ | §26.3 |
| 21 | (c) Suggest alternative employment opportunities | ✅ | §26.4 (charterer-framed) |
| 22 | (c) Optimised positioning to reduce deadheading | ✅ | §26.4 ballast cost matrix |
| 23 | (d) Early warnings for market volatility | ✅ | §27.1 market risk, §27.4 alerts |
| 24 | (d) Early warnings for port congestion | ✅ | §27.1 port risk, §27.4 |
| 25 | (d) Other disruptions | ✅ | §27.1 weather/route/demand risk |
| 26 | User-friendly dashboard interface | ✅ | §30 — 7 pages |
| 27 | Input cargo details | ✅ | Page 2 form, `/optimize-charter` |
| 28 | Input origin/destination ports | ✅ | Page 2 |
| 29 | Input desired contract duration | ✅ | Page 2 `contract_horizon_voyages` |
| 30 | Receive comprehensive freight forecasts | ✅ | Page 2 + Page 3 |
| 31 | Receive actionable recommendations | ✅ | Recommendation card with 5 reasons |
| 32 | **Objective: move from single spot contracts to short/medium-term multiple voyage contracts** | ✅ | §28 simulator explicitly compares spot vs. multi-voyage; §25 constraint C8/C9; Page 6 |
| 33 | Move from reactive to proactive predictive chartering | ✅ | Entire COS + timing + window design |
| 34 | Cost reductions | ✅ | §38.2 — measured honestly |
| 35 | Improved supply chain efficiency | ✅ | Waiting/turnaround/idle reduction, §38.3 |
| 36 | Enhanced decision-making | ✅ | Explanations, rejected options, sensitivity |
| 37 | Handysize / Supramax / Panamax / Capesize specifically | ✅ | All four, from Baltic standard descriptions |
| 38 | Paradip, Vizag, Gangavaram, Gopalpur, Dhamra, Sagar-Sandheads, Haldia | ✅ | All seven in §14.3; Haldia/Sandheads given special treatment in §14.4 |

**Result: 38 / 38 covered.** Two are covered with a stated derivation rather than measurement (#2 route-level rates, #8 daily rather than real-time congestion), and both are labelled as such in the product itself.

---

## 44. Data Feasibility Audit

| Required Data | Source | Availability | Acquisition Method | Fallback if unavailable |
|---|---|---|---|---|
| BDI daily history | Baltic Exchange / public index history | 🟢 | Download | Rebuild composite from the sub-indices using published weights |
| BCI / BPI / BSI / BHSI daily | Same | 🟢/🟡 | Download | Use BDI + published class weights to back out approximate class levels; label derived |
| Baltic standard vessel descriptions | balticexchange.com | 🟢 | Manual transcription | Ship-register class averages from IMO GISIS |
| Class TC average $/day | Public market reporting | 🟡 | Manual/parse | Derive from index level via the published index-to-TCE relationship |
| Route-level $/t voyage freight | Platts / Argus / Baltic licensed | 🔴 | — | **Shadow Freight Model §17.4**, calibrated against a publicly observable route and quoted with that reconstruction error as its floor |
| FFA forward curve | Exchange/broker | 🔴 | — | Use our own forecast band; state that we cannot benchmark against FFA |
| Paradip berth constraints | PPA marine notification PDF | 🟢 | Download + manual verify | Port handbook / agent circulars, clearly marked lower-confidence |
| Paradip daily traffic (congestion) | PPA daily report PDFs | 🟢 | Automated fetch + parse | IPA monthly turnaround & pre-berthing detention as a coarser substitute |
| Vizag berth constraints | VPA marine dept PDF | 🟢 | Download + verify | VPA Harbour & Berth Facilities web page |
| Vizag berthing programme | VPA site | 🟡 | Fetch + parse | IPA monthly figures |
| Gangavaram / Dhamra / Gopalpur constraints | Operator pages + Odisha Directorate of Ports & IWT | 🟡 | Manual entry | State maritime board publications; mark lower confidence |
| Gangavaram / Dhamra / Gopalpur congestion | Not published | 🟠 | — | Model waiting from class + monthly traffic with **wider intervals**; badge as modelled |
| Haldia / SMPK draft restrictions | SMPK marine trade notices | 🟡 | Fetch + manual read | Published port limits with a note that notices override |
| Sandheads lighterage rates | SMPK Scale of Rates | 🟡 | Download + manual entry | Parameterise as a user-editable assumption |
| Port tariffs (all ports) | TAMP-approved Scale of Rates PDFs | 🟢 | Download + manual entry | Use a comparable port's SoR as a proxy, clearly labelled |
| IPA monthly port performance | ipa.org.in (site migrated from ipa.nic.in) | 🟡 | Download + parse | MoPSW annual reports; data.gov.in port indicators |
| "Major Ports of India: A Profile" | IPA | 🔴 (sold for Rs 4,000) | — | Assemble the same fields from individual port sites — which we're doing anyway |
| Australian coal port constraints | Maritime Safety Queensland port procedure manuals; DBCT, GPC, PWCS/NCIG handbooks | 🟢 | Download + manual entry | Port authority web pages |
| Newcastle coal queue | HVCCC weekly (member-facing); appears in market press | 🟠 | — | Model origin waiting from throughput and berth count; widen intervals |
| Indonesian / Mozambican / Russian port constraints | Operator and authority sites | 🟡/🟠 | Manual entry | Use a class-representative "typical export terminal" profile, explicitly labelled as a generic profile |
| US coal port constraints | Port authority + USACE channel depths | 🟢 | Download | — |
| Bay of Bengal AIS | Commercial | 🔴 | — | **Port daily reports (§16.3)** — arguably better for our purpose, and we make that argument |
| Vessel particulars (individual) | IMO GISIS / Equasis (free registration) | 🟡 | Registered access, no redistribution | **Extract real vessels from PPA daily reports** (§15.3) — free, official, India-specific |
| Vessel open positions / availability | Broker lists | 🔴 | — | Derived availability proxy (§15.5), explicitly labelled |
| World fleet by class | UNCTADstat | 🟢 | Download | — |
| India coal imports by country | data.gov.in | 🟢 | API/CSV | UN Comtrade HS 2701 |
| Monthly coking/thermal coal by port | IPA monthly | 🟡 | Parse | Ministry of Coal statistics; note CCO discontinued Provisional Coal Statistics after 2021-22 |
| Coal / iron ore / crude prices | World Bank Pink Sheet | 🟢 | XLSX download (discover the hashed URL from the Commodity Markets page) | EIA for crude; IMF primary commodity prices |
| Bunker prices | Public bunker price pages | 🟡 | Fetch | **Derive from Brent with a fitted spread**, labelled derived |
| USD/INR | RBI | 🟢 | Download | — |
| India IIP / steel output | MoSPI / Joint Plant Committee | 🟢 | Download | — |
| Marine weather (waves, wind) | Open-Meteo Marine + Forecast APIs | 🟢 | API, keyless | Copernicus Marine (registration); NOAA WAVEWATCH III |
| Cyclone warnings | IMD / RSMC New Delhi | 🟡 | Fetch bulletins | IBTrACS climatology only |
| Historical cyclone tracks | NOAA IBTrACS | 🟢 | Download | — |
| Sea distances | `searoute` (Apache-2.0) | 🟢 | Compute locally | Eurostat SeaRoute (Java); published distance tables for spot checks |

**Red-flag summary:** five datasets are genuinely unavailable to us (route-level freight, FFA, regional AIS, vessel open positions, the paid IPA profile). Every one has a documented fallback, and none of them blocks the MVP. That is the single most important line in this document.

---

## 45. WHAT WE SHOULD BUILD FIRST

Ten concrete tasks, in strict order, starting the moment you finish reading this.

---

**Task 1 — Verify every source yourself, today. (All three. 3 hours.)**
Open every URL referenced in §10 and §44. Confirm it loads, confirm the file downloads, note the exact path. Record each in `docs/REFERENCES.md` with the date and a screenshot in `docs/evidence/`. Websites move — the IPA site has already migrated from `ipa.nic.in` to `ipa.org.in`, and Paradip has reorganised its PDF paths. **Do not write a single line of ingestion code before this is done.** If a source is dead, you need to know now, not in week three.

---

**Task 2 — Hand-build `data/reference/berths.csv`. (M3. 4–6 hours.)**
Download the berth constraint PDFs for Paradip and Visakhapatnam. Type the berth table into a CSV by hand: berth name, cargo types, max LOA, min LOA, max beam, max draft, tide allowance, coupling constraint, status, source URL, retrieved date. Then add the best available rows for Gangavaram, Dhamra, Gopalpur, Haldia and Sandheads. Have a second team member independently re-check ten rows against the source and sign `docs/verification_log.md`.

This is ~60 rows of typing and it is the single highest-value artefact in the project. It is what makes you different from every "BDI forecast dashboard" in the room.

---

**Task 3 — Get the freight index history loading. (M2. 3 hours.)**
Postgres up via docker-compose. `fact_freight_index` created. A script that downloads BDI plus the four class indices and loads them with provenance columns populated. Plot all five. Sanity-check a handful of recent values against a second public source and record the check.

---

**Task 4 — Freeze the API contract. (All three, together, 2 hours. Do this on Day 3, not later.)**
Sit in one room. Walk through the eight endpoints in §29. Agree every field name and type. Write `docs/api_contract.md`. Generate JSON fixtures for `frontend/src/api/mock/`. From this moment, Member 1 is independent and can build all seven pages without waiting for anyone.

This meeting is the difference between a team that integrates in week 4 and a team that integrates on the last night.

---

**Task 5 — Build the Paradip daily traffic report parser. (M3. 1 full day.)**
Download 30 days of PPA daily traffic PDFs. Write a parser that extracts, per vessel row: name, cargo, berth, tonnage, draft, LOA, beam, arrival time, ready-for-berth time, berthed time, ETD, delay reason code. Validate hard (draft 3–20 m, LOA 80–400 m, arrival ≤ berthed ≤ sailed) and quarantine failures. Load into `fact_port_call`.

The moment this works you have **observed waiting times at an Indian port** — which is the dataset that makes your congestion model, your simulator, and your validation section all real. Expect the parsing to be fiddly; budget the full day.

---

**Task 6 — Baseline forecasts with a completed metrics grid. (M2. 1 day.)**
Naïve, moving average and seasonal naïve for all four class indices at all six horizons. Walk-forward validation. Produce the full MAE/RMSE/MAPE/MASE table. **Write down the naïve MASE numbers — that is the bar every later model must clear.** If LightGBM later fails to clear it at 7 days, you report that, and it makes you more credible, not less.

---

**Task 7 — Cost model as pure, tested functions. (M3. 1 day.)**
`cost_model.py` with no database access and no I/O: functions that take explicit parameters and return a cost breakdown. Port dues, pilotage, berth hire and wharfage computed from the `port_tariffs.csv` slabs. Bunker from distance, speed and consumption. Waiting cost, demurrage, lighterage. Write unit tests with hand-computed expected values for at least five cases.

Pure functions here means the simulator can call this a million times and you can debug any single result by hand at midnight. That property is worth the discipline.

---

**Task 8 — Build the compatibility dataset and look at it. (M3. Half a day.)**
Run the intake and feasibility calculations across port × berth × class × cargo × season. Write `derived_compatibility`. Export it as a CSV.

Then **actually read it.** Does it say a Capesize can't berth at Haldia? Good. Does it say a Handysize is a poor fit for 120,000 t? Good. Does it say something surprising? Either you found a real insight or you found a bug — both are valuable, and finding them now is a lot cheaper than finding them on stage.

---

**Task 9 — Simulator v1, five strategies, end to end. (M3, with M2 supplying the forecast distribution. 1.5 days.)**
Wire: forecast distribution → strategy enumeration → feasibility filter → Monte-Carlo over the cost model → ranked results with mean, P10, P90, CVaR and deadline-miss probability. 1,000 draws. Expose it at `POST /api/v1/simulate-strategy`.

**When this returns a ranked list with one row marked INFEASIBLE and a reason, your USP exists.** Everything after this is improvement; this is the thing that wins.

---

**Task 10 — Run the full demo scenario end to end and write down what breaks. (All three. Half a day.)**
120,000 t coking coal, Hay Point → Paradip, by 25 October, 3-voyage horizon. Type it into the real UI. Click through Pages 1, 2, 4 and 6. Write down every crash, every ugly number, every missing state, every place a juror would ask a question you can't answer.

That list is your week-2 backlog, and it will be more accurate than any plan you could write today.

---

### The ordering logic, briefly

Tasks 1–2 protect you from the project's single biggest risk: discovering in week three that the data isn't there. Tasks 3–4 unblock all three members in parallel. Task 5 buys you the dataset nobody else will have. Tasks 6–9 build the differentiator from the bottom up, each one testable in isolation. Task 10 converts optimism into a list.

**If you only get through Tasks 1, 2, 4, 5 and 9, you still have a competitive submission**, because you will have verified data, a real constraint registry, real observed port waiting times, a clean team interface, and a working strategy simulator. Everything else is polish on top of a solid thing.

---

## 46. References / Data Sources

*To be maintained live in `docs/REFERENCES.md` with retrieval dates. Grouped by category. Every URL must be verified by the team before the submission (Task 1).*

**Freight & market**
- Baltic Exchange — Dry services: index methodology and standard vessel descriptions (BHSI/BSI/BPI/BCI) — `balticexchange.com/en/data-services/market-information0/dry-services.html`
- Public BDI/sub-index historical series (verify the specific provider and its terms before use)

**Indian ports**
- Paradip Port Authority — berth specifications, marine department berth LOA/beam/draft notifications, daily traffic reports, Scale of Rates — `paradipport.gov.in`
- Visakhapatnam Port Authority — harbour & berth facilities, allowable LOA/beam/draft (inner & outer harbour), berthing programme, Scale of Rates — `vizagport.com` / `vpt.shipping.gov.in`
- Syama Prasad Mookerjee Port, Kolkata — Haldia Dock Complex, marine department trade notices, Scale of Rates
- Indian Ports Association — reports & statistics (**site migrated to `ipa.org.in`**)
- Ministry of Ports, Shipping and Waterways — `shipmin.gov.in`
- Open Government Data Platform India — port sector indicators, country-wise coal imports — `data.gov.in`
- Government of Odisha, Commerce & Transport Department, Directorate of Ports & IWT — Dhamra, Gopalpur — `ct.odisha.gov.in`
- Adani Ports & SEZ — Dhamra, Gangavaram, Gopalpur port pages
- Tariff Authority for Major Ports — Scale of Rates framework

**Origin ports**
- Maritime Safety Queensland — Port Procedures and Information for Shipping: Hay Point, Gladstone, Abbot Point — `msq.qld.gov.au`
- Dalrymple Bay Coal Terminal — shipping information — `dbct.com.au`
- Gladstone Ports Corporation — Port Handbook, trade statistics — `gpcl.com.au`
- Port of Newcastle / Port Authority of NSW; PWCS and NCIG terminal handbooks
- US Army Corps of Engineers — channel depths; US port authority pages

**Commodity, macro, trade**
- World Bank Commodity Markets ("Pink Sheet") — monthly price workbook
- Ministry of Coal / Coal Controller's Organisation (note: Provisional Coal Statistics discontinued after 2021-22)
- Ministry of Commerce — Export Import Data Bank (tradestat)
- UN Comtrade — bilateral trade by HS code
- Reserve Bank of India — reference exchange rates
- MoSPI; Joint Plant Committee — industrial and steel production
- UNCTADstat — world merchant fleet by vessel type

**Weather**
- Open-Meteo Marine Weather API — `marine-api.open-meteo.com` (free, no API key)
- Open-Meteo Forecast / Historical Weather API
- India Meteorological Department / RSMC New Delhi — cyclone bulletins — `mausam.imd.gov.in`
- NOAA IBTrACS — historical cyclone tracks

**Tools & libraries**
- `searoute` (PyPI, Apache-2.0) — maritime distance estimation (documented as visualisation-grade, not for navigation)
- Eurostat SeaRoute (Java)
- Google OR-Tools — CP-SAT and MILP solvers
- LightGBM, scikit-learn, statsmodels, pandas, NumPy
- FastAPI, SQLAlchemy, PostgreSQL
- React, Vite, Apache ECharts, Leaflet / OpenStreetMap

**Open AIS (for completeness — none cover our region)**
- Danish Maritime Authority — historical AIS
- Norwegian Coastal Administration (Kystverket) — AIS under NLOD
- NOAA Office for Coastal Management — US historical AIS

---

*End of blueprint. Keep this document in `docs/` and update it as reality contradicts it — a blueprint that never changes is a blueprint nobody is using.*
