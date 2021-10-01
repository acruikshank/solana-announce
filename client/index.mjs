
import { Account, Connection, PublicKey, SystemProgram, TransactionInstruction, Transaction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { deserializeHAMTNode, deserializeAnnounceInstruction, serializeAnnounceInstruction, AnnounceStateSize, HAMTNodeSize } from "./serialization.mjs";
import { Command } from "commander";
import sha256 from 'crypto-js/sha256.js';
import encHex from 'crypto-js/enc-hex.js';

const signerAccount = new Account(new Uint8Array([64,26,82,89,7,207,32,204,43,235,63,151,123,16,233,79,100,116,87,112,223,34,117,14,87,189,199,51,187,200,57,83,229,235,248,218,204,175,70,229,70,166,99,88,218,103,183,188,103,198,119,82,180,62,43,126,179,239,125,84,136,36,196,109]));
const programID = new PublicKey("7HnngbGgWDRj8Yno976E3qi7ZFuhC2MSsxPTq36CUSDX");
const connection = new Connection("http://localhost:8899", 'singleGossip');
// state address: DAMqpxvSdUV3ZUjJNn74ffhMWhZhc6dweF89WzyT5FNK
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
 * @param serializedAnnouncement hash of the announcement content
 */
const announce = async (stateAddress, url, serializedAnnouncement) => {
  //const hashBytes = base58.default.decode(hash)

  let hash   = sha256(serializedAnnouncement);
  let buffer = Buffer.from(hash.toString(encHex), 'hex');
  let array  = new Uint8Array(buffer);

  const serialization = serializeAnnounceInstruction(url, array);
  //88 is 32 for hash, 32 for key, and 24 for min size of string
  const announcementSize = 88 + url.length;
  console.log("url length", url.length);
  console.log("serialization length: ", serialization.length);
  console.log("serialization: ", serialization);
  // get id of state account
  // get url & hash (from cli)
  // create a new account (node)
  // set instruction data  (serialized)
  //
  try {
  const announcementAccount = new Account();
  const createAnnouncementAccountIx = SystemProgram.createAccount({
    space: announcementSize,
    lamports: await connection.getMinimumBalanceForRentExemption(announcementSize, 'singleGossip'),
    fromPubkey: signerAccount.publicKey,
    newAccountPubkey: announcementAccount.publicKey,
    programId: programID
  });


  const keys = [
    { pubkey: signerAccount.publicKey, isSigner: true, isWritable: false },
    { pubkey: stateAddress, isSigner: false, isWritable: true }, // writable so we can increment the index and set the root (head)
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
    { pubkey: announcementAccount.publicKey, isSigner: false, isWritable: true },
  ]

  const setIx = new TransactionInstruction({
    programId: programID,
    keys,
    data: serialization,
  })

  const tx = new Transaction().add(createAnnouncementAccountIx, setIx);
  console.log("Sending Transaction")
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

const lookup = async(conn, pubKey) => {
  const res= await conn.getAccountInfo(pubKey, 'singleGossip')
  const data = deserializeAnnounceInstruction(res.data)
  console.log(data)
}

/**
 * Command CLI
 */
 const program = new Command();
 program
   .command('init')
   .description('create a new HAMT state account')
   .action(init);
 program
   .command('announce <stateAddress> <url> <serializedAnnouncement>')
   .description('saves announcement to chain')
   .action(announce);
 program
   .command('get <stateAddress> <starting_index>')
   .description('get list of announcements starting at index')
   .action(getAnnouncements);
 program.parse(process.argv)
