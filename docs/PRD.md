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
    - **Action:** A "View" button is right-aligned within the card. Clicking it leads to the editable journal page for that week. "Important" insight icon (💡) to draw attention without signaling a critical issue.

### Typography

- **Font Stack:** The application will use a system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`). This ensures optimal performance, legibility, and a native feel on any device without requiring custom font loading.

### Core Components & Styling

- **Banner Component:** The primary site banner uses a solid red (`--feedback-critical-color`) background with high-contrast white text. This makes the medical disclaimer impossible to miss.
- **Buttons:**
  - **Primary:** Solid green background with white text. Used for main calls-to-action (e.g., "Login", "Start Journal").
  - **Secondary:** Transparent background with a green border and text. Used for less prominent actions (e.g., "View" on a historical journal).
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
