#!/usr/bin/env bash
#
# Back up a set of EntEdit repositories on any GraphDB server, one per group: <prefix>01, <prefix>02, ... <prefix>NN — the same names
# create-repos.sh produces.
#
# Every repository is exported in full (vocabulary, profile and the users'
# entities, all named graphs) as compressed TriG-star, so the RDF-star
# entedit:valueOrder annotations survive. Only explicitly asserted statements
# are exported (no inferred ones), so a restore reproduces the repository
# exactly. Each repository's configuration is saved next to it.
#
# With --graph the backup is limited to the named graphs you list ("default" is the
# default graph), e.g. just the data the editor created.
#
#   ./tools/backup-repos.sh -e http://localhost:7200 -p VBINF6000-H26- -n 12
#
# Restore one repository: create it (create-repos.sh, or the Workbench),
# then POST the decompressed file to <endpoint>/repositories/<repo>/statements
# with Content-Type: application/x-trigstar. Run --help for all options.

set -euo pipefail

ENDPOINT=""
PREFIX=""
COUNT=""
START=1
WIDTH=2
OUTPUT_DIR=""
FORMAT="trigstar"
GRAPHS=()
DRY_RUN=0
GDB_USER="${GRAPHDB_USER:-}"
GDB_PASS="${GRAPHDB_PASSWORD:-}"

usage() {
  cat <<'EOF'
Usage: backup-repos.sh -e <endpoint> -p <prefix> -n <count> [options]

Required:
  -e, --endpoint URL   GraphDB SPARQL endpoint or base URL. Both forms work:
                       http://host:7200  or  http://host:7200/repositories/EntEdit
                       (a trailing /repositories/<id> is stripped)
  -p, --prefix NAME    Repository name prefix, e.g. "VBINF6000-H26-"
  -n, --count N        Number of repositories to back up

Options:
  -s, --start N        First group number (default: 1)
  -w, --width N        Zero-padding width for group numbers (default: 2 -> 01..09)
  -o, --output DIR     Directory for the backup
                       (default: ./backups/<prefix>-<UTC timestamp>)
  -g, --graph IRI      Back up only this named graph; repeat for several. The word
                       "default" means the default graph, where the editor puts new
                       entities. The file is then called <repo>.partial.<ext> and
                       the manifest lists the graphs. Without this option everything
                       is exported.
  -f, --format NAME    Export format (default: trigstar):
                         trigstar  TriG-star, keeps named graphs and RDF-star
                                   value-order annotations (.trigs.gz)
                         nquads    N-Quads, keeps named graphs but drops the
                                   RDF-star annotations (.nq.gz)
  -U, --user NAME      GraphDB admin user (env: GRAPHDB_USER)
  -P, --password PASS  GraphDB admin password (env: GRAPHDB_PASSWORD); asked for if omitted
      --dry-run        Print what would happen, change nothing
  -h, --help           Show this help

The backup directory gets, per repository, <repo>.trigs.gz and <repo>.config.ttl,
and one manifest.tsv listing statement counts and file sizes.

Only the statements you wrote are in the default graph (new entities from the
editor); the vocabularies and the profile live in graphs of their own, and edits to
an existing entity stay in the graph it was loaded from. To restore, create the
repository, install the vocabularies (tools/install-vocabularies.sh) and POST the
decompressed file to <endpoint>/repositories/<repo>/statements with
Content-Type: application/x-trigstar: each statement lands in the graph it came from.

Examples:
  ./tools/backup-repos.sh -e http://localhost:7200 -p VBINF6000-H26- -n 12
  ./tools/backup-repos.sh -e https://graphdb.example.org -p KURS- -n 25 \
      -U admin -P secret -o /Volumes/backup/kurs
  ./tools/backup-repos.sh -e http://localhost:7200 -p VBINF6000-H26- -n 12 \
      --graph default                      # only what was created in the editor
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
    -o|--output)   OUTPUT_DIR="${2:-}"; shift 2 ;;
    -g|--graph)    GRAPHS+=("${2:-}"); shift 2 ;;
    -f|--format)   FORMAT="${2:-}"; shift 2 ;;
    -U|--user)     GDB_USER="${2:-}"; shift 2 ;;
    -P|--password) GDB_PASS="${2:-}"; shift 2 ;;
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

