// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import {MintController} from "./MintController.sol";

/**
 * @title MasterMinter
 * @notice This contract uses multiple controllers to manage minters for a contract that implements the MinterManagerInterface.
 * @dev MasterMinter inherits all its functionality from MintController.
 */
contract MasterMinter is MintController {
    // Storage Gap for future upgrades
    uint256[49] private __gap;
}
