#!/bin/sh
set -e

GRAPHDB_URL="${GRAPHDB_URL:-http://graphdb:7200}"
REPO="${GRAPHDB_REPO:-EntEdit}"
DATA_DIR="/import-data"
CONFIG_FILE="/repo-config.ttl"
SPARQL_DIR="/sparql-updates"
FORCE_REINIT="${FORCE_REINIT:-0}"

INIT_MARKER_GRAPH="urn:entedit:init-marker"
INIT_MARKER_PRED="http://entedit.org/ns#initializedAt"
INIT_MARKER_SUBJ="urn:entedit:init"

# --- Phase 0: Wait for GraphDB, then create repository if needed ---

echo "Waiting for GraphDB to be ready..."
until curl -sf "${GRAPHDB_URL}/rest/repositories" > /dev/null 2>&1; do
  sleep 2
done
echo "GraphDB is ready."

if curl -sf "${GRAPHDB_URL}/rest/repositories/${REPO}" > /dev/null 2>&1; then
  echo "Repository '${REPO}' already exists."
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

# --- Phase 1: Decide whether to run full init ---

marker_present() {
  ask_query="ASK { GRAPH <${INIT_MARKER_GRAPH}> { <${INIT_MARKER_SUBJ}> <${INIT_MARKER_PRED}> ?v } }"
  response=$(curl -s -G "${GRAPHDB_URL}/repositories/${REPO}" \
    --data-urlencode "query=${ask_query}" \
    -H "Accept: application/sparql-results+json" 2>/dev/null || true)
  echo "$response" | grep -q '"boolean"[[:space:]]*:[[:space:]]*true'
}

if [ "$FORCE_REINIT" = "1" ]; then
  echo "FORCE_REINIT=1 — forcing full re-initialization (existing data and connectors will be wiped)."
elif marker_present; then
  echo "Init marker present — repository is already initialized. Skipping init."
  echo "To force a full re-init, restart this container with FORCE_REINIT=1."
  exit 0
else
  echo "Init marker not found — running full initialization."
fi

# --- Phase 2: Clear repository contents (connectors survive and are dropped in their own .sparql files) ---

echo "Clearing repository contents (CLEAR ALL)..."
http_code=$(curl -s -o /tmp/clear.out -w "%{http_code}" \
  -X POST "${GRAPHDB_URL}/repositories/${REPO}/statements" \
  -H "Content-Type: application/sparql-update" \
  --data-binary 'CLEAR ALL')
if [ "$http_code" = "204" ]; then
  echo "Repository cleared."
else
  echo "ERROR: Failed to clear repository (HTTP $http_code)"
  cat /tmp/clear.out
  exit 1
fi

# --- Phase 3: Import RDF data files ---

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

# --- Phase 4: SPARQL UPDATE queries (Lucene connector definitions) ---
#
# Each file may contain multiple ';'-separated statements (a drop followed by
# a create). We split on lines that are exactly ';' and run each statement as
# its own request so a drop against a non-existent connector (first-ever run)
# doesn't block the subsequent create. Drop failures are logged as WARN.

if [ -d "$SPARQL_DIR" ]; then
  echo "Running SPARQL updates..."
  TMP_STMT_DIR=$(mktemp -d)
  trap 'rm -rf "$TMP_STMT_DIR"' EXIT

  find "$SPARQL_DIR" -type f -name "*.sparql" | sort | while read -r file; do
    filename=$(basename "$file")
    echo "  File: $filename"

    # Split on lines that are exactly ';' (ignoring surrounding whitespace).
    rm -f "$TMP_STMT_DIR"/part_*.sparql
    awk -v outdir="$TMP_STMT_DIR" '
      BEGIN { n = 1; out = outdir "/part_001.sparql" }
      /^[[:space:]]*;[[:space:]]*$/ {
        close(out); n++;
        out = sprintf("%s/part_%03d.sparql", outdir, n);
        next
      }
      { print > out }
    ' "$file"

    for stmt in "$TMP_STMT_DIR"/part_*.sparql; do
      [ -s "$stmt" ] || continue
      stmt_name=$(basename "$stmt")
      printf "    Executing %-20s" "$stmt_name..."
      http_code=$(curl -s -o /tmp/update.out -w "%{http_code}" \
        -X POST "${GRAPHDB_URL}/repositories/${REPO}/statements" \
        -H "Content-Type: application/sparql-update" \
        --data-binary "@${stmt}")

      if [ "$http_code" = "204" ]; then
        echo "OK"
      else
        echo "WARN (HTTP $http_code)"
      fi
    done
  done
  echo "SPARQL updates complete."
fi

# --- Phase 5: Write init marker ---

timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
marker_update="INSERT DATA { GRAPH <${INIT_MARKER_GRAPH}> { <${INIT_MARKER_SUBJ}> <${INIT_MARKER_PRED}> \"${timestamp}\" } }"

echo "Writing init marker..."
http_code=$(curl -s -o /tmp/marker.out -w "%{http_code}" \
  -X POST "${GRAPHDB_URL}/repositories/${REPO}/statements" \
  -H "Content-Type: application/sparql-update" \
  --data-binary "${marker_update}")
if [ "$http_code" = "204" ]; then
  echo "Init marker written (${timestamp})."
else
  echo "WARN: Failed to write init marker (HTTP $http_code)"
  cat /tmp/marker.out
fi

echo "Initialization complete."
