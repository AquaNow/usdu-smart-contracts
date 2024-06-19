// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {Controller} from "./Controller.sol";
import {MinterManagementInterface} from "./MinterManagerInterface.sol";
import {Ownable} from "../TokenContracts/Ownable.sol";

/**
 * @title MintController
 * @notice This contract manages the minting process by interfacing with the MinterManagementInterface contract.
 * It allows configuration, increment, and decrement of minter allowances and removes minters.
 * @dev Inherits from the Controller contract.
 */
contract MintController is Controller {
    /// @notice The interface to manage minters.
    MinterManagementInterface internal minterManager;
    /// @notice A mapping from minter addresses to their allowances.
    mapping(address => uint256) internal minterAllowance;

    /// @notice Event emitted when the minter manager is set.
    event MinterManagerSet(address indexed _oldMinterManager, address indexed _newMinterManager);
    /// @notice Event emitted when a minter is configured.
    event MinterConfigured(
        address indexed _msgSender,
        address indexed _minter,
        uint256 _allowance
    );
    /// @notice Event emitted when a minter is removed.
    event MinterRemoved(address indexed _msgSender, address indexed _minter);
    /// @notice Event emitted when a minter's allowance is incremented.
    event MinterAllowanceIncremented(
        address indexed _msgSender,
        address indexed _minter,
        uint256 _increment,
        uint256 _newAllowance
    );
    /// @notice Event emitted when a minter's allowance is decremented.
    event MinterAllowanceDecremented(
        address indexed msgSender,
        address indexed minter,
        uint256 decrement,
        uint256 newAllowance
    );

    // Error messages for various failure cases.
    error MintController__NoMinters();
    error MintController__NoZeroAddress(address account);
    error MintController__ExceedMaxMinters();
    error MintController__MinterHasController();
    error MintController__IncrementTooSmall();
    error MintController__OnlyForMinterAllowance();
    error MintController__AllowanceTooSmall();
    error MintController__NotMinterController();

    /**
     * @notice Initializes the MintController with a minter manager and maximum number of minters.
     * @param _minterManager The address of the minter manager contract.
     * @param _initMaxNumOfMinters The initial maximum number of minters.
     */
    function initializeMintController(
        address _minterManager,
        uint256 _initMaxNumOfMinters
    ) public initializer {
        Ownable.initialize(msg.sender);
        _maxNumOfMinters = _initMaxNumOfMinters;
        minterManager = MinterManagementInterface(_minterManager);
    }

    /**
     * @notice Returns the address of the minter manager.
     * @return The address of the minter manager contract.
     */
    function getMinterManager() external view returns (MinterManagementInterface) {
        return minterManager;
    }

    // onlyOwner functions

    /**
     * @notice Sets a new minter manager.
     * @param _newMinterManager The address of the new minter manager contract.
     */
    function setMinterManager(address _newMinterManager) external onlyOwner {
        emit MinterManagerSet(address(minterManager), _newMinterManager);
        minterManager = MinterManagementInterface(_newMinterManager);
    }

    // onlyController functions

    /**
     * @notice Removes a minter controlled by the caller.
     * @param _minter The address of the minter to remove.
     * @return A boolean indicating whether the minter was successfully removed.
     */
    function removeMinter(address _minter) external onlyController returns (bool) {
        uint256 len = controllers[msg.sender].length;

        if (len == 0) revert MintController__NoMinters();
        bool minterFoundAndRemoved = false;
        for (uint256 i = 0; i < len; i++) {
            if (controllers[msg.sender][i] == _minter) {
                minterController[_minter] = address(0);
                controllers[msg.sender][i] = controllers[msg.sender][len - 1];
                controllers[msg.sender].pop();
                emit MinterRemoved(msg.sender, _minter);
                minterFoundAndRemoved = true;
                break;
            }
        }

        if (minterFoundAndRemoved) {
            return minterManager.removeMinter(_minter);
        } else {
            return false;
        }
    }

    /**
     * @notice Configures a minter with a specified allowance. If the minter is new, assigns it to the caller and adds it to the caller's minter list.
     * @param _minter The address of the new minter.
     * @param _newAllowance The allowance to set for the new minter.
     * @return A boolean indicating whether the minter was successfully configured.
     */
    function configureMinter(
        address _minter,
        uint256 _newAllowance
    ) external onlyController returns (bool) {
        if (_minter == address(0)) revert MintController__NoZeroAddress(_minter);
        if (minterController[_minter] == address(0)) {
            minterController[_minter] = msg.sender;
            if (controllers[msg.sender].length + 1 > _maxNumOfMinters)
                revert MintController__ExceedMaxMinters();

            controllers[msg.sender].push(_minter);
        }
        if (minterController[_minter] != msg.sender) revert MintController__MinterHasController();
        minterAllowance[_minter] = _newAllowance;
        emit MinterConfigured(msg.sender, _minter, _newAllowance);
        return _setMinterAllowance(_minter, _newAllowance);
    }

    /**
     * @notice Increases the allowance of an active minter.
     * @param _allowanceIncrement The amount to increase the allowance by.
     * @param _minter The address of the minter.
     * @return A boolean indicating whether the allowance was successfully incremented.
     */
    function incrementMinterAllowance(
        uint256 _allowanceIncrement,
        address _minter
    ) external onlyController returns (bool) {
        if (_allowanceIncrement <= 0) revert MintController__IncrementTooSmall();
        if (minterController[_minter] != msg.sender) revert MintController__NotMinterController();

        uint256 currentAllowance = minterManager.getMinterAllowance(_minter);
        uint256 newAllowance = currentAllowance + _allowanceIncrement;

        emit MinterAllowanceIncremented(msg.sender, _minter, _allowanceIncrement, newAllowance);

        return _setMinterAllowance(_minter, newAllowance);
    }

    /**
     * @notice Decreases the allowance of an active minter.
     * @param _allowanceDecrement The amount to decrease the allowance by.
     * @param _minter The address of the minter.
     * @return A boolean indicating whether the allowance was successfully decremented.
     */
    function decrementMinterAllowance(
        uint256 _allowanceDecrement,
        address _minter
    ) external onlyController returns (bool) {
        if (_allowanceDecrement <= 0) revert MintController__AllowanceTooSmall();
        if (minterController[_minter] != msg.sender) revert MintController__NotMinterController();

        uint256 currentAllowance = minterManager.getMinterAllowance(_minter);

        uint256 actualAllowanceDecrement = (
            currentAllowance > _allowanceDecrement ? _allowanceDecrement : currentAllowance
        );

        uint256 newAllowance = currentAllowance - actualAllowanceDecrement;

        emit MinterAllowanceDecremented(
            msg.sender,
            _minter,
            actualAllowanceDecrement,
            newAllowance
        );
        return _setMinterAllowance(_minter, newAllowance);
    }

    /**
     * @notice Sets the allowance for a minter using the MinterManagementInterface.
     * @param _minter The address of the minter.
     * @param _newAllowance The new allowance to be set.
     * @return A boolean indicating whether the allowance was successfully set.
     */
    function _setMinterAllowance(address _minter, uint256 _newAllowance) internal returns (bool) {
        return minterManager.configureMinter(_minter, _newAllowance);
    }
}
