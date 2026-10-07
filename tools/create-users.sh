#!/usr/bin/env bash
#
# Create GraphDB users for a set of groups (one per group, or several per
# group with --per-repo), with usernames that are easy to remember and
# passwords that are easy to type:
#
#   group 01  ->  user  kurs-ulv        password  bla-skog-tau-4821
#                 access to repository  VBINF6000-H26-01
#
# Usernames are <prefix><animal>. The animal for a group is fixed by the prefix
# (a shuffle seeded with it), so running the script again addresses the same
# users: ones that already exist are left alone, never given a new password.
# With --per-repo every member of a group gets an animal of their own.
# Passwords are random words plus four digits; the strength is printed when
# they are generated.
#
#   ./tools/create-users.sh -e http://localhost:7200 -p kurs- \
#       -r VBINF6000-H26- -n 12 -U admin -P secret -o users.csv
#
# Run --help for all options.

set -euo pipefail

ENDPOINT=""
PREFIX=""
REPO_PREFIX=""
COUNT=""
START=1
WIDTH=2
LANG_CHOICE="no"
ACCESS="write"
SEED=""
PASSWORD_WORDS=3
PER_REPO=1
OUTPUT=""
DRY_RUN=0
GDB_USER="${GRAPHDB_USER:-}"
GDB_PASS="${GRAPHDB_PASSWORD:-}"

usage() {
  cat <<'EOF'
Usage: create-users.sh -e <endpoint> -p <prefix> -r <repo-prefix> -n <count> [options]

Required:
  -e, --endpoint URL      GraphDB base URL (a trailing /repositories/<id> is stripped)
  -p, --prefix NAME       Username prefix; the animal is appended, e.g. "kurs-" -> kurs-ulv
  -r, --repo-prefix NAME  Prefix of the repositories made by create-repos.sh;
                          group N gets <repo-prefix><N> (zero-padded like that script)
  -n, --count N           Number of groups (repositories)

Options:
  -s, --start N           First group number (default: 1)
  -w, --width N           Zero-padding width of the repository numbers (default: 2)
  -l, --lang no|en        Language of the animal and password words (default: no)
  -a, --access LEVEL      Rights on the group's repository: write (default) or read
      --per-repo N        Users per repository (default: 1), each with their own
                          animal and password, e.g. 4 for individual logins in a group
      --words N           Words in each password (default: 3), plus four digits
      --seed TEXT         Seed of the animal assignment (default: the prefix)
  -o, --output FILE       Also write the credentials to FILE as CSV (mode 600)
  -U, --user NAME         GraphDB admin user (env: GRAPHDB_USER)
  -P, --password PASS     GraphDB admin password (env: GRAPHDB_PASSWORD); asked for if omitted
      --dry-run           Print the credentials that would be created, change nothing
  -h, --help              Show this help

Existing users are skipped, so a rerun never resets a password. Keep --seed and
--per-repo as they were when you rerun: --per-repo may be raised to add members
(the earlier users keep their names), but changing the seed or adding groups with
--per-repo above 1 can move animals between groups, which the script reports. To give a
group a new password, change it in GraphDB's Workbench (Setup > Users and Access).

GraphDB security must be enabled for the logins to be asked for. Do not combine
this with free access on the same repositories: anonymous visitors would then
have the access the users were meant to need a login for.
EOF
}

log()  { printf '%s\n' "$*" >&2; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    -e|--endpoint)    ENDPOINT="${2:-}"; shift 2 ;;
    -p|--prefix)      PREFIX="${2:-}"; shift 2 ;;
    -r|--repo-prefix) REPO_PREFIX="${2:-}"; shift 2 ;;
    -n|--count)       COUNT="${2:-}"; shift 2 ;;
    -s|--start)       START="${2:-}"; shift 2 ;;
    -w|--width)       WIDTH="${2:-}"; shift 2 ;;
    -l|--lang)        LANG_CHOICE="${2:-}"; shift 2 ;;
    -a|--access)      ACCESS="${2:-}"; shift 2 ;;
    --per-repo)       PER_REPO="${2:-}"; shift 2 ;;
    --words)          PASSWORD_WORDS="${2:-}"; shift 2 ;;
    --seed)           SEED="${2:-}"; shift 2 ;;
    -o|--output)      OUTPUT="${2:-}"; shift 2 ;;
    -U|--user)        GDB_USER="${2:-}"; shift 2 ;;
    -P|--password)    GDB_PASS="${2:-}"; shift 2 ;;
    --dry-run)        DRY_RUN=1; shift ;;
    -h|--help)        usage; exit 0 ;;
    *)                usage >&2; die "Unknown argument: $1" ;;
  esac
