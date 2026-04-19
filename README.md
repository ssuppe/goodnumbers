# GoodNumbers 🩸

**A smart weekly journal for type 1 diabetics.**

GoodNumbers is an **experimental, non-commercial, open-source project** designed to help people with Type 1 Diabetes reflect on and improve their blood sugar management through a weekly practice of self-reflection.

---

## 🚀 What is GoodNumbers?

GoodNumbers is a weekly journal that combines traditional statistical analysis with modern AI to help you identify trends and patterns in your diabetes management.

- **Statistical Analysis**: Automatically identify "hotspots" and troublesome trends in your blood glucose data.
- **AI-Powered Reflection**: Leverage AI to reflect on strategies, celebrate wins, and find blind spots.
- **Weekly Practice**: A dedicated pause in your week to look back, learn, and improve for the next seven days.
- **Motivation without Judgment**: Designed to be a positive, motivating tool for a challenging daily job.

https://github.com/user-attachments/assets/4ec7fa7b-3743-47a6-aac8-22760a915135

> **Note**: GoodNumbers is an experiment and is for educational use only. It is **not** a medical device and does **not** provide medical advice.

---

## 🛠️ Built With

- **Frontend**: React (Vite), TypeScript, Tailwind CSS, Refine (v5)
- **Backend**: Node.js, Express, Prisma, Auth.js (NextAuth for Express)
- **Data**: SQLite (Development) / PostgreSQL (Production), Redis (for background jobs)
- **AI**: Gemini 3.1 Pro (via Google AI Studio) for deep clinical reasoning

---

## ✨ Key Features

GoodNumbers provides a multi-layered analysis of your 7-day diabetes data:

### 📊 Statistical Analysis & Heuristics (Ground Truth)

The core of the report is built on robust statistical methods and deterministic logic:

- **Ambulatory Glucose Profile (AGP)**: A standardized chart showing your blood sugar patterns and percentiles (5th, 25th, 50th, 75th, 95th) over a 24-hour period.
- **Voyager Scorecards**: Key performance metrics including Average Glucose, Stability (Rate of Change), and Time in Range (Standard and Tight).
- **Bolus Timing Heuristics**: A deterministic engine that identifies:
  - **Uncovered Meals**: Meals detected without matching insulin.
  - **Post-bolusing**: Insulin given at or after the start of a meal.
  - **Pre-bolusing**: Insulin given significantly before a meal.
- **Glycemic Hotspot Detection**: Automatically identifies recurring "clusters" of highs or lows at specific times of day.

### 📝 The Weekly Report

Each journal entry generates a comprehensive summary:

- **Subjective Reflection**: Capture your "Weekly Vibe," influencing factors (like stress or illness), and goals for the coming week.
- **Data Analysis**: Compact, collapsible breakdown of deterministic insights for every pattern found.
- **Interactive Charts**: Patterns are visualized with both blood sugar and treatment (carbs/insulin) data on a single timeline.

### 🎙️ AI-Driven Personalization (Gemini 3.1 Pro)

Leveraging the state-of-the-art **Gemini 3.1 Pro** model for deep analysis:

- **Clinical Assessment**: A structured, qualitative review of every recurring pattern. The AI uses **Hybrid Prompting**—it receives both the hard-coded heuristics ("Ground Truth") and a 4-hour raw data trace for every event in a pattern.
- **Structured Insights**: Every AI assessment is parsed into a professional, patient-friendly report:
  - **Key Takeaway**: A single-sentence summary of the core issue.
  - **Recommendation**: 1-3 actionable items to discuss with a doctor.
  - **In Detail**: A precise, colloquial explanation of the physiological cause-and-effect.
- **Patient-First Language**: Insights use common T1D vernacular (e.g., "blood sugar," "insulin kicking in") instead of dense clinical terminology.

---

## 🔌 Required Integrations

To run your own instance of GoodNumbers, you will need account access to the following services:

1.  **Nightscout**: GoodNumbers pulls your data from a Nightscout instance. You will need your Nightscout URL and an API Access Token.
2.  **Google Cloud Console**: Required for **Google OAuth**. You must create a project and OAuth 2.0 credentials.
3.  **Google AI Studio (Gemini)**: Required for the **AI features**. A Gemini API Key is needed (Free tier available).
4.  **Database & Cache**: **SQLite** is used by default for local development. **Redis** is required for the background worker (run via Docker).

---

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/) (for Redis)
- [Just](https://github.com/casey/just) (Command runner - optional but recommended)

### Installation

1.  **Clone and Install**:

    ```bash
    git clone https://github.com/your-username/goodnumbers.git
    cd goodnumbers
    npm install
    ```

2.  **Environment Setup**:

    ```bash
    cp .env.example .env
    cp backend/.env.example backend/.env
    ```

3.  **Local Network Access (Optional)**:
    To access the app from other devices on your network, use a `nip.io` domain (e.g., `http://192.168.1.x.nip.io:5173`). This allows Google OAuth to function correctly on private IPs.

### Start Development

The easiest way to start is using the included **`just`** recipes:

1.  **Start Services**: `just services-up` (Starts Redis)
2.  **Reset DB**: `just db-reset-dev` (Initializes SQLite)
3.  **Run App**:
    - Backend: `just dev-backend`
    - Worker: `just dev-worker` (Required for AI insights)
    - Frontend: `just dev-frontend`

---

## 🧬 Development & Testing

We follow a strict **Test-Driven Development (TDD)** workflow.

### Quality Gates

Run these commands before pushing:

- **Linting**: `npm run lint`
- **Tests**: `npm test` (Runs all 270+ backend and frontend tests)
- **Reset Environment**: `just redis-flush` && `just db-reset-dev`

For more details on contributing, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 🤖 How This Project Was Created

GoodNumbers was created using a **human-in-the-loop AI development process**.

The majority of the code, tests, and documentation were generated by AI agents (using the Gemini API and related tooling). The project is steered and reviewed by a **former software engineer** who acted as the "Senior Tech Lead." While every line of code has been reviewed for intent and functionality, this remains an experimental project.

**The author offers NO GUARANTEES of correctness, safety, or reliability.**

This project is a demonstration of how AI can assist in building complex health-tech tools, but it must be used with extreme caution.

---

## 📅 TODO / Next Steps

GoodNumbers is actively evolving. Our current focus is on **Simplification**:

- **Client-Side Migration**: We are working to move the core logic to be entirely client-side. This will remove the need for a complex backend and database setup for individual users.
- **Vastly Simpler Deployment**: Our goal is to make GoodNumbers a "Static Site" that can be run directly in the browser or hosted easily on services like GitHub Pages, making it much simpler for the community to run their own instances.

---

## ⚖️ License & Disclaimer

- **License**: Distributed under the [AGPL-3.0 License](LICENSE).
- **Medical Disclaimer**: This software is not intended for medical use. **Read the full [DISCLAIMER.md](DISCLAIMER.md) before use.**

---

_GoodNumbers is dedicated to the idea that better data and regular reflection can lead to better outcomes._
