#!/bin/bash

# Exit script on any error
set -e
# Treat unset variables as an error
set -u
# Ensure pipeline errors are caught
set -o pipefail

# === Configuration Variables (MODIFY THESE) ===

# --- VM Details ---
VM_USER="ssuppe"                 # SSH username on your Compute Engine VM
VM_IP="goodnumbers.net"        # Static IP address of your VM
VM_APP_DIR="/home/${VM_USER}/app"     # App directory on the VM
VM_SECRETS_DIR="/home/${VM_USER}/s" # Secrets directory on the VM (for the key file)
VM_TMP_DIR="/home/${VM_USER}"         # Temp directory on VM for the tarball

# --- Docker Details ---
DOCKER_IMAGE_NAME="goodnumbers:latest" # Tag for your Docker image
TARBALL_NAME="goodnumbers.tar.gz"         # Filename for the saved image tarball

# --- Local File Paths ---
# Assuming script is run from the project root where Dockerfile is located
LOCAL_PROJECT_ROOT=$(pwd) # Get current directory
LOCAL_ENV_FILE="${LOCAL_PROJECT_ROOT}/.env.production"
LOCAL_SECRETS_FILE="${LOCAL_PROJECT_ROOT}/.env.secrets"
LOCAL_COMPOSE_FILE="${LOCAL_PROJECT_ROOT}/docker-compose.yml"

# IMPORTANT: Set the correct path to your Service Account key file
LOCAL_SERVICE_ACCOUNT_KEY="../../envs/goodnumbersmain-446416-eff174c6bc72.json"

# --- Remote File Names ---
REMOTE_SERVICE_ACCOUNT_KEY_NAME="gcp-key.json" # Name you want the key file to have on the VM

# === End of Configuration ===

# --- Safety Check ---
if [[ "$VM_IP" == "YOUR_VM_STATIC_IP" ]]; then
  echo "ERROR: Please update the VM_IP variable in the script."
  exit 1
fi
if [[ ! -f "$LOCAL_SERVICE_ACCOUNT_KEY" ]]; then
  echo "ERROR: Service account key file not found at: $LOCAL_SERVICE_ACCOUNT_KEY"
  echo "Please update the LOCAL_SERVICE_ACCOUNT_KEY variable in the script."
  exit 1
fi
if [[ ! -f "$LOCAL_COMPOSE_FILE" ]]; then
  echo "ERROR: docker-compose.yml not found at: $LOCAL_COMPOSE_FILE"
  exit 1
fi
if [[ ! -f "$LOCAL_ENV_FILE" ]]; then
  echo "ERROR: .env.production not found at: $LOCAL_ENV_FILE"
  exit 1
fi

if [[ ! -f "$LOCAL_SECRETS_FILE" ]]; then
  echo "ERROR: .env.secrets not found at: $LOCAL_SECRETS_FILE"
  exit 1
fi

if [[ ! -f "${LOCAL_PROJECT_ROOT}/Dockerfile" ]]; then
  echo "ERROR: Dockerfile not found in the current directory: ${LOCAL_PROJECT_ROOT}"
  exit 1
fi

echo "=== Deployment Configuration ==="
echo "Local Project Root: $LOCAL_PROJECT_ROOT"
echo "VM User:            $VM_USER"
echo "VM IP:              $VM_IP"
echo "VM App Dir:         $VM_APP_DIR"
echo "VM Secrets Dir:     $VM_SECRETS_DIR"
echo "Docker Image:       $DOCKER_IMAGE_NAME"
echo "Compose File:       $LOCAL_COMPOSE_FILE"
echo "Env File:           $LOCAL_ENV_FILE"
echo "Env File:           $LOCAL_SECRETS_FILE"
echo "SA Key (Local):     $LOCAL_SERVICE_ACCOUNT_KEY"
echo "SA Key (Remote):    ${VM_SECRETS_DIR}/${REMOTE_SERVICE_ACCOUNT_KEY_NAME}"
echo "=============================="

# Check for -yes flag to skip confirmation
if [[ "${1-}" != "-yes" ]]; then
  read -p "Proceed with deployment? (y/N) " confirm && [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]] || exit 1
