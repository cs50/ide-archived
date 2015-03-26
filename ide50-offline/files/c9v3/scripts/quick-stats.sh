#!/bin/bash -e

gitws() {
	gssh -f -P -q "$HOSTS" '
		hostname >&2
		sudo ls -d /var/lib/docker/aufs/mnt/*/home/ubuntu/workspace/.git 2>/dev/null | wc -l
	' | tr -d '\r'
}

allws() {
	gssh -f -P -q "$HOSTS" '
		hostname >&2
		sudo ls -d /var/lib/docker/aufs/mnt/*/home/ubuntu/workspace 2>/dev/null | wc -l
	' | tr -d '\r'
}

demows() {
	gssh -f -P -q "$HOSTS" '
		hostname >&2
		d9 ps -a | grep demo-project | wc -l
	' | tr -d '\r'
}

sum() {
	local RESULT=0
	while read N; do
		N=${N/\r/}
		if [ "$N" == "" ]; then continue; fi
		RESULT=$((RESULT + N))
	done
	echo $RESULT
}

usage() {
	echo "quick-stats shows some quick & dirty stats about our active users"
	echo
	echo "Usage: quick-stats COMMAND [PATTERN]"
	echo
	echo "COMMAND is one of:"
	echo "  git              number of workspaces that use git"
	echo "  demo-project     number of workspaces called demo-project"
	echo
	echo
	echo "PATTERN is a gssh pattern (default: docker-prod)"
}

reportresults() {
	local MATCHING=$1

	echo "Determining total workspaces considered..."
	local TOTAL=`allws | sum`
	echo

	echo "Projects considered:  $TOTAL"
	echo "Projects matching:    $MATCHING"
	echo "Percentage:           $((100 * MATCHING / TOTAL))%"
}

HOSTS=${2:-docker-prod}

case "$1" in
	git)
		echo "Determining matching workspaces..."
		MATCHING=`gitws | sum`
		echo
		reportresults $MATCHING
		;;

	demo-project)
		echo "Determining matching workspaces..."
		MATCHING=`demows | sum`
		echo
		reportresults $MATCHING
		;;

	*)
		usage
		exit 1
esac