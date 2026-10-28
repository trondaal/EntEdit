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
  (Sjalusimannen og andre fortellinger, Rotteøya og andre fortellinger, 2021):
  each story and each of the two collections as work and expression; the editions
  combining both collections (Aschehoug 2022, the English translation) are not works of
  their own; French translations by collection and story. Also six novels with their first Norwegian editions, and four publications
  holding two novels each (Bokklubben, two audiobooks, a German omnibus), the audio drama
  Sjalusimannen in four episodes and three Danish audiobooks of single stories. Publication data
  from Nasjonalbiblioteket and BnF; ad hoc http://example.org/nesbo/... identifiers.
  Loaded into the local repository Nesbo.
OrientExpress.ttl: "Adaptations and other relationships" - Agatha Christie's Murder on the
  Orient Express (1934) and what derives from it: two Norwegian translations, an abridged
  ELT reader, four audiobooks (new expressions of the novel), and films, TV, radio, a play,
  a graphic novel with a Norwegian translation, a computer game, a Disney parody with a
  Norwegian translation, a study guide and a supplement (new works, related at work level),
  the film music of the 1974 and 2017 films (music for the films' expressions) and two
  large print editions (equivalent manifestations). Publication data from
  Nasjonalbiblioteket, library catalogues and Inducks; ad hoc http://example.org/orient/...
  identifiers. Loaded into the local repository OrientExpress.
LittleWomen.ttl: "Works built on works" - Louisa May Alcott's Little Women for an
  international group (notes in English): the novel as a whole with its two parts, the
  sequels Little Men and Jo's Boys, the revised 1880 text, French and German translations
  (literal, free and abridged), an ELT reader, audiobooks, four films (one a remake), TV,
  anime, musical and opera (adaptations stated between expressions), a graphic novel, a
  parody, a novel inspired by it and an annotated edition. Publication data from library
  catalogues, BnF and DNB; ad hoc http://example.org/littlewomen/... identifiers. Loaded
  into the local repository LittleWomen.
exercises/: one HTML page per example above (Nesbo, OrientExpress, LittleWomen) with an
  ISBD-style description and a plain-language content note for every publication, for
  students to catalogue and then compare with the loaded example. The descriptions are
  generated from the manifestations in the .ttl files, so regenerate them if those change.
