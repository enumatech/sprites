#!/usr/bin/env bash

in="$@"
out=./out/out.json
err=./out/err.txt
new=./out/contracts.json
now=$(date +%H:%M:%S)

cd $(dirname "$0")/..
test -d ./out || mkdir -p ./out
test -f $out -o -f $err && rm -f $out $err

solc --combined-json=abi,bin $in 2>$err  | jq . >$out
exitcode="$?"

echo -ne "\n$now "

if [ "$exitcode" -eq 0 ]; then
    contract_names=$(jq -j '.contracts|keys|join(" ")' $out)
    echo "Success"
    echo "  $contract_names"
    cp $out $new
else
    echo "Fail"
fi

# stderr might contain warnings only
test -s $err && (echo; cat $err | grcat bin/.solc-colors) > /dev/stderr
exit $exitcode
