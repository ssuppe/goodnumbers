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

https://github.com/ssuppe/goodnumbers/raw/main/docs/videos/gn_demo.mp4

> **Note**: GoodNumbers is an experiment and is for educational use only. It is **not** a medical device and does **not** provide medical advice.

---

## 🛠️ Built With

- **Frontend**: React (Vite), TypeScript, Tailwind CSS, Refine (v5)
- **Backend**: Node.js, Hono, Prisma, Better Auth
- **Data**: PostgreSQL, Redis (for background jobs)
- **AI**: Integration with LLMs for personalized data analysis and reflection

---

## ✨ Key Features

GoodNumbers provides a multi-layered analysis of your 7-day diabetes data:

### 📊 Statistical Analysis (No AI)

The core of the report is built on robust statistical methods to provide an objective view of your week:

- **Ambulatory Glucose Profile (AGP)**: A standardized chart showing your glucose patterns and percentiles (5th, 25th, 50th, 75th, 95th) over a 24-hour period.
- **Voyager Scorecards**: Key performance metrics including Average Glucose, Stability (Rate of Change), and Time in Range (Standard and Tight).
- **Trend Tracking**: Automatic comparison with your previous week's data to see if you are improving.
- **Glycemic Hotspot Detection**: A custom engine that identifies recurring "clusters" of highs or lows at specific times of day, helping you find patterns that might otherwise be missed.

### 📝 The Weekly Report

Each journal entry generates a comprehensive summary:

- **Subjective Reflection**: Capture your "Weekly Vibe," influencing factors (like stress or illness), and goals for the coming week.
- **Automated Insights**: Rule-based insights derived from your statistical data.
- **Hotspot Analysis**: Detailed breakdown of recurring events with the ability to add your own notes to each cluster.

### 🎙️ AI-Driven Personalization (Experimental)

Leveraging the power of Large Language Models (Gemini):

- **Clinical Assessment**: An AI-generated qualitative review of your data, identifying blind spots and suggesting areas for reflection.
- **Personalized Podcast**: GoodNumbers can generate a short audio summary (scripted by AI) that talks you through your week, making the reflection process feel more like a conversation than a chore.

---

## 🔌 Required Integrations

To run your own instance of GoodNumbers, you will need account access to the following services:

1.  **Nightscout**: GoodNumbers pulls your blood glucose data from a Nightscout instance. You will need your Nightscout URL and an API Access Token.
2.  **Google Cloud Console**: Required for **Google OAuth**. You must create a project and OAuth 2.0 credentials to allow users to sign in.
3.  **Google AI Studio (Gemini)**: Required for the **AI reflection features**. You will need a Gemini API Key to enable the automated analysis and coaching.
4.  **Database & Cache**: You will need a **PostgreSQL** database and a **Redis** instance (can be run locally via the included Docker Compose file).

---

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/) (for PostgreSQL and Redis)
- [Prisma CLI](https://www.prisma.io/docs/orm/prisma-cli/installation)

### Installation

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/your-username/goodnumbers.git
    cd goodnumbers
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

### Environment Setup

GoodNumbers requires several environment variables to function correctly. Copy the example files and update them with your specific configuration:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

#### Required Variables

| Variable             | Description                              | Location       |
| :------------------- | :--------------------------------------- | :------------- |
| `ENCRYPTION_KEY`     | 32-byte hex string for data encryption   | Root `.env`    |
| `DATABASE_URL`       | PostgreSQL connection string             | `backend/.env` |
| `REDIS_HOST`         | Redis server hostname                    | Root `.env`    |
| `REDIS_PORT`         | Redis server port (default: 6379)        | Root `.env`    |
| `REDIS_PASSWORD`     | Redis server password                    | Root `.env`    |
| `AUTH_SECRET`        | Secret key for session signing           | `backend/.env` |
| `AUTH_GOOGLE_ID`     | Google OAuth Client ID                   | `backend/.env` |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret               | `backend/.env` |
| `CSRF_SECRET`        | 32+ character string for CSRF protection | `backend/.env` |
| `COOKIE_SECRET`      | Secret key for cookie parsing            | `backend/.env` |
| `GEMINI_API_KEY`     | API key for AI reflection features       | `backend/.env` |

#### Start Services

    Launch the database and cache using Docker Compose:
    ```bash
    docker-compose up -d
    ```

5.  **Initialize Database**:

    ```bash
    cd backend
    npx prisma migrate dev
    npx prisma generate
    ```

6.  **Run the Application**:
    From the root directory, start both the frontend and backend:
    ```bash
    npm run dev
    ```

---

## 🧬 Development & Testing

We follow a strict **Test-Driven Development (TDD)** workflow. All contributions must include tests.

### Quality Gates

Run these commands before pushing any changes:

- **Linting**: `npm run lint`
- **Type Check**: `npm run build:backend` && `npm run build:frontend`
- **Tests**: `npm run test:ai` (Optimized for CI/CD and AI contexts)

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
