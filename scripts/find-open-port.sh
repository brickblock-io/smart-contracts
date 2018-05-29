#!/bin/bash

# Script to find an open port for ganache in our CI runners.

# Why do need to do this?
# Because a CI runner can potentially run multiple smart-contract pipelines in parallel
# which leads to port conflicts as per default truffle will always use port 8545.

# Why keep the port in a local file instead of an environment variable?
# Because it's not possible to define an environment variable in one npm script
# and then use it in another. For example, this would not work:
#
#   "test:setup": "export port=1337",
#   "test:run": "yarn test:setup && ganache-cli -p $port" <== $port is undefined here!
#
# That's why we're keeping this state in a local tmp file that gets cleaned up after the test run.

export GANACHE_PORT=8545
while lsof -i :$GANACHE_PORT > /dev/null; do
  echo "Port $GANACHE_PORT is already in use. Trying another one…";
  ((GANACHE_PORT++))
done

# XDG_SESSION_ID is used on CI (CentOS). TERM_SESSION_ID is used on macOS for local testing
echo $GANACHE_PORT > "GANACHE_PORT_TERM_ID_${XDG_SESSION_ID:-$TERM_SESSION_ID}"
