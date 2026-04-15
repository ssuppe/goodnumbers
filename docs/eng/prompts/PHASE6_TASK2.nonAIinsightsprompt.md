Now that Phase 6 Task 1 is complete, including the Hotspot Detector and displaying them as EventClusterCards (see @src/components/journal/EventClusterCard.tsx), I want to add non-AI insights to the EventClusterCards.

By non-AI insights, I mean using basic statistical analysis to describe what was happening in that hotspot.

You can read may of the proof of concept insights in the following files:
@proof_of_concept/goodnumbers/lib/insights/generators/avg-glucose.generator.ts
@proof_of_concept/goodnumbers/lib/insights/generators/basic-stats.generator.ts
@proof_of_concept/goodnumbers/lib/insights/generators/gmi-vs-tir.generator.ts
@proof_of_concept/goodnumbers/lib/insights/generators/gmi.generator.ts
@proof_of_concept/goodnumbers/lib/insights/generators/low-percentage.generator.ts
@proof_of_concept/goodnumbers/lib/insights/generators/meal-related-highs.generator.ts
@proof_of_concept/goodnumbers/lib/insights/generators/time-in-range.generator.ts

You don't need to implement these verbatim, rather use them as inspiration. This original proof-of-concept was a bit confusing because it created user-visible insights (for the web page) and also text insights that could be passed to AI to create the podcast.

But I'd like you to:
a) Separate out the 'aggregate statistics' insights and use those on the AGP chart
b) Use the others on the EventClusterCards.

Always show all the relevant insights.

Be sure to include plans for both the backend prisma changes, middleware, and frontend. Be thorough.
