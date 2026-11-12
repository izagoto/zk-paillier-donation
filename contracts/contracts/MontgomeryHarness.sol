// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./Montgomery4096.sol";

contract MontgomeryHarness {
    function mulMod(
        uint256[16] calldata a,
        uint256[16] calldata b,
        uint256[16] calldata m,
        uint256 m0inv,
        uint256[16] calldata r2
    ) external pure returns (uint256[16] memory) {
        return Montgomery4096.mulMod(copy(a), copy(b), copy(m), m0inv, copy(r2));
    }

    function copy(uint256[16] calldata input) private pure returns (uint256[16] memory output) {
        for (uint256 i = 0; i < 16; i++) {
            output[i] = input[i];
        }
    }
}
