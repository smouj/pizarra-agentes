#!/bin/bash

# OpenClaw MGS Codec Dashboard - Start Script

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║   🦞 OpenClaw MGS Codec Dashboard                    ║
║   FREQUENCY 187.89 MHz - CODEC INITIALIZING          ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if configuration exists
if [ ! -f "backend/.env" ] || [ ! -f "frontend/.env" ]; then
    echo -e "${YELLOW}⚠  Configuration not found. Running setup wizard...${NC}"
    python3 scripts/setup_wizard.py
    echo ""
fi

# Start MongoDB if not running
if ! pgrep -x "mongod" > /dev/null; then
    echo -e "${CYAN}Starting MongoDB...${NC}"
    if command -v systemctl &> /dev/null; then
        sudo systemctl start mongod 2>/dev/null || true
    elif command -v service &> /dev/null; then
        sudo service mongod start 2>/dev/null || true
    fi
    sleep 2
fi

# Check if MongoDB is running
if pgrep -x "mongod" > /dev/null; then
    echo -e "${GREEN}✓${NC} MongoDB is running"
else
    echo -e "${YELLOW}⚠  MongoDB is not running. Please start it manually.${NC}"
fi

# Start Backend
echo -e "${CYAN}Starting Backend (Port 8001)...${NC}"
cd "$PROJECT_DIR/backend"

# Activate venv if exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Kill existing backend process
pkill -f "uvicorn.*server:app" 2>/dev/null || true

# Start backend in background
nohup python3 server.py > ../logs/backend.log 2>&1 &
BACKEND_PID=$!

echo -e "${GREEN}✓${NC} Backend started (PID: $BACKEND_PID)"

# Start Frontend
echo -e "${CYAN}Starting Frontend (Port 3000)...${NC}"
cd "$PROJECT_DIR/frontend"

# Kill existing frontend process
pkill -f "react-scripts start" 2>/dev/null || true

# Start frontend in background
nohup npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!

echo -e "${GREEN}✓${NC} Frontend started (PID: $FRONTEND_PID)"

# Wait for services to start
echo ""
echo -e "${CYAN}Waiting for services to initialize...${NC}"
sleep 5

# Check if services are running
echo ""
if curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend is responding at http://localhost:8001"
else
    echo -e "${YELLOW}⚠${NC}  Backend may still be starting..."
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Services Started!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}🌐 Dashboard:${NC}  http://localhost:3000"
echo -e "${CYAN}🔧 Backend API:${NC} http://localhost:8001"
echo -e "${CYAN}📊 Health:${NC}     http://localhost:8001/api/health"
echo ""
echo -e "${CYAN}📋 Useful Commands:${NC}"
echo -e "   ${GREEN}./stop.sh${NC}   - Stop all services"
echo -e "   ${GREEN}./logs.sh${NC}   - View logs"
echo ""
echo -e "${GREEN}FREQUENCY 187.89 MHz - CODEC ACTIVE${NC} 🦞"
echo ""
