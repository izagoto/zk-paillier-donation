pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

// Tahap A. Amount stays private. The only public signal is the commitment.
template Identity() {
    signal input secret;
    signal input amount;
    signal input commitment;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== secret;
    commitment === hasher.out;

    // 1 <= amount <= 1000000000. Forty bits covers the upper bound.
    component atLeastOne = GreaterEqThan(40);
    atLeastOne.in[0] <== amount;
    atLeastOne.in[1] <== 1;
    atLeastOne.out === 1;

    component atMostCap = LessEqThan(40);
    atMostCap.in[0] <== amount;
    atMostCap.in[1] <== 1000000000;
    atMostCap.out === 1;
}

component main {public [commitment]} = Identity();
