# Goodnumbers Weekly Health Journal PRD

**Revision:** v0.5 (Updated with UX Design System)

GoodNumbers is a weekly health journal that is a combination of a diary/bullet journal, statistical analyzer and AI coach.

**Problem:** Type 1 Diabetics typically see their specialists quarterly or less, making it challenging to identify and address daily and weekly trends in their blood glucose management.

**Solution:** GoodNumbers provides a weekly practice of self-reflection, empowering Type 1 Diabetics to proactively manage their health. It leverages:

- **Data Analysis:** To help users find "hotspots" and trends in their blood glucose numbers.
- **AI Coaching:** To help users consider behavioral or treatment changes (always after consulting with a doctor).
- **Personalized Podcast:** For novelty and a new way to explain data, offering a weekly audio summary of their progress and wins, making the self-reflection process feel positive and motivating, like a beneficial workout.

The goal of GoodNumbers is to give Type 1 Diabetics a weekly practice of self-reflection, including:

- A pause in the week to look back over the last week, see how they are feeling, and celebrate wins and places to improve.
- Reviewing trends, ‘problem areas’ and ‘hotspots’ in their blood glucose numbers (e.g., highs and lows). GoodNumbers will provide statistical analyses to take the work out of finding the problem areas and hotspots in their blood glucose management.
- Use AI to take in their personal experiences, correlate to the data, and provide a report (in the form of text/charts as well as a personal podcast) so they can improve for the next week.

GoodNumbers is meant to be motivating - there is no judgement - just recognition of a hard job well done (managing blood glucose) and providing real data and feedback on how to improve.

It should be noted that GoodNumbers does NOT provide medical advice - rather, it recognizes patterns and makes /general/ recommendations that the patient should then take to their doctor or medical healthcare team.

## UX Design System

This section outlines the core principles of the GoodNumbers visual identity and user interface components. The design is intended to be clean, professional, calm, and supportive, creating a trustworthy environment for users to reflect on their health data.

### Overall Philosophy

- **Aesthetic:** Modern, clean, and uncluttered. The interface prioritizes readability and ease of use, with a professional feel that inspires confidence.
- **Layout:** The system is built on a card-based architecture, using an off-white background (`#F8F9FA`) to create a soft, inviting canvas. Components have rounded corners and use subtle shadows sparingly to create a sense of depth and organization without adding visual noise.
- **Theming:** The color system is designed with CSS variables to facilitate the future implementation of a dark mode.

### Color Palette

The palette is unified and intentional, using a primary green for positive actions and a distinct red for critical alerts.

- **Primary Color (Primary Blue):** Used for all interactive elements, including buttons, links, selected states, and informational icons. This color signifies trust, stability, and positive action.

  - `--primary-color: #1976d2`
  - `--primary-color-hover: #1e88e5`
  - `--primary-color-active: #1976d2`

- **Critical Alert Color (Red):** Reserved exclusively for high-priority warnings to ensure its significance is not diluted. Its primary use is for the site-wide medical disclaimer banner.

  - `--feedback-critical-color: #D32F2F`

- **Neutral Colors:** A palette of grays and whites forms the foundation of the interface, ensuring high readability and a clean look.

  - `--background-color: #F8F9FA` (Main page background)
  - `--component-background-color: #FFFFFF` (Card and input backgrounds)
  - `--text-color-primary: #212529` (Primary text)
  - `--text-color-secondary: #6C757D` (Secondary text)
  - `--border-color: #DEE2E6` (Dividers and borders)

- **Accent & Feedback Colors:** Additional colors are used for specific semantic purposes within the Insight Taxonomy.
  - **Important:** An amber/orange color (`#F57F17`) is used for the "Important" insight icon (💡) to draw attention without signaling a critical issue.

### Typography

