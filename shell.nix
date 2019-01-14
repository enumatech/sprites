let
  pkgs = import <nixpkgs> { };
  # Update pinned nix package tree version with `bin/update-nix.sh`
  pinnedNixpkgs = pkgs.lib.importJSON ./nixpkgs.json;
in
with import (
  builtins.fetchTarball {
    url = pinnedNixpkgs.url;
    sha256 = pinnedNixpkgs.sha256;
  }
) { };

mkShell rec {
    buildInputs = [
        coreutils # for consistent command line options across OSes
        curl # bin/update-nix.sh
        gawk # bin/update-nix.sh bin/create-keystore.sh
        git # for potential git nodejs dependencies
        overmind # starting the env for tests and  examples with one command
        entr # monitor file changes
        jq # bin/update-nix.sh bin/solc-combined.sh
        grc # bin/solc-combined.sh -- color compilation errors and warnings
        go-ethereum # provides geth
        solc
        nodejs-10_x
        nodePackages_10_x.yarn
    ] ++
    # compiling nodejs deps, like websocket, keccak, scrypt
    (if stdenv.isDarwin
     then []
     else [python glibcLocales]);

    shellHook = ''
        export PATH="$PATH:$PWD/node_modules/.bin"
        export OVERMIND_CAN_DIE=keystore
        # export TEST_CHAIN=ipc:$(realpath ./test-chain.ipc)
        '';
}
