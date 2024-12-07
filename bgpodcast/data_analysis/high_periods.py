from datetime import timedelta
import mypandas as pd
from bgpodcast.data_analysis.dfutils import find_high_periods, prepare_data
from bgpodcast.data_ingestion.nightscout import read_treatments_file
from bgpodcast.utils.bgutils import add_comment, get_number_of_days

def is_near_meal_time(start_time, meal_times):
  """
  This function takes in a start time and a list of meal times and returns True if the start time 
  is within one hour of any of the meal times.

  Args:
    start_time: A string representing a time in the format "%H:%M".
    meal_times: A list of strings representing meal times in the format "%H:%M".

  Returns:
    A boolean value indicating whether the start time is within one hour of any of the meal times.
  """

  # Convert the start time and meal times to datetime objects.
  start_time = pd.to_datetime(start_time, format="%H:%M")
  meal_times = pd.to_datetime(meal_times, format="%H:%M")

  # Create a boolean mask indicating whether the start time is within one hour of any of the meal times.
  mask = (start_time >= meal_times - pd.Timedelta(hours=1)) & (start_time <= meal_times + pd.Timedelta(hours=2))

  # Return the boolean mask.
  return mask.any()
def analyze_pre_high_period(high_period, df_treatments, lookback_hours=4):
    """Analyze treatments before a high period"""
    start_time = high_period['start_time']
    lookback_start = start_time - timedelta(hours=lookback_hours)
    
    # Get relevant treatments
    relevant_treatments = df_treatments[
        (df_treatments['datetime'] >= lookback_start) &
        (df_treatments['datetime'] <= start_time)
    ]
    
    meals = relevant_treatments[relevant_treatments['eventType'] == 'Meal Bolus']
    corrections = relevant_treatments[relevant_treatments['eventType'] == 'Correction Bolus']
    
    return {
        'meals': meals.to_dict('records'),
        'corrections': corrections.to_dict('records'),
        'meal_count': len(meals),
        'correction_count': len(corrections),
        'last_meal_time': meals['datetime'].max() if not meals.empty else None,
        'last_correction_time': corrections['datetime'].max() if not corrections.empty else None
    }

def high_period_report(entries : pd.DataFrame, treatments : pd.DataFrame) -> str:
    entries = prepare_data(entries)
    treatments = prepare_data(treatments)
    ######################################################
    # Find general high periods
    high_periods = find_high_periods(entries)

    notes = ""
    if len(high_periods) > 0:
        notes = add_comment("Periods of the day with higher than normal blood sugar levels", notes)
        notes = add_comment(f"""There are some portions of the day that could use improvement. 
                We break down the day into 3 to 4 hour segments and look for times the patient consistently runs high, and we found
                {len(high_periods)} periods.""", notes)

        # meal_times = get_probable_mealtimes(carbs)
        # meal_times.reset_index(drop=False, inplace=True)
        # high_periods["meal_time"] = high_periods["start_time"].apply(lambda x: is_near_meal_time(x, meal_times["start_time"]))
    #     # # display(high_periods)
        
        for i, hp in high_periods.iterrows():
            # st = pd.to_datetime(hp.start_time, format="%H:%M")
            notes += f"Time period {i}: from {hp.start_time} to {hp.end_time} runs high on average, at {hp.sgv} mg/dl."

            pre = analyze_pre_high_period(hp, treatments, lookback_hours=4)


            # notes += f"{hp.start_time} is close to one of {patient_name}'s most common meal times.'"
            # if st.hour < 11:
    #             notes += f"Note: Since {hp.start_time} is in the morning, talk about dawn phenomenon, and tips for a low glycemic index breakfast."
    #         elif st.hour >= 11 and st.hour < 16:
    #             notes += f"Note: Since {hp.start_time} is in the daytime, talk about low glycemic lunch options, how work stress can impact high blood sugars, and ideas for lowering blood glucose, such as going for a walk."
    #         elif st.hour >= 16 and st.hour < 20:
    #             notes += f"Note: Since {hp.start_time} is in the evening, talk about low glycemic dinner options, how work and home stress can impact high blood sugars, and ideas for lowering blood glucose, such as going for a walk."
    #         else:
    #             notes += f"Note: Give general advice on checking basal and insulin sensitivity."
    # else:
    #     notes += f"Steve doesn't have any time periods where he is running high. Well done! This is quite an accomplishment!"
    return notes


if __name__ == "__main__":
    from bgpodcast.data_ingestion.nightscout import read_entries_file
    en = read_entries_file("/home/ssuppe/studioprojects/goodnumbers/data/5Dec/entries.json")
    tr = read_treatments_file("/home/ssuppe/studioprojects/goodnumbers/data/5Dec/treatments.json")
    results = high_period_report(en, tr)

    from pprint import pprint
    pprint(results)