# GridGuard AI | Outage Decision Support System

> **Emergency power allocation & outage decision-support system for facility managers**  
> Built for hospitals, university campuses, commercial offices, and essential businesses during prolonged electrical grid outages.

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20Postgres-3ECF8E?logo=supabase)](https://supabase.com)
[![Anthropic Claude](https://img.shields.io/badge/Anthropic-Claude%20AI-D97706?logo=anthropic)](https://anthropic.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ The Problem

When severe weather, cyberattacks, or equipment failures knock out the electrical grid, facility managers face life-critical decisions under extreme pressure:
- **Which circuits must stay online?**
- **How long will existing battery or generator reserves hold?**
- **What is the exact tradeoff if non-essential loads are shed?**

Making wrong calculations costs lives in hospitals (ventilators, ICU oxygenation) and causes millions in data loss or structural freezing in campuses and offices.

---

## 🛡️ The Solution: GridGuard AI

**GridGuard AI** gives facility managers a decision-first operational cockpit:
1. **Command Dashboard**: Live battery runtime countdown, initial demand kW, 30s auto-refresh, and 1-click **"Shed All P3"** action with real-time runtime extension gains.
2. **Interactive Power-Flow Topology**: Dynamic React Flow diagram visualizing energy flow from Source $\to$ Distribution Panels $\to$ Categorized Circuit Groups, with power-proportional stroke animations.
3. **Outage Horizon Simulator**: Real-time slider (30m to 72h) recalculating runtime in `<200ms`, step-by-step playback, scrubber, and circuit dropout markers.
4. **AI Recovery Planner**: Claude-powered engine that analyzes facility constraints and generates plain-English circuit-by-circuit load shedding recommendations with zero-trust safety validation.
5. **Scenario Comparison Matrix**: 3-column side-by-side strategy analyzer (e.g. All-On Baseline vs. Balanced P1+P2 vs. Max Endurance P1-Only), BarCharts, diff tables, metric winners (🏆), plain-English verdicts, and CSV export.
6. **Always-On Safety Lock**: Prevents life-safety P1 critical circuits from being demoted or accidentally shed.

---

## 📐 Mathematical Formulation & Core Engine

GridGuard AI evaluates backup duration using a deterministic physics formulation:

$$\text{Usable Capacity (kWh)} = \text{Nameplate Capacity (kWh)} \times \left(\frac{\text{DoD}}{100}\right) \times \left(\frac{\text{Efficiency}}{100}\right)$$

$$\text{Estimated Runtime (hours)} = \frac{\text{Usable Capacity (kWh)} \times 1,000}{\text{Connected Active Load (Watts)}}$$

### Example (Hospital ICU Wing):
- **Nameplate Storage**: 50.0 kWh (LiFePO4 Battery Bank)
- **Depth of Discharge (DoD)**: 80% safe cutoff limit
- **Inverter Efficiency**: 92% round-trip conversion efficiency
- **Usable Energy**: $50.0 \times 0.80 \times 0.92 = 36.80\text{ kWh}$
- **All Circuits Active (16,000 W)**: Runtime = $\frac{36,800\text{ Wh}}{16,000\text{ W}} = 2.30\text{ hours}$
- **P1 Life-Safety Only (7,300 W)**: Runtime = $\frac{36,800\text{ Wh}}{7,300\text{ W}} = \mathbf{5.04\text{ hours}}$ (+2h 44m extended runtime)

---

## 🏗️ System Architecture

```mermaid
graph TD
    Client[Next.js 14 App Router UI] --> Zustand[Zustand Store with LocalStorage Cache]
    Client --> Recharts[Recharts Interactive Timeline & Comparison Charts]
    Client --> ReactFlow[React Flow Animated Power Topology]
    Client --> APIPlan[/api/plan Server Route]
    
    APIPlan --> Anthropic[Anthropic Claude API claude-sonnet-4-6]
    APIPlan --> DeterministicEngine[lib/engine Zero-Trust Validation & Fallback]
    
    Client --> SupabaseServer[Supabase SSR Client & Server Actions]
    SupabaseServer --> SupabaseDB[(PostgreSQL with Row Level Security RLS)]
```

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- Node.js 18.17+ or Node.js 20+
- npm or yarn

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/Jyotishkumar-dev/hacktoberfest26.git
cd hacktoberfest26
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your configuration keys:
```env
# Supabase Connection
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Anthropic Claude API (Server-side only)
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-6

# Demo Judge Account
NEXT_PUBLIC_DEMO_EMAIL=demo@gridguard.ai
DEMO_PASSWORD=DemoHospital2026!
```

> **Note on Offline Resilience**: If no `ANTHROPIC_API_KEY` is provided, the AI Planner automatically and seamlessly falls back to our sub-second deterministic rule-based allocation engine.

### 4. Database Setup (Supabase)
Run the migration script located at `supabase/schema.sql` in your Supabase SQL Editor:
- Creates tables: `facilities`, `equipment`, `scenarios`, `ai_recommendations`
- Configures Row Level Security (RLS) policies for user isolation
- Indexes `user_id` and `facility_id` for low-latency queries

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Run Engine Unit Tests
```bash
npx vitest run
```
All 5/5 calculation engine unit tests pass with zero warnings.

---

## ☁️ Deployment on Vercel

### Step 1: Push Repository to GitHub
Ensure all changes are committed and pushed to your remote repository.

### Step 2: Import into Vercel
1. Log into [Vercel](https://vercel.com) and click **"Add New Project"**.
2. Select your `hacktoberfest26` GitHub repository.
3. Keep Framework Preset as **Next.js**.

### Step 3: Add Environment Variables in Vercel
Under **Project Settings $\to$ Environment Variables**, add:
| Variable Name | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://xyzcompany.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Public Anon Key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | `eyJhbGciOi...` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API Key | `sk-ant-api03-...` |
| `ANTHROPIC_MODEL` | Claude Model Name | `claude-sonnet-4-6` |
| `NEXT_PUBLIC_DEMO_EMAIL` | Demo Account Email | `demo@gridguard.ai` |
| `DEMO_PASSWORD` | Demo Account Password | `DemoHospital2026!` |

### Step 4: Configure Supabase Auth Redirect URLs
In your **Supabase Dashboard $\to$ Authentication $\to$ URL Configuration**:
1. **Site URL**: `https://<your-project-name>.vercel.app`
2. **Redirect URLs**:
   - `http://localhost:3000/**`
   - `http://localhost:3004/**`
   - `https://<your-project-name>.vercel.app/**`

Click **Deploy** in Vercel.

---

## 🎯 Evaluator / Judge Walkthrough (Demo Mode)

For judges and evaluators, GridGuard AI includes a **1-click fail-safe demo mode**:

1. **One-Click Demo Entry**: On the Login screen, click **"Try demo hospital (One-Click)"**. You are immediately authenticated and directed to the Hospital Command Center.
2. **Guided Tour**: A 3-step interactive onboarding tour introduces Equipment Priority Triage, Outage Simulations, and AI Planning.
3. **Command Center**:
   - Notice the persistent gray **`SIMULATED DATA`** badge.
   - Click the orange **"Shed 3 P3 Now"** button to witness instant live runtime extension.
   - Explore the interactive React Flow Power Distribution Topology tab.
4. **Equipment Manager (`/equipment`)**:
   - Drag and drop equipment across P1, P2, and P3 columns.
   - Attempt to move the Ventilators (Safety Lock active) to P3 to verify the automatic lock alert.
5. **Scenario Simulator (`/simulator`)**:
   - Drag the outage slider between 30 min and 72 hours. Notice sub-200ms real-time recalculation.
   - Hit **Play** to watch the battery depletion timeline and circuit dropoff markers.
6. **AI Recovery Planner (`/planner`)**:
   - Click **"Recommend Plan"** with a target duration.
   - Inspect plain-English reasoning for every circuit shed, modify toggles, and click **"Apply to Simulator"**.
7. **Scenario Comparison (`/compare`)**:
   - View the 3 pre-saved strategies: Baseline (All-On), Balanced (P1+P2), and Max Endurance (P1-Only).
   - Review the plain-English verdict, metric winners with trophy badges (🏆), and export the diff matrix as a CSV file.
8. **Settings (`/settings`)**:
   - Edit battery capacity, DoD %, and inverter efficiency with live formula calculations updated in real time.

---

## ⚠️ Assumptions and Limitations

1. **Simulated Data Disclaimer**:  
   All runtime metrics, discharge timelines, and power graphs are simulated algorithmic models intended for readiness training, tabletop exercises, and decision support. Actual battery cell performance varies with ambient cell temperature, age, state of health, and Peukert's exponent.
2. **Constant Draw (Steady-State) Approximation**:  
   Loads are modeled with steady continuous power draw (Watts). Dynamic inrush currents and HVAC duty-cycle peaks are linearly averaged.
3. **Single Backup Source Architecture**:  
   The core engine models a unified primary backup storage or generator source feeding distribution panels. Multi-generator synchronization is abstracted at the panel level.
4. **Decision Support Only**:  
   GridGuard AI is strictly an operational advisory tool. It does not actuate physical circuit breakers. All load-shedding and power transfer actions must be verified and executed by certified facility engineers in compliance with NFPA 110 and local electrical codes.

---

## 📄 License
This project is open-source under the MIT License. Developed for Hacktoberfest 2026.
