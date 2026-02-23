#!/bin/sh
set -e

GRAPHDB_URL="${GRAPHDB_URL:-http://graphdb:7200}"
REPO="${GRAPHDB_REPO:-EntEdit}"
DATA_DIR="/import-data"
CONFIG_FILE="/repo-config.ttl"

# --- Phase 0: Wait for GraphDB, then create repository if needed ---

echo "Waiting for GraphDB to be ready..."
until curl -sf "${GRAPHDB_URL}/rest/repositories" > /dev/null 2>&1; do
  sleep 2
done
echo "GraphDB is ready."

if curl -sf "${GRAPHDB_URL}/rest/repositories/${REPO}" > /dev/null 2>&1; then
  echo "Repository '${REPO}' already exists, skipping creation."
else
  echo "Creating repository '${REPO}'..."
  http_code=$(curl -s -o /tmp/create-repo.out -w "%{http_code}" \
    -X POST "${GRAPHDB_URL}/rest/repositories" \
    -F "config=@${CONFIG_FILE};type=text/turtle")

  if [ "$http_code" = "201" ]; then
    echo "Repository created."
  else
    echo "ERROR: Failed to create repository (HTTP $http_code)"
    cat /tmp/create-repo.out
    exit 1
  fi
fi

echo "Waiting for repository '${REPO}' to be available..."
until curl -sf "${GRAPHDB_URL}/repositories/${REPO}/size" > /dev/null 2>&1; do
  sleep 2
done
echo "Repository ready."

# --- Phase 1: Import RDF data files ---

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

# --- Phase 2: SPARQL UPDATE queries (e.g. Lucene connector definitions) ---
SPARQL_DIR="/sparql-updates"

if [ -d "$SPARQL_DIR" ]; then
  echo "Running SPARQL updates..."
  find "$SPARQL_DIR" -type f -name "*.sparql" | sort | while read -r file; do
    filename=$(basename "$file")
    printf "  Executing %-50s" "$filename..."
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "${GRAPHDB_URL}/repositories/${REPO}/statements" \
      -H "Content-Type: application/sparql-update" \
      --data-binary "@${file}")

    if [ "$http_code" = "204" ]; then
      echo "OK"
    else
      echo "WARN (HTTP $http_code)"
    fi
  done
  echo "SPARQL updates complete."
fi
