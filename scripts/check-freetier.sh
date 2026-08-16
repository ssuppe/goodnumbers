#!/bin/bash

echo "========================================"
echo "      GCP FREE TIER STATUS REPORT       "
echo "========================================"

# 1. Check Uptime (Free tier allows 730 hours/month)
UPTIME=$(uptime -p)
echo "[COMPUTE] VM Uptime: $UPTIME"
echo "          (Limit: 1 non-preemptible e2-micro instance per month)"
echo "----------------------------------------"

# 2. Check Disk Space (Internal OS usage vs the 30GB provisioned limit)
# Grabs the stats for the root partition (/)
DISK_TOTAL=$(df -h / | awk 'NR==2 {print $2}')
DISK_USED=$(df -h / | awk 'NR==2 {print $3}')
DISK_PCT=$(df -h / | awk 'NR==2 {print $5}')

echo "[DISK]    Internal Usage: $DISK_USED / $DISK_TOTAL ($DISK_PCT used)"
echo "          (Note: GCP Free Tier limit is 30GB provisioned total)"
echo "----------------------------------------"

# 3. Check Network Egress (Monthly)
# vnstat calculates traffic for the default interface
IFACE=$(ip route get 8.8.8.8 | awk -- '{printf $5}')
EGRESS_MONTH=$(vnstat -i $IFACE -m --oneline | awk -F';' '{print $10}')

if [ -z "$EGRESS_MONTH" ]; then
    echo "[EGRESS]  Outbound Traffic: Data collecting..."
    echo "          (vnstat needs a few minutes after installation to gather data)"
else
    echo "[EGRESS]  Outbound Traffic (This Month): $EGRESS_MONTH"
    echo "          (Limit: 1 GB outbound to eligible non-China/Aus regions)"
fi
echo "========================================"
