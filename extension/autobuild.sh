#!/bin/bash
# Dil Reaktörü - Auto Build Script

cd "$(dirname "$0")"

echo "🔄 Watching for changes..."

# Watch for changes in src directory and rebuild
chokidar "src/**/*" --command "npm run build"

echo "✅ Auto-rebuild complete"
