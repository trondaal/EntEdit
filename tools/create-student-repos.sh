#!/usr/bin/env bash
#
# Create and initialize a set of EntEdit repositories on any GraphDB server,
# one per student group: <prefix>01, <prefix>02, ... <prefix>NN.
#
# Each repository is created from the same configuration used by the Docker
# initialization, then loaded with the vocabulary/type files and the Lucene
# full-text connector definitions.
#
#   ./tools/create-student-repos.sh -e http://localhost:7200 -p VBINF6000-H26- -n 12
#
# Run --help for all options.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENDPOINT=""
PREFIX=""
COUNT=""
START=1
WIDTH=2
ACCESS="write"
INCLUDE_TESTDATA=0
FORCE=0
DRY_RUN=0
GDB_USER="${GRAPHDB_USER:-}"
GDB_PASS="${GRAPHDB_PASSWORD:-}"

TYPES_DIR="${ROOT_DIR}/database/types"
TESTDATA_DIR="${ROOT_DIR}/database/testdata"
SPARQL_DIR="${ROOT_DIR}/database/lucene_connectors"
CONFIG_TEMPLATE="${ROOT_DIR}/docker/graphdb/repositories/EntEdit/config.ttl"

EXAMPLES_GRAPH="http://oslomet.no/abi/examples"
INIT_MARKER_GRAPH="urn:entedit:init-marker"
INIT_MARKER_PRED="http://entedit.org/ns#initializedAt"
INIT_MARKER_SUBJ="urn:entedit:init"

usage() {
  cat <<'EOF'
Usage: create-student-repos.sh -e <endpoint> -p <prefix> -n <count> [options]

Required:
  -e, --endpoint URL   GraphDB SPARQL endpoint or base URL. Both forms work:
                       http://host:7200  or  http://host:7200/repositories/EntEdit
                       (a trailing /repositories/<id> is stripped)
  -p, --prefix NAME    Repository name prefix, e.g. "VBINF6000-H26-"
  -n, --count N        Number of repositories to create

Options:
  -s, --start N        First group number (default: 1)
  -w, --width N        Zero-padding width for group numbers (default: 2 -> 01..09)
  -a, --access LEVEL   Unauthenticated ("public") access to grant on the new
                       repositories when GraphDB security is enabled:
                         write  read + write, students need no login (default)
                         read   read only
                         none   do not touch free-access settings
  -U, --user NAME      GraphDB admin user (env: GRAPHDB_USER)
  -P, --password PASS  GraphDB admin password (env: GRAPHDB_PASSWORD)
      --testdata       Also import database/testdata into the examples graph
      --force          Re-import into repositories that are already initialized
      --dry-run        Print what would happen, change nothing
  -h, --help           Show this help

Examples:
  ./tools/create-student-repos.sh -e http://localhost:7200 -p VBINF6000-H26- -n 12
  ./tools/create-student-repos.sh -e https://graphdb.example.org -p KURS- -n 25 \
      -U admin -P secret --access read
EOF
}

log()  { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    -e|--endpoint) ENDPOINT="${2:-}"; shift 2 ;;
    -p|--prefix)   PREFIX="${2:-}"; shift 2 ;;
    -n|--count)    COUNT="${2:-}"; shift 2 ;;
    -s|--start)    START="${2:-}"; shift 2 ;;
    -w|--width)    WIDTH="${2:-}"; shift 2 ;;
    -a|--access)   ACCESS="${2:-}"; shift 2 ;;
    -U|--user)     GDB_USER="${2:-}"; shift 2 ;;
    -P|--password) GDB_PASS="${2:-}"; shift 2 ;;
    --testdata)    INCLUDE_TESTDATA=1; shift ;;
    --force)       FORCE=1; shift ;;
    --dry-run)     DRY_RUN=1; shift ;;
    -h|--help)     usage; exit 0 ;;
    *)             usage >&2; die "Unknown argument: $1" ;;
  esac
done

[ -n "$ENDPOINT" ] || { usage >&2; die "Missing --endpoint"; }
[ -n "$PREFIX" ]   || { usage >&2; die "Missing --prefix"; }
[ -n "$COUNT" ]    || { usage >&2; die "Missing --count"; }

case "$COUNT" in ''|*[!0-9]*) die "--count must be a positive integer" ;; esac
case "$START" in ''|*[!0-9]*) die "--start must be a non-negative integer" ;; esac
case "$WIDTH" in ''|*[!0-9]*) die "--width must be a positive integer" ;; esac
[ "$COUNT" -ge 1 ] || die "--count must be at least 1"
[ "$WIDTH" -ge 1 ] || die "--width must be at least 1"

