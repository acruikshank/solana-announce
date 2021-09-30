
import { Account, Connection, PublicKey, SystemProgram, TransactionInstruction, Transaction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { deserializeHAMTNode, serializeAnnounceInstruction, AnnounceStateSize, HAMTNodeSize } from "./serialization.mjs";
import { Command } from "commander";
import { getRoot, dumpNode, lookup } from "./hamt.mjs";
import *  as base58 from "bs58";

const signerAccount = new Account(new Uint8Array([149,168,13,129,58,167,135,27,13,110,187,205,6,188,154,160,82,29,39,200,148,195,206,89,13,131,153,191,184,142,120,230,194,24,225,115,139,94,5,229,29,100,181,252,131,252,216,9,52,157,37,41,105,24,126,215,92,147,246,6,237,247,255,212]));
const programID = new PublicKey("4xTvGbGnJxJeZjbMECmBPPCuzdb3ZYyHG3hTbQk3V5rZ");
const connection = new Connection("http://localhost:8899", 'singleGossip');
// state address: FR1pAtrqDE4opTrLPsZQCWcN4YDkwEpEeozJYSeBwVf9
/**
 * Init HAMT
 * Initialize a new HAMT with a program state account and root node.
 * Outputs the HAMT address which identified the HAMT instance for future calls.
 */
const init = async () => {
  const stateAccount = new Account();
  const createProgramAccountIx = SystemProgram.createAccount({
    space: AnnounceStateSize,
    lamports: await connection.getMinimumBalanceForRentExemption(AnnounceStateSize, 'singleGossip'),
    fromPubkey: signerAccount.publicKey,
    newAccountPubkey: stateAccount.publicKey,
    programId: programID
  });

  const initIx = new TransactionInstruction({
    programId: programID,
    keys: [
        { pubkey: signerAccount.publicKey, isSigner: true, isWritable: false },
        { pubkey: stateAccount.publicKey, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
    ],
    data: Buffer.from([0]),
  })
  const tx = new Transaction().add(createProgramAccountIx, initIx);
  let str = await connection.sendTransaction(tx, [signerAccount, stateAccount], {skipPreflight: false, preflightCommitment: 'singleGossip'});

  console.log("State Address:", stateAccount.publicKey.toBase58());
  process.exit(0)
}

/**
 * Announce a batch
 * @param stateAddress - state address of Announcement Program state
 * @param url url of the announcement
 * @param hash hash of the announcement content
 */
const announce = async (stateAddress, url, hash) => {
  const announcementSize = 32 + 4 + url.length + 32;
  // get id of state account
  // get url & hash (from cli)
  // create a new account (node)
  // set instruction data  (serialized)
  //
  const announcementAccount = new Account();
  const createAnnouncementAccountIx = SystemProgram.createAccount({
    space: announcementSize,
    lamports: await connection.getMinimumBalanceForRentExemption(announcementSize, 'singleGossip'),
    fromPubkey: signerAccount.publicKey,
    newAccountPubkey: announcementAccount.publicKey,
    programId: programID
  });
  const hashBytes = base58.default.decode(hash)

  const keys = [
    { pubkey: signerAccount.publicKey, isSigner: true, isWritable: false },
    { pubkey: stateAddress, isSigner: false, isWritable: true }, // writable so we can increment the index and set the root (head)
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
    { pubkey: announcementAccount, isSigner: false, isWritable: true },
  ]

  const setIx = new TransactionInstruction({
    programId: programID,
    keys,
    data: serializeAnnounceInstruction(url, hashBytes),
  })

  const tx = new Transaction().add(createAnnouncementAccountIx, setIx);
  console.log("Sending Transaction")
  try {
    const txSignature = await connection.sendTransaction(
        tx,
        [signerAccount, announcementAccount],
        {skipPreflight: false, preflightCommitment: 'singleGossip'});

    console.log("Transaction:", txSignature)

    await connection.confirmTransaction(txSignature)
    const result = await connection.getTransaction(txSignature, {commitment: 'confirmed'})
    console.log({result})
  } catch (e) {
    console.trace(e)
  }
  process.exit(0);
}

/**
 * Get value from hamt
 * Outputs value on stdout if found. Otherwis exits with code 1.
 * @param hamt address of hamt program state
 * @param key string key to fetch
 */
const getAnnouncements = async (hamt, key) => {
  const result = await lookup(connection, new PublicKey(hamt), key);

  if (result.value === undefined) {
    process.exit(1);
  } else {
    console.log(result.value.toString())
    process.exit(0);
  }
}

/**
 * Get value from hamt
 * Outputs value on stdout if found. Otherwis exits with code 1.
 * @param hamt address of hamt program state
 * @param key string key to fetch
 */
 const rent = async (size) => {
  console.log(await connection.getMinimumBalanceForRentExemption(parseInt(size), 'singleGossip'))
  process.exit(0);
}

/**
 * Execute many transactions against that HAMT and record performance.
 * @param hamt address of hamt to execute against
 * @param count number of values to set into HAMT
 */
const bench = async (hamt, count) => {
  const hamtKey = new PublicKey(hamt)
  const timeStats = { count: 0, total: 0 }
  const feeStats = { count: 0, total: 0 }
  const rentStats = { count: 0, total: 0 }
  const computeStats = { count: 0, total: 0 }

  let lowestSet = 0;
  let highestSet = parseInt(count)
  let batchSize = 1;
  let errorSets = []
  while (lowestSet < highestSet || errorSets.length != 0) {
    const newSets = Math.min(batchSize - errorSets.length, highestSet-lowestSet)
    const results = await Promise.all([
      ...errorSets.map(s=>_setValueForBench(hamtKey, s.key, s.value)),
      ...Array(newSets).fill().map((_,i)=>_setValueForBench(hamtKey, `test${i+lowestSet}`, i+lowestSet))
    ])
    lowestSet += newSets
    results.forEach(r => {
      if (r.error) return;
      updateStats(r.millis, timeStats)
      updateStats(r.rent, rentStats)
      updateStats(r.fee, feeStats)
      updateStats(r.compute, computeStats)
    })

    errorSets = results.filter(r => r.error)
    console.log(lowestSet, ": completed", batchSize, "sets with", errorSets.length, "errors")
    batchSize = Math.min(256, batchSize*2)
  }

  console.log(`Set ${count} values.`)
  console.log(`Time (ms): ${statStr(timeStats)}`)
  console.log(`Fee (lamports): ${statStr(feeStats)}`)
  console.log(`Rent (lamports): ${statStr(rentStats)}`)
  console.log(`Compute: ${statStr(computeStats)}`)
  console.log()

  for await (let i of range(count)) {
    const key = `test${i}`
    const result = await lookup(connection, hamtKey, key);

    if (result.value === undefined) {
      console.log(`Could not find ${key} in HAMT`)
      process.exit(1)
    }

    if (result.value != BigInt(i)) {
      console.log(`Expected ${i} for ${key}, but got ${result.value.toString()}`)
      process.exit(1)
    }
  }
  console.log("All keys found")
  process.exit(0)
}

/**
 * Internal functions
 */
const _setValue = async (hamt, key, value) => {
  const result = await lookup(connection, hamt, key);

  const baseKeys = [
    { pubkey: signerAccount.publicKey, isSigner: true, isWritable: false },
    { pubkey: hamt, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
  ]

  const nodeKeys = result.path.map(pubkey => ({ pubkey: pubkey, isSigner: false, isWritable: false }))
  nodeKeys[nodeKeys.length - 1].isWritable = true

  const nodeRent = await connection.getMinimumBalanceForRentExemption(HAMTNodeSize, 'singleGossip');
  const collisionAccounts = Array(result.collisions).fill().map(()=>new Account());
  const collisionInstructions = collisionAccounts.map((acc)=>SystemProgram.createAccount({
    space: HAMTNodeSize,
    lamports: nodeRent,
    fromPubkey: signerAccount.publicKey,
    newAccountPubkey: acc.publicKey,
    programId: programID
  }));
  const collisionKeys = collisionAccounts.map(acc=>({ pubkey: acc.publicKey, isSigner: false, isWritable: true }))

  result.rent = nodeRent * result.collisions;
  result.collisionAccounts = collisionAccounts;

  const valueBN = BigInt(value)
  const setIx = new TransactionInstruction({
    programId: programID,
    keys: [...baseKeys, ...nodeKeys, ...collisionKeys],
    data: serializeSetValueInstruction(key, valueBN),
  })

  const tx = new Transaction().add(...collisionInstructions, setIx);
  result.txSignature = await connection.sendTransaction(
      tx,
      [signerAccount, ...collisionAccounts],
      {skipPreflight: false, preflightCommitment: 'singleGossip'});
  return result
}

const _setValueForBench = async (hamt, key, value) => {
  const computeRegexp = /consumed (\d+) of \d+ compute units/
  try {
    const start = Date.now();
    const result =  await _setValue(hamt, key, value)
    const confirm = await connection.confirmTransaction(result.txSignature)
    result.millis = Date.now() - start;

    if (confirm.value.err) throw err

    const txData = await connection.getTransaction(result.txSignature, {commitment: 'confirmed'})
    result.fee =  txData.meta.fee
    result.compute = parseInt(txData.meta.logMessages
      .filter(l=>l.match(computeRegexp))[0]
      .match(computeRegexp)[1])

    return result
  } catch (error) {
    console.log(`Error setting ${key}`)
    return { error, key, value }
  }
}

const updateStats = (stat, stats) => {
  stats.total += stat
  stats.count += 1
  stats.min = stats.min == undefined ? stat : Math.min(stat, stats.min)
  stats.max = stats.max == undefined ? stat : Math.max(stat, stats.max)
}

const statStr = (stats) => (
  `avg: ${(stats.total/stats.count).toFixed(2)}, max: ${stats.max}, min: ${stats.min}`
)

/**
 * Range iterator for bench
 */
const range = (count) => ({
  [Symbol.asyncIterator]() {
    return {
      current: 0,
      last: count,

      async next() {
        if (this.current < this.last) {
          return { done: false, value: this.current++ };
        } else {
          return { done: true };
        }
      }
    };
  }
})

/**
 * Command CLI
 */
 const program = new Command();
 program
   .command('init')
   .description('create a new HAMT state account')
   .action(init);
 program
   .command('announce <stateAddress> <url> <hash>')
   .description('saves announcement to chain')
   .action(announce);
 program
   .command('get <stateAddress> <starting_index>')
   .description('get list of announcements starting at index')
   .action(getAnnouncements);
 program.parse(process.argv)
