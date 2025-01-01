"""
bgprompt
"""
import pandas as pd
import numpy as np

from bgpodcast.data_analysis import dawnphenom, high_periods, weekly_analysis
from bgpodcast.utils.bgutils import is_dev_environment


def generate_notes(entries: pd.DataFrame, treatments: pd.DataFrame) -> str:

    notes = ""

    notes += "# Patient's latest results:\n"

    ######################################################
    # Weekly stats
    notes += "## This week's general statistics:\n"

    weekly_stats = weekly_analysis.weekly_stats(entries)
    notes += weekly_stats + "\n"

    ######################################################
    # Check for dawn phenomenons
    notes += "## Dawn phenomenom report\n"
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
    if is_dev_environment():
        with open("../../_tmp/notes.txt", "w", encoding="utf-8") as f:
            f.write(notes)

    return notes
