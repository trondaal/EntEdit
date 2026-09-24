# Changelog

User-facing changes, newest first. Written for people using the app (students,
cataloguers), not as a full commit history — see `git log` for that.

## 2026-09-24

**English**

- **Cataloguing style setting.** You can now switch between *classic* and
  *semantic web* cataloguing style in Settings — this controls whether
  identifiers and labels are shown/required. Ask your instructor which style
  to use for this course.
- **Language tagging.** Text fields for natural-language values (titles,
  notes, etc.) now offer a language selector. Fields that aren't natural
  language (dates, identifiers, numbering) don't show one.
- **Generate button.** New entities without a URI of their own can get one
  generated automatically via a "Generate" button next to the identifier
  field.
- **Removing inferred relationships.** A relationship shown as "inferred"
  (dashed outline) can now be removed from either the entity you're viewing
  or the one it's linked to.
- **Unsaved changes warning.** Navigating away with unsaved edits now asks
  for confirmation first.
- **Search fix.** Full-text search no longer breaks on special characters,
  and a bug where a search term from one publication's title could
  incorrectly match a different, unrelated publication has been fixed.
- Smaller polish: clearer error messages for empty rows, duplicate values,
  and identifiers already in use; more readable names for entities without a
  label; better layout on phones.

**Norsk**

- **Katalogiseringsstil.** Du kan nå velge mellom *klassisk* og *semantisk
  web*-katalogisering under Innstillinger — dette styrer om identifikator og
  labels vises/kreves. Spør faglærer om hvilken stil som skal brukes i dette
  emnet.
- **Språkmerking.** Tekstfelt for naturlig språk (titler, notater osv.) har
  nå en språkvelger. Felt som ikke er naturlig språk (datoer, identifikatorer,
  nummerering) viser ingen velger.
- **Generer-knapp.** Nye entiteter uten egen URI kan få generert én
  automatisk via en "Generer"-knapp ved siden av identifikatorfeltet.
- **Fjerne utledede koblinger.** En kobling merket "utledet" (stiplet ramme)
  kan nå fjernes både fra entiteten du ser på, og fra den den er koblet til.
- **Varsel om ulagrede endringer.** Du blir nå spurt om bekreftelse før du
  navigerer bort med ulagrede endringer.
- **Søkefiks.** Fulltekstsøk krasjer ikke lenger på spesialtegn, og en feil
  der et søkeord fra tittelen på én utgivelse kunne treffe en helt annen,
  urelatert utgivelse, er rettet.
- Mindre finpuss: tydeligere feilmeldinger for tomme rader, dupliserte
  verdier og identifikatorer som allerede er i bruk; mer lesbare navn for
  entiteter uten label; bedre visning på mobil.