- **Font Stack:** The application will use a system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`). This ensures optimal performance, legibility, and a native feel on any device without requiring custom font loading.

### Core Components & Styling

- **Banner Component:** The primary site banner uses a solid red (`--feedback-critical-color`) background with high-contrast white text. This makes the medical disclaimer impossible to miss.
- **Buttons:**
  - **Primary:** Solid blue background with white text. Used for main calls-to-action (e.g., "Login", "Start Journal").
  - **Secondary:** Transparent background with a blue border and text. Used for less prominent actions (e.g., "View" on a historical journal).
- **Cards:** Content is organized into cards with a white background, large rounded corners (`12px`), and a light box shadow. This separates information into clean, manageable chunks.
- **Insight Taxonomy:** A clear visual language is used to classify AI-generated insights. Each insight has a neutral gray background, with the icon colored according to importance:
  - **Critical (🚨):** Red
  - **Important (💡):** Amber/Orange
  - **Info (ℹ️):** Green

## Home page

<a id="homepage-screenshot"></a>
![Home page screenshot](imgs/goodnumbers_homepage.png 'Goodnumbers homepage')

- I have code for this already which we can use as inspiration (but does not need to be followed exactly, as we are moving from [Next.js](http://Next.js) to [Express.js](http://Express.js))

| Name of component/area | Description for PM/AI reader                                                                                                | String                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Banner component       | There is a reusable banner component that we will render on most pages. It is described in detail in another section below. | NOTE: GoodNumbers is an experiment and is for educational use only. Do not make any changes to your diabetic healthcare plan without speaking to your doctor.                                                                                                                                                                                                                                                                                |
| Headline               |                                                                                                                             | A smart weekly journal for type 1 diabetics                                                                                                                                                                                                                                                                                                                                                                                                  |
| Paragraph              |                                                                                                                             | **GoodNumbers** is an experimental weekly journal to help type 1 diabetics reflect and improve their blood sugar levels week to week. It uses a mix of good old statistical analysis to help you zero in on troublesome trends and identify patterns. It then leverages AI to help you reflect on strategies to address them. Use it for self-reflection, to find your blind spots in your diabetes management, and to continuously improve. |
| Button 1               | Links the [Demo Page](#demo-page) with static saved data in the client, it's not a live demo tied to the backend            | See a demo                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Button 2               | Leads to the[Login page](#login-page)                                                                                       | Login / Register                                                                                                                                                                                                                                                                                                                                                                                                                             |

### User Journey and Purpose

The homepage's primary purpose is new user acquisition and discovery. It serves as the initial touchpoint for potential users to understand GoodNumbers, its value proposition, and to initiate their journey either through a demo or by registering/logging in.

### Standard Page Elements

- **Top Right Button:** A "Login / Register" button should be prominently displayed in the top right corner of the homepage. This button leads to the [Login page](#login-page).
- **Footer:** Located at the bottom, containing:
  - Copyright information
  - Links to [Privacy Policy](app/privacy/page.tsx)
  - Links to [Terms of Service](app/terms/page.tsx)
  - Links to [About Us](app/about/page.tsx) (TBD - new page)

### Mobile Responsiveness

**Global Requirement:** All pages and components throughout the GoodNumbers product, including the homepage, must be fully mobile-responsive. This means the layout, content, and interactive elements should adapt seamlessly to various screen sizes and orientations (e.g., mobile phones, tablets) to ensure an optimal user experience across all devices.

## Banner component

The banner component is a reusable component of the following attributes:

```
export const announcementData: AnnouncementProps = {
  title: 'NOTE',
  callToAction: {
    text: 'GoodNumbers is an experiment and is for educational use only. Do not make any changes to your diabetic healthcare plan without speaking to your doctor.',
    href: 'https://nextjs.org/blog/next-14'
  }
};
```

The title gets a special UI treatment you can see in [Homepage Screenshot](#homepage-screenshot).

Pre-Release Access Barrier

This section defines the requirements for a site-wide access barrier. The primary goal of this feature is to restrict access to the entire
application to a pre-approved list of users during the private beta/pre-release phase. This barrier serves as a first line of defense,
preceding the application's main user authentication system.

1. Overview & Goal

- Goal: To implement a simple, secure gate that users must pass before accessing any page or API endpoint of the application.
- User Story: As a pre-approved beta tester, I want to enter a shared password on a simple page so that I can gain access to the application
  to begin testing.
- Functionality: Any attempt to access a URL within the application will first be intercepted. If the user has not passed the barrier, they
  will be redirected to a dedicated barrier login page. Upon successful entry of credentials, their access will be remembered for a set
  duration, and they will be able to proceed to the main application, including the standard login/registration flows.

2. User Experience & Design

The barrier page will be minimal and professional, adhering to the established UX Design System to ensure brand consistency.

- Layout: A clean, centered layout dominated by a single card containing the login form.
- Page Elements:
  - Headline: "Private Beta Access"
  - Form: A card containing two input fields:
    - Username
    - Password
  - Button: A primary action button labeled "Enter".
- Styling (from Design System):
  - The page background will use --background-color.
  - The form will be contained within a standard Card component (--component-background-color, rounded corners, light box shadow).
  - The "Enter" button will be a Primary Button (--primary-color).
  - Typography will use the standard Font Stack.
- Interaction Flow:
  1.  User visits any page in the application.
  2.  If not authenticated at the barrier level, they are redirected to the barrier page.
  3.  User enters the shared username and password and clicks "Enter".
  4.  On Success: The user is redirected to the page they originally intended to visit. They can now navigate the site freely.
  5.  On Failure: A simple error message appears below the "Enter" button (e.g., "Invalid username or password."). The text should use
      --feedback-critical-color.

3. Functional & Technical Requirements

- Tech Stack: The barrier will be implemented as a middleware within the Express.js framework.
- Authentication Mechanism:
  - An Express.js middleware will be applied globally to all routes.
  - It will check for the presence of a valid session cookie on every incoming request.
  - If the cookie is not present, it will redirect the request to the barrier page, except for the barrier page itself and its
    authentication API endpoint.
- Credential Management:
  - The shared username and password MUST NOT be hardcoded in the source code.
  - They will be supplied to the application via secure server-side environment variables.
- Session Management:
  - Upon successful authentication, the /api/barrier-login endpoint will set a secure, httpOnly cookie in the user's browser.
  - This cookie will have a defined expiration (e.g., 7 days) to remember the user's session.
- Separation of Concerns: This barrier is entirely distinct from the main application's user authentication (Google OAuth, managed via
  Prisma). A user must pass this barrier before they can reach the page to log in or register as a standard application user

## Login page {#login-page}

This document outlines the product requirements for the user Login and Registration page for our SaaS application's Minimum Viable Product (MVP). The goal is to provide a secure, intuitive, and seamless experience for both new and existing users to access the application, **initially focusing solely on Google OAuth for authentication using Auth.js built-in pages** to accelerate development.

### 2. Goals

- **Enable Secure User Access:** Provide a robust and secure mechanism for users to log into their existing accounts.
- **Facilitate Seamless Onboarding:** Allow new users to easily register and gain access to the application with minimal friction, leveraging Google's identity.
- **Enhance User Convenience:** Offer Google OAuth as the primary and sole authentication method for a quick and familiar sign-in experience.
- **Improve Conversion Rates:** Optimize the registration flow to reduce abandonment and encourage new sign-ups via Google.
- **Maintain Brand Consistency (within Auth.js limitations):** Ensure the login/registration experience aligns with the overall application's design and user experience, leveraging the customization options provided by Auth.js built-in pages.
- **Accelerate MVP Development:** Streamline authentication implementation by focusing on a single, widely-used OAuth provider and utilizing pre-built UI components.

### 3. User Stories

#### New User Registration

- As a **new user**, I want to register quickly using my existing Google account, so I don't have to create new credentials.
- As a **new user**, I want to understand and explicitly agree to the terms, privacy policy, and software disclaimer before I register, so I can make an informed decision and proceed.
- As a **new user**, I want clear feedback if my registration attempt fails (e.g., Google authentication error), so I can correct my input.

#### Existing User Login

- As an **existing user**, I want to log in using my Google account, so I can access the application conveniently.
- As an **existing user**, I want clear error messages if my Google login fails, so I know what to fix.

### 4. Functional Requirements

#### 4.1. Authentication Interface

- The authentication interface MUST primarily leverage Auth.js's built-in pages for login and registration.
- The UI MUST clearly indicate that Google is the primary (and only) sign-in method.
- **Authenticated User Handling:** Upon initial page load, the system will check for an active, valid user session. If a session is found, the user will be immediately redirected to the application's Dashboard.

#### 4.2. Google OAuth Integration (Primary Authentication)

<a id="login-page-disabled"></a>![Login page - disabled](<imgs/Login Page-disabled.png> 'Goodnumbers homepage')

- Users MUST be able to register and log in using their Google account.
- Before being able to sign in/authenticate, **for new users**, an Agreements Page MUST be presented immediately after a successful Google sign-in and right before successful login to the dashboard. Users MUST explicitly agree to the following on this page (presented as checkboxes):
  - Terms and Conditions (which includes acknowledgment of the experimental nature of the project and software disclaimer)
  - Privacy Policy

The 'Login' button MUST be disabled unless both of the above checkboxes are checked by the user (as seen in [Login Page-disabled](#login-page-disabled)). If the user does not check the required agreement checkboxes, the login button remains disabled, preventing them from proceeding.

Once a user checks the boxes of both the T&Cs and the Privacy Policy, the "Login" button becomes enabled (as seen below in [Login Page-enabled](#login-page-enabled))

<a id="login-page-enabled"></a>
![Login page - enabled](<imgs/Login Page-enabled.png> 'Goodnumbers homepage')

- A prominent "Sign in with Google" button MUST be available on the page, as provided by Auth.js.
- When pressed, it should load a page or popup with the standard Google OAuth consent screen (Auth.js default consent screen is sufficient, no specific product requirements beyond this).
- Upon successful Google authentication, the system MUST:
  - **For New Users:** Create a new user account linked to their Google profile.
  - **For Existing Users:** Log the user directly into their account.
- The system MUST handle potential errors during the OAuth flow (e.g., user declines permissions, network issues).

#### 4.3. Error States & Feedback

- **Authentication Errors:** For any issues during the Google OAuth flow (e.g., network issues, Google service errors, user denial), a generic but informative error message will be displayed on the Auth.js login page.
- **Loading Indicators:** All asynchronous operations will be accompanied by appropriate loading indicators.

#### 4.4. Accessibility

- The Auth.js built-in pages are expected to provide a reasonable level of accessibility.
- All interactive elements will be keyboard navigable.
- Color contrast and screen reader compatibility will be considered based on Auth.js defaults and any custom styling applied.

#### 4.5. Responsiveness

- The Auth.js built-in pages are expected to be responsive and adapt gracefully to various screen sizes.

#### 4.6. Session Management

- Upon successful login or registration via Google OAuth, a secure user session MUST be established by Auth.js.
- The session MUST be managed securely (e.g., using JWTs or secure cookies).
- Users MUST be automatically logged out after a period of inactivity (configurable session timeout).
- Users MUST be able to explicitly log out of their account.

#### 4.7. User Interface & Experience (UI/UX)

- The authentication pages MUST be fully responsive and adapt gracefully to various screen sizes (desktop, tablet, mobile), leveraging Auth.js's default responsiveness.
- Loading indicators MUST be displayed during OAuth redirects to provide feedback to the user.
- The design will largely follow Auth.js's default built-in page styling, with minimal custom branding to align with the overall SaaS application's branding where possible (e.g., logo, primary colors via CSS variables if supported by Auth.js theming).

#### 4.8. Authenticated User Redirection

- If an already authenticated user attempts to access the login/registration page, they MUST be automatically redirected to the application's main dashboard.

### 6. Non-Functional Requirements

#### 6.1. Security

- All data transmitted between the client and server MUST be encrypted (HTTPS/SSL).
- The system MUST be protected against common web vulnerabilities (e.g., XSS, CSRF, SQL Injection).
- Rate limiting SHOULD be considered on the initiation of the Google OAuth flow to prevent abuse.
- Sensitive user data (e.g., tokens) MUST be stored securely.

#### 6.2. Performance

- The login/registration page MUST load quickly (target < 2 seconds on average network conditions).
- Authentication responses MUST be fast (target < 1 second).

#### 6.3. Usability & Accessibility

- The page MUST be intuitive and easy to use for all users.
- The page SHOULD adhere to WCAG 2.1 AA guidelines for accessibility (e.g., sufficient color contrast, proper ARIA attributes).

#### 6.4. Scalability

- The authentication system MUST be able to handle a growing number of concurrent users and registration requests without degradation in performance.

#### 6.5. Reliability

- The authentication system MUST have high availability and be resilient to failures.

## Authenticated User Experience & Navigation

This section defines the persistent navigation elements available to authenticated users.

### Dashboard Header

Upon successful login, the Dashboard and all subsequent authenticated pages will feature a persistent header with the following elements:

- **Settings Button:** A button that links to the user's account settings page (the "Setup Account" page), allowing them to update their Nightscout connection details (URL, Token) and preferred glucose units (mg/dL or mmol/L).
- **Logout Button:** A button that allows the user to explicitly log out of their account.
- **Podcast Button:** A button that navigates to the dedicated Podcast Page.

### Podcast Page

This page is accessible via the "Podcast" button in the Dashboard header. Its primary purpose is to provide the user with their private RSS feed URL for use in third-party podcast applications.

- **Content:** The page MUST display the user's unique, authenticated RSS feed URL.
- **Copy Functionality:** A prominent "Copy" button MUST be provided next to the URL to facilitate easy copying.
- **Usage Explanation:** A brief, clear explanation MUST be included on the page, guiding the user on how to use this URL in popular podcast applications (e.g., "Copy this URL and paste it into your favorite podcast app's 'Add by URL' or 'Private Feed' option").
- **Regenerate URL:** This feature is out of scope for the MVP.

## Demo Page

The Demo Page serves as an initial touchpoint for potential users to understand GoodNumbers' value proposition without requiring registration.

- **Content Source:** The Demo Page will utilize the standard journal page structure and components, populated with pre-generated data from a specific "fake user" account.
- **Interactivity:** The Demo Page MUST be presented as a read-only version of a journal. User input fields (e.g., notes, vibe selection) will be disabled or not present.
- **Framing & Call to Action:** A prominent banner or header MUST be displayed at the top of the Demo Page. This banner MUST clearly explain that the user is viewing a demo and include a prominent "Sign up to create your own" call to action, linking to the Login/Registration page.

## Setup Account

- The first time a user logs in, the first thing we need to do is setup their account. Accounts have the following information:
  - CGM Provider - this should be a dropdown where the user can choose which CGM system they use.
    - **Initial Support:** Currently, we only support one CGM provider: Nightscout. The dropdown will initially only contain "Nightscout" as an option.
    - **Modularity for Future Expansion:** The system should be designed modularly to easily integrate additional CGM providers and their respective required fields in the future.
  - After choosing the Provider (currently Nightscout), we should show the required fields for that provider:
    - For Nightscout, the following fields are required:
      - Nightscout API version (for now, this is hardcoded to 1)
      - Nightscout URL (text field)
      - Nightscout Token (text field)
  - **Connection Flow:**
    1.  The user fills in their Nightscout URL and Token.
    2.  A "Test Connection" button is displayed. Next to it, a "Save and Continue" button is also visible but is **disabled** by default.
    3.  The user clicks "Test Connection."
    4.  **On Success:**
        - A small success message (e.g., "Connection successful!") appears near the test button.
        - The "Save and Continue" button becomes **enabled**.
    5.  **On Failure:**
        - A clear error message is displayed (e.g., "Connection failed. Please check your URL and token and try again.").
        - The "Save and Continue" button remains disabled.
    6.  Once the "Save and Continue" button is enabled, the user can click it to save their settings and be redirected to the Dashboard.
  - Preferred units: They can choose ONE of (but can be changed later):
    - mg/dL
    - mmol/L

## Dashboard

- Upon successful login, the dashboard is the landing page for all authenticated users.

### "Log this week's journal" Card (Primary Action)

- **Functionality:** The "Start Journal" button is enabled only if it has been 3 or more days since the last journal was created, or if there are no journals yet. This encourages a weekly reflection cadence.
- **Visual Hierarchy:** This card is styled as a "hero" component, making it visually distinct and more prominent than the historical journal cards.
- **Enabled State Layout:**
  - **Desktop:** A two-part horizontal layout. A square image is on the left, with the title "Reflect on your week" to its right. Below this, a "Start Journal" button is right-aligned.
  - **Mobile:** A vertically stacked layout. The image appears first, followed by the title "Reflect on your week", and finally a full-width "Start Journal" button for a large, accessible tap target.
- **Disabled State (Within 3 days of last journal):**
  - **Content:** The card will display a seed icon and the text "Your next journal unlocks on [Date]. Come back then to reflect".
  - **Layout:** It maintains the same layout as the enabled state, but with the icon and text replacing the image and title. A disabled "Start Journal" button is present and right-aligned on desktop (full-width on mobile) to provide a consistent spatial cue for the user.

### "Past weeks" Section (Historical Journals)

- **Ordering:** Historical Journals are shown in reverse chronological order (newest first).
- **Visual Hierarchy:** This section has a more neutral, secondary visual treatment compared to the primary action card.
- **Empty State:** If there are no past journals, the entire "Past weeks" section is hidden from view to simplify the UI.
- **Card Layout (for each historical journal):**
  - Each card has a fixed minimum height equivalent to four lines of text.
  - **Date:** Displayed in the top-left corner.
  - **Title:** Positioned below the date.
  - **Description:** An AI-generated description appears below the title. If it exceeds the allocated space, it will be truncated with an ellipsis ("...").
  - **Action:** A "View" button is right-aligned within the card. Clicking it leads to the editable journal page for that week.

## This week's journal

### Insufficient Data Handling

When a user clicks "Start Journal," the system will proceed with the data analysis and journal generation, regardless of the amount of historical data available. If the system detects less than 7 days of CGM data, a prominent, non-blocking warning message will be displayed at the very top of the "This week's journal" page.

**Warning Text:** "Heads up: This analysis is based on only [X] days of data. For the most complete insights, try to journal when you have at least 7 days of data logged."

### Journal State

All journal entries, including historical ones, are always editable. The AI-generated content (podcast, analysis) is immutable once generated, but the user's notes can be edited and saved at any time.

**Note on Edits:** For the MVP, editing the notes of a historical journal is for the user's personal record-keeping only. The new information will be saved, but it will **not** trigger a re-analysis or have any impact on the AI-generated content for subsequent new journals.

### Journal Page: UX/UI Concept and Flow

This section outlines the user experience and interface design for the "This Week's Journal" page. The design prioritizes a guided, reflective workflow, balancing data-rich analysis with subjective user input in a clear, non-overwhelming layout.

#### 1. Overall Page Structure & Flow

The page is designed as a vertical narrative that guides the user through a structured reflection process. The user journey is as follows:

1.  **Listen & Prime:** The user is first encouraged to listen to their personalized podcast to get a high-level, narrative summary of their week.
2.  **Analyze High-Level Data:** They then review the AGP chart and its key, prioritized insights.
3.  **Record Subjective Feelings:** The user provides their personal context byselecting a "Weekly Vibe" and "Influencing Factors."
4.  **Deep-Dive into Patterns:** They explore specific, recurring glycemic patterns through detailed "Glycemic Event Cluster" cards.
5.  **Set Future Intentions:** The user shifts focus to the week ahead by setting goals.
6.  **Save Progress:** They save their complete journal entry.

#### 2. Component-Level Design

##### 2.1 Personalized Podcast Player

- **Initial State:** The top of the page features the AI-generated podcast **Title** and **Description**, followed by a lazy-loading audio player. The player initially appears as a placeholder (e.g., "Click to load AI discussion on your numbers") and only loads the full player component upon user click to optimize page performance.
- **Sticky State (On Scroll):** Once the user scrolls past the initial podcast section, the player collapses into a compact, sticky bar that remains fixed to the top of the viewport.
  - **Layout:** This compact player is minimalistic, containing only essential controls: a **Play/Pause button**, a **Rewind 10s button**, and a **time counter** (e.g., `01:23 / 05:40`). This ensures the user can control the audio while reviewing data lower on the page without obstructing the view.
- **Error Handling:** If the audio file for the week cannot be found or fails to load, an explicit error message will be displayed in place of the audio player component.

##### 2.2 Ambulatory Glucose Profile (AGP) & Insights

- **Layout:** This section begins with the visual **AGP chart**. Directly below the chart is a list of prioritized, AI-generated insights.

###### AGP Chart: Visual Language & Interaction Model

This section details the design principles for the Ambulatory Glucose Profile (AGP) chart to ensure it is clear, insightful, and emotionally supportive.

**Overall Goal:** The chart's primary purpose is to help the user immediately understand their weekly glucose patterns, focusing on two key questions: "How well did I do keeping my blood glucose in range?" and "What times of day are hardest for me?"

**Data Representation & Visual Hierarchy:**

- **Median Glucose Line (Primary Story):**

  - **Visuals:** Represented as a solid, prominent line with a thickness of `2.5px`.
  - **Color:** A very dark, high-contrast color (`#212529`) to serve as the primary focal point.
  - **Behavior:** The line will connect across any time slots with missing data (`connectNulls: true`) to show the overall trend. The 'Average' (mean) line will **not** be displayed, simplifying the view.

