#!/bin/bash

# Configuration
URL="http://localhost:3000/v1/user/avatar"
FILE="/home/kali/Downloads/Shuhei_Hisagi.jpeg"
CONCURRENCY=20      # Number of parallel uploads at a time
TOTAL=200           # Total uploads

# Store start time
start_total=$(date +%s%3N)

# Function to upload one file and measure time
upload() {
  local i=$1
  start=$(date +%s%3N)
  
  http_code=$(curl -s -X POST \
       -F "file=@$FILE" \
       -F "description=Test upload $i" \
       "$URL" \
       -o /dev/null \
       -w "%{http_code}")

  end=$(date +%s%3N)
  duration=$((end - start))
  echo "Upload $i finished: HTTP $http_code, Time ${duration}ms"
}

# Run uploads in batches
for ((i=1;i<=TOTAL;i++)); do
  upload $i &
  
  # Limit concurrency
  if (( i % CONCURRENCY == 0 )); then
    wait
  fi
done

# Wait for remaining uploads
wait

# Total time
end_total=$(date +%s%3N)
total_duration=$((end_total - start_total))
echo "All uploads finished! Total time: ${total_duration}ms"
