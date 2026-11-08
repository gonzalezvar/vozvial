#!/usr/bin/env bash
# Build web para e2e con tiempos cortos. Serializa los builds con flock para que varias suites en paralelo no choquen en la cache de Metro.
set -euo pipefail
DIST="${1:-dist}"
cd "$(dirname "$0")/.."
mkdir -p .cache
flock .cache/build-e2e.lock npx cross-env EXPO_PUBLIC_BLOQUEO_MS=3000 EXPO_PUBLIC_INACTIVIDAD_MS=5000 EXPO_PUBLIC_PBKDF2_ITERACIONES=1000 expo export -p web --output-dir "$DIST"
