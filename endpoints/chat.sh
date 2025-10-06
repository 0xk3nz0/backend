#!/bin/bash

# Configuration
SERVER_URL="${SERVER_URL:-http://localhost:3000}"
WS_URL="${WS_URL:-ws://localhost:3000}"
TEST_USER_EMAIL="${TEST_USER_EMAIL:-test@example.com}"
TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-testpassword}"
AUTH_ENDPOINT="${SERVER_URL}/api/auth/login"
OUTPUT_FILE="test_output.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to log messages
log() {
  echo -e "$1" | tee -a "$OUTPUT_FILE"
}

# Function to check if a command exists
check_command() {
  if ! command -v "$1" &> /dev/null; then
    log "${RED}Error: $1 is required but not installed.${NC}"
    exit 1
  fi
}

# Check dependencies
check_command curl
check_command wscat
check_command jq

# Initialize output file
> "$OUTPUT_FILE"
log "Starting chat server tests at $(date)"

# Test 1: Authenticate and get JWT token
log "Test 1: Authenticating user..."
AUTH_RESPONSE=$(curl -s -X POST "$AUTH_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}")

TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token')
USER_ID=$(echo "$AUTH_RESPONSE" | jq -r '.user.id')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  log "${RED}Test 1 FAILED: Could not authenticate user${NC}"
  exit 1
else
  log "${GREEN}Test 1 PASSED: Obtained JWT token${NC}"
fi

# Test 2: Create a room via HTTP
log "Test 2: Creating a room..."
CREATE_ROOM_RESPONSE=$(curl -s -X POST "${SERVER_URL}/api/rooms" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Test Room\",\"type\":\"GROUP\",\"userId\":\"$USER_ID\"}")

ROOM_ID=$(echo "$CREATE_ROOM_RESPONSE" | jq -r '.room.id')

if [ -z "$ROOM_ID" ] || [ "$ROOM_ID" == "null" ]; then
  log "${RED}Test 2 FAILED: Could not create room${NC}"
  exit 1
else
  log "${GREEN}Test 2 PASSED: Room created with ID $ROOM_ID${NC}"
fi

# Test 3: Connect to WebSocket and join room
log "Test 3: Connecting to WebSocket and joining room..."
WS_MESSAGE="{\"type\":\"join_room\",\"payload\":{\"roomId\":\"$ROOM_ID\",\"userId\":\"$USER_ID\"}}"
WS_RESPONSE=$(echo "$WS_MESSAGE" | wscat -c "$WS_URL" -H "Authorization: Bearer $TOKEN" -n 2>&1 | tee -a "$OUTPUT_FILE")

if echo "$WS_RESPONSE" | grep -q '"type":"joined"'; then
  log "${GREEN}Test 3 PASSED: Successfully joined room $ROOM_ID${NC}"
else
  log "${RED}Test 3 FAILED: Could not join room${NC}"
  exit 1
fi

# Test 4: Send a message via WebSocket
log "Test 4: Sending a message..."
WS_MESSAGE="{\"type\":\"send_message\",\"payload\":{\"roomId\":\"$ROOM_ID\",\"senderId\":\"$USER_ID\",\"text\":\"Hello, Test Room!\"}}"
WS_RESPONSE=$(echo "$WS_MESSAGE" | wscat -c "$WS_URL" -H "Authorization: Bearer $TOKEN" -n 2>&1 | tee -a "$OUTPUT_FILE")

if echo "$WS_RESPONSE" | grep -q '"type":"message"'; then
  log "${GREEN}Test 4 PASSED: Message sent successfully${NC}"
else
  log "${RED}Test 4 FAILED: Could not send message${NC}"
  exit 1
fi

# Test 5: Get messages via HTTP
log "Test 5: Fetching messages..."
GET_MESSAGES_RESPONSE=$(curl -s -X GET "${SERVER_URL}/api/messages?roomId=$ROOM_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN")

if echo "$GET_MESSAGES_RESPONSE" | grep -q "Hello, Test Room!"; then
  log "${GREEN}Test 5 PASSED: Messages fetched successfully${NC}"
else
  log "${RED}Test 5 FAILED: Could not fetch messages${NC}"
  exit 1
fi

# Test 6: Test rate limiting (send multiple messages quickly)
log "Test 6: Testing rate limiting..."
for i in {1..15}; do
  WS_MESSAGE="{\"type\":\"send_message\",\"payload\":{\"roomId\":\"$ROOM_ID\",\"senderId\":\"$USER_ID\",\"text\":\"Rate limit test $i\"}}"
  WS_RESPONSE=$(echo "$WS_MESSAGE" | wscat -c "$WS_URL" -H "Authorization: Bearer $TOKEN" -n 2>&1 | tee -a "$OUTPUT_FILE")
  if echo "$WS_RESPONSE" | grep -q '"message":"Rate limit exceeded'; then
    log "${GREEN}Test 6 PASSED: Rate limiting enforced${NC}"
    break
  fi
  sleep 0.1
done

if ! echo "$WS_RESPONSE" | grep -q '"message":"Rate limit exceeded'; then
  log "${RED}Test 6 FAILED: Rate limiting not enforced${NC}"
fi

# Test 7: Delete room via WebSocket
log "Test 7: Deleting room..."
WS_MESSAGE="{\"type\":\"delete_room\",\"payload\":{\"roomId\":\"$ROOM_ID\",\"userId\":\"$USER_ID\"}}"
WS_RESPONSE=$(echo "$WS_MESSAGE" | wscat -c "$WS_URL" -H "Authorization: Bearer $TOKEN" -n 2>&1 | tee -a "$OUTPUT_FILE")

if echo "$WS_RESPONSE" | grep -q '"type":"room_deleted_success"'; then
  log "${GREEN}Test 7 PASSED: Room deleted successfully${NC}"
else
  log "${RED}Test 7 FAILED: Could not delete room${NC}"
  exit 1
fi

log "All tests completed. Output logged to $OUTPUT_FILE"