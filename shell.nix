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
        nodePackages_8_x.pnpm
    ];

    shellHook = ''
        export PATH="$PATH:$PWD/merchant/node_modules/.bin"
        print_module_version="console.log(process.versions.modules)"
        export npm_config_store=''${NPM_STORE_PREFIX-$HOME}/.pnpm-store-abi-$(${nodejs-8_x}/bin/node -e $print_module_version)
        '';
}
