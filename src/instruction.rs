use crate::{util::Serdes};
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::hash::Hash;

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug)]
pub enum AnnounceInstruction {
    Init,
    Announce,
}
impl Serdes for AnnounceInstruction {}

/// Initializes a new Announce with a state account that points to the end of the list.
///
/// Accounts expected:
///
/// 0. `[signer]` The account of the person initializing the escrow
/// 1. `[writable]` Account to hold Announce state data (33 bytes)
/// 2. `[]` The rent sysvar
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug)]
pub struct Init {
    kind: AnnounceInstruction
}

impl Serdes for Init {}

/// Creates a new Announcement
///
/// Accounts expected:
///
/// 0. `[signer]` The account of the person initializing the escrow
/// 1. `[]` HAMT State account
/// 2.. Empty anouncement account. Must be rent exempt and sized to store
///     a serialized string (the url), hash, and a public key.
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug)]
pub struct Announce {
    pub kind: AnnounceInstruction,
    pub url: String,
    pub hash: Hash,
    // Why is there no 'next' field here?
}

impl Serdes for Announce {}