case "$ACCESS" in read|write|none) ;; *) die "--access must be read, write or none" ;; esac

# GraphDB repository IDs allow letters, digits, dash, underscore and dot.
case "$PREFIX" in
  *[!A-Za-z0-9._-]*) die "--prefix may only contain letters, digits, '.', '_' and '-'" ;;
esac

# Accept either the base URL or a full SPARQL endpoint URL.
BASE_URL="${ENDPOINT%/}"
BASE_URL="$(printf '%s' "$BASE_URL" | sed -E 's#/repositories(/[^/]+)?(/statements)?$##')"
BASE_URL="${BASE_URL%/}"
[ -n "$BASE_URL" ] || die "Could not derive a GraphDB base URL from --endpoint"

[ -d "$TYPES_DIR" ]      || die "Type files not found: $TYPES_DIR"
[ -d "$SPARQL_DIR" ]     || die "Connector queries not found: $SPARQL_DIR"
[ -f "$CONFIG_TEMPLATE" ] || die "Repository config template not found: $CONFIG_TEMPLATE"
if [ "$INCLUDE_TESTDATA" = 1 ] && [ ! -d "$TESTDATA_DIR" ]; then
  die "Test data not found: $TESTDATA_DIR"
fi

CURL_AUTH=()
if [ -n "$GDB_USER" ]; then
  CURL_AUTH=(-u "${GDB_USER}:${GDB_PASS}")
fi

# ${CURL_AUTH[@]+...} keeps `set -u` happy with an empty array on bash 3.2 (macOS).
api() { curl -s ${CURL_AUTH[@]+"${CURL_AUTH[@]}"} "$@"; }

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# ---------------------------------------------------------------------------
# Server checks
# ---------------------------------------------------------------------------

log "GraphDB server: ${BASE_URL}"
if ! api -f -o /dev/null "${BASE_URL}/rest/repositories"; then
  die "Cannot reach GraphDB at ${BASE_URL} (check the URL and, if security is on, --user/--password)"
fi

SECURITY_ENABLED="$(api "${BASE_URL}/rest/security" || true)"
case "$SECURITY_ENABLED" in
  *true*) SECURITY_ENABLED=1 ;;
  *)      SECURITY_ENABLED=0 ;;
esac

# ---------------------------------------------------------------------------
# Repository name list
# ---------------------------------------------------------------------------

REPOS=()
i=0
n="$START"
while [ "$i" -lt "$COUNT" ]; do
  REPOS+=("$(printf '%s%0*d' "$PREFIX" "$WIDTH" "$n")")
  i=$((i + 1))
  n=$((n + 1))
done

log "Repositories to set up (${COUNT}): ${REPOS[0]} ... ${REPOS[$((COUNT - 1))]}"
if [ "$DRY_RUN" = 1 ]; then
  for repo in "${REPOS[@]}"; do log "  $repo"; done
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

