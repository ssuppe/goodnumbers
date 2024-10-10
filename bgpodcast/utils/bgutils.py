import datetime
import pandas as pd

def get_gemini_key():
    api_key = open("/Users/ssuppe/tmp/google_gemini_key.txt", "r").read().strip()
    return api_key

def create_date_from_timestamp(timestamp: int, utcoffset: int):
    """
    Takes a timestamp (in microseconds) and creates a date 
    (in whatever localtime if given the offset)
    """
    # utcoffset=0
    date = datetime.datetime.fromtimestamp(timestamp)
    # Add the specified UTC offset
    date = date + pd.Timedelta(minutes=utcoffset)
    return date

def get_number_of_days(df : pd.DataFrame, date_col : str ='date'):
    """
    Given a dataframe with a date column, and the column name, returns the
    number of unique days
    """
    return df[date_col].dt.date.unique().size

def get_months(df, date_col):
    """
    Gets a list of unique months from a DataFrame column.
    
    Args:
        df: The DataFrame containing the data.
        date_col: The name of the column containing the datetimes.
    
    Returns:
        A list of datetime objects, one for each unique month in the column.
    """

    # Extract unique months and convert to datetime objects
    unique_months = df[date_col].dt.to_period('M').unique()
    return [month.to_timestamp() for month in unique_months]

def get_weeks(df, date_col):
    """
    Gets a list of unique weeks from a DataFrame column.

    Args:
        df: The DataFrame containing the data.
        date_col: The name of the column containing the datetimes.

    Returns:
    A list of datetime objects, one for each unique week in the column.
    """

    # Extract unique weeks and convert to datetime objects
    unique_weeks = df[date_col].dt.to_period('W').unique()
    return [week for week in unique_weeks]

def get_sgv_stats(mdf : pd.DataFrame):
    print(mdf)
    monthly_mean = mdf['sgv'].mean()
    monthly_stddev = mdf['sgv'].std()
    monthly_pct_low = len(mdf[mdf.sgv < 70]) / len(mdf)
    monthly_pct_high = len(mdf[(mdf.sgv > 180)]) / len(mdf)
    monthly_tir = len(mdf[(mdf.sgv >= 70) & (mdf.sgv < 180)]) / len(mdf)
    monthly_ttir = len(mdf[(mdf.sgv >= 70) & (mdf.sgv < 140)]) / len(mdf)
    return monthly_mean, monthly_stddev, monthly_pct_low, monthly_pct_high, monthly_tir, monthly_ttir

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