// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {AbstractTokenV1} from "./AbstractTokenV1.sol";
import {Ownable} from "./Ownable.sol";
import {Pausable} from "./Pausable.sol";
import {Blacklistable} from "./Blacklistable.sol";
import {Rescuable} from "./Rescuable.sol";

/**
 * @title TokenV1
 * @dev ERC20 Token backed by fiat reserves with additional functionality for minting, burning, pausing, blacklisting, and rescuing tokens.
 */
contract TokenV1 is AbstractTokenV1, Ownable, Pausable, Blacklistable, Rescuable {
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    string public currency;
    address public masterMinter;

    uint256 internal _totalSupply;

    mapping(address => uint256) internal balances;
    mapping(address => mapping(address => uint256)) internal allowed;
    mapping(address => bool) public isMinter;
    mapping(address => uint256) public minterAllowance; // Allowance set by approval

    /**
     * @dev Emitted when tokens are minted.
     * @param minter The address of the minter.
     * @param to The address of the recipient.
     * @param amount The amount of tokens minted.
     */
    event Mint(address indexed minter, address indexed to, uint256 amount);

    /**
     * @dev Emitted when tokens are burned.
     * @param burner The address of the burner.
     * @param amount The amount of tokens burned.
     */
    event Burn(address indexed burner, uint256 amount);

    /**
     * @dev Emitted when a minter is configured.
     * @param minter The address of the minter.
     * @param minterAllowedAmount The allowance of the minter.
     */
    event MinterConfigured(address indexed minter, uint256 minterAllowedAmount);

    /**
     * @dev Emitted when a minter is removed.
     * @param oldMinter The address of the removed minter.
     */
    event MinterRemoved(address indexed oldMinter);

    /**
     * @dev Emitted when the master minter is changed.
     * @param newMasterMinter The address of the new master minter.
     */
    event MasterMinterChanged(address indexed newMasterMinter);

    /**
     * @dev Emitted when the token decimals are set.
     * @param decimals The number of decimals set.
     */
    event TokenDecimalsSet(uint8 decimals);

    /**
     * @dev Emitted when a new master minter is set.
     * @param newMasterMinter The address of the new master minter.
     */
    event NewMasterMinter(address indexed newMasterMinter);

    /**
     * @dev Emitted when a new pauser is set.
     * @param newPauser The address of the new pauser.
     */
    event NewPauser(address indexed newPauser);

    /**
     * @dev Emitted when a new blacklister is set.
     * @param newBlacklister The address of the new blacklister.
     */
    event NewBlacklister(address indexed newBlacklister);

    /**
     * @dev Error thrown when the caller is not a minter.
     */
    error NotMinter();

    /**
     * @dev Error thrown when the caller is not the master minter.
     */
    error NotMasterMinter();

    /**
     * @dev Error thrown when a zero address is provided.
     * @param account The zero address that triggered the error.
     */
    error NoZeroAddress(address account);

    /**
     * @dev Error thrown when the mint amount is zero.
     */
    error MintMustBeGreaterThanZero();

    /**
     * @dev Error thrown when an account is already blacklisted.
     * @param account The blacklisted account.
     */
    error AlreadyBlacklisted(address account);

    /**
     * @dev Error thrown when an attempt to unpause an already unpaused contract is made.
     */
    error AlreadyUnpaused();

    /**
     * @dev Error thrown when the amount exceeds the balance.
     */
    error AmountExceedsBalance();

    /**
     * @dev Error thrown when the burn amount is not greater than zero.
     */
    error BurnAmountNotGreaterThanZero();

    /**
     * @dev Error thrown when the allowance is exceeded.
     */
    error AllowanceExceeded();

    /**
     * @dev Error thrown when a mint amount is not greater than zero.
     */
    error MustMintGreaterThanZero();

    /**
     * @dev Error thrown when a minter is unconfigured.
     */
    error UnconfiguredMinter();

    /**
     * @dev Error thrown when an attempt to decrease the allowance fails.
     * @param spender The spender address.
     * @param currentAllowance The current allowance.
     * @param decrement The decrement amount.
     */
    error FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 decrement);

    /**
     * @dev Error thrown when an attempt to approve a non-zero to non-zero allowance is made.
     */
    error ApproveNonZeroToNonZero();

    /**
     * @dev Modifier to make a function callable only by a minter.
     */
    modifier onlyMinter() {
        if (!isMinter[msg.sender]) revert NotMinter();
        _;
    }

    /**
     * @dev Modifier to make a function callable only by the master minter.
     */
    modifier onlyMasterMinter() {
        if (msg.sender != masterMinter) revert NotMasterMinter();
        _;
    }

    /**
     * @notice Initializes the token with given parameters at most once.
     * @param tokenName The name of the token.
     * @param tokenSymbol The symbol of the token.
     * @param tokenCurrency The currency of the token.
     * @param tokenDecimals The number of decimals the token uses.
     * @param newMasterMinter The address of the new master minter.
     * @param newPauser The address of the new pauser.
     * @param newBlacklister The address of the new blacklister.
     * @param newRescuer The address of the new rescuer.
     */
    function initializeToken(
        string memory tokenName,
        string memory tokenSymbol,
        string memory tokenCurrency,
        uint8 tokenDecimals,
        address newMasterMinter,
        address newPauser,
        address newBlacklister,
        address newRescuer
    ) public initializer {
        Ownable.initialize(msg.sender);
        Pausable.initPaused();

        if (newMasterMinter == address(0)) revert NoZeroAddress(newMasterMinter);
        if (newPauser == address(0)) revert NoZeroAddress(newPauser);
        if (newBlacklister == address(0)) revert NoZeroAddress(newBlacklister);
        if (newRescuer == address(0)) revert NoZeroAddress(newRescuer);

        _name = tokenName;
        _symbol = tokenSymbol;
        currency = tokenCurrency;
        _decimals = tokenDecimals;
        masterMinter = newMasterMinter;
        _pauser = newPauser;
        _blacklister = newBlacklister;
        _rescuer = newRescuer;

        emit NewMasterMinter(newMasterMinter);
        emit NewPauser(newPauser);
        emit NewBlacklister(newBlacklister);
        emit TokenDecimalsSet(tokenDecimals);
        emit RescuerChanged(newRescuer);
    }

    /**
     * @notice Returns the name of the token.
     * @return The name of the token.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    /**
     * @notice Returns the symbol of the token.
     * @return The symbol of the token.
     */
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    /**
     * @notice Returns the number of decimals used to get its user representation.
     * @return The number of decimals used by the token.
     */
    function decimals() public view virtual returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Returns the minting allowance of a minter.
     * @param minter The address of the minter.
     * @return The minting allowance of the minter.
     */
    function getMinterAllowance(address minter) external view returns (uint256) {
        return minterAllowance[minter];
    }

    /**
     * @notice Returns the amount of tokens that spender is allowed to transfer on behalf of owner.
     * @param owner Token owner's address.
     * @param spender Spender's address.
     * @return The allowance amount.
     */
    function allowance(address owner, address spender) external view override returns (uint256) {
        return allowed[owner][spender];
    }

    /**
     * @notice Returns the total supply of the token.
     * @return The total supply.
     */
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @notice Returns the token balance of an account.
     * @param account The address of the account.
     * @return The token balance of the account.
     */
    function balanceOf(address account) external view override returns (uint256) {
        return balances[account];
    }

    /**
     * @notice Sets spender's allowance over the caller's tokens to be a given value.
     * @param spender Spender's address.
     * @param value Allowance amount.
     * @return True if the operation was successful.
     */
    function approve(
        address spender,
        uint256 value
    )
        external
        override
        whenNotPaused
        notBlacklisted(msg.sender)
        notBlacklisted(spender)
        returns (bool)
    {
        if (allowed[msg.sender][spender] != 0 && value != 0) {
            revert ApproveNonZeroToNonZero();
        }
        _approve(msg.sender, spender, value);
        return true;
    }

    /**
     * @notice Internal function to set allowance.
     * @param owner Token owner's address.
     * @param spender Spender's address.
     * @param value Allowance amount.
     */
    function _approve(address owner, address spender, uint256 value) internal override {
        if (owner == address(0)) revert NoZeroAddress(owner);
        if (spender == address(0)) revert NoZeroAddress(spender);
        allowed[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    /**
     * @notice Transfers tokens from one address to another using allowance.
     * @param from Payer's address.
     * @param to Payee's address.
     * @param value Transfer amount.
     * @return True if the operation was successful.
     */
    function transferFrom(
        address from,
        address to,
        uint256 value
    )
        external
        override
        whenNotPaused
        notBlacklisted(msg.sender)
        notBlacklisted(from)
        notBlacklisted(to)
        returns (bool)
    {
        if (value > allowed[from][msg.sender]) revert AllowanceExceeded();
        _transfer(from, to, value);
        allowed[from][msg.sender] -= value;
        return true;
    }

    /**
     * @notice Transfers tokens from the caller to another address.
     * @param to Payee's address.
     * @param value Transfer amount.
     * @return True if the operation was successful.
     */
    function transfer(
        address to,
        uint256 value
    )
        external
        override
        whenNotPaused
        notBlacklisted(msg.sender)
        notBlacklisted(to)
        returns (bool)
    {
        _transfer(msg.sender, to, value);
        return true;
    }

    /**
     * @notice Internal function to process token transfers.
     * @param from Payer's address.
     * @param to Payee's address.
     * @param value Transfer amount.
     */
    function _transfer(address from, address to, uint256 value) internal override {
        if (from == address(0)) revert NoZeroAddress(from);
        if (to == address(0)) revert NoZeroAddress(to);
        if (value > balances[from]) revert AmountExceedsBalance();

        balances[from] -= value;
        balances[to] += value;
        emit Transfer(from, to, value);
    }

    /**
     * @notice Configures a new minter or updates the allowance of an existing minter.
     * @param minter The address of the minter.
     * @param _minterAllowedAmount The minting allowance for the minter.
     * @return True if the operation was successful.
     */
    function configureMinter(
        address minter,
        uint256 _minterAllowedAmount
    ) external whenNotPaused onlyMasterMinter returns (bool) {
        isMinter[minter] = true;
        minterAllowance[minter] = _minterAllowedAmount;

        emit MinterConfigured(minter, _minterAllowedAmount);
        return true;
    }

    /**
     * @notice Removes a minter.
     * @param minter The address of the minter to remove.
     * @return True if the operation was successful.
     */
    function removeMinter(address minter) external onlyMasterMinter returns (bool) {
        isMinter[minter] = false;
        emit MinterRemoved(minter);
        return true;
    }

    /**
     * @notice Allows a minter to burn some of its own tokens.
     * @param _amount The amount of tokens to be burned.
     */
    function burn(uint256 _amount) external whenNotPaused onlyMinter notBlacklisted(msg.sender) {
        uint256 balance = balances[msg.sender];
        if (_amount <= 0) revert BurnAmountNotGreaterThanZero();
        if (balance < _amount) revert AmountExceedsBalance();

        _totalSupply -= _amount;
        balances[msg.sender] -= _amount;
        emit Burn(msg.sender, _amount);
        emit Transfer(msg.sender, address(0), _amount);
    }

    /**
     * @notice Mints new tokens to a specified address.
     * @param _to The address to receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     * @return True if the operation was successful.
     */
    function mint(
        address _to,
        uint256 _amount
    ) public whenNotPaused notBlacklisted(msg.sender) notBlacklisted(_to) returns (bool) {
        if (_to == address(0)) revert NoZeroAddress(_to);
        if (_amount <= 0) revert MintMustBeGreaterThanZero();
        if (!isMinter[_to]) revert UnconfiguredMinter();
        if (minterAllowance[_to] < _amount) revert AllowanceExceeded();

        _totalSupply += _amount;
        balances[_to] += _amount;
        minterAllowance[_to] -= _amount;
        emit Mint(msg.sender, _to, _amount);
        emit Transfer(address(0), _to, _amount);
        return true;
    }

    /**
     * @notice Updates the master minter address.
     * @param _newMasterMinter The address of the new master minter.
     */
    function updateMasterMinter(address _newMasterMinter) external onlyOwner {
        if (_newMasterMinter == address(0)) revert NoZeroAddress(_newMasterMinter);
        masterMinter = _newMasterMinter;
        emit MasterMinterChanged(masterMinter);
    }

    /**
     * @notice Increases the allowance by a given increment.
     * @param spender Spender's address.
     * @param increment The amount to increase the allowance by.
     * @return True if the operation was successful.
     */
    function increaseAllowance(
        address spender,
        uint256 increment
    ) external whenNotPaused notBlacklisted(msg.sender) notBlacklisted(spender) returns (bool) {
        address owner = msg.sender;
        _approve(owner, spender, allowed[owner][spender] + increment);

        return true;
    }

    /**
     * @notice Decreases the allowance by a given decrement.
     * @param spender Spender's address.
     * @param decrement The amount to decrease the allowance by.
     * @return True if the operation was successful.
     */
    function decreaseAllowance(
        address spender,
        uint256 decrement
    ) external whenNotPaused notBlacklisted(msg.sender) notBlacklisted(spender) returns (bool) {
        address owner = msg.sender;
        uint256 currentAllowance = allowed[owner][spender];
        if (currentAllowance < decrement) {
            revert FailedDecreaseAllowance(spender, currentAllowance, decrement);
        }

        _approve(owner, spender, currentAllowance - decrement);
        return true;
    }
}
