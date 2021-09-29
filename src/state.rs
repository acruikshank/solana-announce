use solana_program::{
    program_pack::{IsInitialized, Sealed},
    pubkey::Pubkey,
    hash::Hash,
};

use crate::{util::Serdes};
use borsh::{BorshDeserialize, BorshSerialize};

/**
 * State for main program node
 */
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug)]
pub struct AnnounceState {
    pub is_initialized: bool,
    pub root_pubkey: Pubkey,
}

impl Sealed for AnnounceState {}
impl Serdes for AnnounceState {}

impl IsInitialized for AnnounceState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

/**
 * Annoucement node account state
 */
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug)]
pub struct Announcement {
    pub url: String,
    pub hash: Hash,
    pub next: Pubkey,
}

impl Sealed for Announcement {}
impl Serdes for Announcement {}

