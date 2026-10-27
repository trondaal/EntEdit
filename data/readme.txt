Examples files that are not included in the distribution

Ballard/: J. G. Ballard, works and publications from ISFDB, one file per entity type
  (persons, publishers, works, expressions, manifestations), converted with isfdb2lrm
  (author 259; report.json gives date, converter commit and counts).
  Persons and works already known by a VIAF (or Wikidata) identifier use that URI;
  everything else uses http://entedit.org/... identifiers.
  manifestations.ttls is Turtle-star (entedit:valueOrder keeps the order of contents).
  catalogue.ttl: two music recordings (Dream cargoes, The isle is full of noises) whose
  tracks are named after Ballard stories; not in ISFDB, links to nothing in the conversion.
Nesbo.ttl: "Collections and aggregates" - Jo Nesbø's two short story collections
  (Sjalusimannen og andre fortellinger, Rotteøya og andre fortellinger, 2021): each story
  and each collection as work and expression, an omnibus work for the editions with all
  12 stories (Aschehoug 2022, the English translation), French translations at collection
  level only. Publication data from Nasjonalbiblioteket and BnF; ad hoc
  http://example.org/nesbo/... identifiers. Loaded into the local repository Nesbo.