done

[ -n "$PREFIX" ]      || { usage >&2; die "Missing --prefix"; }
[ -n "$REPO_PREFIX" ] || { usage >&2; die "Missing --repo-prefix"; }
[ -n "$COUNT" ]       || { usage >&2; die "Missing --count"; }
if [ "$DRY_RUN" = 0 ]; then
  [ -n "$ENDPOINT" ]  || { usage >&2; die "Missing --endpoint"; }
fi

case "$COUNT" in ''|*[!0-9]*) die "--count must be a positive integer" ;; esac
case "$START" in ''|*[!0-9]*) die "--start must be a positive integer" ;; esac
case "$WIDTH" in ''|*[!0-9]*) die "--width must be a positive integer" ;; esac
case "$PER_REPO" in ''|*[!0-9]*) die "--per-repo must be a positive integer" ;; esac
case "$PASSWORD_WORDS" in ''|*[!0-9]*) die "--words must be a positive integer" ;; esac
[ "$COUNT" -ge 1 ] && [ "$START" -ge 1 ] && [ "$WIDTH" -ge 1 ] && [ "$PER_REPO" -ge 1 ] \
  && [ "$PASSWORD_WORDS" -ge 1 ] \
  || die "--count, --start, --width, --per-repo and --words must be at least 1"
case "$LANG_CHOICE" in no|en) ;; *) die "--lang must be no or en" ;; esac
case "$ACCESS" in read|write) ;; *) die "--access must be read or write" ;; esac
case "$PREFIX" in
  *[!A-Za-z0-9._-]*) die "--prefix may only contain letters, digits, '.', '_' and '-'" ;;
esac
case "$REPO_PREFIX" in
  *[!A-Za-z0-9._-]*) die "--repo-prefix may only contain letters, digits, '.', '_' and '-'" ;;
esac
[ -n "$SEED" ] || SEED="$PREFIX"
command -v python3 >/dev/null 2>&1 || die "python3 is required"

BASE_URL=""
if [ -n "$ENDPOINT" ]; then
  BASE_URL="${ENDPOINT%/}"
  BASE_URL="$(printf '%s' "$BASE_URL" | sed -E 's#/repositories(/[^/]+)?(/statements)?$##')"
  BASE_URL="${BASE_URL%/}"
  [ -n "$BASE_URL" ] || die "Could not derive a GraphDB base URL from --endpoint"
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
# Generate: group <TAB> repository <TAB> username <TAB> password <TAB> JSON body
# ---------------------------------------------------------------------------