- **Percentile Bands (Secondary Context):**

  - **Visuals:** Two stacked, shaded areas representing the interquartile and interdecile ranges.
  - **25th-75th Percentile:** A darker, neutral blue-grey (`rgba(90, 110, 150, 0.35)`).
  - **5th-95th Percentile:** A lighter, harmonious neutral blue-grey (`rgba(120, 140, 180, 0.25)`).
  - **Behavior:** The bands provide context for variability without competing visually with the median line.

- **User's Personal Target Range (The "Success Zone"):**

  - **Visuals:** A single, semi-transparent shaded area that spans the chart horizontally between the user's personal low and high glucose goals.
  - **Color:** A soft, supportive green (`rgba(76, 175, 80, 0.2)`), visually distinct from all other data elements. This creates a "river of success" for the median line.

- **Clinical Safety Thresholds:**
  - **Visuals:** Represented as thin, dashed red lines (`#D32F2F`) at the standard clinical high and low values (e.g., 70 and 180 mg/dL).
  - **Goal:** These lines act as clear safety boundaries, distinct from the user's personal goals, and use the established red alert color.

**Interaction Model (Hover & Tooltip):**

- **Spotlight Effect:** When a user hovers over the chart:

  1.  A vertical "scrubber" line appears at the selected time point.
  2.  All series elements (median line, percentile bands) not currently being hovered over will fade significantly (e.g., `opacity: 0.2`), creating a "spotlight" on the selected time.
  3.  The hovered elements will remain fully vibrant and opaque.

