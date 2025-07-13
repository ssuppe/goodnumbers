# Goodnumbers Weekly Health Journal PRD

GoodNumbers is a weekly health journal that is a combination of a diary/bullet journal, statistical analyzer and AI coach. The goal of GoodNumbers is to give Type 1 Diabetics a weekly practice of self-reflection:

- A pause in the week to look back over the last week, see how they are feeling, and celebrate wins and places to improve
- Utilizing statistical analyses to take the work out of finding the problem areas and hotspots in their blood glucose management.
- Use AI to take in their personal experiences, correlate to the data, and provide a report (in the form of text/charts as well as a personal podcast) so they can improve for the next week.

GoodNumbers is meant to be motivating \- there is no judgement \- just recognition of a hard job well done (managing blood glucose) and providing real data and feedback on how to improve.

It should be noted that GoodNumbers does NOT provide medical advice \- rather, it recognizes patterns and makes /general/ recommendations that the patient should then take to their doctor or medical healthcare team.

Here is a textual description of the workflow and basic functionality.

# Home page

- I have code for this already. It's a standard landing page that explains what good numbers is, and has two calls to action \- see a demo (which links to a single report page with static saved data in the client, it's not a live demo tied to the backend), and Login, which leads to the login page
- There is a banner across the top in red that explains this is an experimental website and very likely wrong . I have copy for this and can provide a demo. This banner would be on all pages, even logged in ones

# Login

- This should be a simple page with the ability to log in or create an account
- Before being able to sign up, there are two checkboxes they need to click to accept the terms of service and the fact this is all experimental and should not take the place of
- For now, let's just support logging in with Google oauth using passport.us

# Setup Account

- The first time a user logs in, the first thing we need to do is setup their account. Accounts have the following information:
  - CGM Provider \- this should be a dropdown where the user can choose which CGM system they use, so we can query for historical blood glucose, meal times, insulin profiles, etc
    - Currently we only support one CGM provider \- Nightscout
  - After choosing the Provider, we should show the required fields for that provider
    - For Nightscout, the following fields are required:
      - Nightscout URL (text field)
      - Nightscout Token (text field)
      - A "Test" button will be provided to validate the Nightscout credentials. This will trigger a server-side call to `https://<nightscout_url>/api/v1/status?token=<nightscout_token>` and confirm a successful (HTTP 200) response.

# Dashboard

- Upon successful login, the dashboard is the landing page for all authenticated users
- It has a larger card at the top to “Log this week's journal.” For now it will have an image, a paragraph of text, and a button for “Start Journal.”
  - Users shouldn’t be able to create new Journals all the time. This will be costly to the platform, and also the user needs to spend roughly a week or more between Journals so they have new behavior and data to reflect on. Therefore the “Start Journal” button should only be enabled if one or more of the following pieces of logic are true:
    - It’s been 5 or more days since the last Journal
    - There are no other Journals
  - When the "Start Journal" button is disabled, a clear, persistent text banner will be displayed near the button explaining when the user can create their next entry (e.g., "You have another X days before you can write your next journal entry").
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

- When a new Journal is first created, the user is taken to a dedicated loading page while the analysis is performed. This page will display:
  - The GoodNumbers logo or name.
  - A rotating motivational quote to create a positive waiting experience.
  - A progress bar and text that updates to reflect the current stage of the analysis (e.g., "Fetching data," "Analyzing patterns," "Generating podcast").
  - If the CGM data fetch fails, the loading screen will display the full error message and a link to the "Account Settings" page to help with debugging.
  - If any part of the AI analysis or podcast generation fails, the entire process will be halted. The loading screen will display the full error message, and the journal will not be created.
- During this phase, the following data is queried and processed:
  - Blood glucose data for the last 7 days
  - Treatments (insulin, meals) for the last 7 days
  - Profile data (for the last 7 days)
  - Currently all this data is pulled _client side_ and then prepared/passed to the server. This is a TBD decision if this is the right way to do it.
- Once all that data is collected, then there is a pre-analysis that is done on the server. This means the above data needs to be sent to the backend to do the following:
  - Run through non-AI data analysis tools to do timeseries analysis. This generates a structured text document called "Notes" that is passed to the AI. The "Notes" document begins with the date range of the analysis and the user's preferred glucose units (mg/dL or mmol/L) and is divided into two main sections:
    - **Weekly Overview:** A summary of high-level statistics for the entire period, including:
        - Average blood glucose
        - GMI (Glucose Management Indicator, an A1c estimate)
        - Time in Range (TIR), Time Above Range (TAR), and Time Below Range (TBR) percentages.
        - Key measures of glycemic variability.
    - **Glycemic Pattern Analysis:** This section identifies and describes recurring "hotspots" of high or low blood glucose. For each significant pattern, it provides a summary like:
        - "Pattern 1: 4 high events detected, typically occurring around 9:45 AM."
        - It also includes an initial AI-generated insight that attempts to identify the potential cause of the pattern (e.g., relating a high to meal times).
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
  - How did you feel about your diabetes this week? (Happy face, neutral face, sad face)
  - Chips that are all unselected by default, but can be clicked and enabled. These selections are passed to the AI for analysis and to provide context for the report and podcast.:
    - Stressful or relaxed
    - Busy or quiet
    - Sick or healthy
    - Lots of exercise
    - Lack of sleep
    - Exceptional diet
- Next, we show a list of times of day where the patient was commonly out of range. Each section should have the following:
  - Time of day
  - Average BG
  - Line chart of each day where there was an issue (x axis is time, y axis is blood glucose)
  - AIs description, thoughts and questions
  - Text box for patients notes. The prompt should be \- “Why do you think this happened? Leave some notes on what you think the issue is, or how to fix the problem. If you don’t know, say so, or leave it blank.
- Next section: Goals for the week
  - Prompt: What are your goals for the week? Any big life challenges coming up? How do you think that will affect your diabetes, and is there anything you can do mentally or physically to prepare?
  - Input: Text box (paragraph) (optional)
- Button Bar:
  - "Save as Draft": Saves the journal entry and returns the user to the Dashboard. A confirmation toast message ("Saved draft!") will be displayed for 10 seconds.
  - "Save": Saves the journal as a final version, making it a Historical Journal, and redirects the user to the Dashboard.

# Historical Journals

- Historical Journals can be viewed. When one is clicked on, it should show a read-only view of all the same data when it was the Weekly Journal, but all the text fields and buttons are read-only.
- Historical Journals can be deleted but not edited. There should be a “Delete” icon on the top right of the header (aligned right to the screen), and when pressed, there should be a warning dialog “Are you sure, etc…”, with “Cancel” or “Delete” buttons

# Account Settings

- Users can access this page to manage their account settings.
- The first section allows users to manage their CGM provider.
  - A dropdown will allow them to select their CGM provider (e.g., Nightscout).
  - Based on the selection, the necessary fields for that provider will be displayed for editing (e.g., Nightscout URL and Token).
  - A "Test" button will be available to validate the credentials.
- The second section will be for account deletion.
  - A "Delete Account" button will be present.
  - Clicking this button will trigger a confirmation dialog to prevent accidental deletion.
