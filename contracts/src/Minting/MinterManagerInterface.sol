//SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

/**
 * @title MinterManagementInterface
 * @notice Interface that defines external functions for managing minters and their allowances.
 * @dev Implementing contracts should provide functionality for adding, removing, and configuring minters.
 */
interface MinterManagementInterface {
    /**
     * @notice Checks if an account is a registered minter.
     * @param _account The address to check.
     * @return A boolean indicating whether the address is a minter.
     */
    function isMinter(address _account) external view returns (bool);

    /**
     * @notice Gets the allowance of a minter.
     * @param _minter The address of the minter.
     * @return The amount of tokens the minter is allowed to mint.
     */
    function getMinterAllowance(address _minter) external view returns (uint256);

    /**
     * @notice Configures a new minter or updates the allowance of an existing minter.
     * @param _minter The address of the minter.
     * @param _minterAllowedAmount The new allowance for the minter.
     * @return A boolean indicating whether the configuration was successful.
     */
    function configureMinter(address _minter, uint256 _minterAllowedAmount) external returns (bool);

    /**
     * @notice Removes a minter.
     * @param _minter The address of the minter to remove.
     * @return A boolean indicating whether the removal was successful.
     */
    function removeMinter(address _minter) external returns (bool);
}
