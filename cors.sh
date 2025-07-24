#!/bin/bash

echo "Testing CORS headers for GraphDB..."

echo "1. Testing OPTIONS preflight request:"
curl -I -X OPTIONS 'http://localhost:7200/repositories/EntEdit' \
     -H 'Origin: http://localhost:5173' \
     -H 'Access-Control-Request-Method: POST' \
     -H 'Access-Control-Request-Headers: Content-Type, Authorization'

echo -e "\n2. Testing actual POST request:"
curl -I -X POST 'http://localhost:7200/repositories/EntEdit/statements' \
     -H 'Origin: http://localhost:5173' \
     -H 'Content-Type: application/x-www-form-urlencoded'

echo -e "\n3. Testing REST API endpoint:"
curl -I -X GET 'http://localhost:7200/rest/repositories' \
     -H 'Origin: http://localhost:5173'