sed_escape() { printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'; }

repo_exists() {
  api -f -o /dev/null "${BASE_URL}/rest/repositories/$1"
}

create_repo() {
  local repo="$1" cfg="${TMP_DIR}/config-$1.ttl" esc code
  esc="$(sed_escape "$repo")"
  sed -E \
    -e "s/(rep:repositoryID[[:space:]]+)\"[^\"]*\"/\1\"${esc}\"/" \
    -e "s/(rdfs:label[[:space:]]+)\"[^\"]*\"/\1\"${esc}\"/" \
    "$CONFIG_TEMPLATE" > "$cfg"

  grep -q "\"${repo}\"" "$cfg" || die "Failed to template repository config for ${repo}"

  code="$(api -o "${TMP_DIR}/create.out" -w '%{http_code}' \
    -X POST "${BASE_URL}/rest/repositories" \
    -F "config=@${cfg};type=text/turtle")"
  if [ "$code" != "201" ]; then
    warn "Failed to create repository ${repo} (HTTP ${code})"
    sed -n '1,5p' "${TMP_DIR}/create.out" >&2 || true
    return 1
  fi

  local tries=0
  until api -f -o /dev/null "${BASE_URL}/repositories/${repo}/size"; do
    tries=$((tries + 1))
    [ "$tries" -lt 30 ] || { warn "Repository ${repo} did not become available"; return 1; }
    sleep 2
  done
  return 0
}

marker_present() {
  local repo="$1" ask response
  ask="ASK { GRAPH <${INIT_MARKER_GRAPH}> { <${INIT_MARKER_SUBJ}> <${INIT_MARKER_PRED}> ?v } }"
  response="$(api -G "${BASE_URL}/repositories/${repo}" \
    --data-urlencode "query=${ask}" \
    -H "Accept: application/sparql-results+json" || true)"
  printf '%s' "$response" | grep -q '"boolean"[[:space:]]*:[[:space:]]*true'
}

sparql_update() {
  local repo="$1" body="$2" code
  code="$(api -o "${TMP_DIR}/update.out" -w '%{http_code}' \
    -X POST "${BASE_URL}/repositories/${repo}/statements" \
    -H "Content-Type: application/sparql-update" \
    --data-binary "$body")"
  [ "$code" = "204" ]
}

import_file() {
  local repo="$1" file="$2" ctype="$3" graph="${4:-}" url code
  url="${BASE_URL}/repositories/${repo}/statements"
  if [ -n "$graph" ]; then
    url="${url}?context=%3C$(printf '%s' "$graph" | sed 's/#/%23/g')%3E"
  fi
  code="$(api -o /dev/null -w '%{http_code}' \
    -X POST "$url" \
    -H "Content-Type: ${ctype}" \
    --data-binary "@${file}")"
  [ "$code" = "204" ]
}

import_dir() {
  local repo="$1" dir="$2" graph="${3:-}" file filename ctype label
  label="(default graph)"
  [ -n "$graph" ] && label="(examples graph)"
  while IFS= read -r file; do
    filename="$(basename "$file")"
    case "${filename##*.}" in
      ttl) ctype="text/turtle" ;;
      nt)  ctype="application/n-triples" ;;
      rdf) ctype="application/rdf+xml" ;;
      *)   continue ;;
    esac
    printf '    %-46s %s ' "$filename" "$label"
    if import_file "$repo" "$file" "$ctype" "$graph"; then
      echo "OK"
    else
      echo "FAILED"
    fi
  done < <(find "$dir" -type f \( -name '*.ttl' -o -name '*.nt' -o -name '*.rdf' \) | sort)
}

run_connector_queries() {
  local repo="$1" file filename stmt stmt_name
  while IFS= read -r file; do
    filename="$(basename "$file")"
    echo "    ${filename}"
    rm -f "${TMP_DIR}"/part_*.sparql
    # Files hold several ';'-separated statements (a conditional drop followed
    # by a create); run each as its own request so a drop against a missing
    # connector does not block the create.
    awk -v outdir="$TMP_DIR" '
      BEGIN { n = 1; out = outdir "/part_001.sparql" }
      /^[[:space:]]*;[[:space:]]*$/ {
        close(out); n++;
        out = sprintf("%s/part_%03d.sparql", outdir, n);
        next
      }
      { print > out }
    ' "$file"
    for stmt in "${TMP_DIR}"/part_*.sparql; do
      [ -s "$stmt" ] || continue
      stmt_name="$(basename "$stmt")"
      printf '      %-20s ' "$stmt_name"
      if sparql_update "$repo" "$(cat "$stmt")"; then
        echo "OK"
      else
        echo "WARN (see output above)"
      fi
    done
  done < <(find "$SPARQL_DIR" -type f -name '*.sparql' | sort)
}

