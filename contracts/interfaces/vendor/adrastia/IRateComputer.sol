//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/**
 * @title IRateComputer
 * @notice An interface that defines a contract that computes rates.
 * @author TRILEZ SOFTWARE INC. dba. Adrastia
 * @custom:github https://github.com/adrastia-oracle/adrastia-periphery
 */
interface IRateComputer {
    /// @notice Computes the rate for a token.
    /// @param token The address of the token to compute the rate for.
    /// @return rate The rate for the token.
    function computeRate(address token) external view returns (uint64);
}
