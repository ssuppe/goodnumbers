import json
import datetime
import random
import sys


def generate_treatments_data(days=3):
    data = []
    current_time = datetime.datetime.now().timestamp() * 1000  # milliseconds
    meal_times = [8, 12, 18]  # Meal times (hours)
    last_meal_time = 0

    for day in range(days):
        for meal_time in meal_times:
            # Meal boluses (sometimes multiple within 1.5 hours)
            num_meal_boluses = random.randint(
                1, 3)  # 1 to 3 boluses per mealtime
            for _ in range(num_meal_boluses):
                bolus_time = (datetime.datetime.now() + datetime.timedelta(days=day, hours=meal_time) +
                              datetime.timedelta(minutes=random.randint(-90, 90))).timestamp() * 1000
                entry = create_treatment_entry("Meal Bolus", bolus_time, random.randint(
                    20, 50), round(random.uniform(2.5, 5), 1))
                data.append(entry)
                last_meal_time = bolus_time

            # Correction boluses (within 5 hours of last meal)
            if random.random() < 0.7:  # 70% chance of a correction bolus
                correction_time = last_meal_time + \
                    random.randint(0, 5 * 60 * 60 *
                                   1000)  # Up to 5 hours after last meal
                entry = create_treatment_entry(
                    "Correction Bolus", correction_time, None, round(random.uniform(0.5, 2), 1))
                data.append(entry)

    return data


def create_treatment_entry(event_type, date, carbs, insulin):
    return {
        # Replace with your ID generation if needed
        "_id": "generated_id_" + str(int(date)),
        "app": "AAPS",
        "date": int(date),
        "duration": 20,
        "durationInMilliseconds": 1200000,
        "eventType": event_type,
        "isReadOnly": False,
        "isValid": True,
        "reason": "Automation",
        "targetBottom": 99.00000000000003,  # You can modify this if needed
        "targetTop": 99.00000000000003,      # You can modify this if needed
        "units": "mg/dl",
        "utcOffset": -480,
        "created_at": datetime.datetime.fromtimestamp(date/1000).isoformat() + 'Z',
        # Replace if needed
        "identifier": "generated_identifier_" + str(int(date)),
        "srvModified": int(date),
        "srvCreated": int(date),
        "subject": "androidaps-pixel8",
        "carbs": carbs,
        "insulin": insulin
    }


# Generate and print the data:
treatments_data = generate_treatments_data(days=int(sys.argv[1]))
print(json.dumps(treatments_data, indent=2))
