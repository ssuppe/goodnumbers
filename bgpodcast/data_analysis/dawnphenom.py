from datetime import timedelta
import pandas as pd
import numpy as np
from scipy.stats import linregress
from scipy import integrate

def prepare_data(entries, days_to_analyze=7):
    # Convert entries to DataFrame
    df = pd.DataFrame(entries)
    
    # Convert timestamps to datetime
    df['datetime'] = pd.to_datetime(df['date'], unit='ms')
    
    # Filter to last 7 days
    latest_date = df['datetime'].max()
    start_date = latest_date - timedelta(days=days_to_analyze)
    df = df[df['datetime'] >= start_date]
    
    # Create hour of day column
    df['hour'] = df['datetime'].dt.hour + df['datetime'].dt.minute/60
    
    # Filter for 4 AM to 9 AM
    df = df[(df['hour'] >= 4) & (df['hour'] < 9)]
    
    # Sort by datetime
    df = df.sort_values('datetime')
    
    # Add date column for grouping by day
    df['date'] = df['datetime'].dt.date
    
    return df

def calculate_metrics(glucose_values, times):
    """Calculate standard clinical diabetes metrics"""
    # Time in Range calculations
    in_range = np.logical_and(glucose_values >= 70, glucose_values <= 180)
    above_range = glucose_values > 180
    below_range = glucose_values < 70
    
    tir = {
        'in_range': (np.sum(in_range) / len(glucose_values)) * 100,
        'above_range': (np.sum(above_range) / len(glucose_values)) * 100,
        'below_range': (np.sum(below_range) / len(glucose_values)) * 100
    }
    
    # Variability metrics
    cv = (np.std(glucose_values) / np.mean(glucose_values)) * 100  # Coefficient of Variation
    
    # Calculate AUC using trapezoidal rule
    auc = integrate.trapezoid(glucose_values, times)
    
    return {
        'tir': tir,
        'cv': cv,
        'auc': auc,
        'mean': np.mean(glucose_values),
        'std': np.std(glucose_values),
        'min': np.min(glucose_values),
        'max': np.max(glucose_values)
    }

def analyze_individual_days(df):
    """Analyze dawn phenomenon for each individual day with enhanced metrics"""
    daily_stats = []
    
    for date, day_data in df.groupby('date'):
        if len(day_data) < 2:  # Skip days with insufficient data
            continue
            
        # Basic metrics
        start_glucose = day_data.iloc[0]['sgv']
        peak_glucose = day_data['sgv'].max()
        total_rise = peak_glucose - start_glucose
        
        # Calculate rate of change using linear regression
        x = (day_data['datetime'] - day_data['datetime'].min()).dt.total_seconds() / 3600
        y = day_data['sgv']
        slope, _, r_value, _, _ = linregress(x, y)
        
        # Calculate clinical metrics
        clinical_metrics = calculate_metrics(
            day_data['sgv'].values,
            x.values
        )
        
        # Calculate first hour rate of change (4AM-5AM)
        first_hour = day_data[day_data['hour'] < 5]
        if len(first_hour) >= 2:
            first_hour_slope, _, _, _, _ = linregress(
                (first_hour['datetime'] - first_hour['datetime'].min()).dt.total_seconds() / 3600,
                first_hour['sgv']
            )
        else:
            first_hour_slope = None
        
        daily_stats.append({
            'date': date,
            'start_glucose': start_glucose,
            'peak_glucose': peak_glucose,
            'total_rise': total_rise,
            'rate_of_change': slope,
            'first_hour_rate': first_hour_slope,
            'r_squared': r_value**2,
            'time_in_range': clinical_metrics['tir']['in_range'],
            'time_above_range': clinical_metrics['tir']['above_range'],
            'time_below_range': clinical_metrics['tir']['below_range'],
            'cv': clinical_metrics['cv'],
            'auc': clinical_metrics['auc'],
            'mean_glucose': clinical_metrics['mean'],
            'std_glucose': clinical_metrics['std']
        })
    
    return pd.DataFrame(daily_stats)

