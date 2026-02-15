#!/bin/bash

# OpenClaw MGS Codec Dashboard - Logs Viewer

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS_DIR="$PROJECT_DIR/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOGS_DIR"

echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║   🦞 OpenClaw MGS Codec Dashboard - Logs             ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${CYAN}Select log to view:${NC}"
echo ""
echo "  1) Backend logs"
echo "  2) Frontend logs"
echo "  3) Both (split screen)"
echo "  4) Exit"
echo ""

read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo -e "${CYAN}Viewing Backend logs (Ctrl+C to exit)...${NC}"
        echo ""
        touch "$LOGS_DIR/backend.log"
        tail -f "$LOGS_DIR/backend.log"
        ;;
    2)
        echo -e "${CYAN}Viewing Frontend logs (Ctrl+C to exit)...${NC}"
        echo ""
        touch "$LOGS_DIR/frontend.log"
        tail -f "$LOGS_DIR/frontend.log"
        ;;
    3)
        echo -e "${CYAN}Viewing both logs (Ctrl+C to exit)...${NC}"
        echo ""
        touch "$LOGS_DIR/backend.log"
        touch "$LOGS_DIR/frontend.log"

        if command -v tmux &> /dev/null; then
            tmux new-session -d -s openclaw-logs
            tmux split-window -h
            tmux select-pane -t 0
            tmux send-keys "tail -f $LOGS_DIR/backend.log" C-m
            tmux select-pane -t 1
            tmux send-keys "tail -f $LOGS_DIR/frontend.log" C-m
            tmux attach-session -t openclaw-logs
        else
            # Fallback: just show backend
            tail -f "$LOGS_DIR/backend.log" "$LOGS_DIR/frontend.log"
        fi
        ;;
    4)
        echo -e "${GREEN}Exiting${NC}"
        exit 0
        ;;
    *)
        echo -e "${YELLOW}Invalid choice${NC}"
        exit 1
        ;;
esac
