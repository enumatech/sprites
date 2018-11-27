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
        coreutils
        curl
        git
        go-ethereum
        overmind
        solc
        jq
        grc
        entr
        nodejs-8_x
    ];

    shellHook = ''
        export PATH="$PATH:$PWD/lib/node_modules/.bin"
        '';
}
