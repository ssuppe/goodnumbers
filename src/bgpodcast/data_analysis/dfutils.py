from datetime import timedelta
import ruptures as rpt
import pandas as pd

def prepare_data(data, days_to_analyze=7) -> pd.DataFrame:
    df = pd.DataFrame(data)
    
    # Apply UTC offset
    df['adjusted_date'] = df.apply(lambda row: row['date'] + (row['utcOffset'] * 60 * 1000), axis=1)
    df['datetime'] = pd.to_datetime(df['adjusted_date'], unit='ms')

    # Create decimal hour (rounded to nearest quarter hour)
    df['hour'] = df['datetime'].dt.hour + (df['datetime'].dt.minute/60)
    df['hour'] = (df['hour'] * 4).round() / 4  # Round to nearest 0.25
    
    # Filter to last 7 days
    latest_date = df['datetime'].max()
    start_date = latest_date - timedelta(days=days_to_analyze)
    df = df[df['datetime'] >= start_date]
    
    # Sort and add date
    df = df.sort_values('datetime')
    df['date'] = df['datetime'].dt.date.apply(lambda x: pd.to_datetime(x))
    
    return df

def calculate_composite_day(df, value, period='30min', quantile=0.8):
    """
    For a pandas dataframe of a timeseries, turn it into a
    24-hour day, with average/quantile for each hour
    """
    tmp = df.copy()
    tmp['time'] = tmp['datetime'].dt.round(period).dt.time
    tmp = tmp.groupby(tmp['time'])[value].quantile(quantile)
    # composite = df.groupby('hour')['sgv'].agg(['mean', 'std']).reset_index()
    return pd.DataFrame(tmp)


def find_all_periods(sgvdf : pd.DataFrame):
    """
    Convert pandas dataframe into an average day, and then find the periods
    where there is a step function change from the previous period
    """
    # def calculate_composite_day(df, value, period='30min', quantile=0.8):

    avg_day = calculate_composite_day(sgvdf, "sgv")
    # display(avg_day)
    # detection of breakpoints
    algo = rpt.Dynp(model="rbf", min_size=6, jump=1).fit(avg_day)
    windows = algo.predict(n_bkps=6)
    
    # fig, axarr = rpt.display(avg_day, windows, windows)
    windows.insert(0, 0)
    # display(windows)
    window_dist = []
    for i in range(0, len(windows)-1):
        # display(avg_day.index[windows[i]].strftime("%H:%M"))        
        
        if i < len(windows) - 2:
            # display(avg_day.index[windows[i+1]].strftime("%H:%M"))
            window_dist.append([avg_day.index[windows[i]],\
                                avg_day.index[windows[i+1]],\
                                float(avg_day.iloc[windows[i]:windows[i+1]].median().values[0])])
        else:
            # display(avg_day.index[-1].strftime("%H:%M"))
            window_dist.append([avg_day.index[windows[i]],\
                        avg_day.index[-1],\
                        float(avg_day.iloc[windows[i]:windows[-1]].median().values[0])])

    window_dist = pd.DataFrame(window_dist)
    window_dist.columns = ['start_time', 'end_time', 'sgv']
    window_dist.set_index(['start_time', 'end_time'], inplace=True)
    window_dist["sgv"] = pd.to_numeric(window_dist["sgv"])   
    return window_dist

def find_high_periods(sgvdf, high_threshold=150):
    """
    Return just the step function periods of an average day that are > threshold
    """
    all_periods = find_all_periods(sgvdf)
    all_periods = all_periods[(all_periods.sgv > high_threshold)]
    return all_periods.reset_index(inplace=False)

def find_low_periods(sgvdf, low_threshold=80):
    """
    Return just the step function periods of an average day that are < threshold
    """
    all_periods = find_all_periods(sgvdf)
    all_periods = all_periods[(all_periods.sgv < low_threshold)]
    return all_periods.reset_index(inplace=False)
