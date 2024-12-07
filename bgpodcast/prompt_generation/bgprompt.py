"""
bgprompt
"""
import mypandas as pd
import numpy as np

from bgpodcast.data_analysis import dawnphenom, high_periods, weekly_analysis
from bgpodcast.utils.bgutils import add_comment, get_number_of_days

def generate_notes(entries : pd.DataFrame, treatments : pd.DataFrame) -> str:

    notes = ""
    # if gender != "Prefer not to say":
    #     notes += f"Patient is {gender}. \n"

    notes += "Patient's latest results:\n"
    ######################################################
    # Weekly stats
    notes += "Here are the general stats for this week:\n"
    
    weekly_stats = weekly_analysis.weekly_stats(entries)
    notes += weekly_stats + "\n"

    ######################################################
    # Check for dawn phenomenon
    dawn_report = dawnphenom.get_clinical_report(entries)
    notes += dawn_report["clinical_report"]["recommendations"] + "\n"

    ######################################################
    # Analyze high periods
    # high_period_analysis = high_periods.high_period_report(entries, treatments)
    # notes = add_comment(high_period_analysis, notes)

    # low_periods = nsanalyze.find_low_periods(entries)
    # if len(low_periods) > 0:
    #     notes += f"""There are some portions of the day that could use improvement. 
    #             We break down the day into 3 to 4 hour segments and look for times {patient_name} consistently runs low, and we found
    #             {len(low_periods)} periods that could use some tweaking."""
        
    #     for lp in low_periods.itertuples():
    #         # high_periods.apply(lambda x: notes += f"The time period from {x['start_time']} to {x['end_time']} runs low on average, at {x['sgv']} mg/dl", axis=1)
    #         notes += f"The time period from {lp.start_time} to {lp.end_time} runs low on average, at {lp.sgv} mg/dl."
    # else:
    #     notes += f"Steve doesn't have any time periods where he is running low. Well done! This is quite an accomplishment!"
        
    with open("notes.txt", "w", encoding="utf-8") as f:    
        f.write(notes)

    return notes