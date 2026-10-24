#!/usr/bin/env bash
# Symbolic analysis of the policies with Cedar's SymCC (cvc5 underneath):
# each question holds for every possible entity store the schema allows.
set -u
here=$(dirname "$0")
cedar=${CEDAR:-cedar}
q() {
  echo "## $1"
  "$cedar" symcc -f plain --schema "$here/lanterne.cedarschema" \
    --principal-type Member --action "Action::\"$2\"" --resource-type "$3" \
    implies --policies1 "$here/policies.cedar" --policies2 "$here/queries/$4" 2>&1
  echo
}
q "Can anyone outside operations pay a supplier? (policies imply only-operations-pays)" pay_supplier Org only-operations-pays.cedar
q "Can anyone pay a supplier more than 20 000 €? (policies imply no-payment-above-20k)" pay_supplier Org no-payment-above-20k.cedar
q "Can a non-member of the AG vote in an AG decision? (policies imply only-ag-votes-in-ag)" vote Decision only-ag-votes-in-ag.cedar
