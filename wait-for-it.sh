#!/bin/sh
# wait-for-it.sh
# Usage: ./wait-for-it.sh host:port [-t timeout] [-- command args]

set -e

host="$1"
shift
timeout=15

while [ $# -gt 0 ]; do
    case "$1" in
        -t)
        timeout="$2"
        shift 2
        ;;
        --)
        shift
        break
        ;;
        *)
        echo "Usage: $0 host:port [-t timeout] [-- command args]"
        exit 1
        ;;
    esac
done

command="$@"

echo "Waiting for $host... (timeout: ${timeout}s)"

for i in `seq $timeout`; do
    nc -z `echo $host | sed 's/:/ /'` >/dev/null 2>&1
    result=$?
    if [ $result -eq 0 ]; then
        echo "Host $host is available."
        exec $command
    fi
    sleep 1
done

echo "Timeout waiting for $host"
exit 1