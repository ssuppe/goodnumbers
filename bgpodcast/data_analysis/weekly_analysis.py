from dfutils import prepare_data
from bgpodcast.utils import bgutils




def weekly_stats(entries) -> str:
    notes = ""
    entries = prepare_data(entries, days_to_analyze=7)
    start_date, end_date, mean, stddev, pct_low, pct_high, tir, ttir = bgutils.get_sgv_stats(entries)
    
    notes += f"Report from {start_date} to {end_date}"
    notes += f"The average blood glucose for was {mean:.0f} mg/dl, with a standard deviation of {stddev:.1f} mg/dl\n"
    notes += f"This means that 95% of the time, blood glucose was between {(mean - stddev*2):.0f} and {(mean + stddev*2):.0f}.\n"
    notes += f"Time in range was {tir:.0%} mg/dl.\n"
    notes += f"Time in tight range was {ttir:.0%} mg/dl.\n"
    notes += f"Time spent high (above 180) was {pct_high:.0%}.\n"
    notes += f"Time spent low (below 70) was {pct_low:.0%}.\n"
    return notes