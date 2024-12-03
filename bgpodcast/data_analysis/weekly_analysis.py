from datetime import timedelta

import pandas as pd

from bgpodcast.utils import bgutils


def prepare_data(entries, days_to_analyze=7):
    df = pd.DataFrame(entries)
    
    # Apply UTC offset
    df['adjusted_date'] = df.apply(lambda row: row['date'] + (row['utcOffset'] * 60 * 60 * 1000), axis=1)
    df['datetime'] = pd.to_datetime(df['adjusted_date'], unit='ms')
    
    # Filter to last 7 days
    latest_date = df['datetime'].max()
    start_date = latest_date - timedelta(days=days_to_analyze)
    df = df[df['datetime'] >= start_date]
    
    # Sort and add date
    df = df.sort_values('datetime')
    df['date'] = df['datetime'].dt.date
    
    return df

def weekly_stats(entries) -> str:
    notes = ""
    entries = prepare_data(entries, days_to_analyze=7)
    mean, stddev, pct_low, pct_high, tir, ttir = bgutils.get_sgv_stats(entries)
    
    notes += f"The average blood glucose for was {mean:.0f} mg/dl, with a standard deviation of {stddev:.1f} mg/dl\n"
    notes += f"This means that 95% of the time, blood glucose was between {(mean - stddev*2):.0f} and {(mean + stddev*2):.0f}.\n"
    notes += f"Time in range was {tir:.0%} mg/dl.\n"
    notes += f"Time in tight range was {ttir:.0%} mg/dl.\n"
    notes += f"Time spent high (above 180) was {pct_high:.0%}.\n"
    notes += f"Time spent low (below 70) was {pct_low:.0%}.\n"
    return notes