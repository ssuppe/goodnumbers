# Goodnumbers Weekly Health Journal PRD

**Revision:** v0.8 (Post-Statistical Insights Engine)

GoodNumbers is a weekly health journal that is a combination of a diary/bullet journal, statistical analyzer and AI coach.

**Problem:** Type 1 Diabetics typically see their specialists quarterly or less, making it challenging to identify and address daily and weekly trends in their blood glucose management.

**Solution:** GoodNumbers provides a weekly practice of self-reflection, empowering Type 1 Diabetics to proactively manage their health. It leverages:

- **Data Analysis:** To help users find "hotspots" and trends in their blood glucose numbers via a deterministic statistical engine.
- **AI Coaching:** (Future) To help users consider behavioral or treatment changes (always after consulting with a doctor).
- **Personalized Podcast:** (Future) For novelty and a new way to explain data, offering a weekly audio summary of their progress and wins.

The goal of GoodNumbers is to give Type 1 Diabetics a weekly practice of self-reflection, including:

- A pause in the week to look back over the last week, see how they are feeling, and celebrate wins and places to improve.
- Reviewing trends, ‘problem areas’ and ‘hotspots’ in their blood glucose numbers (e.g., highs and lows). GoodNumbers provide statistical analyses to take the work out of finding the problem areas and hotspots in their blood glucose management.
- (Future) Use AI to take in their personal experiences, correlate to the data, and provide a report (in the form of text/charts as well as a personal podcast) so they can improve for the next week.

GoodNumbers is meant to be motivating - there is no judgement - just recognition of a hard job well done (managing blood glucose) and providing real data and feedback on how to improve.

It should be noted that GoodNumbers does NOT provide medical advice - rather, it recognizes patterns and makes /general/ observations that the patient should then take to their doctor or medical healthcare team.

## UX Design System

This section outlines the core principles of the GoodNumbers visual identity and user interface components. The design is intended to be clean, professional, calm, and supportive, creating a trustworthy environment for users to reflect on their health data.

### Overall Philosophy

- **Aesthetic:** Modern, clean, and uncluttered. The interface prioritizes readability and ease of use, with a professional feel that inspires confidence.
- **Layout:** The system is built on a card-based architecture, using an off-white background (`#F4F1EA`) to create a soft, inviting canvas. Components have rounded corners and use subtle shadows sparingly to create a sense of depth and organization without adding visual noise.
- **Theming:** The color system is designed with CSS variables to facilitate the future implementation of a dark mode.

### Color Palette

The palette is unified and intentional, using a "Mesa" theme (Terracotta and Petrol Blue) to create a warm, distinctive, and supportive atmosphere.

- **Primary Color (Mesa Primary - Terracotta):** Used for primary actions, buttons, and key highlights. It is warm and inviting.
  - `--color-mesa-primary: #D9775B`

- **Secondary Color (Mesa Secondary - Petrol Blue):** Used for brand headers, stability indicators, and secondary accents.
  - `--color-mesa-secondary: #2C4C5B`

- **Critical Alert Color (Red):** Reserved exclusively for high-priority warnings to ensure its significance is not diluted. Its primary use is for the site-wide medical disclaimer banner.
  - `--feedback-critical-color: #D32F2F`

- **Neutral Colors:** A palette of grays and off-whites forms the foundation of the interface.
  - `--color-mesa-bg: #F4F1EA` (Main page background - a warm off-white)
  - `--color-mesa-surface: #FFFFFF` (Card backgrounds)
  - `--color-mesa-text: #1F2937` (Primary text)
  - `--color-mesa-muted: #9CA3AF` (Secondary text)
  - `--color-mesa-border: #E5E7EB` (Dividers and borders)

### Typography

- **Font Stack:** The application uses `Nunito` for UI elements (sans-serif) and `Lora` for narrative text (serif), creating a journal-like feel.

### Core Components & Styling

- **Banner Component:** The primary site banner uses a solid red (`--feedback-critical-color`) background with high-contrast white text. This makes the medical disclaimer impossible to miss.
- **Buttons:**
  - **Primary:** Solid Terracotta background with white text. Used for main calls-to-action (e.g., "Login", "Start Journal").
  - **Secondary:** Transparent background with border and text. Used for less prominent actions.
- **Cards:** Content is organized into cards with a white background, large rounded corners (`12px`), and a light box shadow. This separates information into clean, manageable chunks.

## Home page

### User Journey and Purpose

The homepage's primary purpose is new user acquisition and discovery. It serves as the initial touchpoint for potential users to understand GoodNumbers, its value proposition, and to initiate their journey either through a demo or by registering/logging in.

### Standard Page Elements

