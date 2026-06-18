#!/bin/sh
set -e

REPO="Sirbuschi2003/machineflow"
BRANCH="master"
INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "╔══════════════════════════════════════╗"
echo "║       MachineFlow – Update           ║"
echo "╚══════════════════════════════════════╝"

echo ""
echo "▶ Lade neueste Version von GitHub..."
curl -fsSL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" -o /tmp/machineflow.tar.gz

echo "▶ Entpacke Dateien..."
tar -xzf /tmp/machineflow.tar.gz -C /tmp/
cp -rf /tmp/machineflow-${BRANCH}/. "${INSTALL_DIR}/"
rm -rf /tmp/machineflow.tar.gz /tmp/machineflow-${BRANCH}

cd "${INSTALL_DIR}"

echo ""
echo "▶ Baue Images..."
docker compose build

echo ""
echo "▶ Starte Container..."
docker compose up -d

echo ""
echo "▶ Warte auf Datenbankmigrationen..."
sleep 5

echo ""
echo "▶ Container-Status:"
docker compose ps

echo ""
echo "✓ Update abgeschlossen!"
