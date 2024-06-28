//SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {AbstractTokenV1} from "../src/TokenContracts/AbstractTokenV1.sol";
import {Ownable} from "../src/TokenContracts/Ownable.sol";
import {Pausable} from "../src/TokenContracts/Pausable.sol";
import {Blacklistable} from "../src/TokenContracts/Blacklistable.sol";
import { Rescuable } from "../src/TokenContracts/Rescuable.sol";
import {TokenV1} from "../src/TokenContracts/TokenV1.sol";
/**
 * @title Token
 * @dev ERC20 Token backed by fiat reserves
 */

contract TokenV2 is AbstractTokenV1, Ownable, Pausable, Blacklistable, Rescuable, TokenV1 {
    /**
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public view virtual override returns (uint8) {
        return 2;
    }
}
