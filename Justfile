# Justfile for Good Numbers project
# Run commands with: just <command>

# Project variables
backend-dir := "goodnumbers-be"
frontend-dir := "goodnumbers"
gcp-region := "us-east1"
gcp-project := "gemini-437920"
env-dir := "/home/ssuppe/studioprojects/envs"

set dotenv-load := false

# List all available commands
default:
    @just --list

# Deploy backend with environment variables
deploy-backend env:
    #!/usr/bin/env bash
    # First, verify environment file exists
    if [ ! -f "{{env-dir}}/env.{{env}}.backend" ]; then
        echo "Error: Environment file {{env-dir}}/env.{{env}}.backend not found"
        exit 1
    fi
    
    echo "Deploying backend with {{env}}.backend environment..."
    
    # Load environment variables
    # set -a
    # source {{env-dir}}/env.{{env}}.backend
    # set +a
    
    # Deploy to Cloud Functions
    cd {{backend-dir}}/src/api && \
    gcloud functions deploy goodnumbers-api \
        --gen2 \
        --runtime=python312 \
        --region={{gcp-region}} \
        --source=. \
        --entry-point=handler \
        --trigger-http \
        --allow-unauthenticated \
        --env-vars-file={{env-dir}}/env.{{env}}.backend

# Quick development deploy (shorthand)
# dev:
#     just deploy-backend development

# Quick production deploy (shorthand)
prod:
    just deploy-backend production

# Show current GCP configuration
show-gcp-config:
    gcloud config list

# Clean Python cache files
clean-backend:
    find {{backend-dir}} -type d -name "__pycache__" -exec rm -r {} +
    find {{backend-dir}} -type f -name "*.pyc" -delete

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