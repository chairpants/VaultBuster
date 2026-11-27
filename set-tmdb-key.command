#!/bin/zsh
# Ask for the TMDB key in a dialog, check it with TMDB, keep it in the login
# Keychain, and have new terminals load it as TMDB_API_KEY (what
# fetch-covers.mjs and fetch-mv-covers.mjs read). Double-click in Finder, or
# run ./set-tmdb-key.command. Run again to replace the key.

key=$(osascript <<'OSA' 2>/dev/null
try
  set r to display dialog "Paste your TMDB API key (v3 key or v4 read access token).

It is kept in your login Keychain, not in any repo." default answer "" with hidden answer with title "TMDB API key" buttons {"Cancel", "Save"} default button "Save"
  return text returned of r
on error
  return ""
end try
OSA
)
key=${key//[[:space:]]/}
if [[ -z $key ]]; then echo "cancelled, nothing saved"; exit 1; fi

# check it before keeping it: a long token is a v4 bearer token, else a v3 key
if (( ${#key} > 40 )); then
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $key" https://api.themoviedb.org/3/configuration)
else
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://api.themoviedb.org/3/configuration?api_key=$key")
fi
if [[ $code != 200 ]]; then
  osascript -e 'display alert "TMDB did not accept that key" message "Nothing was saved. Check the key and try again." as critical' >/dev/null
  echo "TMDB rejected the key (HTTP $code); nothing saved"; exit 1
fi

security add-generic-password -U -a "$USER" -s TMDB_API_KEY -w "$key" || { echo "couldn't write to the Keychain"; exit 1; }

line='export TMDB_API_KEY="$(security find-generic-password -a "$USER" -s TMDB_API_KEY -w 2>/dev/null)"'
if ! grep -qsF 'find-generic-password -a "$USER" -s TMDB_API_KEY' ~/.zshrc; then
  printf '\n# TMDB key for VaultBuster cover scripts (kept in Keychain; set-tmdb-key.command)\n%s\n' "$line" >> ~/.zshrc
  added=" and added the loader to ~/.zshrc"
fi

osascript -e 'display alert "TMDB key saved" message "It is in your login Keychain. New terminals will have TMDB_API_KEY set."' >/dev/null
echo "saved to the Keychain${added}. Open a new terminal (or: source ~/.zshrc) to use it."