case "$FORMAT" in
  trigstar) ACCEPT="application/x-trigstar"; EXT="trigs.gz" ;;
  nquads)   ACCEPT="application/n-quads";    EXT="nq.gz" ;;
  *)        die "--format must be trigstar or nquads" ;;
esac

# --graph: "default" or an absolute IRI.
GRAPH_ARGS=()
GRAPH_LABEL="all"
if [ "${#GRAPHS[@]}" -gt 0 ]; then
  GRAPH_LABEL=""
  for g in "${GRAPHS[@]}"; do
    case "$g" in
      default) GRAPH_ARGS+=(--data-urlencode "context=null") ;;
      ''|*[[:space:]\<\>\"]*) die "--graph must be \"default\" or an IRI without spaces or angle brackets: '$g'" ;;
      *:*) GRAPH_ARGS+=(--data-urlencode "context=<${g}>") ;;
      *)   die "--graph must be \"default\" or an absolute IRI such as http://example.org/graph: '$g'" ;;
    esac
    GRAPH_LABEL="${GRAPH_LABEL:+${GRAPH_LABEL},}${g}"
  done
fi

PART=""
[ "${#GRAPHS[@]}" -gt 0 ] && PART="partial."

# GraphDB repository IDs allow letters, digits, dash, underscore and dot.
case "$PREFIX" in
  *[!A-Za-z0-9._-]*) die "--prefix may only contain letters, digits, '.', '_' and '-'" ;;
esac

# Accept either the base URL or a full SPARQL endpoint URL.
BASE_URL="${ENDPOINT%/}"
BASE_URL="$(printf '%s' "$BASE_URL" | sed -E 's#/repositories(/[^/]+)?(/statements)?$##')"
BASE_URL="${BASE_URL%/}"
[ -n "$BASE_URL" ] || die "Could not derive a GraphDB base URL from --endpoint"

if [ -z "$OUTPUT_DIR" ]; then
  OUTPUT_DIR="./backups/${PREFIX%-}-$(date -u +%Y%m%dT%H%M%SZ)"
fi

# A user without a password: ask for it. Typing a password containing ! or * on
# the command line is awkward in zsh and bash (history expansion, globbing).
if [ -n "$GDB_USER" ] && [ -z "$GDB_PASS" ] && [ "${DRY_RUN:-0}" = 0 ] && [ -t 0 ]; then
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

# ---------------------------------------------------------------------------
# Server checks
# ---------------------------------------------------------------------------

log "GraphDB server: ${BASE_URL}"
if ! api -f -o /dev/null "${BASE_URL}/rest/repositories"; then
  die "Cannot reach GraphDB at ${BASE_URL} (check the URL and, if security is on, --user/--password)"
fi

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

log "Repositories to back up (${COUNT}): ${REPOS[0]} ... ${REPOS[$((COUNT - 1))]}"
log "Backup directory: ${OUTPUT_DIR}"
log "Format: ${FORMAT} (.${EXT})"
[ "${#GRAPHS[@]}" -gt 0 ] && log "Graphs: ${GRAPH_LABEL} (partial backup)"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

repo_exists() {
  api -f -o /dev/null "${BASE_URL}/rest/repositories/$1"
}

# Explicit statement count (inference off), used as a check against the export.
explicit_size() {
  api -f -G "${BASE_URL}/repositories/$1/size" --data-urlencode "infer=false" \
    ${GRAPH_ARGS[@]+"${GRAPH_ARGS[@]}"} 2>/dev/null | tr -dc '0-9'
}

