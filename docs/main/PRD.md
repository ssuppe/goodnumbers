# Goodnumbers Weekly Health Journal PRD

**Revision:** v1.0 (Static Single-User)

GoodNumbers is a simple, static, single-user weekly health journal for Type 1 Diabetics. It combines a diary/bullet journal with statistical CGM analysis, storing all data locally on the user's disk in portable, human-readable formats.

**Problem:** Type 1 Diabetics often lack a simple, private way to identify weekly trends without relying on complex SaaS platforms or centralized databases.

**Solution:** GoodNumbers provides a purely client-side practice of self-reflection. It leverages:

- **Data Analysis:** Runs entirely in the browser to find "hotspots" and trends in blood glucose numbers.
- **Local Storage:** Uses the Web File System Access API to store journals as Markdown files with YAML frontmatter on the user's computer.
- **Zero Knowledge:** Credentials (Nightscout, API keys) are stored locally in the chosen workspace and never leave the user's browser.
- **Portability:** Journals are human-readable Markdown, making them easy to share with doctors or archive independently of the application.

The goal of GoodNumbers is to give Type 1 Diabetics a weekly practice of self-reflection, including:

- A pause in the week to look back over the last week, see how they are feeling, and celebrate wins and places to improve.
- Reviewing trends and "hotspots" via statistical analyses processed directly from their Nightscout instance.
- Optional AI-generated insights if the user provides their own API keys.

GoodNumbers is motivating, judgment-free, and prioritizes data ownership and simplicity.

**Note:** GoodNumbers does NOT provide medical advice; it recognizes patterns for the user to discuss with their healthcare team.

## UX Design System

The design is clean, professional, calm, and supportive ("Mesa" theme: Terracotta and Petrol Blue). It uses a card-based architecture on an off-white background (`#F4F1EA`).

### Color Palette

- **Primary:** Terracotta (`#D9775B`)
- **Secondary:** Petrol Blue (`#2C4C5B`)
- **Critical:** Red (`#D32F2F`)
- **Background:** Off-white (`#F4F1EA`)

## User Journey: The Workspace Flow

### 1. Workspace Selection (Onboarding)
Instead of a login, the user selects a folder on their computer to act as their "Journal Workspace."
- The app requests read/write permission to this folder.
- A `.goodnumbers.config.json` is created/loaded to store Nightscout credentials and preferences.

### 2. Dashboard
Displays a list of past journals by scanning the workspace for `.md` files.
- **Primary Action:** "Log this week's journal".

### 3. Journal Generation
- Fetches 7 days of data directly from Nightscout (Client-side).
- Analyzes data (Web Worker).
- Saves as a new Markdown file in the workspace.

### 4. Journal View
Displays AGP charts, scorecard metrics, and glycemic event clusters parsed from the file's YAML frontmatter. Allows editing subjective notes saved back to the Markdown body.
