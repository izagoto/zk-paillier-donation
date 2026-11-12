#!/bin/sh
set -eu

cd "$(dirname "$0")"
mkdir -p build

circom identity.circom --r1cs --wasm --sym -l node_modules -o build

if [ ! -f build/pot12_final.ptau ]; then
  npx snarkjs powersoftau new bn128 12 build/pot12_0000.ptau -v
  npx snarkjs powersoftau contribute build/pot12_0000.ptau build/pot12_0001.ptau --name="local" -v -e="donation-local-tau"
  npx snarkjs powersoftau prepare phase2 build/pot12_0001.ptau build/pot12_final.ptau -v
fi

npx snarkjs groth16 setup build/identity.r1cs build/pot12_final.ptau build/identity_0000.zkey
npx snarkjs zkey contribute build/identity_0000.zkey build/identity_final.zkey --name="local" -v -e="donation-local-zkey"
npx snarkjs zkey export verificationkey build/identity_final.zkey build/verification_key.json
npx snarkjs zkey export solidityverifier build/identity_final.zkey ../contracts/contracts/IdentityVerifier.sol

echo "setup selesai"
