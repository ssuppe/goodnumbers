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
  - Currently all this data is pulled _client side_ and then prepared/passed to the server. This is a TBD decision if this is the right way to do it.
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

* Out of Range Hotspots. For each hotspot, show a card of:
  - Time of Day: [e.g., Mornings (7:00 AM - 10:00 AM)]
  - Average BG: [e.g., 12.5 mmol/L (225 mg/dL)] [only in the patient's preferred units]
  - Daily Trend Chart: More information found in the Daily Trend Chart section.
  - AIs description, thoughts and questions
  - Text box for patients notes. The prompt should be \- “Why do you think this happened? Leave some notes on what you think the issue is, or how you can improve next week. If you don’t know, that's ok! Leave it blank.
* Next section: Goals for the week
  - Prompt: What are your goals for the week? Any big life challenges coming up? How do you think that will affect your diabetes, and is there anything you can do mentally or physically to prepare?
  - Input: Text box (paragraph) (optional)
* Save button, and “Save as Draft”

# Glycemic Event Cluster Visualization

1. Overview

The Glycemic Event Cluster Visualization is a time-series chart designed to help users identify and analyze
recurring patterns of significant glycemic excursions (either high or low). When the system detects that
multiple glycemic events of the same type (e.g., 'High Glucose') tend to occur around the same time of day, it
groups them into a "cluster." This feature displays all events from a single cluster on one consolidated chart,
making it easy to compare them, spot trends, and understand the context surrounding these patterns.

2. Functional Description

The feature is composed of a primary chart for glucose visualization, an optional secondary chart for meal
data, and a set of interactive elements for in-depth analysis.

##### 2.1. Chart Composition & Display

- Primary Display (Glucose Chart):

  - X-Axis (Time of Day): The horizontal axis represents a normalized 24-hour time window. All individual
    glycemic events are plotted on this same time axis according to their time of day, regardless of the
    specific date they occurred. This alignment is the core mechanism for visualizing the pattern. The time
    window is dynamically calculated to show the full duration of all events, plus a 60-minute buffer before
    the earliest event and a 30-minute buffer after the latest one.
  - Y-Axis (Glucose Level): The vertical axis represents blood glucose levels. It automatically adjusts its
    scale (min/max) to fit the glucose values present in the plotted events, ensuring the data is clearly
    visible. The axis label and all values correctly reflect the user's preferred units (mg/dL or mmol/L).

- Secondary Display (Carbohydrate Chart):
  - This chart appears automatically at the bottom of the glucose chart only if meal (carbohydrate) data is
    available for the displayed events.
  - It shares the same normalized X-axis (Time of Day) as the glucose chart.
  - Its Y-axis represents "Carbs (g)" and is used to plot meal events as a bar chart.

##### 2.2. Data Representation

- Glucose Event Series:

  - Each individual glycemic event from the cluster is rendered as a distinct line on the primary chart.
  - To ensure legibility, each line is assigned a unique color and/or line style (e.g., solid, dashed,
    dotted). This visual distinction allows the user to follow a single event's trajectory from beginning to
    end.
  - Data points on the line that fall within the official start and end time of the glycemic event are
    emphasized with a larger symbol size. Data points in the buffer periods before and after the event are
    shown with a smaller symbol.

- Carbohydrate Event Series:

  - When the secondary chart is displayed, meals are shown as vertical bars.
  - The color of each carb bar matches the color of the glucose line for that same day, visually linking a
    meal to its subsequent glycemic impact.

- Reference Range Lines:
  - To provide clinical context, the chart displays several horizontal reference lines:
    - Clinical Thresholds: Dashed red lines indicate the standard clinical thresholds for high (180 mg/dL)
      and low (70 mg/dL) glucose.
    - Patient Goals: If configured, dashed green lines indicate the user's personal target range (Target
      Low, Target High).

##### 2.3. User Interactions & Interactivity

- Legend:

  - A scrollable legend is displayed at the bottom of the chart.
  - Each entry corresponds to a single glycemic event, labeled with an identifier (e.g., "Event 1") and its
    original date and start time.
  - The user can click on legend items to toggle the visibility of individual event lines on the chart,
    allowing them to reduce clutter or focus on specific instances.

- Tooltip on Hover:

  - Hovering the cursor over any data point (on a glucose line or a carb bar) displays a detailed tooltip.
  - The tooltip provides context-specific information:
    - For Glucose: Shows the exact glucose value, the full date and time of the reading, and the series name
      (e.g., "Event 1...").
    - For Carbs: Shows the grams of carbohydrates, the time of the meal, and any notes the user logged with
      the meal.

- Event Isolation (Highlight on Hover):
  - This is a key analysis feature. When the user hovers over any part of an event (its glucose line, carb bar,
    or legend entry), the chart enters a "focus mode."
  - The entire event instance (both the full glucose line and any associated carb bars for that day) is
    highlighted at full opacity.
  - All other event series on the chart are "downplayed" (faded to a low opacity).
  - This interaction allows the user to instantly isolate a single, complete event from the cluster to analyze
    it without distraction. Moving the cursor off the chart restores all series to their default view.

3. Associated Information

The chart is presented within a container that provides additional context for the cluster:

- Cluster Summary: A text summary above the chart states the number of events in the cluster, the type of event
  (e.g., "High Glucose"), the average time of day they occur, and the time range of the cluster.
- Insights: A list of plain-language, prioritized insights generated by the system is displayed below the chart.
  These insights offer potential explanations or observations related to the visualized pattern.

# Historical Journals

- Historical Journals can be viewed but not edited. When one is clicked on, it should show a read-only view of all the same data when it was the Weekly Journal, but all the text fields and buttons are read-only.
- Historical Journals can be deleted but not edited. There should be a “Delete” icon on the top right of the header (aligned right to the screen), and when pressed, there should be a warning dialog “Are you sure, etc…”, with “Cancel” or “Delete” buttons

# About Us

TBD - This page will provide information about GoodNumbers, its mission, and the team behind it.
