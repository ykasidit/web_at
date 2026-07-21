#!/bin/sh
set -e
cd "$(dirname "$0")"
./build.sh && ./test.sh && ./push.sh
