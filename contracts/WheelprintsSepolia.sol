// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ISqueekCore} from "./interfaces/ISqueekCore.sol";
import {WheelprintsCommitments} from "./generated/WheelprintsCommitments.sol";

/// @notice Free, Sepolia-only ERC721 rehearsal. Wallets still pay network gas.
/// @dev SVG images remain HTTPS-hosted. Onchain SHA-256 commitments detect changes,
///      but do not guarantee availability or physical sensor truth. There is no
///      owner mint, administrator, metadata setter, upgrade path or mainnet mode.
contract WheelprintsSepolia is ERC721, ReentrancyGuard {
    using Strings for uint256;

    uint256 public constant CHAIN_ID = 11155111;
    uint8 public constant VARIANT_COUNT = 27;
    uint8 public constant SOURCE_COUNT = 3;
    address public constant SOURCE_CORE = 0x980B4424c007CAf7a1f3670B48c8EaEf7EbC3d44;
    address public constant SOURCE_IMPLEMENTATION = 0x284747C4664AF2203E7A90a2Ee76f22b6B5e6889;
    uint64 public constant SOURCE_IMPLEMENTATION_VERSION = 3;
    bytes32 public constant SOURCE_LAYOUT_DIGEST = 0x9a9c008e029460808209571703fbf2679785874e0e6d3232f16a864d12abcb20;
    bytes32 public constant EXPECTED_STREAM_ID = 0x52e443e4e0d236ff0c07f4cdc518c594a3d680d20abb1481510efbed0ec73633;
    uint64 public constant GENESIS_TIMESTAMP = 1793022600;
    uint64 public constant ROUND_DURATION = 600;
    uint96 public constant BLOCK_UNITS_PER_BLOCK = 1000000000;

    struct VariantInfo {
        uint8 sourceIndex;
        string filename;
        string style;
        string palette;
        uint32 visualSeed;
        bytes32 svgSha256;
    }

    // Constructor-only string storage; Solidity does not support immutable strings.
    string private _artworkBaseURL;
    WheelprintsCommitments.Snapshot[3] private _snapshots;
    uint256 private _nextTokenId = 1;
    mapping(uint256 tokenId => uint8 variant) private _tokenVariants;
    mapping(address minter => mapping(uint8 variant => bool)) public minted;

    error WrongChain(uint256 actualChainId);
    error InvalidBaseURL();
    error SourceUnavailable();
    error SourceImplementationMismatch();
    error SourceConfigurationMismatch();
    error SourceRoundIncomplete(uint8 sourceIndex);
    error SourceSnapshotMismatch(uint8 sourceIndex);
    error InvalidVariant(uint8 variant);
    error InvalidSourceIndex(uint8 sourceIndex);
    error AlreadyMinted(address minter, uint8 variant);

    event PrintMinted(address indexed minter, uint256 indexed tokenId, uint8 indexed variant, uint32 visualSeed, bytes32 svgSha256);

    constructor(string memory artworkBaseURL_) ERC721("Wheelprints Sepolia Rehearsal", "WPR-TEST") {
        _requireSepolia();
        _validateBaseURL(artworkBaseURL_);
        _captureSourceSnapshots();
        _artworkBaseURL = artworkBaseURL_;
    }

    function mint(uint8 variant) external nonReentrant returns (uint256 tokenId) {
        _requireSepolia();
        if (variant >= VARIANT_COUNT) revert InvalidVariant(variant);
        if (minted[msg.sender][variant]) revert AlreadyMinted(msg.sender, variant);
        // Effects precede the ERC721Receiver callback made by _safeMint.
        minted[msg.sender][variant] = true;
        tokenId = _nextTokenId++;
        _tokenVariants[tokenId] = variant;
        _safeMint(msg.sender, tokenId);
        (uint32 seed, bytes32 svgHash) = WheelprintsCommitments.variant(variant);
        emit PrintMinted(msg.sender, tokenId, variant, seed, svgHash);
    }

    function totalSupply() external view returns (uint256) { return _nextTokenId - 1; }
    function artworkBaseURL() external view returns (string memory) { return _artworkBaseURL; }
    function streamId() external pure returns (bytes32) { return EXPECTED_STREAM_ID; }
    function rendererSourceHash() external pure returns (bytes32) { return WheelprintsCommitments.rendererSourceHash(); }
    function rendererVersion() external pure returns (string memory) { return WheelprintsCommitments.rendererVersion(); }

    function tokenVariant(uint256 tokenId) external view returns (uint8) {
        _requireOwned(tokenId);
        return _tokenVariants[tokenId];
    }

    function snapshotInfo(uint8 sourceIndex) external view returns (WheelprintsCommitments.Snapshot memory) {
        if (sourceIndex >= SOURCE_COUNT) revert InvalidSourceIndex(sourceIndex);
        return _snapshots[sourceIndex];
    }

    function variantInfo(uint8 variant) public pure returns (VariantInfo memory info) {
        if (variant >= VARIANT_COUNT) revert InvalidVariant(variant);
        info.sourceIndex = variant / 9;
        info.style = _styleName((variant % 9) / 3);
        info.palette = _paletteName(variant % 3);
        info.filename = string.concat("Wheelprints_", _studyName(info.sourceIndex), "_", info.style, "_", info.palette, ".svg");
        (info.visualSeed, info.svgSha256) = WheelprintsCommitments.variant(variant);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint8 variant = _tokenVariants[tokenId];
        VariantInfo memory info = variantInfo(variant);
        WheelprintsCommitments.Snapshot memory snap = _snapshots[info.sourceIndex];
        string memory attributes = string.concat(
            '{"trait_type":"Study","value":"', _studyName(info.sourceIndex), '"},',
            '{"trait_type":"Form","value":"', info.style, '"},',
            '{"trait_type":"Palette","value":"', info.palette, '"},',
            '{"trait_type":"Source round","value":', uint256(snap.roundId).toString(), '},',
            '{"trait_type":"Accepted passages","value":', uint256(snap.work).toString(), '},',
            '{"trait_type":"Completed Squeek blocks","value":', uint256(snap.completedBlocks).toString(), '},',
            '{"trait_type":"Visual seed","value":"', Strings.toHexString(info.visualSeed, 4), '"}'
        );
        bytes memory json = abi.encodePacked(
            '{"name":"Wheelprints Rehearsal #', tokenId.toString(), ' - ', _studyName(info.sourceIndex),
            '","description":"Free Sepolia-only ERC721 rehearsal. The image remains HTTPS-hosted; source snapshots and artwork SHA-256 commitments are preserved onchain. One mint per wallet per variant is a rehearsal rule, not a mainnet supply policy. No official Squeekchain endorsement or physical sensor truth is implied.",',
            '"image":"', _artworkBaseURL, 'exports/', info.filename, '",',
            '"external_url":"', _artworkBaseURL, '",',
            '"attributes":[', attributes, '],',
            '"variant_id":', uint256(variant).toString(), ',',
            '"source_chain_id":11155111,',
            '"source_core":"', Strings.toHexString(SOURCE_CORE), '",',
            '"source_stream_id":"', Strings.toHexString(uint256(EXPECTED_STREAM_ID), 32), '",',
            '"renderer_version":"', WheelprintsCommitments.rendererVersion(), '",',
            '"renderer_source_sha256":"', Strings.toHexString(uint256(WheelprintsCommitments.rendererSourceHash()), 32), '",',
            '"artwork_sha256":"', Strings.toHexString(uint256(info.svgSha256), 32), '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    function _requireSepolia() private view {
        if (block.chainid != CHAIN_ID) revert WrongChain(block.chainid);
    }

    function _validateBaseURL(string memory value) private pure {
        bytes memory url = bytes(value);
        if (url.length < 10 || url.length > 200 || url[url.length - 1] != bytes1("/") || url[8] == bytes1("/")) revert InvalidBaseURL();
        bytes memory prefix = bytes("https://");
        for (uint256 i; i < 8; ++i) if (url[i] != prefix[i]) revert InvalidBaseURL();
        for (uint256 i = 8; i < url.length; ++i) {
            uint8 c = uint8(url[i]);
            // Exclude JSON escapes, credentials, query/fragment delimiters and controls.
            if (c <= 32 || c >= 127 || c == 34 || c == 92 || c == 63 || c == 35 || c == 64 || c == 60 || c == 62) revert InvalidBaseURL();
        }
    }

    function _captureSourceSnapshots() private {
        if (SOURCE_CORE.code.length == 0) revert SourceUnavailable();
        ISqueekCore core = ISqueekCore(SOURCE_CORE);
        if (core.implementationCodeAddress() != SOURCE_IMPLEMENTATION ||
            core.implementationCodeVersion() != SOURCE_IMPLEMENTATION_VERSION ||
            core.implementationStorageLayoutDigest() != SOURCE_LAYOUT_DIGEST) revert SourceImplementationMismatch();
        ISqueekCore.CoreConfiguration memory cfg = core.configuration();
        if (cfg.streamId != EXPECTED_STREAM_ID || cfg.genesisTimestamp != GENESIS_TIMESTAMP ||
            cfg.roundDuration != ROUND_DURATION || cfg.blockUnitsPerBlock != BLOCK_UNITS_PER_BLOCK) revert SourceConfigurationMismatch();
        for (uint8 i; i < SOURCE_COUNT; ++i) {
            WheelprintsCommitments.Snapshot memory expected = WheelprintsCommitments.snapshot(i);
            ISqueekCore.RoundPage memory page = core.roundPage(expected.roundId - 1, expected.roundId, 1);
            if (page.certifiedThroughRound != expected.roundId || page.rounds.length != 1 || block.timestamp < expected.endTimestamp) revert SourceRoundIncomplete(i);
            ISqueekCore.RoundCheckpoint memory point = page.rounds[0];
            if (point.roundId != expected.roundId || point.cumulativeWork != page.end.cumulativeWork ||
                point.cumulativeBlockUnits != page.end.cumulativeBlockUnits || point.workPerThousandBlocks != page.end.workPerThousandBlocks ||
                page.end.cumulativeWork < page.start.cumulativeWork || page.end.cumulativeBlockUnits < page.start.cumulativeBlockUnits) revert SourceSnapshotMismatch(i);
            uint96 completed = page.end.cumulativeBlockUnits / BLOCK_UNITS_PER_BLOCK - page.start.cumulativeBlockUnits / BLOCK_UNITS_PER_BLOCK;
            if (completed > type(uint64).max) revert SourceSnapshotMismatch(i);
            WheelprintsCommitments.Snapshot memory observed = WheelprintsCommitments.Snapshot({
                roundId: point.roundId,
                startTimestamp: cfg.genesisTimestamp + (point.roundId - 1) * cfg.roundDuration,
                endTimestamp: cfg.genesisTimestamp + point.roundId * cfg.roundDuration,
                work: page.end.cumulativeWork - page.start.cumulativeWork,
                completedBlocks: uint64(completed),
                cumulativeWorkBefore: page.start.cumulativeWork,
                cumulativeWorkAfter: page.end.cumulativeWork,
                cumulativeBlockUnitsBefore: page.start.cumulativeBlockUnits,
                cumulativeBlockUnitsAfter: page.end.cumulativeBlockUnits,
                difficultyBefore: page.start.workPerThousandBlocks,
                difficultyAfter: page.end.workPerThousandBlocks,
                dataHash: point.dataHash
            });
            if (keccak256(abi.encode(observed)) != keccak256(abi.encode(expected))) revert SourceSnapshotMismatch(i);
            _snapshots[i] = observed;
        }
    }

    function _studyName(uint8 i) private pure returns (string memory) { return i == 0 ? "Drift" : i == 1 ? "Pulse" : "Surge"; }
    function _styleName(uint8 i) private pure returns (string memory) { return i == 0 ? "orbit" : i == 1 ? "current" : "bloom"; }
    function _paletteName(uint8 i) private pure returns (string memory) { return i == 0 ? "mineral" : i == 1 ? "ember" : "midnight"; }
}
