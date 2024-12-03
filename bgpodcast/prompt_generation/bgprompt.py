"""
bgprompt
"""
import pandas as pd
import numpy as np
from bgpodcast.data_analysis import dawnphenom, dfutils as nsanalyze, weekly_analysis
from bgpodcast.utils import bgutils

def get_probable_mealtimes(carbs : pd.DataFrame):
    number_of_days = bgutils.get_number_of_days(carbs, 'date')
    # Filter out small meals
    carbs['date'] = carbs['date'].apply(lambda x: x.replace(month=9, day=1))
    carbs['date'] = carbs['date'].dt.round("60min")
    carbs['start_time'] = carbs['date'].dt.strftime("%H:%M")
    carbs = carbs.pivot_table(index='start_time', values = 'carbs', aggfunc=["median", "mean", 'count', "sum"])
    carbs = carbs[(carbs["count"]["carbs"] >= number_of_days*.3) & (carbs["median"]["carbs"] >= np.quantile(carbs["median"]["carbs"], .5))]
    return carbs

def generate_notes(patient_name: str, gender : str, entries : pd.DataFrame, carbs : pd.DataFrame) -> str:

    notes = ""
    if gender != "Prefer not to say":
        notes += f"Patient is {gender}. \n"

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

    # high_periods = nsanalyze.find_high_periods(entries)
    # if len(high_periods) > 0:
    #     notes += f"""There are some portions of the day that could use improvement. 
    #             We break down the day into 3 to 4 hour segments and look for times {patient_name} consistently runs high, and we found
    #             {len(high_periods)} periods that could use some tweaking."""

    #     # meal_times = get_probable_mealtimes(carbs)
    #     # meal_times.reset_index(drop=False, inplace=True)
    #     # # display(high_periods)
    #     # # display(meal_times)
    #     # high_periods["meal_time"] = high_periods["start_time"].apply(lambda x: bgutils.is_near_meal_time(x, meal_times["start_time"]))
    #     # # display(high_periods)
        
    #     for hp in high_periods.itertuples():
    #         st = pd.to_datetime(hp.start_time, format="%H:%M")
    #         notes += f"The time period from {hp.start_time} to {hp.end_time} runs high on average, at {hp.sgv} mg/dl."
    #         notes += f"{hp.start_time} is close to one of {patient_name}'s most common meal times.'"
    #         if st.hour < 11:
    #             notes += f"Note: Since {hp.start_time} is in the morning, talk about dawn phenomenon, and tips for a low glycemic index breakfast."
    #         elif st.hour >= 11 and st.hour < 16:
    #             notes += f"Note: Since {hp.start_time} is in the daytime, talk about low glycemic lunch options, how work stress can impact high blood sugars, and ideas for lowering blood glucose, such as going for a walk."
    #         elif st.hour >= 16 and st.hour < 20:
    #             notes += f"Note: Since {hp.start_time} is in the evening, talk about low glycemic dinner options, how work and home stress can impact high blood sugars, and ideas for lowering blood glucose, such as going for a walk."
    #         else:
    #             notes += f"Note: Give general advice on checking basal and insulin sensitivity."
    # else:
    #     notes += f"Steve doesn't have any time periods where he is running high. Well done! This is quite an accomplishment!"

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