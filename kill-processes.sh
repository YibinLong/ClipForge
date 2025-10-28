#!/bin/bash

################################################################################
# ClipForge - Process Cleanup Script
#
# This script safely kills any running Electron processes and webpack dev servers
# that might prevent npm start from running properly.
#
# HOW TO RUN:
#   1. Make the script executable (one time only):
#      chmod +x kill-processes.sh
#
#   2. Run the script:
#      ./kill-processes.sh
#
#   3. Then start the app:
#      npm start
#
# WHAT IT DOES:
#   - Kills all Electron processes (main app instances)
#   - Kills webpack dev server processes (port 3000 or webpack-dev-server)
#   - Kills any ClipForge-specific processes
#   - Shows which processes were killed
################################################################################

echo "🔍 Searching for ClipForge and Electron processes..."
echo ""

# Counter for killed processes
KILLED_COUNT=0

# Function to kill processes by name
kill_by_name() {
    PROCESS_NAME=$1
    PIDS=$(pgrep -f "$PROCESS_NAME" 2>/dev/null)
    
    if [ -n "$PIDS" ]; then
        echo "📍 Found $PROCESS_NAME processes: $PIDS"
        for PID in $PIDS; do
            # Get process info before killing
            PROCESS_INFO=$(ps -p $PID -o command= 2>/dev/null)
            
            # Kill the process
            kill -9 $PID 2>/dev/null
            
            if [ $? -eq 0 ]; then
                echo "   ✅ Killed PID $PID: ${PROCESS_INFO:0:80}..."
                KILLED_COUNT=$((KILLED_COUNT + 1))
            else
                echo "   ⚠️  Failed to kill PID $PID (might require sudo)"
            fi
        done
        echo ""
    fi
}

# Function to kill processes on specific ports
kill_by_port() {
    PORT=$1
    echo "🔍 Checking port $PORT..."
    
    # Find process using the port
    PID=$(lsof -ti:$PORT 2>/dev/null)
    
    if [ -n "$PID" ]; then
        PROCESS_INFO=$(ps -p $PID -o command= 2>/dev/null)
        echo "📍 Found process on port $PORT: PID $PID"
        echo "   Process: ${PROCESS_INFO:0:80}..."
        
        kill -9 $PID 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "   ✅ Killed PID $PID"
            KILLED_COUNT=$((KILLED_COUNT + 1))
        else
            echo "   ⚠️  Failed to kill PID $PID (might require sudo)"
        fi
        echo ""
    fi
}

# Kill Electron processes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Killing Electron processes..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kill_by_name "Electron"
kill_by_name "ClipForge"

# Kill webpack dev server
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Killing webpack dev server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kill_by_name "webpack"
kill_by_name "webpack-dev-server"

# Kill node processes that might be from npm start
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Killing node processes related to electron-forge..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kill_by_name "electron-forge"

# Check common webpack dev server ports
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Checking common ports..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kill_by_port 3000
kill_by_port 8080
kill_by_port 9000

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Cleanup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $KILLED_COUNT -eq 0 ]; then
    echo "✅ No processes needed to be killed. You're good to go!"
else
    echo "✅ Killed $KILLED_COUNT process(es)."
fi

echo ""
echo "You can now safely run:"
echo "  npm start"
echo ""

