#!/usr/bin/env python3
"""Mail each student their GraphDB login, one personal message per row, from
an account in Mail.app (macOS).

Input is the CSV exported from the users sheet: semicolon- or comma-separated,
columns group, email, username, password, repository (header text is ignored).
Rows without an email address are skipped.

By default the messages are only created as drafts, so they can be checked in
Mail before anything is sent. Pass --send to send them.

  ./tools/mail-student-users.py users.csv          # drafts
  ./tools/mail-student-users.py users.csv --send
  ./tools/mail-student-users.py users.csv --list-only      # no Mail at all

Keep the CSV out of git: it contains passwords.
"""
import argparse
import csv
import re
import subprocess
import sys

SUBJECT = "VBINF6000: din innlogging til EntEdit"
BODY = """Hei!

Her er innloggingen din til EntEdit-databasen i VBINF6000.

Adresse:     {url}
Brukernavn:  {username}
Passord:     {password}
Repository:  {repository}

Innloggingen gir tilgang til gruppens repository ({repository}) og ikke til andre grupper.
Gi beskjed hvis den ikke fungerer.

Hilsen
{signature}
"""


def read_rows(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        text = f.read()
    delimiter = ";" if text.splitlines()[0].count(";") >= 3 else ","
    rows = list(csv.reader(text.splitlines(), delimiter=delimiter))[1:]
    people = []
    for r in rows:
        r = [c.strip() for c in r] + [""] * 5
        group, email, username, password, repository = r[:5]
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            continue
        if not username or not password:
            sys.exit(f"Row for {email} lacks username or password")
        people.append(dict(group=group, email=email, username=username,
                           password=password, repository=repository))
    return people


def applescript_string(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def make_message(person, args):
    url = f"{args.url.rstrip('/')}/{person['repository']}"
    body = BODY.format(url=url, signature=args.signature, **person)
    lines = [
        'tell application "Mail"',
        f'  set m to make new outgoing message with properties '
        f'{{subject:{applescript_string(args.subject)}, '
        f'content:{applescript_string(body)}, visible:false}}',
        f'  set sender of m to {applescript_string(args.sender)}',
        f'  tell m to make new to recipient with properties '
        f'{{address:{applescript_string(person["email"])}}}',
    ]
    lines.append("  send m" if args.send else "  save m")
    lines.append("end tell")
    return "\n".join(lines)


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("csv")
    p.add_argument("--sender", default="Trond Aalberg <tronaa@oslomet.no>",
                   help="From address, which selects the Mail account")
    p.add_argument("--url", default="http://dijon.idi.ntnu.no/graphdb/repositories",
                   help="Address up to the repository; each student's own "
                        "repository is appended")
    p.add_argument("--subject", default=SUBJECT)
    p.add_argument("--signature", default="Trond")
    p.add_argument("--send", action="store_true", help="send instead of saving drafts")
    p.add_argument("--list-only", action="store_true",
                   help="print recipients (no passwords) and exit")
    args = p.parse_args()

    people = read_rows(args.csv)
    for pe in people:
        print(f"{pe['group']:>3}  {pe['email']:<32} {pe['username']:<16} {pe['repository']}")
    print(f"{len(people)} recipients")
    if args.list_only:
        return

    for pe in people:
        subprocess.run(["osascript", "-"], input=make_message(pe, args),
                       text=True, check=True)
    print("Sent." if args.send else "Drafts saved in Mail (Drafts) - check, then send.")


if __name__ == "__main__":
    main()
