#!/usr/bin/env bash
#
# Install the EntEdit vocabularies and profile into a GraphDB repository, and
# (re)create the full-text search connectors. Works on any repository you can
# reach: give it the endpoint and a login, nothing else is assumed.
#
#   ./tools/install-vocabularies.sh -e http://host:7200/repositories/EntEdit -U admin
#
# Every folder under database/types/ goes into a named graph of its own,
#
#   rda_vocabulary    ->  http://entedit.org/graph/rda_vocabulary
#   term_vocabularies ->  http://entedit.org/graph/term_vocabularies
#   entedit_profile   ->  http://entedit.org/graph/entedit_profile
#
# so that a layer can be replaced without touching the others or your data:
# drop its graph yourself, run this script again. The script never deletes
# anything, and leaves a graph that already has content alone unless --merge
# is given.
#
# Run --help for all options.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENDPOINT=""
REPO=""
TYPES_DIR="${ROOT_DIR}/database/types"
SPARQL_DIR="${ROOT_DIR}/database/lucene_connectors"
GRAPH_PREFIX="http://entedit.org/graph/"
DEFAULT_GRAPH="http://www.openrdf.org/schema/sesame#nil"
DO_VOCABULARIES=1
DO_CONNECTORS=1
MERGE=0
DRY_RUN=0
GDB_USER="${GRAPHDB_USER:-}"
GDB_PASS="${GRAPHDB_PASSWORD:-}"

