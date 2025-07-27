# Goodnumbers Weekly Health Journal PRD

Revision: v0.1

GoodNumbers is a weekly health journal that is a combination of a diary/bullet journal, statistical analyzer and AI coach.

**Problem:** Type 1 Diabetics typically see their specialists quarterly or less, making it challenging to identify and address daily and weekly trends in their blood glucose management.

**Solution:** GoodNumbers provides a weekly practice of self-reflection, empowering Type 1 Diabetics to proactively manage their health. It leverages:

- **Data Analysis:** To help users find "hotspots" and trends in their blood glucose numbers.
- **AI Coaching:** To help users consider behavioral or treatment changes (always after consulting with a doctor).
- **Personalized Podcast:** For novelty and a new way to explain data, offering a weekly audio summary of their progress and wins, making the self-reflection process feel positive and motivating, like a beneficial workout.

The goal of GoodNumbers is to give Type 1 Diabetics a weekly practice of self-reflection, including:

- A pause in the week to look back over the last week, see how they are feeling, and celebrate wins and places to improve
- Reviewing trends, ‘problem areas’ and ‘hotspots’ in their blood glucose number s(eg, highs and lows). GoodNumbers will provide statistical analyses to take the work out of finding the problem areas and hotspots in their blood glucose management.
- Use AI to take in their personal experiences, correlate to the data, and provide a report (in the form of text/charts as well as a personal podcast) so they can improve for the next week.

GoodNumbers is meant to be motivating \- there is no judgement \- just recognition of a hard job well done (managing blood glucose) and providing real data and feedback on how to improve.

It should be noted that GoodNumbers does NOT provide medical advice \- rather, it recognizes patterns and makes /general/ recommendations that the patient should then take to their doctor or medical healthcare team.

# Home page

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

# Banner component

The banner component is a reusable component of the following attributes:

export const announcementData: AnnouncementProps = {
title: 'NOTE',
callToAction: {
text: 'GoodNumbers is an experiment and is for educational use only. Do not make any changes to your diabetic healthcare plan without speaking to your doctor.',
href: 'https://nextjs.org/blog/next-14'
}
};

