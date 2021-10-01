use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program_pack::{IsInitialized},
    pubkey::Pubkey,
    sysvar::{rent::Rent, Sysvar},
    hash::{ Hash },
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
        let announce_state_account = next_account_info(account_info_iter)?;
        let rent = &Rent::from_account_info(next_account_info(account_info_iter)?)?;

        if !rent.is_exempt(announce_state_account.lamports(), announce_state_account.data_len()) {
            return Err(AnnounceError::NotRentExempt.into());
        }

        // initialize state
        let mut announce_state = AnnounceState::unpack(&announce_state_account.data.borrow())?;
        if announce_state.is_initialized() {
            return Err(AnnounceError::InvalidInstruction.into());
        }
        announce_state.is_initialized = true;
        announce_state.root_pubkey = Pubkey::default();
        announce_state.current_index = 0;

        AnnounceState::pack(&announce_state, &mut announce_state_account.data.borrow_mut());

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
        let _setter = &next_account_info(account_info_iter)?;

        let announce_state = &next_account_info(account_info_iter)?;
        let rent = &Rent::from_account_info(next_account_info(account_info_iter)?)?;

        // State must already be initialized
        let mut announce_state_data = AnnounceState::unpack(&announce_state.data.borrow())?;
        if !announce_state_data.is_initialized() {
            return Err(AnnounceError::InvalidInstruction.into());
        }

        let announcement = &next_account_info(account_info_iter)?;
        if !rent.is_exempt(announcement.lamports(), announcement.data_len()) {
            return Err(AnnounceError::NotRentExempt.into());
        }

        let fake_announcement_data = Announcement { url,hash, next: announce_state_data.root_pubkey };
        Announcement::pack(&fake_announcement_data, &mut announcement.data.borrow_mut());

        //update state object to increment index and set the new root to the new announcement
        announce_state_data.current_index +=1;
        announce_state_data.root_pubkey = *announcement.key;
        AnnounceState::pack(&announce_state_data, &mut announce_state.data.borrow_mut());

        return Ok(())
    }
}