fi

# === Deployment Steps ===

echo ""
echo ">>> Step 1: Building Docker image ($DOCKER_IMAGE_NAME)..."
docker build -t "$DOCKER_IMAGE_NAME" "$LOCAL_PROJECT_ROOT"
echo "Docker image built successfully."

echo ""
echo ">>> Step 2: Saving Docker image to tarball ($TARBALL_NAME)..."
# Remove existing tarball if it exists to avoid confusion
rm -f "${LOCAL_PROJECT_ROOT}/${TARBALL_NAME}"
docker save "$DOCKER_IMAGE_NAME" | gzip > "${LOCAL_PROJECT_ROOT}/${TARBALL_NAME}" 

echo "Docker image saved successfully."

echo ""
echo ">>> Step 3: Ensuring remote directories exist on VM..."
ssh "${VM_USER}@${VM_IP}" "mkdir -p ${VM_APP_DIR} && mkdir -p ${VM_SECRETS_DIR}"
echo "Remote directories checked/created."

echo ""
echo ">>> Step 4: Transferring files to VM (${VM_USER}@${VM_IP})..."

echo "  - Transferring image tarball..."
  # scp "${LOCAL_PROJECT_ROOT}/${TARBALL_NAME}" "${VM_USER}@${VM_IP}:${VM_TMP_DIR}/"
rsync -avzhP "${LOCAL_PROJECT_ROOT}/${TARBALL_NAME}" "${VM_USER}@${VM_IP}:${VM_TMP_DIR}/"

echo "  - Transferring docker-compose.yml..."
scp "$LOCAL_COMPOSE_FILE" "${VM_USER}@${VM_IP}:${VM_APP_DIR}/"

echo "  - Transferring .env.production..."
scp "$LOCAL_ENV_FILE" "${VM_USER}@${VM_IP}:${VM_APP_DIR}/"

echo "  - Transferring .env.secrets..."
scp "$LOCAL_SECRETS_FILE" "${VM_USER}@${VM_IP}:${VM_APP_DIR}/"

echo "  - Transferring Service Account key..."
scp "$LOCAL_SERVICE_ACCOUNT_KEY" "${VM_USER}@${VM_IP}:${VM_SECRETS_DIR}/${REMOTE_SERVICE_ACCOUNT_KEY_NAME}"

echo "File transfers complete."

echo ""
echo ">>> Step 5: Cleaning up local tarball..."
rm "${LOCAL_PROJECT_ROOT}/${TARBALL_NAME}"
echo "Local tarball removed."

echo ""
echo "=================================================="
echo ">>> Deployment Script Finished <<<"
echo "Files have been transferred to the VM."
echo ""
echo ">>> Next Manual Steps on VM (${VM_USER}@${VM_IP}): <<<"
echo "  1. SSH into the VM: ssh ${VM_USER}@${VM_IP}"
echo "  2. Load the Docker image:"
echo "     cd ${VM_TMP_DIR}"
echo "     docker load -i ${TARBALL_NAME}"
echo "     rm ${TARBALL_NAME}  # Clean up tarball on VM"
echo "  3. Ensure correct permissions for the Service Account key:"
echo "     chmod 600 ${VM_SECRETS_DIR}/${REMOTE_SERVICE_ACCOUNT_KEY_NAME}"
echo "  4. Verify docker-compose.yml mounts the key correctly:"
echo "     # (Example: volumes section should have - ${VM_SECRETS_DIR}/${REMOTE_SERVICE_ACCOUNT_KEY_NAME}:/app/secrets/gcp-key.json:ro )"
echo "     nano ${VM_APP_DIR}/docker-compose.yml"
echo "  5. Verify .env.production points to the key's CONTAINER path:"
echo "     # (Example: GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/gcp-key.json )"
echo "     nano ${VM_APP_DIR}/.env.production"
echo "  6. Navigate to the app directory:"
echo "     cd ${VM_APP_DIR}"
echo "  7. Restart the application:"
echo "     docker compose down"
echo "     docker compose up -d"
echo "=================================================="

exit 0
