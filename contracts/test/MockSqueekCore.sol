// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;
import {ISqueekCore} from "../interfaces/ISqueekCore.sol";
import {WheelprintsCommitments} from "../generated/WheelprintsCommitments.sol";

/// @dev Local-EVM fixture only. Its ABI mirrors the observed read tuples.
contract MockSqueekCore {
    uint8 public fault;
    error MockReadFailure();
    function setFault(uint8 value) external { fault = value; }
    function _available() private view { if (fault == 21) revert MockReadFailure(); }
    function implementationCodeAddress() external view returns (address) {
        _available(); return fault == 5 ? address(1) : 0x284747C4664AF2203E7A90a2Ee76f22b6B5e6889;
    }
    function implementationCodeVersion() external view returns (uint64) { _available(); return fault == 6 ? 4 : 3; }
    function implementationStorageLayoutDigest() external view returns (bytes32) {
        _available(); return fault == 7 ? bytes32(uint256(1)) : bytes32(0x9a9c008e029460808209571703fbf2679785874e0e6d3232f16a864d12abcb20);
    }
    function configuration() external view returns (ISqueekCore.CoreConfiguration memory cfg) {
        _available();
        cfg = ISqueekCore.CoreConfiguration({
            streamId: 0x52e443e4e0d236ff0c07f4cdc518c594a3d680d20abb1481510efbed0ec73633,
            genesisTimestamp: 1793022600, roundDuration: 600, maxWorkPerRound: 10000, maxRoundsPerBatch: 16,
            guardian: address(1), reporter: address(2), initialWorkPerThousandBlocks: 10000,
            targetBlocksPerActiveRound: 40, difficultySmoothingRounds: 30, blockUnitsPerBlock: 1000000000
        });
        if (fault == 1) cfg.streamId = bytes32(uint256(1));
        if (fault == 2) cfg.genesisTimestamp++;
        if (fault == 3) cfg.roundDuration++;
        if (fault == 4) cfg.blockUnitsPerBlock++;
    }
    function roundPage(uint64 afterRound, uint64 throughRound, uint256 maxRecords) external view returns (ISqueekCore.RoundPage memory page) {
        _available();
        require(afterRound + 1 == throughRound && maxRecords == 1, "unexpected page arguments");
        uint8 index;
        if (throughRound == 539) index = 0;
        else if (throughRound == 517) index = 1;
        else { require(throughRound == 499, "unexpected round"); index = 2; }
        WheelprintsCommitments.Snapshot memory snap = WheelprintsCommitments.snapshot(index);
        page.certifiedThroughRound = fault == 8 ? throughRound - 1 : throughRound;
        page.start = ISqueekCore.LedgerPosition(snap.cumulativeWorkBefore, snap.cumulativeBlockUnitsBefore, snap.difficultyBefore);
        page.end = ISqueekCore.LedgerPosition(snap.cumulativeWorkAfter, snap.cumulativeBlockUnitsAfter, snap.difficultyAfter);
        page.rounds = new ISqueekCore.RoundCheckpoint[](fault == 9 ? 0 : fault == 23 ? 2 : 1);
        if (page.rounds.length == 0) return page;
        page.rounds[0] = ISqueekCore.RoundCheckpoint(snap.roundId, snap.cumulativeWorkAfter, snap.cumulativeBlockUnitsAfter, snap.difficultyAfter, snap.dataHash);
        if (fault == 10) page.rounds[0].roundId++;
        if (fault == 11) { page.end.cumulativeWork++; page.rounds[0].cumulativeWork++; }
        if (fault == 12) page.start.cumulativeWork--;
        if (fault == 13) { page.end.cumulativeBlockUnits++; page.rounds[0].cumulativeBlockUnits++; }
        if (fault == 14) page.start.cumulativeBlockUnits++;
        if (fault == 15) { page.end.workPerThousandBlocks++; page.rounds[0].workPerThousandBlocks++; }
        if (fault == 16) page.rounds[0].dataHash = bytes32(uint256(1));
        if (fault == 17) page.rounds[0].cumulativeWork++;
        if (fault == 18) page.rounds[0].cumulativeBlockUnits++;
        if (fault == 19) page.rounds[0].workPerThousandBlocks++;
        if (fault == 20) page.start.workPerThousandBlocks++;
        if (fault == 22) page.start.cumulativeBlockUnits -= 1000000000;
    }
}
