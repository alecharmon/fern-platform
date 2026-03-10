#!/bin/bash

# Show what is currently running on all ports used by `pnpm fdr:dev`
#
# Ports:
#   3100  auth0-mock
#   4566  localstack (SQS)
#   5432  fdr-postgres
#   5433  venus-postgres
#   6379  redis
#   8078  edge-config mock
#   8079  upstash REST mock
#   8080  FDR server (host)
#   8081  redis-commander
#   8089  venus
#   9001  python library docs parser
#   9002  cpp library docs parser
#   9090  s3-mock (API)
#   9191  s3-mock (UI)

PORT_LABELS=(
    "3100:auth0-mock"
    "4566:localstack"
    "5432:fdr-postgres"
    "5433:venus-postgres"
    "6379:redis"
    "8078:edge-config-mock"
    "8079:upstash-mock"
    "8080:fdr-server"
    "8081:redis-commander"
    "8089:venus"
    "9001:python-parser"
    "9002:cpp-parser"
    "9090:s3-mock-api"
    "9191:s3-mock-ui"
)

echo "FDR dev ports status:"
echo ""
printf "%-6s  %-20s  %-8s  %s\n" "PORT" "SERVICE" "STATUS" "PID / PROCESS"
printf "%-6s  %-20s  %-8s  %s\n" "------" "--------------------" "--------" "-------------------------"

for entry in "${PORT_LABELS[@]}"; do
    PORT="${entry%%:*}"
    LABEL="${entry#*:}"

    INFO=$(lsof -i :"$PORT" -sTCP:LISTEN -P -n 2>/dev/null | tail -n +2 | head -1)
    if [ -n "$INFO" ]; then
        PID=$(echo "$INFO" | awk '{print $2}')
        PROC=$(echo "$INFO" | awk '{print $1}')
        printf "%-6s  %-20s  %-8s  %s\n" "$PORT" "$LABEL" "IN USE" "PID $PID ($PROC)"
    else
        printf "%-6s  %-20s  %-8s  %s\n" "$PORT" "$LABEL" "free" "-"
    fi
done
