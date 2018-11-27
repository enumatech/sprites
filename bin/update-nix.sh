#!/usr/bin/env nix-shell
#! nix-shell -i bash -p curl jq nix
set -euxo pipefail

### Use nixpkgs master tarball from github
#commit_sha=$(curl 'https://api.github.com/repos/nixos/nixpkgs/commits?sha=master' | jq -r 'first.sha')
#url="https://github.com/nixos/nixpkgs/archive/${commit_sha}.tar.gz"

export NIXPKGS='https://nixos.org/channels/nixpkgs-unstable/nixexprs.tar.xz'
url=$(curl -sI $NIXPKGS | gawk 'BEGIN{RS="\r?\n"} /Location:/ {print $2}')
digest=$(nix-prefetch-url --unpack "$url")
echo "{\"url\": \"${url}\", \"sha256\": \"${digest}\"}" | jq '.' > $(dirname $0)/../nixpkgs.json
