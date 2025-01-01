from bgpodcast.data_analysis.dfutils import prepare_data
from bgpodcast.utils import bgutils


def weekly_stats(entries) -> str:
    notes = ""
    entries = prepare_data(entries, days_to_analyze=7)
    start_date, end_date, mean, stddev, cv, pct_low, pct_high, tir, ttir = bgutils.get_sgv_stats(
        entries)

    notes += f"  * This week was from {start_date} to {end_date}\n"
    notes += f"""  * This week was the patient's average blood glucose was {
        mean:.0f} mg/dl, with a coefficient of variation of {cv:.1%}\n"""

    if mean > 154:
        notes += """    * Their mean is higher than the recommended target of 126 - 154, which means there
        is substantial room for improvement."""
    elif mean > 126 and mean <= 154:
        notes += """    * Their mean is right in the recommended target of 126-154, so they're doing a good job."""
    elif mean <= 126:
        notes += """    * Their mean is below the target range of 126-154, which is very good, so long as their
        time below 70 is less than 4% (less than 1 hour per day)"""

    notes += f"""  Practically speaking, they've spent 95% of their week between {
        (mean - stddev*2):.0f} and {(mean + stddev*2):.0f}.\n"""
    notes += f"  * Time in range (70-180) was {tir:.0%} mg/dl.\n"
    notes += f"  * Time spent high (above 180) was {pct_high:.0%}."

    if pct_high < .12:
        notes += "This is far less than the recommended percentage of 25%, which is excellent.\n"
    elif pct_high < .25:
        notes += "This is less than the recommended percentage of 25%, which is very good.\n"
    else:
        notes += "This is higher than the recommended percentage of 25%, which can lead to long-term health complications.\n"

    notes += f"  * Time spent low (below 70) was {pct_low:.0%}."
    if pct_low < .02:
        notes += "This is far less than the recommended percentage of 4%, which is excellent.\n"
    elif pct_low < .04:
        notes += "This is less than the recommended percentage of 4%, which is very good.\n"
    else:
        notes += """This is higher than the recommended percentage of 4%, which can result in loss
        of hypoglycemia awareness, which can be dangerous.\n"""

    notes += f"""  * Finally, time in tight range (70-140) was
        {ttir:.0%}. Time in tight range is closer to what a non-diabetic's glucose levels are.\n"""

    return notes
