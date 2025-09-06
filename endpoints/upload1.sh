#!/bin/bash

curl -sF "file=@/home/kali/Downloads/Shuhei_Hisagi.jpeg" \
     -F "description=My Image" \
     http://localhost:3000/v1/user/avatar | jq
