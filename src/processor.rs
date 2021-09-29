use std::cmp;


use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program_pack::{IsInitialized},
    pubkey::Pubkey,
    sysvar::{rent::Rent, Sysvar},
    hash::{ Hash, hash },
    msg,
};

use crate::{
    error::AnnounceError,
    instruction::{ Announce },
    util::Serdes,
    state::{ AnnounceState, Announcement }
};

pub struct Processor;
impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction_type = instruction_data[0];

        if instruction_type == 0 {
            return Self::process_init(accounts, program_id)
        }
        
        else if instruction_type == 1 {
            let instruction = Announce::unpack(instruction_data)?;
            return Self::process_announce(accounts, instruction.url, instruction.hash, program_id)
        }

        Err(AnnounceError::InvalidInstruction.into())
    }

    fn process_init(
        accounts: &[AccountInfo],
        _program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        let _setter = next_account_info(account_info_iter)?;
        let hamt_account = next_account_info(account_info_iter)?;
        let rent = &Rent::from_account_info(next_account_info(account_info_iter)?)?;

        if !rent.is_exempt(hamt_account.lamports(), hamt_account.data_len()) {
            return Err(AnnounceError::NotRentExempt.into());
        }

        let root_account = next_account_info(account_info_iter)?;

        // initialize state
        let mut hamt_info = AnnounceState::unpack(&hamt_account.data.borrow())?;
        if hamt_info.is_initialized() {
            return Err(AnnounceError::InvalidInstruction.into());
        }
        hamt_info.is_initialized = true;
        hamt_info.root_pubkey = *root_account.key;

        if !rent.is_exempt(root_account.lamports(), root_account.data_len()) {
            return Err(AnnounceError::NotRentExempt.into());
        }

        AnnounceState::pack(&hamt_info, &mut hamt_account.data.borrow_mut());

        Ok(())
    }

    fn process_announce(
        accounts: &[AccountInfo],
        url: String,
        hash: Hash,
        _program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        // skip over signer (maybe we don't need to send signer as a key)
        let _setter = next_account_info(account_info_iter)?;

        let announce_state = next_account_info(account_info_iter)?;
        let rent = &Rent::from_account_info(next_account_info(account_info_iter)?)?;

        // State must already be initialized
        let announce_state = AnnounceState::unpack(&announce_state.data.borrow())?;
        if !announce_state.is_initialized() {
            return Err(AnnounceError::InvalidInstruction.into());
        }
        
        let mut announcement = next_account_info(account_info_iter)?;
        if !rent.is_exempt(announcement.lamports(), announcement.data_len()) {
            return Err(AnnounceError::NotRentExempt.into());
        }

        let mut announcement_data = Announcement::unpack(&announcement.data.borrow())?;
        announcement_data.url = url;
        announcement_data.hash = Hash::from_str(hash);
        announcement_data.next = announce_info.root_pubkey;

        Announcement::pack(&announcment_data, &mut announcement.data.borrow_mut());

        return Ok(())
    }
}