backup_repo() {
  local repo="$1" tmp="${TMP_DIR}/${repo}.export" out="${OUTPUT_DIR}/${repo}.${PART}${EXT}"
  local code size bytes

  size="$(explicit_size "$repo" || true)"
  log "  Statements (explicit): ${size:-unknown}"

  # An export with nothing in it still carries prefix lines, so a partial backup
  # is judged empty by its statement count.
  if [ "${#GRAPHS[@]}" -gt 0 ] && [ "${size:-}" = "0" ]; then
    log "  Nothing in the selected graph(s) — no file written."
    return 2
  fi

  # Named graphs, RDF-star annotations, no inferred statements.
  code="$(api -o "$tmp" -w '%{http_code}' -G \
    "${BASE_URL}/repositories/${repo}/statements" \
    --data-urlencode "infer=false" \
    ${GRAPH_ARGS[@]+"${GRAPH_ARGS[@]}"} \
    -H "Accept: ${ACCEPT}")"
  if [ "$code" != "200" ]; then
    warn "  Export of ${repo} failed (HTTP ${code})"
    sed -n '1,5p' "$tmp" >&2 || true
    return 1
  fi
  if [ ! -s "$tmp" ]; then
    if [ "${#GRAPHS[@]}" -gt 0 ]; then
      log "  Nothing in the selected graph(s) — no file written."
      return 2
    fi
    warn "  Export of ${repo} is empty"
    return 1
  fi

  # Write to a temporary name first so an interrupted run never leaves a
  # truncated file that looks like a finished backup.
  gzip -c "$tmp" > "${out}.part"
  gzip -t "${out}.part" || { warn "  Compressed file for ${repo} is corrupt"; rm -f "${out}.part"; return 1; }
  mv "${out}.part" "$out"
  rm -f "$tmp"

  bytes="$(wc -c < "$out" | tr -d ' ')"
  log "  Saved ${out} (${bytes} bytes)"

  # Repository configuration (best effort: needs the repository read rights).
  if api -f -o "${OUTPUT_DIR}/${repo}.config.ttl" \
      "${BASE_URL}/rest/repositories/${repo}/download-ttl"; then
    log "  Saved ${OUTPUT_DIR}/${repo}.config.ttl"
  else
    rm -f "${OUTPUT_DIR}/${repo}.config.ttl"
    warn "  Could not save the configuration of ${repo} (the export itself is fine)"
  fi

  printf '%s\t%s\t%s\t%s\t%s\n' "$repo" "${size:-}" "$bytes" "$(basename "$out")" "$GRAPH_LABEL" >> "${OUTPUT_DIR}/manifest.tsv"
  return 0
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

if [ "$DRY_RUN" = 1 ]; then
  for repo in "${REPOS[@]}"; do
    if repo_exists "$repo"; then
      log "  ${repo}: would export to ${OUTPUT_DIR}/${repo}.${PART}${EXT}"
    else
      log "  ${repo}: does not exist, would be skipped"
    fi
  done
  log ""
  log "Dry run complete — nothing was changed."
  exit 0
fi

mkdir -p "$OUTPUT_DIR"
printf 'repository\texplicit_statements\tbytes\tfile\tgraphs\n' > "${OUTPUT_DIR}/manifest.tsv"

BACKED_UP=()
MISSING=()
FAILED=()
EMPTY=()

for repo in "${REPOS[@]}"; do
  log ""
  log "=== ${repo} ==="

  if ! repo_exists "$repo"; then
    warn "  Repository does not exist — skipped."
    MISSING+=("$repo")
    continue
  fi

  rc=0
  backup_repo "$repo" || rc=$?
  case "$rc" in
    0) BACKED_UP+=("$repo") ;;
    2) EMPTY+=("$repo") ;;
    *) FAILED+=("$repo") ;;
  esac
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

log ""
log "Summary"
log "  Backed up: ${#BACKED_UP[@]}"
[ "${#EMPTY[@]}" -gt 0 ] && log "  No data in the selected graph(s): ${#EMPTY[@]} (${EMPTY[*]})"
log "  Missing:   ${#MISSING[@]}"
log "  Failed:    ${#FAILED[@]}"
[ "${#MISSING[@]}" -gt 0 ] && log "  Missing repositories: ${MISSING[*]}"
[ "${#FAILED[@]}" -gt 0 ]  && log "  Failed repositories: ${FAILED[*]}"
log ""
log "Backup written to ${OUTPUT_DIR} (manifest.tsv lists counts and sizes)."
if [ "${#FAILED[@]}" -gt 0 ] || [ "${#MISSING[@]}" -gt 0 ]; then
  exit 1
fi
