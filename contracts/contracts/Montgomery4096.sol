// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Fixed 4096-bit Montgomery multiplication, used for Paillier products modulo n^2.
library Montgomery4096 {
    uint256 internal constant K = 16;

    function mulMod(
        uint256[16] memory a,
        uint256[16] memory b,
        uint256[16] memory m,
        uint256 m0inv,
        uint256[16] memory r2
    ) internal pure returns (uint256[16] memory) {
        uint256[16] memory aR = montMul(a, r2, m, m0inv);
        return montMul(aR, b, m, m0inv);
    }

    function montMul(
        uint256[16] memory a,
        uint256[16] memory b,
        uint256[16] memory m,
        uint256 m0inv
    ) internal pure returns (uint256[16] memory result) {
        uint256[18] memory t;
        for (uint256 i = 0; i < K; ) {
            uint256 carry = 0;
            for (uint256 j = 0; j < K; ) {
                (t[j], carry) = mac(t[j], carry, a[j], b[i]);
                unchecked {
                    j++;
                }
            }
            (t[K], carry) = addWord(t[K], carry);
            t[K + 1] = carry;

            carry = 0;
            uint256 u;
            uint256 t0 = t[0];
            assembly {
                u := mul(t0, m0inv)
            }
            for (uint256 j = 0; j < K; ) {
                (t[j], carry) = mac(t[j], carry, m[j], u);
                unchecked {
                    j++;
                }
            }
            (t[K], carry) = addWord(t[K], carry);
            t[K + 1] += carry;

            for (uint256 j = 0; j < K + 1; ) {
                t[j] = t[j + 1];
                unchecked {
                    j++;
                }
            }
            t[K + 1] = 0;
            unchecked {
                i++;
            }
        }

        for (uint256 i = 0; i < K; ) {
            result[i] = t[i];
            unchecked {
                i++;
            }
        }
        if (t[K] != 0 || gte(result, m)) {
            result = sub(result, m);
        }
    }

    function mac(uint256 acc, uint256 carry, uint256 x, uint256 y) private pure returns (uint256 lo, uint256 hi) {
        assembly {
            let mm := mulmod(x, y, not(0))
            let pLo := mul(x, y)
            let pHi := sub(sub(mm, pLo), lt(mm, pLo))
            lo := add(acc, pLo)
            let c := lt(lo, acc)
            lo := add(lo, carry)
            c := add(c, lt(lo, carry))
            hi := add(pHi, c)
        }
    }

    function addWord(uint256 a, uint256 b) private pure returns (uint256 lo, uint256 hi) {
        assembly {
            lo := add(a, b)
            hi := lt(lo, a)
        }
    }

    function gte(uint256[16] memory a, uint256[16] memory b) private pure returns (bool) {
        for (uint256 i = K; i > 0; ) {
            unchecked {
                i--;
            }
            if (a[i] > b[i]) return true;
            if (a[i] < b[i]) return false;
        }
        return true;
    }

    function sub(uint256[16] memory a, uint256[16] memory b) private pure returns (uint256[16] memory r) {
        uint256 borrow;
        for (uint256 i = 0; i < K; ) {
            uint256 ai = a[i];
            uint256 bi = b[i];
            unchecked {
                r[i] = ai - bi - borrow;
                if (borrow == 0) {
                    borrow = ai < bi ? 1 : 0;
                } else {
                    borrow = ai <= bi ? 1 : 0;
                }
                i++;
            }
        }
    }
}
