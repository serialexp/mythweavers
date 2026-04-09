#!/bin/sh
set -e

# Replace the backend URL in the config.js file with the environment variable
if [ -n "$BACKEND_URL" ]; then
  echo "Setting BACKEND_URL to: $BACKEND_URL"
  cat > /usr/share/nginx/html/config.js <<EOF
// Runtime configuration for the frontend
// This file is generated at container startup
window.RUNTIME_CONFIG = {
  BACKEND_URL: '${BACKEND_URL}',
  STRIPE_PUBLISHABLE_KEY: '${STRIPE_PUBLISHABLE_KEY:-}'
};
EOF
else
  echo "No BACKEND_URL set, using default config.js"
fi

# Start nginx
exec nginx -g 'daemon off;'