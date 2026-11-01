// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {WheelprintsSepolia} from "../WheelprintsSepolia.sol";

contract ReentryReceiver is IERC721Receiver {
    WheelprintsSepolia private target;
    uint8 private chosen;
    bool public entitlementSetDuringCallback;
    bool public sameVariantBlocked;
    bool public otherVariantBlocked;
    function mintFrom(address token, uint8 variant) external {
        target = WheelprintsSepolia(token); chosen = variant;
        target.mint(variant);
    }
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        require(msg.sender == address(target));
        entitlementSetDuringCallback = target.minted(address(this), chosen);
        try target.mint(chosen) { sameVariantBlocked = false; } catch { sameVariantBlocked = true; }
        try target.mint((chosen + 1) % 27) { otherVariantBlocked = false; } catch { otherVariantBlocked = true; }
        return IERC721Receiver.onERC721Received.selector;
    }
}
contract RejectingReceiver is IERC721Receiver {
    error RejectIncoming();
    function mintFrom(address token, uint8 variant) external { WheelprintsSepolia(token).mint(variant); }
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) { revert RejectIncoming(); }
}
contract NonReceiver {
    function mintFrom(address token, uint8 variant) external { WheelprintsSepolia(token).mint(variant); }
}
