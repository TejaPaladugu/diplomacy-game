#!/bin/bash
# Double-click this file in Finder to install dependencies (first run only)
# and launch both the backend and frontend. A browser tab opens automatically
# once the frontend is ready. Close this Terminal window to stop the game.

cd "$(dirname "$0")" || exit 1

if [ ! -d node_modules ] || [ ! -d server/node_modules ] || [ ! -d client/node_modules ]; then
  echo "First run: installing dependencies, this can take a minute..."
  npm install
  npm run install:all
fi

( until curl -s -o /dev/null http://localhost:5173; do sleep 1; done; open http://localhost:5173 ) &

npm run dev
