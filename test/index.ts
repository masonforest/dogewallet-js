import * as dogeWallet from '..';
import { hexToBytes, bytesToHex as hex } from '@noble/hashes/utils';
const assert = require("assert")
const { numberToSatoshis } = dogeWallet;
const { CHAIN_IDS } = dogeWallet;


const EMPTY_BYTES = new Uint8Array(32)
describe('dogeWallet', () => {

describe("createSignedTransaction", function () {
  it("creates a signed bitcoin transaction", async function () {
    const privateKey = hexToBytes(`0ecd20654c2e2be708495853e8da35c664247040c00bd10b9b13e5e86e6a808d`);
    const signedTransation = await dogeWallet.createSignedTransaction({
      chainId: CHAIN_IDS.BTC,
      unspentTransationOutputs: [
        {
          index: 0,
          hash: hexToBytes(`be66e10da854e7aea9338c1f91cd489768d1d6d7189f586d7a3613f2a24d5396`),
          script: hexToBytes(`76a914dd6cce9f255a8cc17bda8ba0373df8e861cb866e88ac`),
          value: 1n
        },
      ],
      recipientAddress: "14zWNsgUMmHhYx4suzc2tZD6HieGbkQi5s",
      value: numberToSatoshis(0.00118307),
      privateKey,
    });
    assert.deepStrictEqual(
      signedTransation, hexToBytes(`0100000001be66e10da854e7aea9338c1f91cd489768d1d6d7189f586d7a3613f2a24d5396000000006a4730440220587ce0cf0252e2db3a7c3c91b355aa8f3385e128227cd8727c5f7777877ad7720220123af7483eb76e12ea54c73978fe627fffb91bbda6797e938147790e43ee57e50121032daa93315eebbe2cb9b5c3505df4c6fb6caca8b756786098567550d4820c09dbffffffff0123ce0100000000001976a9142bc89c2702e0e618db7d59eb5ce2f0f147b4075488ac00000000`))
  });
  it('.doubleSha256()', async () => {
    const expectedDoubleSha256 = hexToBytes('2b32db6c2c0a6235fb1397e8225ea85e0f0e6e8c7b126d0016ccbde0e667151e')
    assert.deepStrictEqual(await dogeWallet.doubleSha256(EMPTY_BYTES), expectedDoubleSha256)
  });
})

describe("addressFromPublicKey", function () {
  describe("Bitcoin", function () {
    it("should return the public key's address", async function () {
      const publicKey = Buffer.from(
        "02a5613bd857b7048924264d1e70e08fb2a7e6527d32b7ab1bb993ac59964ff397",
        "hex"
      );
      assert.equal(
        await dogeWallet.addressFromPublicKey(CHAIN_IDS.BTC, publicKey),
        "1FoG2386FG2tAJS9acMuiDsKy67aGg9MKz"
      );
    });
  });

  describe("Dogecoin", function () {
    it("should return the public key's address", async function () {
      const publicKey = Buffer.from(
        "02a5613bd857b7048924264d1e70e08fb2a7e6527d32b7ab1bb993ac59964ff397",
        "hex"
      );
      assert.equal(
        await dogeWallet.addressFromPublicKey(CHAIN_IDS.DOGE, publicKey),
        "DKwMZJ4jYfwAhJckKCMUFz2vrDqscXPMxB"
      );
    });
  });
});
});
