#!/bin/bash

# OpenClaw MGS Codec Dashboard - Stop Script

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║   🦞 OpenClaw MGS Codec Dashboard                    ║
║   FREQUENCY 187.89 MHz - CODEC SHUTTING DOWN         ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${CYAN}Stopping services...${NC}"
echo ""

# Stop Backend
echo -e "${CYAN}Stopping Backend...${NC}"
pkill -f "uvicorn.*server:app" 2>/dev/null && echo -e "${GREEN}✓${NC} Backend stopped" || echo -e "${GREEN}✓${NC} Backend was not running"

# Stop Frontend
echo -e "${CYAN}Stopping Frontend...${NC}"
pkill -f "react-scripts start" 2>/dev/null && echo -e "${GREEN}✓${NC} Frontend stopped" || echo -e "${GREEN}✓${NC} Frontend was not running"

echo ""
echo -e "${GREEN}✓ All services stopped${NC}"
echo ""
