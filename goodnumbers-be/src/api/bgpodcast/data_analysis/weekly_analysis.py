from bgpodcast.data_analysis.dfutils import prepare_data
from bgpodcast.utils import bgutils


def weekly_stats(entries) -> str:
    notes = "## This week's general statistics:\n"

    entries = prepare_data(entries, days_to_analyze=7)
    start_date, end_date, mean, stddev, pct_low, pct_high, tir, ttir = bgutils.get_sgv_stats(
        entries)

    notes += f"  * This week was from {start_date} to {end_date}\n"
    notes += f"""  * This week was the patient's average blood glucose was {
        mean:.0f} mg/dl, with a standard deviation of {stddev:.1f} mg/dl\n"""
    notes += f"""    * This means that 95% of the time, blood glucose was between {
        (mean - stddev*2):.0f} and {(mean + stddev*2):.0f}.\n"""
    notes += f"  * Time in range was {tir:.0%} mg/dl.\n"
    notes += f"  * Time spent high (above 180) was {pct_high:.0%}.\n"
    notes += f"  * Time spent low (below 70) was {pct_low:.0%}.\n"
    notes += f"""  * More specifically, time in tight range was {
        ttir:.0%} mg/dl. Time in tight range is closer to what a non-diabetic's glucose levels are.\n"""

    return notes
