// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IUtilizationRate {
    function utilization() external view returns (uint256);
}
