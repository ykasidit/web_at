#!/bin/sh
# Content-hash build: public/ -> dist/ (deployed under www.clearevo.com/at/
# by ../ykasidit.github.io/deploy.sh). Relative refs only.
set -e
cd "$(dirname "$0")"
node --check public/app.js
node --check public/logic.js
node --check public/demo.js
node --check public/catalog.js

rm -rf dist
mkdir -p dist/assets
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp public/* "$WORK"

h() { sha256sum "$1" | cut -c1-8; }

for f in ms_sans_serif.woff ms_sans_serif.woff2 ms_sans_serif_bold.woff ms_sans_serif_bold.woff2 PerfectDOSVGA437Win.woff2; do
  hash=$(h "$WORK/$f"); name="${f%.*}"; ext="${f##*.}"
  cp "$WORK/$f" "dist/assets/$name.$hash.$ext"
  sed -i "s|url($f)|url($name.$hash.$ext)|g" "$WORK/xp.css"
done
for f in logic.js demo.js catalog.js; do
  hash=$(h "$WORK/$f"); name="${f%.js}"
  cp "$WORK/$f" "dist/assets/$name.$hash.js"
  sed -i "s|'./$f'|'./$name.$hash.js'|g" "$WORK/app.js"
done
for f in xp.css at.css app.js; do
  hash=$(h "$WORK/$f"); name="${f%.*}"; ext="${f##*.}"
  cp "$WORK/$f" "dist/assets/$name.$hash.$ext"
  sed -i "s|\"$f\"|\"assets/$name.$hash.$ext\"|g" "$WORK/index.html"
done

VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo dev)
sed -i "s|window.AT_VERSION='dev'|window.AT_VERSION='$VERSION'|" "$WORK/index.html"
cp "$WORK/index.html" dist/

! grep -q "'./logic\.js'" dist/assets/app.*.js
! grep -q "'./catalog\.js'" dist/assets/app.*.js
grep -q '"assets/app\.' dist/index.html
grep -q '"assets/xp\.' dist/index.html

echo "build ok -> dist/ ($(ls dist/assets | wc -l) hashed assets)"
