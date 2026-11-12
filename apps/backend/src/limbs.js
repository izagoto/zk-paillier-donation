const MASK = (1n << 256n) - 1n;
const LIMBS = 16;
const R = 1n << 4096n;

export function limbsFromBigint(value) {
  if (value < 0n || value >= R) {
    throw new RangeError("nilai di luar 4096 bit");
  }
  const limbs = [];
  let rest = value;
  for (let i = 0; i < LIMBS; i++) {
    limbs.push(rest & MASK);
    rest >>= 256n;
  }
  return limbs;
}

export function bigintFromLimbs(limbs) {
  let value = 0n;
  for (let i = LIMBS - 1; i >= 0; i--) {
    value = (value << 256n) + BigInt(limbs[i]);
  }
  return value;
}

function inverseMod256(odd) {
  let inverse = 1n;
  for (let i = 0; i < 8; i++) {
    inverse = (inverse * (2n - ((odd * inverse) & MASK))) & MASK;
  }
  return inverse;
}

export function montgomeryParams(modulus) {
  const low = modulus & MASK;
  const m0inv = (MASK + 1n - inverseMod256(low)) & MASK;
  const r2 = (R * R) % modulus;
  return {
    modulus,
    m0inv,
    r2: limbsFromBigint(r2),
    modulusLimbs: limbsFromBigint(modulus),
  };
}

export function encryptZero(publicKey) {
  return publicKey.encrypt(0n);
}