- **Tooltip Content:** A tooltip will appear with the following information in a clear hierarchy:
  1.  **Time:** The specific time slot being inspected.
  2.  **Median:** The precise median glucose value.
  3.  **25th-75th Range:** The interquartile range.
  4.  **5th-95th Range:** The interdecile range.
  - The 'Average' (mean) value will **not** be included in the tooltip to maintain consistency with the visual display.

**Mobile Responsiveness:**

To ensure an optimal experience on smaller screens, the chart will adapt as follows:

- **X-Axis (Time):** Labels will be displayed at a reduced frequency, showing a label every **four hours** to prevent clutter.
- **Y-Axis (Glucose):** The axis title will use a compact format, displaying only the units (e.g., "mg/dl" or "mmol/L") instead of the full "Glucose (...)" label to save horizontal space.
- **Legend:** The chart legend will remain visible at the bottom of the chart but will be contained within a **horizontally scrollable** container if its items overflow the screen width. This preserves vertical space while maintaining full functionality.

* **Insight Taxonomy & Visual Language:** Insights are styled to create a clear visual hierarchy of importance, using icons from a library like `react-icons`.
  - `CRITICAL`: **Red warning icon** (e.g., `IconAlertCircle`) and **red text**.
  - `SERIOUS`: **Red warning icon** and **black text**.
  - `IMPORTANT`: **Lightbulb icon** (💡) and **black text**.
  - `INFO`: **Green "i" icon** (e.g., `IconInfoCircle`) and **black text**.
