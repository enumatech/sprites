# To update to the latest unstable channel:
#    curl -sI https://nixos.org/channels/nixpkgs-unstable/nixexprs.tar.xz | awk '/Location:/ {print $2}'
# then compute the hash with
#    nix-prefetch-url --type sha256 --unpack URL
# and update `nixpkgs.json` accordingly.
#
# Alternatively you can upgrade to nixpkgs master branch with
#    bin/update-nix.sh

let
  pkgs = import <nixpkgs> { };
  pinnedNixpkgs = pkgs.lib.importJSON ./nixpkgs.json;
in
with import (
  builtins.fetchTarball {
    url = pinnedNixpkgs.url;
    sha256 = pinnedNixpkgs.sha256;
  }
) { };

mkShell rec {
    LC_ALL="en_US.UTF-8";
    buildInputs = [
        coreutils # for consistent command line options across OSes
        curl # bin/update-nix.sh
        gawk # bin/update-nix.sh bin/create-keystore.sh
        git # for potential git nodejs dependencies
        overmind # starting the env for tests and  examples with one command
        entr # monitor file changes
        jq # bin/update-nix.sh bin/solc-combined.sh
        grc # bin/solc-combined.sh -- color compilation errors and warnings
        (if stdenv.isDarwin
         then null
         else python) # compiling nodejs deps, like websocket, keccak, scrypt
        go-ethereum # provides geth
        solc
        nodejs-8_x
    ];

    shellHook = ''
        export PATH="$PATH:$PWD/lib/node_modules/.bin"
        export OVERMIND_CAN_DIE=keystore
        '';
}
