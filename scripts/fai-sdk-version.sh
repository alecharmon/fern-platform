latest_tag=$(git tag -l "fai-sdk@*" --sort=-v:refname | head -n1)

hash=$(git describe --always --first-parent)

result="$(echo "$latest_tag" | sed 's/^fai-sdk@//;')"

echo "$result"-"$hash"
