use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Debug, Copy, Clone)]
pub enum AnnounceError {
    /// Invalid instruction
    #[error("Invalid Instruction")]
    InvalidInstruction,
    #[error("Not Rent Exempt")]
    NotRentExempt,
}

impl From<AnnounceError> for ProgramError {
    fn from(e: AnnounceError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
