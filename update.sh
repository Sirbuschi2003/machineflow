#!/bin/sh
set -e

main() {
  COMPOSE="/usr/libexec/docker/cli-plugins/docker-compose"
  DIR="$(cd "$(dirname "$0")" && pwd)"
  cd "$DIR"

  echo "Auftragsverwaltung - Update"
  echo "---------------------------"

  echo "Lade neue docker-compose.yml..."
  curl -fsSL "https://raw.githubusercontent.com/Sirbuschi2003/auftragsverwaltung/master/docker-compose.yml" \
    | tr -d '\r' > docker-compose.yml

  echo "Lade neue Images von ghcr.io..."
  $COMPOSE pull

  echo "Starte Container neu..."
  $COMPOSE up -d

  sleep 5

  echo ""
  echo "Status:"
  $COMPOSE ps

  echo ""
  echo "Fertig!"
}

main
