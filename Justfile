# Justfile for Good Numbers project
# Run commands with: just <command>

# Project variables
# backend-dir := "goodnumbers-be"  # Commented out as no longer used
frontend-dir := "goodnumbers"
gcp-region := "us-east1"
gcp-project := "gemini-437920"
env-dir := "/home/ssuppe/vscode/envs"

set dotenv-load := false

# List all available commands
default:
    @just --list

# Deploy backend with environment variables - COMMENTED OUT (no longer needed)
# deploy-backend env:
#     #!/usr/bin/env bash
#     # First, verify environment file exists
#     if [ ! -f "{{env-dir}}/env.{{env}}.backend" ]; then
#         echo "Error: Environment file {{env-dir}}/env.{{env}}.backend not found"
#         exit 1
#     fi
#
#     echo "Deploying backend with {{env}}.backend environment..."
#
#     # Load environment variables - do not use as this is a YAML file
#     # for Google Cloud
#     # set -a
#     # source {{env-dir}}/env.{{env}}.backend
#     # set +a
#
#     # Deploy to Cloud Functions
#     cd {{backend-dir}}/src/api && \
#     gcloud functions deploy goodnumbers-api \
#         --gen2 \
#         --runtime=python312 \
#         --region={{gcp-region}} \
#         --source=. \
#         --entry-point=handler \
#         --trigger-http \
#         --allow-unauthenticated \
#         --env-vars-file={{env-dir}}/env.{{env}}.backend \
#         --memory=512M \
#         --service-account=google-text-to-speech-api@gemini-437920.iam.gserviceaccount.com \
#         --timeout=300

# Quick development deploy (shorthand)
# dev:
#     just deploy-backend development

# Quick production deploy (shorthand)
# prod:
#     just deploy-backend production

# Show current GCP configuration
show-gcp-config:
    gcloud config list

# Clean Python cache files - COMMENTED OUT (no longer needed)
# clean-backend:
#     find {{backend-dir}} -type d -name "__pycache__" -exec rm -r {} +
#     find {{backend-dir}} -type f -name "*.pyc" -delete

# Show environment variables (safely - hiding secrets)
show-env env:
    #!/usr/bin/env bash
    if [ ! -f "{{env-dir}}/env.{{env}}" ]; then
        echo "Error: Environment file {{env-dir}}/env.{{env}} not found"
        exit 1
    fi

    echo "Environment variables for {{env}}:"
    # Show variables but hide values
    grep -v '^#' {{env-dir}}/env.{{env}} | cut -d '=' -f1


#############################################
# Vercel

# Add this helper recipe to verify Vercel setup
_verify-vercel:
    #!/usr/bin/env bash
    if [ -z "$VERCEL_TOKEN" ]; then
        echo "Error: VERCEL_TOKEN is not set"
        echo "Please create a token at https://vercel.com/account/tokens"
        echo "Then add it to your environment: export VERCEL_TOKEN='your-token'"
        exit 1
    fi

    # Verify token works by checking authentication
    if ! vercel whoami --token=$VERCEL_TOKEN > /dev/null 2>&1; then
        echo "Error: Invalid VERCEL_TOKEN"
        echo "Please check your token at https://vercel.com/account/tokens"
        exit 1
    fi

# Read .env file and push all variables to Vercel production environment
push-env filename env:
    #!/usr/bin/env bash
    #set -euo pipefail

    cd {{frontend-dir}}

    while IFS='=' read -r key value || [ -n "$key" ]; do
        # Skip empty lines and comments
        [[ -z "$key" || "$key" == \#* ]] && continue

        # Trim whitespace from key and value
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)

        # Remove any surrounding quotes from the value
        value=$(echo "$value" | sed -e 's/^["\x27]//' -e 's/["\x27]$//')

        echo "Adding $key to Vercel..."
        echo "$value" | vercel env add "$key" {{env}} --token=$VERCEL_TOKEN
    done < {{filename}}

    echo "✅ Environment variables have been pushed to Vercel {{env}}"

deploy-frontend env:
    #!/usr/bin/env bash
    # First run verification
    set -euo pipefail # -e means exit on any error, -u means error on undefined variables
    just _verify-vercel

    # Verify environment file exists
    if [ ! -f "{{env-dir}}/env.{{env}}.frontend" ]; then
        echo "Error: Environment file {{env-dir}}/env.{{env}}.frontend not found"
        exit 1
    fi

    echo "Deploying frontend with {{env}}.frontend environment..."

    # Load environment variables into current shell
    set -a
    source "{{env-dir}}/env.{{env}}.frontend"
    set +a

    #just push-env {{env-dir}}/env.{{env}}.frontend {{env}}

    cd {{frontend-dir}} && \
    # Create .env file in frontend directory from our env file
    # cp "{{env-dir}}/env.{{env}}.frontend" .env.production && \
    #vercel env push .env.production production --yes --token=$VERCEL_TOKEN && \
    #vercel pull --yes --environment=production --token=$VERCEL_TOKEN && \
    vercel build --prod --token=$VERCEL_TOKEN && \
    vercel deploy --prod --token=$VERCEL_TOKEN

    # Clean up
    #rm -f .env.production

# Add a command to test Vercel configuration
check-vercel:
    #!/usr/bin/env bash
    echo "Checking Vercel configuration..."
    just _verify-vercel
    echo "Vercel configuration is valid ✅"