initialize_repo() {
  local repo="$1" timestamp
  log "  Importing type files..."
  import_dir "$repo" "$TYPES_DIR"
  if [ "$INCLUDE_TESTDATA" = 1 ]; then
    log "  Importing test data..."
    import_dir "$repo" "$TESTDATA_DIR" "$EXAMPLES_GRAPH"
  fi
  log "  Running full-text connector queries..."
  run_connector_queries "$repo"

  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if sparql_update "$repo" \
    "INSERT DATA { GRAPH <${INIT_MARKER_GRAPH}> { <${INIT_MARKER_SUBJ}> <${INIT_MARKER_PRED}> \"${timestamp}\" } }"; then
    log "  Init marker written (${timestamp})."
  else
    warn "  Could not write init marker for ${repo}"
  fi
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

CREATED=()
INITIALIZED=()
SKIPPED=()
FAILED=()

for repo in "${REPOS[@]}"; do
  log ""
  log "=== ${repo} ==="

  if [ "$DRY_RUN" = 1 ]; then
    if repo_exists "$repo"; then
      log "  would reuse existing repository, would import types + connectors"
    else
      log "  would create repository, import types + connectors"
    fi
    continue
  fi

  if repo_exists "$repo"; then
    log "  Repository already exists."
  else
    log "  Creating repository..."
    if create_repo "$repo"; then
      log "  Created."
      CREATED+=("$repo")
    else
      FAILED+=("$repo")
      continue
    fi
  fi

  if [ "$FORCE" != 1 ] && marker_present "$repo"; then
    log "  Already initialized (init marker present) — skipping import. Use --force to re-import."
    SKIPPED+=("$repo")
    continue
  fi

  initialize_repo "$repo"
  INITIALIZED+=("$repo")
done

# ---------------------------------------------------------------------------
# Public (unauthenticated) access
# ---------------------------------------------------------------------------

configure_free_access() {
  local py body code
  if [ "$ACCESS" = "none" ]; then
    log "Free access untouched (--access none)."
    return 0
  fi
  if [ "$SECURITY_ENABLED" != 1 ]; then
    log "GraphDB security is disabled - all repositories are already publicly accessible."
    return 0
  fi

  py="$(command -v python3 || true)"
  if [ -z "$py" ]; then
    warn "python3 not found - cannot safely merge free-access settings."
    warn "Grant free access manually in Workbench: Setup > Users and Access > Free access."
    return 0
  fi

  # Merge the new authorities into whatever free access is already granted, so
  # repositories from earlier runs or other courses keep working.
  cat > "${TMP_DIR}/free-access.py" <<'PYEOF'
import json, sys

level = sys.argv[1]
current_path = sys.argv[2]
repos = sys.argv[3:]

try:
    with open(current_path) as fh:
        current = json.load(fh)
except Exception:
    current = {}
if not isinstance(current, dict):
    current = {}

authorities = list(current.get("authorities") or [])
for repo in repos:
    wanted = ["READ_REPO_" + repo]
    if level == "write":
        wanted.append("WRITE_REPO_" + repo)
    for authority in wanted:
        if authority not in authorities:
            authorities.append(authority)

settings = current.get("appSettings") or {
    "DEFAULT_INFERENCE": True,
    "DEFAULT_SAMEAS": True,
    "EXECUTE_COUNT": True,
    "IGNORE_SHARED_QUERIES": False,
}

json.dump(
    {"enabled": True, "authorities": authorities, "appSettings": settings},
    sys.stdout,
)
PYEOF

  api -o "${TMP_DIR}/free-access.json" "${BASE_URL}/rest/security/free-access" || true
  if ! body="$("$py" "${TMP_DIR}/free-access.py" "$ACCESS" "${TMP_DIR}/free-access.json" "${REPOS[@]}")"; then
    warn "Could not build the free-access request."
    warn "Grant free access manually in Workbench: Setup > Users and Access > Free access."
    return 0
  fi

  code="$(api -o "${TMP_DIR}/access.out" -w '%{http_code}' \
    -X POST "${BASE_URL}/rest/security/free-access" \
    -H "Content-Type: application/json" \
    --data-binary "$body")"
  if [ "$code" = "200" ] || [ "$code" = "204" ]; then
    log "Free access enabled (${ACCESS}) for the ${COUNT} repositories."
  else
    warn "Failed to update free access (HTTP ${code})"
    sed -n '1,5p' "${TMP_DIR}/access.out" >&2 || true
    warn "Grant it manually in Workbench: Setup > Users and Access > Free access."
  fi
}

if [ "$DRY_RUN" = 1 ]; then
  log ""
  if [ "$ACCESS" = "none" ]; then
    log "Would leave free-access settings untouched."
  elif [ "$SECURITY_ENABLED" = 1 ]; then
    log "Would grant free (unauthenticated) ${ACCESS} access to the listed repositories."
  else
    log "GraphDB security is disabled — repositories would already be publicly accessible."
  fi
  log ""
  log "Dry run complete — nothing was changed."
  exit 0
fi

log ""
configure_free_access

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

log ""
log "Summary"
log "  Created:     ${#CREATED[@]}"
log "  Initialized: ${#INITIALIZED[@]}"
log "  Skipped:     ${#SKIPPED[@]}"
log "  Failed:      ${#FAILED[@]}"
if [ "${#FAILED[@]}" -gt 0 ]; then
  log "  Failed repositories: ${FAILED[*]}"
  exit 1
fi
log ""
log "SPARQL endpoints for the students:"
for repo in "${REPOS[@]}"; do
  log "  ${BASE_URL}/repositories/${repo}"
done