* **Interaction:** The insights list is read-only and does not interact with the chart above it.

##### 2.3 Subjective User Inputs

###### 2.3.1 Weekly Vibe

- **Prompt:** "How do you feel about managing your diabetes this week?"
- **Layout:** Presented as a horizontal row of four distinct, tappable cards to feel warm and engaging.
- **Card Design:** Each card has soft, rounded corners and features:
  1.  A large, expressive **emoji** (🥀, 🌱, 🌿, 🌻) at the top.
  2.  The corresponding **title** ("Wilted," "Sprouting," etc.).
  3.  The short **descriptive text**.
- **Interaction:** Tapping a card applies a selected state (e.g., a colored border) to signify the user's choice.

###### 2.3.2 Influencing Factors

- **Prompt:** "What might have influenced your diabetes management this week? Tap any that apply."
- **Layout:** To reduce cognitive load, the selection chips are organized into three clear categories with headings:
  1.  **Weekly Pace & Events** (`Busy`, `Hectic`, `Quiet Week`, `Changes to Routine`, `Travel`, `Social Events`)
  2.  **Health & Wellness** (`Feeling Unwell`, `Feeling Healthy`, `Lots of Exercise`, `Running Around`, `Poor Sleep`, `Good Sleep`, `New Medications`, `Menstrual Cycle`)
  3.  **Diet & Nutrition** (`Great Diet`, `Different foods`, `Strange Meal Times`)
