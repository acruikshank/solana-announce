#!/usr/bin/env bash

#curl https://api.mainnet-beta.solana.com -X POST -H "Content-Type: application/json" \
#  -d '{"jsonrpc":"2.0", "id":1, "method":"getMinimumBalanceForRentExemption", "params":[20000]}'

THIS_DIR="$(dirname "$0")"
CARGO_BUILD=${HOME}/.cargo/bin/cargo

HASH=4eYYrSE6K43gTFaRFFfqzYdLRW3YGFnH5qyewqXUv6bL
STATE_ADDRESS=4xTvGbGnJxJeZjbMECmBPPCuzdb3ZYyHG3hTbQk3V5rZ
function exit_err() { echo "❌ 💔" ; exit 1; }

STV_RUNNING=`ps -A -f | grep "[s]olana-test-validator"`
[ "$STV_RUNNING" == "" ] && echo "start solana-test-validator first" &&  exit_err

$CARGO_BUILD build-bpf || exit_err

SO_PATH=${HOME}/github.com/acruickshank/solana-announce/target/deploy/solana_announce.so
solana program deploy $SO_PATH

node client/index.mjs get $STATE_ADDRESS 0 || exit_err