def assess_dawn_phenomenon(daily_stats, composite_stats):
    """Enhanced assessment of dawn phenomenon presence and severity"""
    # Clinical thresholds based on research
    SIGNIFICANT_RISE = 20  # mg/dL
    SIGNIFICANT_RATE = 10  # mg/dL per hour
    HIGH_CV_THRESHOLD = 36  # % - Standard clinical threshold
    
    # Analyze composite pattern
    composite_has_dawn = (composite_stats['total_rise'] >= SIGNIFICANT_RISE and 
                         composite_stats['rate_of_change'] >= SIGNIFICANT_RATE)
    
    # Analyze individual days
    days_with_dawn = daily_stats[
        (daily_stats['total_rise'] >= SIGNIFICANT_RISE) & 
        (daily_stats['rate_of_change'] >= SIGNIFICANT_RATE)
    ]
    
    percent_days_with_dawn = len(days_with_dawn) / len(daily_stats) * 100
    
    # Calculate mean metrics across days
    mean_metrics = {
        'mean_cv': daily_stats['cv'].mean(),
        'mean_time_in_range': daily_stats['time_in_range'].mean(),
        'mean_auc': daily_stats['auc'].mean(),
        'mean_first_hour_rate': daily_stats['first_hour_rate'].mean()
    }
    
    severity_assessment = {
        'is_severe': (composite_stats['total_rise'] >= 40 or  # Significant rise
                     mean_metrics['mean_cv'] > HIGH_CV_THRESHOLD or  # High variability
                     mean_metrics['mean_time_in_range'] < 70),  # Poor TIR
        'variability_concern': mean_metrics['mean_cv'] > HIGH_CV_THRESHOLD,
        'tir_concern': mean_metrics['mean_time_in_range'] < 70
    }
    
    return {
        'composite_has_dawn': composite_has_dawn,
        'percent_days_with_dawn': percent_days_with_dawn,
        'average_rise': daily_stats['total_rise'].mean(),
        'average_rate': daily_stats['rate_of_change'].mean(),
        'consistency': percent_days_with_dawn >= 70,
        'mean_metrics': mean_metrics,
        'severity': severity_assessment
    }

def generate_clinical_report(assessment, daily_stats):
    """Generate a clinically relevant summary report"""
    report = {
        'summary': {
            'dawn_phenomenon_present': assessment['composite_has_dawn'],
            'consistency': assessment['consistency'],
            'severity': assessment['severity']['is_severe']
        },
        'metrics': {
            'average_morning_glucose': daily_stats['mean_glucose'].mean(),
            'average_cv': daily_stats['cv'].mean(),
            'average_time_in_range': daily_stats['time_in_range'].mean(),
            'average_total_rise': assessment['average_rise'],
            'average_rate_of_change': assessment['average_rate']
        },
        'recommendations': []
    }
    
    # Add clinical recommendations based on metrics
    if assessment['severity']['variability_concern']:
        report['recommendations'].append(
            "High glucose variability detected. Consider basal rate adjustment."
        )
    
    if assessment['severity']['tir_concern']:
        report['recommendations'].append(
            "Time in range below target. Review overnight basal rates and consider adjustment."
        )
    
    if assessment['mean_metrics']['mean_first_hour_rate'] > 15:
        report['recommendations'].append(
            "Significant early morning rise detected. Consider adjusting basal rates between 3-4 AM."
        )
    
    return report

# Update main function to include new analyses
def main(entries):
    df = prepare_data(entries)
    daily_stats = analyze_individual_days(df)
    composite_df, composite_stats = analyze_composite_day(df)
    assessment = assess_dawn_phenomenon(daily_stats, composite_stats)
    clinical_report = generate_clinical_report(assessment, daily_stats)

    return {
        'daily_stats': daily_stats.to_dict('records'),
        'composite_stats': composite_stats,
        'assessment': assessment,
        'clinical_report': clinical_report,
    }