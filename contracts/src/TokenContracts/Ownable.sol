// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address and provides basic authorization control functions.
 * Inherits from Initializable for upgradeable contract pattern.
 */
contract Ownable is Initializable {
    // Address of the contract owner
    address private _owner;

    // Address of the pending owner
    address private _pendingOwner;

    /**
     * @notice Error thrown when a zero address is provided.
     * @param value The zero address that triggered the error.
     */
    error Ownable__NoZeroAddress(address value);

    /**
     * @notice Error thrown when a caller is not the owner.
     */
    error Ownable__CallerNotOwner();

    /**
     * @notice Error thrown when a caller is not the pending owner.
     */
    error Ownable__CallerNotPendingOwner();

    /**
     * @dev Event emitted when ownership is transferred.
     * @param previousOwner The address of the previous owner.
     * @param newOwner The address of the new owner.
     */
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Event emitted when ownership transfer is started.
     * @param previousOwner The address of the previous owner.
     * @param newOwner The address of the new owner.
     */
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Modifier to check if the caller is the owner.
     */
    modifier onlyOwner() {
        if (msg.sender != _owner) revert Ownable__CallerNotOwner();
        _;
    }

    /**
     * @dev Modifier to check if the caller is the pending owner.
     */
    modifier onlyPendingOwner() {
        if (msg.sender != _pendingOwner) revert Ownable__CallerNotPendingOwner();
        _;
    }

    /**
     * @notice Initializes the contract setting the deployer as the initial owner.
     * @param owner The address of the initial owner.
     */
    function initialize(address owner) public onlyInitializing {
        setOwner(owner);
    }

    /**
     * @notice Returns the address of the current owner.
     * @return The address of the owner.
     */
    function getOwner() external view returns (address) {
        return _owner;
    }

    /**
     * @notice Returns the address of the pending owner.
     * @return The address of the pending owner.
     */
    function getPendingOwner() external view returns (address) {
        return _pendingOwner;
    }

    /**
     * @dev Sets a new owner address internally.
     * @param newOwner The address to set as the new owner.
     */
    function setOwner(address newOwner) internal {
        _owner = newOwner;
    }

    /**
     * @notice Starts the ownership transfer of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert Ownable__NoZeroAddress(newOwner);
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(_owner, newOwner);
    }

    /**
     * @notice The new owner accepts the ownership transfer.
     * Can only be called by the pending owner.
     */
    function acceptOwnership() external onlyPendingOwner {
        address oldOwner = _owner;
        setOwner(_pendingOwner);
        _pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, _owner);
    }
}