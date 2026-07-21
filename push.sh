#!/bin/sh
set -e
cd "$(dirname "$0")"
./build.sh
../ykasidit.github.io/deploy.sh
