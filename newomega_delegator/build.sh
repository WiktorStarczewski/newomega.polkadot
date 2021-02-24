#!/usr/bin/env bash

set -eu

cargo +nightly contract build --manifest-path newomega/Cargo.toml
cargo +nightly contract build --manifest-path newomegagame/Cargo.toml
cargo +nightly contract build
