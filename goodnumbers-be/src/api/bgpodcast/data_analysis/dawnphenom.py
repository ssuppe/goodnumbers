import pandas as pd
import numpy as np
from scipy.stats import linregress
from scipy import integrate
from bgpodcast.data_analysis.dfutils import prepare_data

# Clinical thresholds based on research
SIGNIFICANT_RISE = 20  # mg/dL
SIGNIFICANT_RATE = 10  # mg/dL per hour
HIGH_CV_THRESHOLD = 36  # % - Standard clinical threshold


def _calculate_metrics(glucose_values, times):
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
    cv = (np.std(glucose_values) / np.mean(glucose_values)) * \
        100  # Coefficient of Variation

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


def _analyze_individual_days(df):
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
        x = (day_data['datetime'] - day_data['datetime'].min()
             ).dt.total_seconds() / 3600
        y = day_data['sgv']
        slope, _, r_value, _, _ = linregress(x, y)

        # Calculate clinical metrics
        clinical_metrics = _calculate_metrics(
            day_data['sgv'].values,
            x.values
        )

        # Calculate first hour rate of change (4AM-5AM)
        first_hour = day_data[day_data['hour'] < 5]
        if len(first_hour) >= 2:
            first_hour_slope, _, _, _, _ = linregress(
                (first_hour['datetime'] - first_hour['datetime'].min()
                 ).dt.total_seconds() / 3600,
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


def _analyze_composite_day(df):
    """Create and analyze composite day pattern"""
    # Group by hour and calculate mean glucose
    composite = df.groupby('hour')['sgv'].agg(['mean', 'std']).reset_index()

    # Calculate key metrics for composite day
    start_glucose = composite.iloc[0]['mean']
    peak_glucose = composite['mean'].max()
    total_rise = peak_glucose - start_glucose

    # Calculate rate of change using linear regression
    slope, _, r_value, _, _ = linregress(composite['hour'], composite['mean'])

    composite_stats = {
        'start_glucose': start_glucose,
        'peak_glucose': peak_glucose,
        'total_rise': total_rise,
        'rate_of_change': slope,
        'r_squared': r_value**2
    }

    return composite, composite_stats


def _assess_dawn_phenomenon(daily_stats, composite_stats):
    """Enhanced assessment of dawn phenomenon presence and severity"""

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
                      # High variability
                      mean_metrics['mean_cv'] > HIGH_CV_THRESHOLD or
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


def _generate_clinical_report(assessment, daily_stats):
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
        'recommendations': ""
    }

    recommendations = ""
    # Add plain language report on dawn phenomenom
    if assessment['composite_has_dawn']:

        recommendations += """  * When looking at the composite past week, we do see patterns of dawn phenomenon. Dawn phenomenon is when your blood sugar rises more than it should
               in the early hours of the morning, typically between 4 and 9am.
               This is often due to a change in hormones as you start to wake up
               - hormones like cortisol and growth hormone. These signal to the
               liver to produce more glucose to provide energy to your body.
               This is natural and part of waking up, but for diabetics, often
               means they need to provide a higher basal rate to compensate.\n"""

        if assessment["severity"]["is_severe"]:
            recommendations += \
                f"""  * We are seeing quite a severe rise in blood
                sugars during this time - raising more than {SIGNIFICANT_RISE:d} mg/dl
                at more than {SIGNIFICANT_RATE:d} mg/dl per hour.\n"""

            recommendations += \
                f"""  * A deeper look:
                            * Average dawn glucose at this time is
                                {report['metrics']['average_morning_glucose']:d}.
                                {assessment["percent_days_with_dawn"]:d%} days showed dawn phenomena.\n
                            * Average dawn coefficient of variation
                            {report['metrics']['average_cv']:d%}. The widely
                            accepted goal for type 1 diabetics is to be below 36%.\n"""

            if assessment['severity']['variability_concern']:
                recommendations += "High glucose variability detected. Consider basal rate adjustment.\n"

    else:
        recommendations += """  * No dawn phenomenon detected between the hours of 4am and 9am.\n"""

    recommendations += "## General morning statistics\n"
    recommendations += \
        f"""  * Time in range in the morning is {report['metrics']['average_time_in_range']:.2f}%.
            Your sleep time is when you should be aiming to get the highest time in range, since you
            are not moving, not worrying about food, exercise or stress. Aim to be as close to 100%
              possible.\n"""

    # print(f"report[metrics][average_time_in_range]: {
    #   report['metrics']['average_time_in_range']}")
    if report["metrics"]["average_time_in_range"] < 80:
        recommendations += """  * Your average time in range is less than 80%
            this week, so you could definitely improve.\n"""
    elif report["metrics"]["average_time_in_range"] > 90:
        recommendations += """  * Your average time in range is greater than 90% this week, this is
            very good!\n"""
    else:
        recommendations += """  * Your average time in range was between 80% and 90% this week, which is good,
                                          but there is always room for improvement!\n"""

    #     if assessment['mean_metrics']['mean_first_hour_rate'] > 15:
    #         recommendations += """* Significant early morning rise detected. Consider adjusting
    #         basal rates between 3-4 AM.\n"""

    #         recommendations += """* As always, remember when making basal adjustments, your insulin takes time to reach its full strength and
    #                 impact on your blood glucose. For fast-acting insulins like Humalog, Novalog and Novarapid, full strength takes 1.5
    #                 to 2 hours. This means you need to adjust your basal about that much time before you are seeing the effect. So, for example,
    #                 if you are seeing a high rise between 3-4am, you likely need to change your basal arate around 1 or 2am. Other insulines, like Lyumjev,
    #                 work much more quickly, and will have different calculations. Make sure to educate yourself on how your
    #                 insulin works, and be sure to talk to your healthcare professional before making any changes.\n"""
    # else:
    #     recommendations += """* There is no sign of dawn phenomenon, which means your blood
    #                     sugar levels are staying within range and not rising before you wake up"""
    #     recommendations += """* This is great! Let's look a bit deeper to see how you're
    #                     doing and see if there is any more room for improvement\n"""

    #     recommendations += f"""A deeper look:
    #                 * Average morning glucose at this time is {report['metrics']['average_morning_glucose']:d}.
    #                 {assessment["percent_days_with_dawn"]:d%} days showed dawn phenomena.
    #                 * Average coefficient of variation {report['metrics']['average_cv']:d%}. The widely accepted goal for type 1 diabetics
    #                 is to be below 36%."""

    # if assessment['severity']['variability_concern']:
    #     recommendations += "High glucose variability detected. Consider basal rate adjustment."

    # recommendations += f"""* Time in range in the morning is {report['metrics']['average_time_in_range']:d%}. Your sleep time is when you should
    #                                     be aim to get the highest time in range, since you are not moving, not worrying about food, exercise or stress. Aim to be
    #                                     as close to 100% as possible."""

    # if report["metrics"]["average_time_in_range"] < .80:
    #     recommendations += """Your average dawn time in range is less than 80% this week, so you could
    #       improve."""
    # elif report["metrics"]["average_time_in_range"] > .90:
    #     recommendations +=  """Your average dawn time in range is greater than 90% this week, this is very good!""", recommendations)
    # else:
    #     recommendations += """Your average dawn time in range was between 80% and 90% this week, which is good,
    #                                       but there is always room for improvement!"""

    # if assessment['mean_metrics']['mean_first_hour_rate'] > 15:
    #                     recommendations = add_comment(
    #                 "Significant early morning rise detected. Consider adjusting basal rates between 3-4 AM.", recommendations)

    #                     recommendations = add_comment("""As always, remember when making basal adjustments, your insulin takes time to reach its full strength and
    #                         impact on your blood glucose. For fast-acting insulins like Humalog, Novalog and Novarapid, full strength takes 1.5
    #                         to 2 hours. This means you need to adjust your basal about that much time before you are seeing the effect. So, for example,
    #                         if you are seeing a high rise between 3-4am, you likely need to change your basal arate around 1 or 2am. Other insulines, like Lyumjev,
    #                         work much more quickly, and will have different calculations. Make sure to educate yourself on how your
    #                         insulin works, and be sure to talk to your healthcare professional before making any changes.""", recommendations)

    report["recommendations"] = recommendations
    return report


def get_clinical_report(entries) -> dict:
    df = prepare_data(entries)

    # Filter to just the dawn hours
    df = df[(df.hour >= 4) & (df.hour < 9)]

    daily_stats = _analyze_individual_days(df)
    composite_df, composite_stats = _analyze_composite_day(df)
    assessment = _assess_dawn_phenomenon(daily_stats, composite_stats)
    clinical_report = _generate_clinical_report(assessment, daily_stats)

    return {
        'daily_stats': daily_stats.to_dict('records'),
        'composite_stats': composite_stats,
        'assessment': assessment,
        'clinical_report': clinical_report,
    }


if __name__ == "__main__":
    from bgpodcast.data_ingestion.nightscout import read_entries_file
    en = read_entries_file(
        "/home/ssuppe/studioprojects/goodnumbers/data/5Dec/entries.json")
    results = get_clinical_report(en)

    from pprint import pprint
    pprint(results)
