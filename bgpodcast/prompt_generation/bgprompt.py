"""
bgprompt
"""
import pandas as pd
import numpy as np
from bgpodcast.data_analysis import nightscout as nsanalyze
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

def generate_notes(patient_name: str, gender : str, sgv : pd.DataFrame, carbs : pd.DataFrame) -> str:

    notes = ""
    number_of_days = bgutils.get_number_of_days(sgv)
    notes += f"{patient_name} has provided {number_of_days} days of blood glucose data.\n"
    if gender != "Prefer not to say":
        notes += f"They are {gender}. \n"

    notes += "Patient's latest results:\n"
    ######################################################
    # Monthly stats
    mean, stddev, pct_low, pct_high, tir, ttir = bgutils.get_sgv_stats(sgv)
    
    notes += f"The average blood glucose for was {mean:.0f} mg/dl, with a standard deviation of {stddev:.1f} mg/dl"
    notes += f"This means that 95% of the time, {patient_name}'s blood glucose was between {(mean - stddev*2):.0f} and {(mean + stddev*2):.0f}"
    notes += f"Time in range was {tir:.0%} mg/dl"
    notes += f"Time in tight range was {ttir:.0%} mg/dl"
    notes += f"Time spent high (above 180 was {pct_high:.0%}"
    notes += f"Time spent low (below 70 was {pct_low:.0%}"

    ######################################################
    # Weekly stats for this month
    notes += "Here is the week by week breakdown "
    weeks = bgutils.get_weeks(sgv, "date")
    wmeans = []
    for j, w in enumerate(weeks):
        # display(w)
        wdf = sgv[sgv['date'].dt.to_period('W') == w]
        if len(wdf) < 1008: # less than 50% of a week, then skip
            continue

        weekly_mean = wdf['sgv'].mean()
        wmeans.append(weekly_mean - mean)
        tir = len(sgv[(sgv.sgv >= 70) & (sgv.sgv < 180)]) / len(sgv)
        ttir = len(sgv[(sgv.sgv >= 70) & (sgv.sgv < 140)]) / len(sgv)
        notes += f"The average blood glucose for week of {w.to_timestamp().strftime('%B %d')} was {weekly_mean:.0f} mg/dl."

    wmax = max(wmeans)
    wmin = min(wmeans)
    if wmax > 18:
        notes += f"Weekly average blood glucose was higher than 18 mg/dl, which is quite high volatility. Perhaps {patient_name} was sick, had a lot of stress (such as a stressful work event, like a presentation or meeting), or a vacation (which means having a new routine, eating new foods, and possibly indulging a lot more)."
    if wmin < -18:
        notes += f"Weekly average blood glucose was lower than -18 mg/dl compared to the monthly, which is quite high volatility. Perhaps {patient_name} ate a lot less, or had really high insulin sensitivity, maybe due to a new exercise regime, or walking to school or work more."
    if wmax < 18 and wmin > -18:
        notes += f"Weekly average blood glucose didn't exceed an 18 mg/dl difference compared to the month, which means that overall, week over week, {patient_name} held near their monthly average. This is great work and should be celebrated."

    high_periods = nsanalyze.find_high_periods(sgv)
    if len(high_periods) > 0:
        notes += f"""There are some portions of the day that could use improvement. 
                We break down the day into 3 to 4 hour segments and look for times {patient_name} consistently runs high, and we found
                {len(high_periods)} periods that could use some tweaking."""

        meal_times = get_probable_mealtimes(carbs)
        meal_times.reset_index(drop=False, inplace=True)
        # display(high_periods)
        # display(meal_times)
        high_periods["meal_time"] = high_periods["start_time"].apply(lambda x: bgutils.is_near_meal_time(x, meal_times["start_time"]))
        # display(high_periods)
        
        for hp in high_periods.itertuples():
            st = pd.to_datetime(hp.start_time, format="%H:%M")
            notes += f"The time period from {hp.start_time} to {hp.end_time} runs high on average, at {hp.sgv} mg/dl."
            notes += f"{hp.start_time} is close to one of {patient_name}'s most common meal times.'"
            if st.hour < 11:
                notes += f"Note: Since {hp.start_time} is in the morning, talk about dawn phenomenon, and tips for a low glycemic index breakfast."
            elif st.hour >= 11 and st.hour < 16:
                notes += f"Note: Since {hp.start_time} is in the daytime, talk about low glycemic lunch options, how work stress can impact high blood sugars, and ideas for lowering blood glucose, such as going for a walk."
            elif st.hour >= 16 and st.hour < 20:
                notes += f"Note: Since {hp.start_time} is in the evening, talk about low glycemic dinner options, how work and home stress can impact high blood sugars, and ideas for lowering blood glucose, such as going for a walk."
            else:
                notes += f"Note: Give general advice on checking basal and insulin sensitivity."
    else:
        notes += f"Steve doesn't have any time periods where he is running high. Well done! This is quite an accomplishment!"

    low_periods = nsanalyze.find_low_periods(sgv)
    if len(low_periods) > 0:
        notes += f"""There are some portions of the day that could use improvement. 
                We break down the day into 3 to 4 hour segments and look for times {patient_name} consistently runs low, and we found
                {len(low_periods)} periods that could use some tweaking."""
        
        for lp in low_periods.itertuples():
            # high_periods.apply(lambda x: notes += f"The time period from {x['start_time']} to {x['end_time']} runs low on average, at {x['sgv']} mg/dl", axis=1)
            notes += f"The time period from {lp.start_time} to {lp.end_time} runs low on average, at {lp.sgv} mg/dl."
    else:
        notes += f"Steve doesn't have any time periods where he is running low. Well done! This is quite an accomplishment!"
        
    with open(f"notes.txt", "w") as f:    
        f.write(notes)

    return notes