- **Top Right Button:** A "Login / Register" button should be prominently displayed in the top right corner of the homepage. This button leads to the [Login page](#login-page).
- **Footer:** Located at the bottom, containing:
  - Copyright information
  - Links to Privacy Policy
  - Links to Terms of Service

## Banner component

The banner component is a reusable component. The title gets a special UI treatment.

## Email Allowlist Access Control

This section defines the access control mechanism for the private beta/pre-release phase.

1. Overview & Goal

- Goal: To restrict access to the application to a pre-approved list of users.
- Functionality: The system maintains a server-side list of allowed email addresses. Access is checked during the registration and login process.

2. Interaction Flow

1. User provides email and password on the Registration page.
1. **Allowlist Check:** The system checks if the user's email is in the allowlist.
1. **Allowed:** The user account is created with the hashed password, and the user is logged in.
1. **Denied:** The sign-in fails, and the user is denied access.

## Login page {#login-page}

### 2. Goals

- **Enable Secure User Access:** Provide a robust and secure mechanism for users to log into their existing accounts using a email/password combination.
- **Facilitate Seamless Onboarding:** Allow new users on the allowlist to easily register and gain access to the application by creating a unique password.

### 3. User Stories

#### New User Registration

- As a **new user**, I want to register quickly using my email and a secure password.
- As a **new user**, I want to understand and explicitly agree to the terms, privacy policy, and software disclaimer before I register.

### 4. Functional Requirements

#### 4.1. Authentication Interface

- The authentication interface MUST consist of custom `/login` and `/register` pages.
- The UI MUST clearly indicate that Email and Password is the primary (and only) sign-in method.

#### 4.2. Credentials Integration (Primary Authentication)

- Users MUST be able to register and log in using their email and a unique password.
- **New User Flow:**
  1. User registers at `/register`.
  2. If on allowlist, they are redirected to the **Agreements Page**.
  3. User MUST check boxes to agree to Terms and Privacy Policy.
  4. User clicks "Accept and Continue".
  5. User is redirected to the **Setup Page**.

## Authenticated User Experience & Navigation

### Dashboard Header

Upon successful login, the Dashboard and all subsequent authenticated pages will feature a persistent header with the following elements:

- **Settings Button:** A button that links to the user's account settings page (the "Setup Account" page).
- **Logout Button:** A button that allows the user to explicitly log out.

## Demo Page

The Demo Page serves as an initial touchpoint for potential users to understand GoodNumbers' value proposition without requiring registration.

- **Content Source:** The Demo Page will utilize the standard journal page structure and components, populated with pre-generated data.
- **Interactivity:** The Demo Page MUST be presented as a read-only version.

## Setup Account

- The first time a user logs in (after agreements), they are taken to the Setup page.
  - Nightscout URL (text field)
  - Nightscout Token (password field)
  - Preferred Units (mg/dL or mmol/L)
- **Connection Flow:**
  - The user enters credentials and clicks "Save".
  - The system validates the input format and saves the encrypted credentials.

## Dashboard

- Upon successful login, the dashboard is the landing page for all authenticated users.

### "Log this week's journal" Card (Primary Action)

- **Functionality:** The "Start Journal" button initiates the background generation process.
- **Visual Hierarchy:** This card is styled as a "hero" component.

### "Past weeks" Section (Historical Journals)

- **Ordering:** Historical Journals are shown in reverse chronological order (newest first).
- **Card Layout:** Displays date, title, and description with a "View" and "Delete" button.

## This week's journal

### Journal Generation Process

This section describes the process that occurs after a user clicks "Start Journal".

#### User Experience (Loading Screen)

Upon clicking "Start Journal," the user is navigated to a dedicated loading page that displays a progress bar and descriptive text to keep them informed. It polls the backend for status updates.

#### Backend Process

- **Data Fetching:** Fetches last 7 days of entries, treatments, and profile from Nightscout.
- **Analysis:** Calculates AGP metrics (GMI, Variability, Time in Range) and Scorecard metrics.
- **Hotspot Detection:** Identifies clusters of high/low events.
- **Persistence:** Saves all data to the database.

## Journal Page: UX/UI Concept

This page displays the generated report and serves as the primary interface for user reflection. The design prioritizes cognitive ease by decoupling raw data from AI interpretation and using progressive disclosure.

#### Components

- **Executive Summary (Highlights):** Replaces dense paragraphs with three discrete, color-coded highlight cards (Win, Trend, Warning). These are generated by the AI based on AGP stats deltas.
- **Podcast Player:** For playing the AI-generated audio summary and "The Vibe" (Future).
- **AGP Chart & Metrics Grid:** A clean, 4-column visual grid of raw AGP stats (Avg Glucose, TIR, Stability, GMI) positioned directly above the interactive AGP chart. Explanatory text is removed from this section to focus on pure data visualization.
- **Weekly Vibe:** Subjective tracking with emoji options (🥀 Wilted, 🌱 Sprouting, 🌿 Growing, 🌻 Flourishing).
- **Influencing Factors:** Multi-select chips organized by category (Food, Movement, Body & Meds, Mind & Mood, Life & Tech).
- **Event Cluster Cards:** Detailed view of detected glycemic patterns.
  - **Interactive Chart:** Visualizes both glucose and treatment (carb/insulin) data using a multi-grid layout with perfect vertical alignment.
  - **Travel Context:** Automatically surfaces human-friendly city names and GMT offsets (e.g., "London / Paris (GMT+1)") if the journal spans multiple timezones.
  - **High-Fidelity Highlighting:** Every out-of-bounds peak (above 10 mmol/L or below 3.9 mmol/L) is rendered solid/opaque using a value-based scanner.
  - **AI Co-pilot Hypothesis:** A progressively disclosed section (hidden by default under a toggle) where the AI provides a clinical hypothesis and reasoning for the pattern.
  - **Quick Log Chips:** Interactive, one-tap buttons that allow users to quickly append AI-suggested reflections (e.g., "Late dinner", "Underestimated carbs") to their personal notes.
  - **Overnight Glucose Control Analysis:** A specialized heuristic analyzing the critical 11 PM to 7 AM window to identify stability levels (Mastery, Success, Stability) and providing actionable clinical framing.
  - **Goals:** Text area for next week's goals.

- **Sticky Action Bar:** For saving or discarding changes.
