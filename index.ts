declare const globalThis: Record<string, any> | undefined;
const cr = () =>
  typeof globalThis === 'object' && 'crypto' in globalThis ? globalThis.crypto : undefined;

import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 as sha256Sync } from '@noble/hashes/sha256';
import { base58check } from '@scure/base';

import { secp256k1 } from '@noble/curves/secp256k1';
import { concatBytes } from '@noble/hashes/utils';

export const CHAIN_IDS = {
  BTC: 0,
  DOGE: 30,
};

export const MAX_SEQUENCE = 0xffffffff;
// https://raghavsood.com/blog/2018/06/10/bitcoin-signature-types-sighash
export const SIGHASH_ALL = 1;
export const BASE_UNIT = 100000000n;
export const FEE_PRICES = {
  fast: 1002n,
  medium: 1001n,
  slow: 1000n,
};

export function encodeTransaction({
  versionByte = 1,
  inputs,
  outputs,
  lockTime = 0,
}: {
  versionByte?: number;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  lockTime?: number;
}): Uint8Array {
  return concatBytes(
    encodeUint32(versionByte),
    encodeArray(inputs.map(encodeInput)),
    encodeArray(outputs.map(encodeOutput)),
    encodeUint32(lockTime)
  );
}

interface TransactionInput {
  hash: Uint8Array;
  index: number;
  script: Uint8Array;
  sequence?: number;
}

interface TransactionOutput {
  value: bigint;
  script: Uint8Array;
}

interface UnspentTransactionOutput {
    hash: Uint8Array;
    index: number;
    value: bigint;
    script: Uint8Array;
}

export function encodeInput(input: TransactionInput): Uint8Array {
  const { hash, index, script, sequence = MAX_SEQUENCE } = input;
  return concatBytes(hash, encodeUint32(index), encodeBytes(script), encodeUint32(sequence));
}

export function encodeOutput(output: TransactionOutput): Uint8Array {
  return concatBytes(encodeUint64(output.value), encodeBytes(output.script));
}

export function calculateFee({
  inputs,
  outputs,
  speed,
}: {
  inputs: any[];
  outputs: any[];
  speed: keyof typeof FEE_PRICES;
}): bigint {
  return transactionSize({ inputs, outputs }) * BigInt(FEE_PRICES[speed]);
}

const transactionSize = ({ inputs, outputs }: { inputs: any[]; outputs: any[] }): bigint => {
  return BigInt(inputs.length * 150 + outputs.length * 40);
};

export const OPERATIONS = {
  OP_DUP: 0x76,
  OP_EQUALVERIFY: 0x88,
  OP_HASH160: 0xa9,
  OP_CHECKSIG: 0xac,
};

export const standardTransactionScript = (publicKeyHash: Uint8Array): Uint8Array =>
  encodeScript(
    OPERATIONS.OP_DUP,
    OPERATIONS.OP_HASH160,
    publicKeyHash,
    OPERATIONS.OP_EQUALVERIFY,
    OPERATIONS.OP_CHECKSIG
  );

export async function createSignedTransaction({
  chainId,
  unspentTransationOutputs,
  recipientAddress,
  privateKey,
  value,
  fee,
  speed = 'fast',
  minimumDust = BASE_UNIT / 10n,
}: {
  chainId: number;
  unspentTransationOutputs: Array<UnspentTransactionOutput>;
  recipientAddress: string;
  privateKey: Uint8Array;
  value: bigint;
  fee?: bigint;
  speed?: keyof typeof FEE_PRICES;
  minimumDust?: bigint;
}): Promise<Uint8Array> {
  const inputs = unspentTransationOutputs;
  const inputAmount = inputs.reduce((accumulator, currentValue) => {
    return accumulator + BigInt(currentValue.value);
  }, BigInt(0));
  const publicKey = await secp256k1.getPublicKey(privateKey, true);
  const changeAddress = await addressFromPublicKey(chainId, publicKey);
  const outputs = [
    {
      script: standardTransactionScript(addressToPublicKeyHash(recipientAddress)),
      value,
    },
  ];
  fee ??= calculateFee({ inputs, outputs, speed });
  const changeAmount = inputAmount - value - fee;
  if (changeAmount > minimumDust) {
    outputs.push({
      script: standardTransactionScript(addressToPublicKeyHash(changeAddress)),
      value: changeAmount,
    });
  }
  let transaction = {
    chainId,
    inputs,
    outputs,
  };

  transaction.inputs = await Promise.all(
    transaction.inputs.map((input, inputIndex) =>
      signInput(input, inputIndex, transaction, privateKey)
    )
  );

  return encodeTransaction(transaction);
}

