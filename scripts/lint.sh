#!/bin/bash
#
# RUN ALL CHECKS
#
# https://sipb.mit.edu/doc/safe-shell/
set -euf -o pipefail

printf "1️⃣  Running solium…\n"
yarn lint:contracts
printf "✅  solium done\n\n\n"

printf "2️⃣  Running eslint…\n"
yarn lint:js
printf "✅  eslint done\n\n\n"

printf "3️⃣  Running stylelint…\n"
yarn lint:css
printf "✅  stylelint done\n\n\n"
