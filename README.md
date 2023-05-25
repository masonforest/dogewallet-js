DogeWallet
===========

Dogewallet is a secure dogecoin wallet implementation built in pure JavaScript. Doge wallet leverages the [Noble Crypto libraries](https://github.com/paulmillr/noble-secp256k1) for cryptographic primatives.

Usage
------


```javascript
import * as secp from "@noble/secp256k1";
import axios from "axios";
import {
  addressFromPublicKey,
  createSignedTransaction,
  CHAIN_IDS,
} from "doge-wallet";
import {hexToBytes, bytesToHex} from "@noble/hashes/utils";

async function getBalance(address) {
  const res = await axios.get(
    `https://api.blockcypher.com/v1/doge/main/addrs/${address}?unspentOnly=true)`
  );
  return res.data.balance / 10 ** 8;
}

async function getUnspentTransationOutputs(address) {
  const res = await axios.get(
    `https://api.blockcypher.com/v1/doge/main/addrs/${address}?unspentOnly=true&includeScript=true`
  );
  return res.data.txrefs.map(({tx_hash, tx_output_n, script, value}, i) => {
    return {
      hash: hexToBytes(tx_hash).reverse(),
      index: tx_output_n,
      script: hexToBytes(script),
      value: BigInt(parseInt(value)),
    };
  });
}
(async () => {
  // Save you private key somewhere safe!
  let privateKey = secp.utils.randomPrivateKey();
  const publicKey = secp.getPublicKey(privateKey);
  const address = await addressFromPublicKey(CHAIN_IDS.DOGE, publicKey);
  // Print out your new Dogecoin address
  // Dogecoin addresses start with a capital D

  console.log(address)

  // For example

  // D93TkhsqBZMtFXYefNQiye1ZMkFVR2tjSJ

  // Now send yourself some tokens a wait a minute or so

  // Check your balance via the BlockCypher API
  //

  console.log(await getBalance(address));

  // Send some doge to your buddy!
  const recipientAddress = "D93TkhsqBZMtFXYefNQiye1ZMkFVR2tjSJ";

  // First get unspent transaction outputs (these are kinda like coins in your wallet)
  const unspentTransationOutputs = await getUnspentTransationOutputs(address);
  const signedTransation = await createSignedTransaction({
    chainId: CHAIN_IDS.DOGE,
    unspentTransationOutputs,
    recipientAddress,
    value: BigInt(1 * 10 ** 8),
    privateKey,
  });

  // Print your sigend transaction in hex format.
  // Youn can either copy and paste this into the
  // [Block Cypher Broacast Transaction Tool](https://live.blockcypher.com/doge/pushtx/) 
  // Or send it to a Dogecoin node via [sendrawtransaction](https://developer.bitcoin.org/reference/rpc/sendrawtransaction.html)
  console.log(bytesToHex(signedTransation));

})();
```
