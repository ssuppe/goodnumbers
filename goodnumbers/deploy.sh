#!/bin/bash

# Exit script on any error
set -e
# Treat unset variables as an error
set -u
# Ensure pipeline errors are caught
set -o pipefail

# === Configuration Variables (SHOULD MATCH deploy.sh DESTINATIONS) ===

# --- VM Details ---
# Attempt to get current user, fallback to 'ssuppe' if needed
VM_USER=$(whoami || echo "ssuppe")
VM_HOME="/home/${VM_USER}"
VM_APP_DIR="${VM_HOME}/app"
VM_SECRETS_DIR="${VM_HOME}/secrets"
VM_TMP_DIR="${VM_HOME}" # Directory where the tarball was copied

# --- Docker/File Details ---
TARBALL_NAME="goodnumbers.tar"         # Filename for the saved image tarball
REMOTE_SERVICE_ACCOUNT_KEY_NAME="gcp-key.json" # Name the key file has on the VM

# --- Full Paths ---
TARBALL_PATH="${VM_TMP_DIR}/${TARBALL_NAME}"
SA_KEY_PATH="${VM_SECRETS_DIR}/${REMOTE_SERVICE_ACCOUNT_KEY_NAME}"
COMPOSE_FILE_PATH="${VM_APP_DIR}/docker-compose.yml"

# === End of Configuration ===

echo "=== VM App Update Configuration ==="
echo "User:            $VM_USER"
echo "App Dir:         $VM_APP_DIR"
echo "Secrets Dir:     $VM_SECRETS_DIR"
echo "Tarball Path:    $TARBALL_PATH"
echo "SA Key Path:     $SA_KEY_PATH"
echo "Compose Path:    $COMPOSE_FILE_PATH"
echo "================================="

# --- Safety Checks ---
if [[ ! -f "$TARBALL_PATH" ]]; then
  echo "ERROR: Docker image tarball not found at: $TARBALL_PATH"
  echo "Please ensure the local deploy.sh script completed successfully."
  exit 1
fi
if [[ ! -f "$SA_KEY_PATH" ]]; then
  echo "ERROR: Service Account key file not found at: $SA_KEY_PATH"
  echo "Please ensure the local deploy.sh script completed successfully."
  exit 1
fi
if [[ ! -f "$COMPOSE_FILE_PATH" ]]; then
  echo "ERROR: docker-compose.yml not found at: $COMPOSE_FILE_PATH"
  echo "Please ensure the local deploy.sh script completed successfully."
  exit 1
fi
if ! command -v docker &> /dev/null; then
    echo "ERROR: docker command could not be found. Is Docker installed?"
    exit 1
fi
if ! command -v docker compose &> /dev/null; then
    echo "ERROR: docker compose command could not be found. Is Docker Compose installed?"
    exit 1
fi


# === Update Steps ===

echo ""
echo ">>> Step 1: Loading Docker image from tarball ($TARBALL_PATH)..."
# Navigate to tmp dir just in case docker load needs context, though usually not
cd "$VM_TMP_DIR"
docker load -i "$TARBALL_PATH"
echo "Docker image loaded successfully."

echo ""
echo ">>> Step 2: Cleaning up tarball on VM..."
rm "$TARBALL_PATH"
echo "Removed tarball: $TARBALL_PATH"

echo ""
echo ">>> Step 3: Setting permissions for Service Account key..."
chmod 600 "$SA_KEY_PATH"
echo "Permissions set to 600 for: $SA_KEY_PATH"

echo ""
echo ">>> Step 4: Navigating to application directory ($VM_APP_DIR)..."
cd "$VM_APP_DIR"
echo "Current directory: $(pwd)"

# Optional: Add checks here to verify docker-compose.yml and .env.production contents if desired

echo ""
echo ">>> Step 5: Stopping existing application containers (if any)..."
# Use '--down' which stops and removes containers, networks defined in the compose file
# This ensures a clean start. Add '|| true' to prevent exit if no containers are running.
docker compose down || true
echo "Existing containers stopped and removed."

echo ""
echo ">>> Step 6: Starting application containers..."
# '-d' runs in detached mode
docker compose up -d
echo "Application containers started."

echo ""
echo ">>> Step 7: Displaying running containers..."
docker ps

echo ""
echo "==================================="
echo ">>> VM Update Script Finished <<<"
echo "Application should now be running with the updated image."
echo "Check 'docker ps' output above and 'docker logs <container_name>' if needed."
echo "==================================="

exit 0