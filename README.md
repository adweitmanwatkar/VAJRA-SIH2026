# VAJRA

**Climate-Adaptive Shelter Design — simulate, compare and optimize shelter configurations for area-specific thermal comfort.**

Decision-support prototype for **Smart India Hackathon 2026 · Problem Statement SIH26051** — *"Software Based Model Development for Design of Area Specific Shelter for Thermal Comfort Maintenance"* (DRDO).

> ⚠️ **What this is:** a hackathon-grade screening/decision-support prototype using reference material properties and representative climate data. It is **not** a certified DRDO engineering solver, uses **no classified or DRDO-authorized datasets**, and does **not** run ANSYS or any external high-fidelity solver.

---

## What it does

1. **Acquire climate data** for a selected location (NASA POWER live fetch → local cache, built-in representative profiles, or user CSV upload).
2. **Configure a shelter** (geometry, occupancy, openings, materials, insulation, thermal mass, orientation) with a live schematic.
3. **Run a deterministic, physics-based transient simulation** (single-zone RC heat balance, hourly climate series, 1–15 min integration steps).
4. **Analyse results** — indoor/outdoor temperature, comfort accounting, heat-flow decomposition, cumulative energy balance, auxiliary energy demand.
5. **Compare candidate designs** under the *same* climate input.
6. **Optimize** via a constrained parameter sweep (deterministic, no black-box AI) with transparent trade-offs.
7. **Recommend** the best configuration *under the selected assumptions* — explicitly stating when active heating/cooling is unavoidable.
8. **Generate an engineering report** (print/PDF + Markdown export) assembled from actual computed results.

## Quick start

```bash
cd vajra
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build (dist/ works offline from file://)
```

**Demo flow (3–5 min):** open the app → click the **Leh — High Altitude Cold Shelter** card → **Run Thermal Simulation** → **View Results** → **Compare Designs →** add candidates A/B/C → **Run All** → **Run Optimization** → review the recommendation → **Reports** → Print/Export → **Climate** page → *Fetch live NASA POWER data* and the cache table.

## Architecture

```
src/
  domain/types.ts        Data model: DesignCase, Location, ClimateProfile, ClimatePoint,
                         Shelter, Material, SimulationResult, CandidateDesign,
                         Comparison, Recommendation, OptimizationReport, Report
  climate/
    synthetic.ts         Seeded representative profiles (deterministic, NASA-POWER schema)
    nasa.ts              NASA POWER hourly point API client (graceful failure)
    service.ts           Climate cache (localStorage), CSV upload, summary statistics
  engine/
    solar.ts             Solar geometry, isotropic sky split (beam/diffuse/ground)
    envelope.ts          Layered assemblies → U-values, areal heat capacity
    thermal.ts           Transient single-zone RC heat balance + PMV/PPD + aux demand
    simulateService.ts   Orchestration, staged progress, input validation
  services/
    store.ts             Persistence (localStorage; swap for REST + SQLite/Postgres later)
    demo.ts              Leh / Jaisalmer / Srinagar demo scenarios
    analysis.ts          Comparison, parameter-sweep optimization, recommendation
    report.ts            Report assembly + Markdown export
    offline.ts           Pre-caching for offline analysis
  ui/                    App shell, design kit, charts (Recharts), SVG shelter schematic
  pages/                 Dashboard, DesignCases, CaseEditor, Climate, Materials,
                         Simulation, Results, Comparison, Reports, Settings
```

The **simulation engine is decoupled from the UI**: it consumes plain data (`Shelter`, `SimulationSettings`, `ClimateProfile`, `LocationInfo`, `Material[]`) and returns a plain `SimulationResult`. The intended production path keeps the same JSON schemas behind a Python/FastAPI + NumPy/SciPy service with SQLite (Postgres-ready) persistence.

## Physics model (reduced-order)

Per time step (explicit Euler, default 5 min):

```
C_total · dTin/dt = Q_solar + Q_internal − Q_cond − Q_vent

Q_solar    = SHGC · A_win · I_wall           (transmitted glazing gain)
Q_internal = occupants·W_person + equipment
Q_cond     = Σ UA_i · (Tin − T_eff)          (walls, roof, openings, floor→ground node)
Q_vent     = ρ·cp·V̇(ACH + wind-driven) · (Tin − Tout)
T_eff      = sol-air temperature  Tout + α·I/h_out   for opaque surfaces
C_total    = air + 35 % coupled envelope mass + user extra mass
```

- **Solar split:** isotropic-sky model — beam by surface incidence + diffuse (0.5 view factor) + ground-reflected (albedo 0.2); diffuse share scales with sky clarity.
- **Auxiliary energy:** second deterministic pass with an ideal system clamping Tin to the comfort band; integrated energy = estimated demand.
- **Comfort:** configurable band (default 18–26 °C) + Fanger-form PMV/PPD screening indicator (stated assumptions: clo 0.9, v 0.15 m/s, T_rad ≈ T_air).
- **Determinism:** no random numbers anywhere in the engine; identical inputs → identical outputs (verified).

### Verified sensitivity (Leh, 7-day January window, 8 occupants)

| Change | Aux demand |
|---|---|
| Steel walls, no insulation | 1362 kWh |
| Baseline envelope, no insulation | 690 kWh |
| Baseline + 60 mm PUR | **159 kWh** |
| Baseline + 150 mm PUR | 89 kWh |
| Optimized sweep result (115 mm, 0.3 ACH, 0.2 m² glazing) | **35.8 kWh** |

South vs north orientation changes captured solar gain ~3.6×; Jaisalmer produces cooling demand/overheat as expected.

## Climate data & offline mode

- **NASA POWER** hourly point API (`T2M`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `WS2M`) — historical reanalysis, **never a forecast**. Live fetch is attempted on demand; any failure falls back to cached data with a visible message. Verified live: 336 records fetched and cached.
- **Representative profiles** — seeded synthetic years for 6 stations (Leh, Jaisalmer, Srinagar, Tawang, Jodhpur, Port Blair) built from public climatological knowledge, cached automatically (8,760 h each).
- **CSV upload** — `timestamp,temp_c,rh_pct,ghi_wm2,wind_ms`.
- **Offline:** acquire once → cache → the entire workflow (simulation, comparison, optimization, reports) runs locally with the status pills *Climate cached / Offline analysis available*.

## Honest limitations (also surfaced in-app and in every report)

- Single-zone RC model — no CFD, multi-zone airflow, moisture/condensation, or radiant asymmetry.
- Reference material properties from public sources — replaceable by authorized data via the parameterized schema.
- Representative/synthetic demo climates are demonstration scenarios only.
- Auxiliary demand assumes an ideal 100 %-effective system at the band bounds.
- Where the comfort band is not passively achievable (e.g. Leh January), the app says so plainly and reports minimum auxiliary demand instead of claiming comfort.

## Roadmap (post-hackathon)

- Python/FastAPI backend implementing the same schemas; SQLite → PostgreSQL.
- ASHRAE 140-style analytical verification, then instrumented field trials.
- ANSYS high-fidelity validation as an offline path.
- Multi-zone airflow, moisture buffering, cost/logistics constraints in the optimizer.