async function signInput(
  inputToSign: {
    hash: Uint8Array;
    script: Uint8Array;
    index: number;
    value: bigint;
  },
  inputToSignIndex: number,
  transaction: {
    chainId: number;
    inputs: Array<{
      hash: Uint8Array;
      value: bigint;
      script: Uint8Array;
      index: number;
    }>;
    outputs: Array<{
      script: Uint8Array;
      value: bigint;
    }>;
  },
  privateKey: Uint8Array
): Promise<{
  hash: Uint8Array;
  script: Uint8Array;
  index: number;
  value: bigint;
}> {
  // Set the script of all the other inputs to empty arrays
  // ¯\_(ツ)_/¯
  // https://bitcoin.stackexchange.com/a/41226

  const signableTransaction = {
    ...transaction,
    inputs: transaction.inputs.map((input, inputIndex) => {
      if (inputIndex === inputToSignIndex) {
        return input;
      } else {
        return {
          ...input,
          script: new Uint8Array([]),
        };
      }
    }),
  };

  var messageHash = await doubleSha256(
    concatBytes(encodeTransaction(signableTransaction), encodeUint32(SIGHASH_ALL))
  );
  const signature = (
    await secp256k1.sign(messageHash, privateKey, {
      lowS: true,
    })
  ).toDERRawBytes();
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  return {
    ...inputToSign,
    script: concatBytes(
      encodeBytes(concatBytes(signature, encodeCompactSizeUint(SIGHASH_ALL))),
      encodeBytes(publicKey)
    ),
  };
}
// https://en.bitcoin.it/wiki/Technical_background_of_version_1_Bitcoin_addresses
export async function addressFromPublicKey(
  chainId: number,
  publicKey: Uint8Array
): Promise<string> {
  if (publicKey.length !== 33) throw new Error('publicKey must be in compressed 33 bytes format');
  return base58check(sha256Sync).encode(
    concatBytes(new Uint8Array([chainId]), await publicKeyHash(publicKey))
  );
}

export async function publicKeyHash(publicKey: Uint8Array) {
  return ripemd160(await sha256(publicKey));
}

export async function doubleSha256(data: Uint8Array): Promise<Uint8Array> {
  return sha256(await sha256(data));
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const crypto = cr();
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

export function numberToSatoshis(n: number): bigint {
  return BigInt(n * 100000000);
}

export function addressToPublicKeyHash(address: string): Uint8Array {
  return base58check(sha256Sync).decode(address).slice(1);
}

function encodeUint64(n: bigint): Uint8Array {
  const arr = new ArrayBuffer(8);
  const view = new DataView(arr);
  view.setBigUint64(0, n, true);
  return new Uint8Array(arr);
}

function encodeUint32(n: number): Uint8Array {
  const arr = new ArrayBuffer(4);
  const view = new DataView(arr);
  view.setUint32(0, n, true);
  return new Uint8Array(arr);
}

function encodeBytes(bytes: Uint8Array): Uint8Array {
  return concatBytes(encodeCompactSizeUint(bytes.length), bytes);
}

export function encodeCompactSizeUint(n: number | bigint): Uint8Array {
  const length = n <= 0xfc ? 1 : n <= 0xffff ? 3 : n <= 0xffffffff ? 5 : 9;
  const buffer = new ArrayBuffer(length);
  const dataview = new DataView(buffer);
  if (n <= 0xfc && typeof n === 'number') {
    const array = new Uint8Array(length);
    array[0] = n;
    return array;
  } else if (n <= 0xffff) {
    dataview.setUint8(0, 0xfd);
    dataview.setUint16(1, Number(n));
    return new Uint8Array(dataview.buffer);
  } else if (n <= 0xffffffff) {
    dataview.setUint8(0, 0xfe);
    dataview.setUint32(1, Number(n));
    return new Uint8Array(dataview.buffer);
  } else {
    dataview.setUint8(0, 0xff);
    dataview.setBigUint64(1, BigInt(n));
    return new Uint8Array(dataview.buffer);
  }
}

function encodeScript(...items: Array<number | Uint8Array>): Uint8Array {
  return concatBytes(
    ...items.map((item) => {
      if (typeof item === 'number') {
        return encodeCompactSizeUint(item);
      } else {
        return encodeBytes(item);
      }
    })
  );
}

function encodeArray(items: Array<Uint8Array>): Uint8Array {
  return concatBytes(encodeCompactSizeUint(items.length), ...items);
}
