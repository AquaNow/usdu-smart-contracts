// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AbstractTokenV1
 * @dev Abstract contract for ERC20 token operations. Defines internal functions for approving and transferring tokens.
 * Inherits from the IERC20 interface.
 */
abstract contract AbstractTokenV1 is IERC20 {
    /**
     * @notice Internal function to set the allowance for a spender over the owner's tokens.
     * @param owner The address of the token owner.
     * @param spender The address of the spender.
     * @param value The amount of tokens the spender is allowed to spend.
     * @dev This function must be overridden in the derived contract.
     */
    function _approve(address owner, address spender, uint256 value) internal virtual;

    /**
     * @notice Internal function to transfer tokens from one address to another.
     * @param from The address of the token sender.
     * @param to The address of the token recipient.
     * @param value The amount of tokens to transfer.
     * @dev This function must be overridden in the derived contract.
     */
    function _transfer(address from, address to, uint256 value) internal virtual;

    // Storage Gap for future upgrades
    uint256[49] private __gap;
}
