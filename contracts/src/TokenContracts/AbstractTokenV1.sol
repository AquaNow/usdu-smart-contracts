// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AbstractTokenV1
 * @dev Abstract contract for ERC20 token operations. Defines internal functions for approving and transferring tokens.
 * Inherits from the IERC20 interface.
 */
abstract contract AbstractTokenV1 is IERC20 {
    /**
     * @notice Error thrown when the decrease allowance request exceeds the current allowance.
     * @param spender The address of the spender.
     * @param currentAllowance The current allowance of the spender.
     * @param requestedDecrease The amount by which the allowance is requested to be decreased.
     */
    error ERC20FailedDecreaseAllowance(
        address spender,
        uint256 currentAllowance,
        uint256 requestedDecrease
    );

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
}