usage() {
  cat <<'EOF'
Usage: install-vocabularies.sh -e <endpoint> [-U <user>] [options]

Installs database/types/ (the RDA vocabulary, the term vocabularies and the
EntEdit profile) and runs database/lucene_connectors/*.sparql, on an existing
repository. Each folder under types/ becomes a named graph of its own.

Required:
  -e, --endpoint URL    The repository's SPARQL endpoint, e.g.
                          http://localhost:7200/repositories/EntEdit
                          https://example.org/graphdb/repositories/EntEdit
                        or the GraphDB base URL together with --repository

Options:
  -r, --repository ID   Repository ID, when --endpoint is a base URL only
  -U, --user NAME       GraphDB user (env: GRAPHDB_USER)
  -P, --password PASS   GraphDB password (env: GRAPHDB_PASSWORD); asked for if
                        a user is given without one
      --types DIR       Vocabulary folder (default: database/types)
      --connectors DIR  Connector queries (default: database/lucene_connectors)
      --graph-prefix IRI  Prefix of the graph names (default:
                        http://entedit.org/graph/)
      --skip-vocabularies  Only run the connector queries
      --skip-connectors    Only install the vocabularies
      --merge           Also load into a graph that already has content (the
                        new statements are added; old ones stay)
      --dry-run         Show what would be done, change nothing
  -h, --help            Show this help

The script never deletes data. To replace a layer with a newer version, drop its
graph first (Workbench: Explore > Graphs overview, or `DROP GRAPH <iri>` in the
SPARQL editor), then run the script again. The connector queries recreate their
indexes, so every search index is rebuilt.

The user needs write access to the repository (and, for the connectors, the right
to manage them: in practice the admin).
EOF
}

log()  { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    -e|--endpoint)       ENDPOINT="${2:-}"; shift 2 ;;
    -r|--repository)     REPO="${2:-}"; shift 2 ;;
    -U|--user)           GDB_USER="${2:-}"; shift 2 ;;
    -P|--password)       GDB_PASS="${2:-}"; shift 2 ;;
    --types)             TYPES_DIR="${2:-}"; shift 2 ;;
    --connectors)        SPARQL_DIR="${2:-}"; shift 2 ;;
    --graph-prefix)      GRAPH_PREFIX="${2:-}"; shift 2 ;;
    --skip-vocabularies) DO_VOCABULARIES=0; shift ;;
    --skip-connectors)   DO_CONNECTORS=0; shift ;;
    --merge)             MERGE=1; shift ;;
    --dry-run)           DRY_RUN=1; shift ;;
    -h|--help)           usage; exit 0 ;;
    *)                   usage >&2; die "Unknown argument: $1" ;;
  esac
done

[ -n "$ENDPOINT" ] || { usage >&2; die "Missing --endpoint"; }
[ "$DO_VOCABULARIES" = 1 ] || [ "$DO_CONNECTORS" = 1 ] || die "Nothing to do: both parts are skipped"

# Accept the repository endpoint, or a base URL plus --repository.
BASE_URL="${ENDPOINT%/}"
URL_REPO="$(printf '%s' "$BASE_URL" | sed -nE 's#.*/repositories/([^/]+)(/statements)?$#\1#p')"
BASE_URL="$(printf '%s' "$BASE_URL" | sed -E 's#/repositories(/[^/]+)?(/statements)?$##')"
BASE_URL="${BASE_URL%/}"
[ -n "$BASE_URL" ] || die "Could not derive a GraphDB base URL from --endpoint"
[ -n "$REPO" ] || REPO="$URL_REPO"
[ -n "$REPO" ] || die "No repository: put /repositories/<id> in --endpoint or pass --repository"
REPO_URL="${BASE_URL}/repositories/${REPO}"

[ "$DO_VOCABULARIES" = 0 ] || [ -d "$TYPES_DIR" ]  || die "Vocabulary folder not found: $TYPES_DIR"
[ "$DO_CONNECTORS" = 0 ]   || [ -d "$SPARQL_DIR" ] || die "Connector folder not found: $SPARQL_DIR"

# A user without a password: ask for it. Typing a password containing ! or * on
# the command line is awkward in zsh and bash (history expansion, globbing).
if [ -n "$GDB_USER" ] && [ -z "$GDB_PASS" ] && [ "$DRY_RUN" = 0 ] && [ -t 0 ]; then
  read -r -s -p "GraphDB password for ${GDB_USER}: " GDB_PASS
  printf '\n' >&2
fi

CURL_AUTH=()
if [ -n "$GDB_USER" ]; then
  CURL_AUTH=(-u "${GDB_USER}:${GDB_PASS}")
fi
# ${CURL_AUTH[@]+...} keeps `set -u` happy with an empty array on bash 3.2 (macOS).
api() { curl -s ${CURL_AUTH[@]+"${CURL_AUTH[@]}"} "$@"; }

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

urlencode() { python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1" 2>/dev/null \
  || printf '%s' "$1" | sed 's/%/%25/g;s/#/%23/g;s/</%3C/g;s/>/%3E/g;s/ /%20/g'; }

ask() {   # ASK query (extra curl arguments after it) -> exit 0 when true
  local query="$1" out
  shift
  out="$(api -G "${REPO_URL}" --data-urlencode "query=${query}" "$@" -H 'Accept: application/sparql-results+json' || true)"
  printf '%s' "$out" | grep -q '"boolean"[[:space:]]*:[[:space:]]*true'
}

count_graph() {
  api -G "${REPO_URL}" --data-urlencode "query=SELECT (COUNT(*) AS ?n) WHERE { GRAPH <$1> { ?s ?p ?o } }" \
    -H 'Accept: application/sparql-results+json' \
    | sed -nE 's/.*"value"[[:space:]]*:[[:space:]]*"([0-9]+)".*/\1/p' | head -1
}

sparql_update() {
  local body="$1" code
  code="$(api -o "${TMP_DIR}/update.out" -w '%{http_code}' -X POST "${REPO_URL}/statements" \
    -H 'Content-Type: application/sparql-update' --data-binary "$body")" || code=000
  [ "$code" = 204 ]
}

# ---------------------------------------------------------------------------
# Reach the repository before doing anything
# ---------------------------------------------------------------------------

if [ "$DRY_RUN" = 0 ]; then
  code="$(api -o /dev/null -w '%{http_code}' -G "${REPO_URL}/size")" || code=000
  case "$code" in
    200) ;;
    000) die "Cannot reach ${REPO_URL}" ;;
    401|403) die "GraphDB rejected the login (HTTP $code). Pass -U and the password." ;;
    404) die "Repository '${REPO}' not found at ${BASE_URL}" ;;
    *) die "Unexpected response from ${REPO_URL}/size (HTTP $code)" ;;
  esac
  log "Repository: ${REPO_URL}"
fi

FAILED=0

# ---------------------------------------------------------------------------
# Vocabularies: one named graph per folder
# ---------------------------------------------------------------------------

