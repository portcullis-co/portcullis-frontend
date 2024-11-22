#!/bin/sh
set -e

# Log that we're starting the entrypoint script
echo "Starting entrypoint script..."

# Create a .env file from environment variables
echo "Creating .env file..."
env | grep -E '^(NEXT_PUBLIC_|SUPABASE_|CLERK_|REPO_)' > .env

# Log the creation of .env (without showing sensitive values)
echo ".env file created"
echo "Number of environment variables captured: $(cat .env | wc -l)"

# Make sure we have a command to execute
if [ $# -eq 0 ]; then
    echo "Error: No command provided to execute"
    exit 1
fi

# Log what we're about to execute (safely)
echo "Executing command: $@"

# Execute the main container command
exec "$@"