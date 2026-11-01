// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

/// @notice Observed Core v3 read interface. This is not a canonical-deployment assertion.
interface ISqueekCore {
    struct CoreConfiguration {
        bytes32 streamId;
        uint64 genesisTimestamp;
        uint64 roundDuration;
        uint64 maxWorkPerRound;
        uint16 maxRoundsPerBatch;
        address guardian;
        address reporter;
        uint32 initialWorkPerThousandBlocks;
        uint64 targetBlocksPerActiveRound;
        uint64 difficultySmoothingRounds;
        uint96 blockUnitsPerBlock;
    }
    struct LedgerPosition {
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint32 workPerThousandBlocks;
    }
    struct RoundCheckpoint {
        uint64 roundId;
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint32 workPerThousandBlocks;
        bytes32 dataHash;
    }
    struct RoundPage {
        uint64 certifiedThroughRound;
        LedgerPosition start;
        LedgerPosition end;
        RoundCheckpoint[] rounds;
    }
    function configuration() external view returns (CoreConfiguration memory);
    function roundPage(uint64 afterRound, uint64 throughRound, uint256 maxRecords) external view returns (RoundPage memory);
    function implementationCodeAddress() external view returns (address);
    function implementationCodeVersion() external pure returns (uint64);
    function implementationStorageLayoutDigest() external pure returns (bytes32);
}
