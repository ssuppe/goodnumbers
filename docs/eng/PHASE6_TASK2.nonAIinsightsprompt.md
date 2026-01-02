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

Also, I think these insights may have been a little too close to medical advice, which would qualify this as a medical device. Let's give insights that give them a list of things to discuss with their doctor, rather than diagnosing directly or telling them an exact input or number to change in their pump settings. Other suggestions could be general like diet, exercise, taking a walk before/after meals, etc. Note that these text insights are hard coded and given based on basic heuristics, they are not AI.

Be sure to include plans for both the backend prisma changes, middleware, and frontend. Be thorough.
