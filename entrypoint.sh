#!/bin/sh

# Create a .env file from environment variables
env | grep -E '^(NEXT_PUBLIC_|SUPABASE_|CLERK_|REPO_)' > .env

# Execute the main container command
exec "$@"