The title gets a special UI treatment you can see in [Homepage Screenshot](#homepage-screenshot).

# Login page {#login-page}

Login page PRD and specification can be found at [Login page](LOGIN.md).

# Demo Page

TBD, but will essentially be a flat single report from an example user.

# Setup Account

- The first time a user logs in, the first thing we need to do is setup their account. Accounts have the following information:
  - CGM Provider \- this should be a dropdown where the user can choose which CGM system they use.
    - **Initial Support:** Currently, we only support one CGM provider: Nightscout. The dropdown will initially only contain "Nightscout" as an option.
    - **Modularity for Future Expansion:** The system should be designed modularly to easily integrate additional CGM providers and their respective required fields in the future.
  - After choosing the Provider (currently Nightscout), we should show the required fields for that provider:
    - For Nightscout, the following fields are required:
      - Nightscout API version (for now, this is hardcoded to 1)
      - Nightscout URL (text field)
      - Nightscout Token (text field)
      - Test button - when pressed, it should issue a GET request to the /status endpoint, eg https://<nightscout_url>/status?token=<nightscout_token>, and check to see if we get a valid response (HTTP error code 200, and an apiEnabled=TRUE response in the json)
  - Preferred units: They can choose ONE of (but can be changed later):
    - mg/dL
    - mmol/L

# Dashboard

- Upon successful login, the dashboard is the landing page for all authenticated users
- It has a larger card at the top to “Log this week's journal.” For now it will have an image, a paragraph of text, and a button for “Start Journal.”
  - Users shouldn’t be able to create new Journals all the time. This will be costly to the platform, and also the user needs to spend roughly a week or more between Journals so they have new behavior and data to reflect on. Therefore the “Start Journal” button should only be enabled if one or more of the following pieces of logic are true:
    - It’s been 3 or more days since the last Journal
    - There are no other Journals
- Underneath it should have “Past weeks”, which is a list of cards with dates, a small summary (which will be created when the journal is created), and a view button.
  - If there are no Historical Journals, this section shouldn’t be shown
  - Historical Journals should be shown in reverse chronological order (newest first)

# This week's journal

- Upon clicking “Start Journal”, they are taken to a new page for This week’s journal
- The Journal should have two saved states
  - Draft \- when in Draft, it is saved to the backend, but can still be edited
    - On the Dashboard, the Journal still takes the topmost large CTA card
    - The Card shows “Edit Journal” when in Draft
  - Saved \- once saved, it becomes a Historical Journal and follows all the same logic as defined above

## Loading phase

- When a new Journal is first created (not edited from draft, but first time), a number of things have to be queried, created and saved for this Journal. This data is NOT user input. This includes:
  - Blood glucose data for the last 7 days
  - Treatments (insulin, meals) for the last 7 days
  - Profile data (for the last 7 days)
  - Currently all this data is pulled _client side_ and then prepared/passed to the server. This is a TBD decision if this is the right way to do it, feel free to recommend something else.
- Once all that data is collected, then there is a pre-analysis that is done on the server. This means the above data needs to be sent to the backend to do the following:
  - Run through non-AI data analysis tools to do timeseries analysis (averages, finding low and high periods, and more). I have working code for this, we can get into the details later. We will call this “Notes”. This analysis is structured \- it includes
    - A weekly overview
    - Summaries of hotspots (ie, common times of day over the last week where the patient was high or low)
    - Currently these summaries are created using non-AI (ie, hardcoded text)
  - Send the data to Gemini for additional analysis which creates an audio podcast
    - This is actually a server-side pipeline that calls Gemini several times in order to:
      - Pass 1: Your job is to look at the patient's clinical notes and create a thorough assessment with recommendations on how the patient might improvement their blood sugar numbers, including control, variability, and overall quality of life.
      - Pass 2: A more in-depth second pass assessment of the notes. Focus on:
        - 1\. Carefully examining numbers and times of day
        - 2\. Causes of problems, anomalies and issues.
        - 3\. Recommendations and medical treatments.
      - Pass 3: Create a Podcast Dialog
      - Pass 4: Create SSML of Podcast Dialog
      - Pass 5: Description of the Podcast for the RSS feed
  - Create a new RSS entry
  - Return everything to the client

# User input phase

After the loading phase, the user now gets to review the data and review their week. The goal here is for the user to be able to reflect on both the emotional aspects, lifestyle aspects, and of course the numbers data of how their week went.

- The top should say “My week” and the date underneath it as a subheading
- AGP for the last seven days. I have code examples for the AGP, it also has a general overview of different points/text.
- After that there are questions:
  - 1. Weekly Vibe: How Was Your Week?
       Let's start with a quick check-in on your overall feeling about your diabetes management this past week.
       Prompt: "How do you feel about managing your diabetes this week?"
       - Options (Tap one):
         - 🥀 Wilted: Feeling completely drained, struggling to stand.
         - 🌱 Sprouting: Getting by, some fragile growth, still needs a lot of care.
         - 🌿 Healthy: Growing strong, managing well, feeling good.
         - 🌻 Blooming: Feeling vibrant, flourishing, full of energy and positive outcomes.

2. Influencing Factors
   What might have influenced your diabetes management this week? Tap any that apply. Chips (Click to Select/Deselect):

- Busy
- Hectic
- Quiet Week
- Feeling Unwell
- Feeling Healthy
- Lots of Exercise
- Running Around
- Poor Sleep
- Good Sleep
- Great Diet
- Different foods
- Strange Meal Times
- Changes to Routine
- Travel
- Social Events
- New Medications
- Menstrual Cycle

* Out of Range Glycemic Event Clusters. For each cluster, show a card of its details. These are covered in the [Glycemic Event Cluster Analysis](#glycemic-event-cluster-analysis) section
  - Time of Day: [e.g., Mornings (7:00 AM - 10:00 AM)]
  - Average BG: [e.g., 12.5 mmol/L (225 mg/dL)] [only in the patient's preferred units]
  - Daily Trend Chart: More information found in the Daily Trend Chart section.
  - AIs description, thoughts and questions
  - Text box for patients notes. The prompt should be \- “Why do you think this happened? Leave some notes on what you think the issue is, or how you can improve next week. If you don’t know, that's ok! Leave it blank.
* Next section: Goals for the week
  - Prompt: What are your goals for the week? Any big life challenges coming up? How do you think that will affect your diabetes, and is there anything you can do mentally or physically to prepare?
  - Input: Text box (paragraph) (optional)
* Save button, and “Save as Draft”

# Glycemic Event Cluster Analysis

1. Overview

The Glycemic Event Cluster Analysis feature is a comprehensive tool designed to automatically identify,
visualize, and explain recurring patterns of high or low glycemic events. When the system detects that multiple
events of the same type (e.g., "Hypoglycemia") consistently occur around the same time of day, it groups them
into a "cluster." This feature then presents the cluster as a single, integrated component composed of four
parts: a high-level Cluster Summary, an interactive Glycemic Event Cluster Visualization, a list of prioritized
Associated Insights, and a User Notes text box for patient reflection. The goal is to provide the user with a
clear, actionable understanding of their glycemic patterns while encouraging personal engagement.

2. Components

##### 2.1. Cluster Summary

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

##### 2.2. Glycemic Event Cluster Visualization

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

##### 2.3. Associated Insights

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

##### 2.4. User Notes

This component provides a dedicated space for the user to reflect on the presented pattern and document their
own thoughts, context, or action plans. It is displayed at the bottom of the feature, after the Associated
Insights.

- Functionality:
  _ Component: A multi-line text input field (textarea).
  _ Prompt: The text box will be empty by default but will contain the following instructional prompt: > "Why do you think this happened? Leave some notes on what you think the issue is, or how you can
  improve next week. If you don’t know, that's ok! Leave it blank."
  _ Behavior:
  _ Input is optional and the field can be left blank. \* Notes entered by the user will be saved and associated with the specific cluster for future review by the user or their clinician. It will also be used by AI when creating insights in the Loading phase for subsequent weeks (ie, subsequent weeks may look at this data).

# Historical Journals

- Historical Journals can be viewed but not edited. When one is clicked on, it should show a read-only view of all the same data when it was the Weekly Journal, but all the text fields and buttons are read-only.
- Historical Journals can be deleted but not edited. There should be a “Delete” icon on the top right of the header (aligned right to the screen), and when pressed, there should be a warning dialog “Are you sure, etc…”, with “Cancel” or “Delete” buttons

# About Us

TBD - This page will provide information about GoodNumbers, its mission, and the team behind it.
