#!/usr/bin/env -S bash -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <font-name>" >&2
    exit 1
fi

font_name="$1"
font_url_safe="${font_name// /+}"
css_url="https://fonts.googleapis.com/css2?family=${font_url_safe}&text=0123456789"

css=$(curl -sS -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "$css_url")

woff2_url=$(echo "$css" | grep -oE "url\([^)]+\) format\('woff2'\)" | grep -oE "https://[^)]+")

if [[ -z "$woff2_url" ]]; then
    echo "Error: Could not find WOFF2 URL in CSS" >&2
    exit 1
fi

woff2_data=$(curl -sS "$woff2_url" | base64 | tr -d '\n')

const_name="${font_name^^}"
const_name="${const_name// /_}"
echo "export const ${const_name}_DIGITS_WOFF2 ="
echo "    \"${woff2_data}\";"
