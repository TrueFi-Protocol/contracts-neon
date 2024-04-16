// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IRateComputer} from "./vendor/adrastia/IRateComputer.sol";
import {IProtocolConfig} from "./IProtocolConfig.sol";
import {IPortfolio} from "./IPortfolio.sol";
import {IDepositController} from "./IDepositController.sol";
import {IWithdrawController} from "./IWithdrawController.sol";
import {ITransferController} from "./ITransferController.sol";
import {IUtilizationRate} from "./IUtilizationRate.sol";

enum AutomatedLineOfCreditStatus {
    Open,
    Full,
    Closed
}

interface IAutomatedLineOfCredit is IPortfolio, IUtilizationRate {
    struct Controllers {
        IDepositController depositController;
        IWithdrawController withdrawController;
        ITransferController transferController;
        IRateComputer interestRateController;
    }

    function initialize(
        IProtocolConfig _protocolConfig,
        uint256 _duration,
        IERC20Metadata _asset,
        address _borrower,
        uint256 _maxSize,
        Controllers memory controllers,
        string memory name,
        string memory symbol
    ) external;

    function borrow(uint256 amount) external;

    function repay(uint256 amount) external;
}
