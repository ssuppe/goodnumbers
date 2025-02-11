import json
import datetime
import random
import math
import sys


# New parameters
def generate_cgm_data(days=7, target_avg_sgv=80, variation=15, smoothing_factor=0.5, meal_rise=30, meal_times=[8, 12, 18]):
    data = []
    current_time = datetime.datetime.now().timestamp() * 1000  # milliseconds
    five_minutes = 5 * 60 * 1000  # milliseconds
    sgv = target_avg_sgv  # Initialize near the target average
    total_sgv = 0

    for i in range(days * 24 * 60 // 5):
        current_datetime = datetime.datetime.fromtimestamp(current_time / 1000)
        current_hour = current_datetime.hour

        # Sinusoidal variation around target average
        sgv_change = variation * \
            math.sin(i / 50) + (random.random() - 0.5) * variation / 2

        # Mealtime spikes
        meal_effect = 0
        for meal_time in meal_times:
            if abs(current_hour - meal_time) <= 1:  # Within 1 hour of mealtime
                meal_effect = meal_rise * \
                    (1 - abs(current_hour - meal_time))  # Linear rise and fall

        # Smoothing: Exponentially weighted moving average
        sgv = int(smoothing_factor * sgv + (1 - smoothing_factor) *
                  # Include meal_effect
                  (target_avg_sgv + sgv_change + meal_effect))
        sgv = max(20, min(180, sgv))  # Keep within realistic bounds

        entry = {
            # Replace with actual ID generation if needed
            "_id": "generated_id_" + str(i),
            "app": "AAPS",
            "date": int(current_time),
            "device": "AAPS-DexcomG6",
            "direction": "Flat",  # You might want to update this based on sgv_change
            "isReadOnly": False,
            "isValid": True,
            "sgv": sgv,
            "type": "sgv",
            "unfiltered": 0,
            "units": "mg/dl",
            "utcOffset": -480,
            # Formatted datetime
            "created_at": datetime.datetime.fromtimestamp(current_time/1000).isoformat() + 'Z',
            # Replace if needed
            "identifier": "generated_identifier_" + str(i),
            "srvModified": int(current_time),
            "srvCreated": int(current_time),
            "subject": "androidaps-pixel8"
        }

        data.append(entry)
        total_sgv += sgv  # Accumulate for average calculation
        current_time += five_minutes

    # Calculate actual average
    actual_average = total_sgv / len(data) if data else 0

    # Adjust to match target average more closely (optional, but improves accuracy)
    adjustment = target_avg_sgv - actual_average
    for entry in data:
        # print(entry)
        entry["sgv"] = max(20, min(180, int(entry["sgv"] + adjustment)))

    return data


# Example usage, target 60 mg/dl

cgm_data = generate_cgm_data(target_avg_sgv=int(sys.argv[1]))
print(json.dumps(cgm_data, indent=2))