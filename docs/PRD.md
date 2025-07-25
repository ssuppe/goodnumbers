# Goodnumbers Weekly Health Journal PRD

Revision: v0.1

GoodNumbers is a weekly health journal that is a combination of a diary/bullet journal, statistical analyzer and AI coach. The goal of GoodNumbers is to give Type 1 Diabetics a weekly practice of self-reflection, including:

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
  - CGM Provider \- this should be a dropdown where the user can choose which CGM system they use, so we can query for historical blood glucose, meal times, insulin profiles, etc
    - Currently we only support one CGM provider \- Nightscout
  - After choosing the Provider, we should show the required fields for that provider
    - For Nightscout, the following fields are required
      - Nightscout URL (text field)
  - Nightscout Toekn

# Dashboard

- Upon successful login, the dashboard is the landing page for all authenticated users
- It has a larger card at the top to “Log this week's journal.” For now it will have an image, a paragraph of text, and a button for “Start Journal.”
  - Users shouldn’t be able to create new Journals all the time. This will be costly to the platform, and also the user needs to spend roughly a week or more between Journals so they have new behavior and data to reflect on. Therefore the “Start Journal” button should only be enabled if one or more of the following pieces of logic are true:
    - It’s been 5 or more days since the last Journal
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
  - How did you feel about your diabetes this week? (Happy face, neutral face, sad face)
  - Chips that are all unselected by default, but can be clicked and enabled:
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
- Save button, and “Save as Draft”

# Historical Journals

- Historical Journals can be viewed. When one is clicked on, it should show a read-only view of all the same data when it was the Weekly Journal, but all the text fields and buttons are read-only.
- Historical Journals can be deleted but not edited. There should be a “Delete” icon on the top right of the header (aligned right to the screen), and when pressed, there should be a warning dialog “Are you sure, etc…”, with “Cancel” or “Delete” buttons
