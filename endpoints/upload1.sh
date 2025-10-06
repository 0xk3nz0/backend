#!/bin/bash

if [ $# -ne 1 ]; then
     echo -e "  -> Please provide the access token!"
     exit 13
fi

curl -sF "file=@/home/kali/Downloads/Shuhei_Hisagi.jpeg" \
     -F "description=My Image" \
     -H "Cookie: access_token=$1" \
     http://localhost:3000/v1/user/avatar | jq
