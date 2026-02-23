#!/bin/sh
set -e

GRAPHDB_URL="${GRAPHDB_URL:-http://graphdb:7200}"
REPO="${GRAPHDB_REPO:-EntEdit}"
DATA_DIR="/import-data"

echo "Waiting for repository '${REPO}' to be available..."
until curl -sf "${GRAPHDB_URL}/repositories/${REPO}/size" > /dev/null 2>&1; do
  sleep 2
done
echo "Repository ready."

errors=0
imported=0

find "$DATA_DIR" -type f \( -name "*.ttl" -o -name "*.nt" -o -name "*.rdf" \) | sort | while read -r file; do
  filename=$(basename "$file")
  ext="${filename##*.}"

  case "$ext" in
    ttl) ctype="text/turtle" ;;
    nt)  ctype="application/n-triples" ;;
    rdf) ctype="application/rdf+xml" ;;
    *)   echo "  SKIP: $filename (unknown extension)"; continue ;;
  esac

  printf "  Importing %-50s" "$filename..."
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${GRAPHDB_URL}/repositories/${REPO}/statements" \
    -H "Content-Type: ${ctype}" \
    --data-binary "@${file}")

  if [ "$http_code" = "204" ]; then
    echo "OK"
  else
    echo "WARN (HTTP $http_code)"
  fi
done

echo "Import complete."
