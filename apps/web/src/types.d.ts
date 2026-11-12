declare module "snarkjs" {
  export const groth16: {
    fullProve: (
      input: Record<string, string>,
      wasm: string,
      zkey: string,
    ) => Promise<{ proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] }; publicSignals: string[] }>;
  };
}

declare module "circomlibjs" {
  export function buildPoseidon(): Promise<{
    F: { toObject: (value: unknown) => bigint };
    (input: bigint[]): unknown;
  }>;
}

declare module "paillier-bigint" {
  export class PublicKey {
    constructor(n: bigint, g: bigint);
    encrypt(value: bigint): bigint;
  }
}
