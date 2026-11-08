#!/usr/bin/env bash
# Corre Playwright con build y puerto propios: scripts/e2e-aislado.sh <nombre> <puerto> [archivos o filtros de playwright]
set -euo pipefail
NOMBRE="$1"; PUERTO="$2"; shift 2
cd "$(dirname "$0")/.."
E2E_DIST="dist-$NOMBRE" E2E_PUERTO="$PUERTO" npx playwright test --output "test-results-$NOMBRE" "$@"