install_layer() {
  local layer="$1" dir="$2" graph="${GRAPH_PREFIX}$1" file ctype shown total=0 failed=0 code url

  if [ "$DRY_RUN" = 1 ]; then
    log "  ${layer}  ->  <${graph}>  ($(find "$dir" -type f \( -name '*.ttl' -o -name '*.nt' -o -name '*.rdf' \) | wc -l | tr -d ' ') files)"
    return
  fi

  if [ "$MERGE" = 0 ] && ask "ASK { GRAPH <${graph}> { ?s ?p ?o } }"; then
    log "  ${layer}: <${graph}> already has content ($(count_graph "$graph") statements) - skipped."
    log "    To replace it, drop the graph first (DROP GRAPH <${graph}>) and run this again,"
    log "    or use --merge to add to it."
    return
  fi

  log "  ${layer}  ->  <${graph}>"
  url="${REPO_URL}/statements?context=%3C$(urlencode "$graph")%3E"
  while IFS= read -r file; do
    case "${file##*.}" in
      ttl) ctype="text/turtle" ;;
      nt)  ctype="application/n-triples" ;;
      rdf) ctype="application/rdf+xml" ;;
      *)   continue ;;
    esac
    shown="${file#"$dir"/}"
    printf '    %-58s ' "${shown}"
    code="$(api -o "${TMP_DIR}/import.out" -w '%{http_code}' -X POST "$url" \
      -H "Content-Type: ${ctype}" --data-binary "@${file}")" || code=000
    if [ "$code" = 204 ]; then
      echo "OK"; total=$((total + 1))
    else
      echo "FAILED (HTTP $code)"; failed=$((failed + 1))
      if [ "$code" = 413 ]; then
        warn "The proxy in front of GraphDB refused the upload (HTTP 413: body too large). Use GraphDB's own address, e.g. http://host:7200/repositories/${REPO}, or raise client_max_body_size."
      elif [ -s "${TMP_DIR}/import.out" ]; then
        warn "$(head -c 300 "${TMP_DIR}/import.out" | tr '\n' ' ')"
      fi
    fi
  done < <(find "$dir" -type f \( -name '*.ttl' -o -name '*.nt' -o -name '*.rdf' \) | sort)

  [ "$failed" = 0 ] || FAILED=$((FAILED + failed))
  log "    ${total} files loaded, $(count_graph "$graph") statements in the graph"

  # The same statements may still sit in the default graph from an install made
  # before the vocabularies had graphs of their own. Queries see them once
  # either way, but the old copy stays behind when this graph is dropped.
  # (infer=false: inferred statements count as default-graph content and would
  # match every statement of a clean install.)
  if ask "ASK { GRAPH <${graph}> { ?s ?p ?o } GRAPH <${DEFAULT_GRAPH}> { ?s ?p ?o } }" --data-urlencode infer=false; then
    warn "${layer}: some of these statements are also in the default graph (an older install)."
    warn "  Remove that copy when you are ready, with:"
    warn "  DELETE { GRAPH <${DEFAULT_GRAPH}> { ?s ?p ?o } } WHERE { GRAPH <${graph}> { ?s ?p ?o } GRAPH <${DEFAULT_GRAPH}> { ?s ?p ?o } }"
  fi
}

if [ "$DO_VOCABULARIES" = 1 ]; then
  log ""
  log "Vocabularies (from ${TYPES_DIR}):"
  found=0
  while IFS= read -r dir; do
    found=1
    install_layer "$(basename "$dir")" "$dir"
  done < <(find "$TYPES_DIR" -mindepth 1 -maxdepth 1 -type d | sort)
  [ "$found" = 1 ] || warn "No folders under ${TYPES_DIR}"
  if find "$TYPES_DIR" -maxdepth 1 -type f \( -name '*.ttl' -o -name '*.nt' -o -name '*.rdf' \) | grep -q .; then
    warn "Files directly under ${TYPES_DIR} are not installed; put them in a folder."
  fi
fi

# ---------------------------------------------------------------------------
# Connectors: each .sparql file drops (if present) and creates its index
# ---------------------------------------------------------------------------

if [ "$DO_CONNECTORS" = 1 ]; then
  log ""
  log "Search connectors (from ${SPARQL_DIR}):"
  while IFS= read -r file; do
    log "  $(basename "$file")"
    if [ "$DRY_RUN" = 1 ]; then continue; fi
    rm -f "${TMP_DIR}"/part_*.sparql
    # A file holds several ';'-separated statements (a conditional drop and a
    # create); each runs as its own request so a drop against a connector that
    # does not exist yet does not block the create.
    awk -v outdir="$TMP_DIR" '
      BEGIN { n = 1; out = outdir "/part_001.sparql" }
      /^[[:space:]]*;[[:space:]]*$/ { close(out); n++; out = sprintf("%s/part_%03d.sparql", outdir, n); next }
      { print > out }
    ' "$file"
    for stmt in "${TMP_DIR}"/part_*.sparql; do
      [ -s "$stmt" ] || continue
      printf '    %-20s ' "$(basename "$stmt")"
      if sparql_update "$(cat "$stmt")"; then
        echo "OK"
      else
        echo "WARN"
        warn "$(head -c 300 "${TMP_DIR}/update.out" | tr '\n' ' ')"
        FAILED=$((FAILED + 1))
      fi
    done
  done < <(find "$SPARQL_DIR" -type f -name '*.sparql' | sort)
fi

log ""
if [ "$DRY_RUN" = 1 ]; then
  log "Dry run - nothing was changed."
elif [ "$FAILED" = 0 ]; then
  log "Done."
else
  log "Done, with ${FAILED} problem(s) above."
  exit 1
fi
