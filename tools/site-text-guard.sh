#!/bin/sh
# The site's text guard's hook (apps/site/index.md, whose words): what
# cella's and the workshop's .claude/settings.json run before every tool
# call. It finds a node, on the path or where NixOS keeps one, without
# starting nix, and runs tools/site-text-guard.mjs with it. Finding none,
# it refuses only an Edit, Write, MultiEdit or NotebookEdit whose path
# lies under apps/site/src/content, read from the hook's JSON with the
# shell's builtins alone, and passes every shell command, the rule
# holding those.
#
#   sh tools/site-text-guard.sh < <hook input>

guard="${0%/*}/site-text-guard.mjs"
for node in "$(command -v node 2>/dev/null)" /run/current-system/sw/bin/node \
	"/etc/profiles/per-user/$USER/bin/node" "$HOME/.nix-profile/bin/node"; do
	[ -n "$node" ] && [ -x "$node" ] && exec "$node" "$guard"
done

input=
while IFS= read -r line || [ -n "$line" ]; do input="$input$line "; done

# The string value of the first field named $1, up to its closing quote.
field() {
	v=${input#*\"$1\"}
	[ "$v" = "$input" ] && return 1
	v=${v#"${v%%[!:	 ]*}"}
	case $v in \"*) v=${v#\"} ;; *) return 1 ;; esac
	printf '%s' "${v%%\"*}"
}

case $(field tool_name) in
Edit | Write | MultiEdit | NotebookEdit) ;;
*) exit 0 ;;
esac
file=$(field file_path) || file=$(field notebook_path) || exit 0
text=apps/site/src/content
case $file in
"$text" | "$text"/* | */"$text" | */"$text"/*)
	echo "The site's text is the operator's, and no agent writes it: $(field tool_name) writes $file. Change the site's structure or its components instead, and say in your entry's Flag what its text needs; the operator writes it (AGENTS.md; apps/site/index.md, whose words)." >&2
	exit 2
	;;
esac
exit 0
