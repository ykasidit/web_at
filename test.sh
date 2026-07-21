#!/bin/sh
set -e
cd "$(dirname "$0")"
node --test "test/*.test.js"
