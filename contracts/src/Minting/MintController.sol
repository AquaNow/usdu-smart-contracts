// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {Controller} from "./Controller.sol";
import {MinterManagementInterface} from "./MinterManagerInterface.sol";
import {Ownable} from "../TokenContracts/Ownable.sol";

contract MintController is Controller {
    /*
     * @title MinterManagementInterface
     * @notice MintController calls the minterManager to execute/record minter
     * management tasks, as well as to query the status of a minter address.
     */
    MinterManagementInterface internal minterManager;
    mapping(address => uint256) internal minterAllowance;

    event MinterManagerSet(address indexed _oldMinterManager, address indexed _newMinterManager);
    event MinterConfigured(
        address indexed _msgSender,
        address indexed _minter,
        uint256 _allowance
    );
    event MinterRemoved(address indexed _msgSender, address indexed _minter);
    event MinterAllowanceIncremented(
        address indexed _msgSender,
        address indexed _minter,
        uint256 _increment,
        uint256 _newAllowance
    );

    event MinterAllowanceDecremented(
        address indexed msgSender,
        address indexed minter,
        uint256 decrement,
        uint256 newAllowance
    );

    /* Errors */
    error MintController__NoMinters();
    error MintController__NoZeroAddress(address account);
    error MintController__ExceedMaxMinters();
    error MintController__MinterHasController();
    error MintController__IncrementTooSmall();
    error MintController__OnlyForMinterAllowance();
    error MintController__AllowanceTooSmall();
    error MintController__NotMinterController();

    /*
     * @notice Initializes the minterManager.
     * @param _minterManager The address of the minterManager contract.
     */
    function initializeMintController(
        address _minterManager,
        uint256 _initMaxNumOfMinters
    ) public initializer {
        Ownable.initialize(msg.sender);
        _maxNumOfMinters = _initMaxNumOfMinters;
        minterManager = MinterManagementInterface(_minterManager);
    }

    /*
     * @notice gets the minterManager
     */
    function getMinterManager() external view returns (MinterManagementInterface) {
        return minterManager;
    }

    // onlyOwner functions

    /**
     * @notice Sets the minterManager.
     * @param _newMinterManager The address of the new minterManager contract.
     */
    function setMinterManager(address _newMinterManager) external onlyOwner {
        emit MinterManagerSet(address(minterManager), _newMinterManager);
        minterManager = MinterManagementInterface(_newMinterManager);
    }

    // onlyController functions

    /**
     * @notice Removes the controller's own minter.
     */
    function removeMinter(address _minter) external onlyController returns (bool) {
        uint256 len = controllers[msg.sender].length;

        if (len == 0) revert MintController__NoMinters();
        bool minterFoundAndRemoved = false;
        for (uint256 i = 0; i < len; i++) {
            if (controllers[msg.sender][i] == _minter) {
                minterController[_minter] = address(0);
                controllers[msg.sender][i] = controllers[msg.sender][len - 1];
                isMinter[_minter] = false;
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
     * @notice Enables the minter and sets its allowance.
     * @param _newAllowance New allowance to be set for minter.
     */
    function configureMinter(
        address _minter,
        uint256 _newAllowance
    ) external onlyController returns (bool) {
        if (_minter == address(0)) revert MintController__NoZeroAddress(_minter);
        if (controllers[msg.sender].length > _maxNumOfMinters)
            revert MintController__ExceedMaxMinters();
        //total minted vs allowance
        if (minterController[_minter] == address(0)) {
            minterController[_minter] = msg.sender;
            if (controllers[msg.sender].length + 1 > _maxNumOfMinters)
                revert MintController__ExceedMaxMinters();

            controllers[msg.sender].push(_minter);
        }
        if (minterController[_minter] != msg.sender) revert MintController__MinterHasController();
        isMinter[_minter] = true;
        minterAllowance[_minter] = _newAllowance;
        emit MinterConfigured(msg.sender, _minter, _newAllowance);
        return _setMinterAllowance(_minter, _newAllowance);
    }

    /**
     * @notice Increases the minter's allowance if and only if the minter is an
     * active minter.
     * @dev An minter is considered active if minterManager.isMinter(minter)
     * returns true.
     */
    function incrementMinterAllowance(
        uint256 _allowanceIncrement,
        address _minter
    ) external onlyController returns (bool) {
        if (_allowanceIncrement <= 0) revert MintController__IncrementTooSmall();
        if (!minterManager.isMinter(_minter)) revert MintController__OnlyForMinterAllowance();

        uint256 currentAllowance = minterManager.getMinterAllowance(_minter);
        uint256 newAllowance = currentAllowance + _allowanceIncrement;

        emit MinterAllowanceIncremented(msg.sender, _minter, _allowanceIncrement, newAllowance);

        return _setMinterAllowance(_minter, newAllowance);
    }

    /**
     * @notice decreases the minter allowance if and only if the minter is
     * currently active. The controller can safely send a signed
     * decrementMinterAllowance() transaction to a minter and not worry
     * about it being used to undo a removeMinter() transaction.
     */
    function decrementMinterAllowance(
        uint256 _allowanceDecrement,
        address _minter
    ) external onlyController returns (bool) {
        if (_allowanceDecrement <= 0) revert MintController__AllowanceTooSmall();
        if (minterController[_minter] != msg.sender) revert MintController__NotMinterController();
        if (!minterManager.isMinter(_minter)) revert MintController__OnlyForMinterAllowance();

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

    // Internal functions

    /**
     * @notice Uses the MinterManagementInterface to enable the minter and
     * set its allowance.
     * @param _minter Minter to set new allowance of.
     * @param _newAllowance New allowance to be set for minter.
     */
    function _setMinterAllowance(address _minter, uint256 _newAllowance) internal returns (bool) {
        return minterManager.configureMinter(_minter, _newAllowance);
    }
}
