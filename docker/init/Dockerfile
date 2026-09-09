# One-shot initialiser for the GraphDB repository.
#
# The vocabulary, sample data, repository definition and import script are baked
# into the image so that `docker compose up` needs nothing from the source tree —
# users can start the whole system from Docker Hub without downloading this
# repository. Build context is the project root:
#
#   docker build -f docker/init/Dockerfile -t trondaal/entedit-init .
#
# Rebuild and push whenever anything under database/ or docker/graphdb/ changes.

FROM alpine:3

RUN apk add --no-cache curl

COPY database/types              /import-data/types
COPY database/testdata           /import-data/testdata
COPY database/lucene_connectors  /sparql-updates
COPY docker/graphdb/repositories/EntEdit/config.ttl /repo-config.ttl
COPY docker/graphdb/import-types.sh /import-types.sh

ENTRYPOINT ["sh", "/import-types.sh"]