generate() {
  PREFIX="$PREFIX" REPO_PREFIX="$REPO_PREFIX" COUNT="$COUNT" START="$START" \
  WIDTH="$WIDTH" LANG_CHOICE="$LANG_CHOICE" ACCESS="$ACCESS" SEED="$SEED" \
  PASSWORD_WORDS="$PASSWORD_WORDS" PER_REPO="$PER_REPO" python3 - <<'PYEOF'
import json, math, os, random, secrets, sys

ANIMALS = {
    "no": """elg rev ulv bjorn hare ugle orn hauk grevling gaupe hjort rein sel hval
        torsk laks krabbe hummer maur bie veps frosk padde slange hest gris sau geit
        kanin hund katt esel and gjess svane trane hegre spurv trost meis ravn skarv
        lunde oter bever mink mus rotte ekorn delfin hai rokke makrell sild tiger ape
        sebra kamel panda koala pingvin fasan tiur storke hubro falk bison""".split(),
    "en": """otter fox wolf bear hare owl eagle hawk badger lynx deer elk seal whale cod
        salmon crab lobster ant bee wasp frog toad snake horse pig sheep goat rabbit dog
        cat donkey duck goose swan crane heron sparrow thrush raven puffin beaver mink
        mouse rat squirrel dolphin shark ray herring tiger ape zebra camel panda koala
        penguin pheasant stork falcon moose bison gecko newt""".split(),
}

WORDS = {
    "no": """bla gul rod gronn hvit svart brun lilla sol mane stjerne sky regn sno vind
        torden fjell dal elv sjo skog strand bro hus dor vindu stol bord seng lampe bok
        penn bil tog buss sykkel bat skip fly vei gate torg kirke brygge fyr tre blomst
        gress eple plomme banan brod ost melk kaffe sukker salt suppe kake kniv gaffel
        skje kopp tallerken glass nokkel klokke sko hatt lue votter jakke belte ring
        mynt kart flagg trommel fele gitar spade hammer sag spiker tau nett kurv sekk
        pose eske tonne brev ball spill terning sjakk dans sang vers rose tulipan eik
        bjork furu gran stein sand kyst fjord""".split(),
    "en": """blue yellow red green white black brown purple sun moon star cloud rain snow
        wind thunder mountain valley river lake forest beach bridge house door window
        chair table bed lamp book pen car train bus bicycle boat ship plane road street
        market church harbour lighthouse tree flower grass apple plum banana bread
        cheese milk coffee sugar salt soup cake knife fork spoon cup plate glass key
        clock shoe hat cap glove jacket belt ring coin map flag drum fiddle guitar
        spade hammer saw nail rope net basket sack bag box barrel letter ball game dice
        chess dance song verse rose tulip oak birch pine stone sand coast fjord""".split(),
}

lang = os.environ["LANG_CHOICE"]
prefix = os.environ["PREFIX"]
repo_prefix = os.environ["REPO_PREFIX"]
count = int(os.environ["COUNT"])
start = int(os.environ["START"])
width = int(os.environ["WIDTH"])
access = os.environ["ACCESS"]
n_words = int(os.environ["PASSWORD_WORDS"])
per_repo = int(os.environ["PER_REPO"])

animals = list(dict.fromkeys(ANIMALS[lang]))
words = list(dict.fromkeys(WORDS[lang]))
last = start + count - 1
if last * per_repo > len(animals):
    sys.exit(f"ERROR: only {len(animals)} animal names are available, which allows "
             f"{len(animals) // per_repo} groups of {per_repo} (group {last} asked for)")
if n_words > len(words):
    sys.exit("ERROR: --words is larger than the word list")

# The assignment depends only on the seed, so a rerun addresses the same users.
# Member 1 of every group takes the first block of the shuffled list, member 2
# the next block, and so on: raising --per-repo later adds users without
# renaming the existing ones.
order = animals[:]
random.Random(os.environ["SEED"]).shuffle(order)

rng = secrets.SystemRandom()
for group in range(start, start + count):
  repo = f"{repo_prefix}{group:0{width}d}"
  for member in range(per_repo):
    username = prefix + order[member * last + group - 1]
    password = "-".join(rng.sample(words, n_words) + [f"{rng.randrange(10000):04d}"])
    authorities = ["ROLE_USER", f"READ_REPO_{repo}"]
    if access == "write":
        authorities.append(f"WRITE_REPO_{repo}")
    body = json.dumps({
        "password": password,
        "grantedAuthorities": authorities,
        "appSettings": {
            "DEFAULT_INFERENCE": True,
            "DEFAULT_SAMEAS": True,
            "EXECUTE_COUNT": True,
            "IGNORE_SHARED_QUERIES": False,
            "DEFAULT_VIS_GRAPH_SCHEMA": True,
        },
    }, separators=(",", ":"))
    print("\t".join([str(group), repo, username, password, body]))

bits = sum(math.log2(len(words) - i) for i in range(n_words)) + math.log2(10000)
print(f"Password strength: about {bits:.0f} bits ({n_words} words from {len(words)}, plus four digits)",
      file=sys.stderr)
PYEOF
}

