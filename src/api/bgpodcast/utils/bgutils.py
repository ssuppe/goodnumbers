import datetime
import pandas as pd

def add_comment(comment, note):
    note = "\n" + note + comment + "\n"
    lines = note.split('\n')
    # Remove leading spaces from each line using lstrip()
    trimmed_lines = [line.lstrip() for line in lines]

    # Join the lines back into a string
    result_string = '\n'.join(trimmed_lines)

    return result_string


def get_gemini_key():
    api_key = open("/Users/ssuppe/tmp/google_gemini_key.txt", "r", encoding="utf-8").read().strip()
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

def get_sgv_stats(df : pd.DataFrame):
    # print(mdf)
    start_date = df['date'].min()
    end_date = df['date'].max()
    mean = df['sgv'].mean()
    stddev = df['sgv'].std()
    pct_low = len(df[df.sgv < 70]) / len(df)
    pct_high = len(df[(df.sgv > 180)]) / len(df)
    tir = len(df[(df.sgv >= 70) & (df.sgv < 180)]) / len(df)
    ttir = len(df[(df.sgv >= 70) & (df.sgv < 140)]) / len(df)
    return start_date, end_date, mean, stddev, pct_low, pct_high, tir, ttir

def interpolate(prompt="", **kwargs):
    for key, value in kwargs.items():
        prompt = prompt.replace(f"{{{key}}}", value)
        
    return prompt

def write_file(to : str="./tmp", contents: str = "") -> None:
    with open(to, "w", encoding="utf-8") as f:
        f.write(contents)

def read_file(fr : str="./tmp") -> str:
    with open(fr, "r", encoding="utf-8") as f:
        return f.read()