- **Interaction:** Users can tap to select/deselect multiple chips.

##### 2.4 Glycemic Event Cluster Analysis

- **Introduction:** The section is introduced with a summary headline (e.g., "We found 3 patterns of high glucose this week").
- **Card Layout:** Each individual cluster is presented in its own dedicated card, stacked vertically. The components within each card are ordered as specified in the [Glycemic Event Cluster Analysis](#glycemic-event-cluster-analysis) section, concluding with the **User Notes** text area at the bottom of the card.

##### 2.5 Goals for the Week

- **Layout:** This section is visually separated from the data-analysis sections above by being enclosed in its own distinct card.
- **Card Design:** The card has a clear, encouraging headline featuring a **watering can icon** (🪴) and the title "Your Goals for Next Week," reinforcing the app's growth-oriented theme.
- **Input:** Below the headline are the prompt text ("What are your goals for the week?...") and a paragraph input field.

##### 2.6 Save Action Bar

- **Layout:** A floating action bar is persistently visible at the bottom of the screen, ensuring the user can save their entry at any point without needing to scroll.
- **Initial State:** The "Save and Close" button within the bar is **always enabled**, allowing the user to save at any time.
- **Interaction & Feedback:**
  - On click, the system provides immediate feedback.
  - The button is temporarily **disabled** to prevent duplicate submissions.
  - The button label changes from "Save and Close" to "**Saving...**" and displays a **loading spinner icon**.
  - Upon successful save, the user is redirected back to the Dashboard.

### Journal Generation Process

This section describes the process that occurs after a user clicks "Start Journal". It covers both the user-facing loading experience and the backend technical steps.

#### User Experience (Loading Screen)

Upon clicking "Start Journal," the user is navigated to a dedicated loading page that displays a progress bar and descriptive text to keep them informed. This is a synchronous process; the user will wait on this screen until all generation is complete.

**Loading Steps & Progress Text:**

- (0%) Initializing: "Kicking things off..."
- (20%) Fetching Data: "Gathering your blood glucose, insulin, and meal data from the last 7 days."
- (40%) Statistical Analysis: "Running analysis to find trends and hotspots in your numbers."
- (60%) AI Scripting: "Writing the script for your personalized audio summary. This is the longest step, thanks for your patience!"
- (80%) Audio Generation: "Recording your podcast."
- (95%) Finalizing: "Putting the finishing touches on your journal."
- (100%) Done: The loading screen is replaced by the fully loaded "This week's journal" page.

#### Backend Process

- When a new Journal is first created (not edited from draft, but first time), a number of things have to be queried, created and saved for this Journal. This data is NOT user input. This includes:
  - Blood glucose data for the last 7 days
  - Treatments (insulin, meals) for the last 7 days
  - Profile data (for the last 7 days)
  - Currently all this data is pulled _client side_ and then prepared/passed to the server. This is a TBD decision if this is the right way to do it, feel feel to recommend something else.
- Once all that data is collected, then there is a pre-analysis that is done on the server. This means the above data needs to be sent to the backend to do the following:
  - Run through non-AI data analysis tools to do timeseries analysis (averages, finding low and high periods, and more). I have working code for this, we can get into the details later. We will call this “Notes”. This analysis is structured - it includes
    - A weekly overview
    - Summaries of hotspots (ie, common times of day over the last week where the patient was high or low)
    - Currently these summaries are created using non-AI (ie, hardcoded text)
  - Send the data to Gemini for additional analysis which creates an audio podcast
    - This is actually a server-side pipeline that calls Gemini several times in order to:
      - Pass 1: Your job is to look at the patient's clinical notes and create a thorough assessment with recommendations on how the patient might improvement their blood sugar numbers, including control, variability, and overall quality of life.
      - Pass 2: A more in-depth second pass assessment of the notes. Focus on:
        - 1. Carefully examining numbers and times of day
        - 2. Causes of problems, anomalies and issues.
        - 3. Recommendations and medical treatments.
      - Pass 3: Create a Podcast Dialog
      - Pass 4: Create SSML of Podcast Dialog
      - Pass 5: Description of the Podcast for the RSS feed
  - Create a new RSS entry
  - Return everything to the client

## Glycemic Event Cluster Analysis

### 1. Overview

The Glycemic Event Cluster Analysis feature is a comprehensive tool designed to automatically identify,
visualize, and explain recurring patterns of high or low glycemic events. When the system detects that multiple
events of the same type (e.g., "Hypoglycemia") consistently occur around the same time of day, it groups them
into a "cluster." This feature then presents the cluster as a single, integrated component composed of four
parts: a high-level Cluster Summary, an interactive Glycemic Event Cluster Visualization, a list of prioritized
Associated Insights, and a User Notes text box for patient reflection. The goal is to provide the user with a
clear, actionable understanding of their glycemic patterns while encouraging personal engagement.

### 2. Components

#### 2.1. Cluster Summary

The Cluster Summary provides an at-a-glance overview of the pattern's key characteristics. It is displayed
prominently above the visualization.

- Functionality:
  - Title: A clear, dynamically generated title describes the pattern (e.g., "High Glucose Pattern Analysis").
  - Key Metrics: Two primary statistics are highlighted with icons for quick recognition:
    - Time of Day: (Icon: Clock) The average time of day around which the events in the cluster occur.
    - Event Count: (Icon: Repeat) The total number of individual glycemic events included in the cluster.
  - Descriptive Summary: A concise, plain-language sentence synthesizes the key metrics. It explicitly states
    the number of events, the event type, the average time, and the earliest and latest times the events have
    started, providing a complete picture of the pattern's timing. (e.g., "12 High Glucose events typically
    occur around 8:30 PM (between 7:15 PM and 9:00 PM)").

#### 2.2. Glycemic Event Cluster Visualization

This is an interactive, multi-series time-series chart that allows for detailed exploration of the individual
events that form the cluster.

- Functional Description:
  - Primary Display (Glucose Chart):
    - X-Axis (Time of Day): The horizontal axis represents a normalized 24-hour time window. All individual
      glycemic events are plotted on this same time axis according to their time of day, regardless of the
      specific date they occurred.
    - Y-Axis (Glucose Level): The vertical axis represents blood glucose levels, with units (mg/dL or mmol/L)
      and scale automatically adjusted for clarity.
  - Secondary Display (Carbohydrate Chart):
    - This chart appears automatically at the bottom of the glucose chart only if meal (carbohydrate) data is
      available for the displayed events. It shares the same time axis.
  - Data Representation:
    - Glucose Event Series: Each individual glycemic event is rendered as a distinct line with a unique color
      and/or line style (solid, dashed).
    - Carbohydrate Event Series: Meals are shown as vertical bars, colored to match the glucose line from the
      same day.
    - Reference Range Lines: The chart displays horizontal dashed lines for standard clinical high/low
      thresholds (red) and the user's personal target range (green).
  - User Interactions & Interactivity:
    - Legend: A scrollable legend allows users to toggle the visibility of individual event lines.
    - Tooltip on Hover: Hovering over any data point reveals a tooltip with precise values, date, and time.
    - Event Isolation (Highlight on Hover): Hovering over any part of an event highlights the complete event
      instance while fading all others, enabling "focus mode" for detailed analysis.

#### 2.3. Associated Insights

Displayed directly below the visualization, this component provides a list of contextual, prioritized, and
machine-generated observations about the cluster.

- Functionality:
  - Purpose: To provide actionable, plain-language explanations, contributing factors, or potential
    consequences related to the visualized pattern.
  - Prioritization & Visual Indicators: Each insight is assigned a priority (Critical, Serious, Important, Key
    Insight) and displayed with a corresponding icon and color highlight to draw the user's attention
    appropriately.
  - Accessibility: Each icon is paired with screen-reader-only text (e.g., "Critical insight:") to ensure the
    level of importance is conveyed to all users.
  - Empty State: If no specific insights are generated, the message "No insights available for this cluster" is
    displayed.

#### 2.4. User Notes

This component provides a dedicated space for the user to reflect on the presented pattern and document their
own thoughts, context, or action plans. It is displayed at the bottom of the feature, after the Associated
Insights.

- Functionality:
  - Component: A multi-line text input field (textarea).
  - Prompt: The text box will be empty by default but will contain the following instructional prompt: > "Why do you think this happened? Leave some notes on what you think the issue is, or how you can
    improve next week. If you don’t know, that's ok! Leave it blank."
  - Behavior:
  - Input is optional and the field can be left blank. \* Notes entered by the user will be saved and associated with the specific cluster for future review by the user or their clinician. It will also be used by AI when creating insights in the Loading phase for subsequent weeks (ie, subsequent weeks may look at this data).

## Historical Journals

- When a historical journal is clicked on from the Dashboard, it will show the same view as the "Weekly Journal" page, allowing all user-input fields (notes, vibe, etc.) to be edited and saved.
- Historical Journals can be deleted. There should be a “Delete” icon on the top right of the header (aligned right to the screen), and when pressed, there should be a warning dialog “Are you sure you want to permanently delete this journal entry?”, with “Cancel” or “Delete” buttons.

## Error Handling

This section defines how the application handles critical errors to ensure a clear and informative user experience by providing immediate feedback and clear recovery paths.

### Nightscout Connection Failures

This error state is triggered when the application cannot connect to the user's configured Nightscout instance upon loading the Dashboard.

- **UI State:**
  - A persistent, critical red error banner (`--feedback-critical-color`) MUST be displayed at the top of the Dashboard. This banner is not dismissible.
  - The banner MUST contain the text: "The Nightscout connection was unsuccessful. Please check your credentials." The text MUST include a link to the user's Account Settings page.
  - The "Start Journal" button on the "Log this week's journal" card MUST be visually disabled.
- **Interaction Model:**
  - When a user hovers over the disabled "Start Journal" button, a tooltip MUST appear with the message: "Cannot start journal. Please resolve the Nightscout connection issue in your settings."
  - This prevents the user from initiating a journal creation process that is guaranteed to fail.

### Journal Creation with No Usable CGM Data

This error state is triggered if a user clicks "Start Journal" but the system, after a successful connection, finds no usable CGM data for the past 7 days.

- **UI State:**
  - Journal creation MUST be prevented, and the user MUST remain on the Dashboard.
  - A persistent, critical red error banner (`--feedback-critical-color`) MUST be displayed at the top of the Dashboard. This banner is not dismissible.
  - The banner MUST contain the text: "No data found. Check your Nightscout server if you think this is incorrect."
  - The "Start Journal" button on the "Log this week's journal" card MUST be visually disabled.
- **Interaction Model:**
  - When a user hovers over the disabled "Start Journal" button, a tooltip MUST appear with the message: "Cannot start journal. No CGM data was found for the last 7 days."
  - A link to the Nightscout documentation (`https://nightscout.github.io/`) should be provided within the banner to guide the user on ensuring data is flowing.

## Monetization Strategy (Post-MVP)

This section outlines the high-level monetization strategy envisioned for Goodnumbers beyond the Minimum Viable Product.

- **Model:** A freemium model is planned.
- **Free Tier Limitations:**
  - Free users will be able to log in and create an account.
  - They will be able to create only one report.
  - The "Save" button on the journal page will be disabled for free users, meaning their report will not be persistent.
  - The length of the personalized podcast will be limited for free users.

## About Us

TBD - This page will provide information about GoodNumbers, its mission, and the team behind it.