generate > "$TMP_DIR/users.tsv"

# ---------------------------------------------------------------------------
# Server checks
# ---------------------------------------------------------------------------

if [ "$DRY_RUN" = 0 ]; then
  # The user list is admin-only, so this also tells us the credentials work.
  code=$(api -o /dev/null -w '%{http_code}' "${BASE_URL}/rest/security/users") \
    || die "Cannot reach GraphDB at ${BASE_URL}"
  case "$code" in
    200) ;;
    401|403) die "GraphDB rejected the admin credentials (HTTP $code). Check -U and the password." ;;
    *) die "Unexpected response from ${BASE_URL}/rest/security/users (HTTP $code)" ;;
  esac
  api "${BASE_URL}/rest/security" | grep -q true \
    || warn "GraphDB security is not enabled: the users are created, but nobody is asked to log in."
fi

# ---------------------------------------------------------------------------
# Create users
# ---------------------------------------------------------------------------

CSV_ROWS="$TMP_DIR/created.tsv"
: > "$CSV_ROWS"
created=0; skipped=0; failed=0

while IFS=$'\t' read -r group repo username password body; do
  if [ "$DRY_RUN" = 1 ]; then
    printf '%s\t%s\t%s\t%s\n' "$group" "$username" "$password" "$repo" >> "$CSV_ROWS"
    created=$((created + 1))
    continue
  fi

  code=$(api -o "$TMP_DIR/existing.out" -w '%{http_code}' "${BASE_URL}/rest/security/users/${username}") || code=000
  if [ "$code" = 200 ]; then
    if grep -q "\"READ_REPO_${repo}\"" "$TMP_DIR/existing.out"; then
      log "  ${username}: exists, left unchanged"
      skipped=$((skipped + 1))
    else
      warn "${username}: exists but has no access to ${repo} - it belongs to something else, so the animals have moved (changed --seed, or added groups while --per-repo is above 1?). Nothing done."
      failed=$((failed + 1))
    fi
    continue
  fi
  if [ "$code" != 404 ]; then
    warn "${username}: could not check whether it exists (HTTP $code)"
    failed=$((failed + 1))
    continue
  fi

  code=$(api -o "$TMP_DIR/create.out" -w '%{http_code}' -X POST \
    -H 'Content-Type: application/json' --data-binary "$body" \
    "${BASE_URL}/rest/security/users/${username}") || code=000
  case "$code" in
    200|201|204)
      log "  ${username}: created, access to ${repo}"
      printf '%s\t%s\t%s\t%s\n' "$group" "$username" "$password" "$repo" >> "$CSV_ROWS"
      created=$((created + 1))
      ;;
    *)
      warn "${username}: creation failed (HTTP $code): $(head -c 200 "$TMP_DIR/create.out")"
      failed=$((failed + 1))
      ;;
  esac
done < "$TMP_DIR/users.tsv"

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

if [ "$created" -gt 0 ]; then
  [ "$DRY_RUN" = 1 ] && log "Dry run - these users would be created:" || log "Created:"
  printf '%-6s %-22s %-28s %s\n' "Group" "Username" "Password" "Repository"
  while IFS=$'\t' read -r group username password repo; do
    printf '%-6s %-22s %-28s %s\n' "$group" "$username" "$password" "$repo"
  done < "$CSV_ROWS"

  if [ -n "$OUTPUT" ] && [ "$DRY_RUN" = 0 ]; then
    umask 077
    {
      printf 'group,username,password,repository\n'
      while IFS=$'\t' read -r group username password repo; do
        printf '%s,%s,%s,%s\n' "$group" "$username" "$password" "$repo"
      done < "$CSV_ROWS"
    } > "$OUTPUT"
    chmod 600 "$OUTPUT"
    log "Credentials written to ${OUTPUT} (readable only by you)."
  fi
fi

log "Done: ${created} created, ${skipped} already existed, ${failed} failed."
[ "$failed" = 0 ]
