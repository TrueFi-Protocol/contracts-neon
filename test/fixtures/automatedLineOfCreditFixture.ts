import {
  AllowAllLenderVerifier__factory,
  LinearKinkInterestRateController__factory,
  ProtocolConfig__factory,
} from 'contracts'
import {
  DepositController__factory,
  AutomatedLineOfCredit__factory,
  MockUsdc__factory,
  BlockedTransferController__factory,
  WithdrawController__factory,
  LegacyWhitelistDepositController__factory,
} from 'contracts'
import { BigNumber, BigNumberish, ContractTransaction, Wallet } from 'ethers'
import { YEAR } from 'utils/constants'
import { parseUSDC } from 'utils/parseUSDC'
import {
  executeAndSetNextTimestamp as _executeAndSetNextTimestamp,
  timeTravel as _timeTravel,
  timeTravelTo as _timeTravelTo,
  getTxTimestamp as _getTxTimestamp,
  setNextBlockTimestamp as _setNextBlockTimestamp,
  skipBlocksWithProvider,
  mockLenderVerifier as _mockLenderVerifier,
  mockDepositController as _mockDepositController,
  mockWithdrawController as _mockWithdrawController,
  MockLenderVerifierConfig,
  MockDepositControllerConfig,
  MockWithdrawControllerConfig,
} from 'utils'
import {
  interestRatePolyline,
  invertedInterestRatePolyline,
  maxSize,
  portfolioName,
  portfolioSymbol,
  alocProtocolFeeRate as protocolFeeRate,
} from 'config'
import { deployBehindProxy } from 'utils/deployBehindProxy'
import { MockProvider } from 'ethereum-waffle'
import { parseUnits } from 'ethers/lib/utils'

export const automatedLineOfCreditFeeFixture = (feeRate: BigNumberish) => {
  return async function ([wallet]: Wallet[], provider: MockProvider) {
    const fixtureData = await automatedLineOfCreditFixture([wallet], provider)
    const { protocolConfig } = fixtureData
    await protocolConfig.setProtocolFeeRate(feeRate)
    return { ...fixtureData, feeRate }
  }
}

export const automatedLineOfCreditDepositFixture = (amount: BigNumberish) => {
  return async function ([wallet]: Wallet[], provider: MockProvider) {
    const fixtureData = await automatedLineOfCreditFixture([wallet], provider)
    const { deposit } = fixtureData
    await deposit(wallet, parseUSDC(amount))
    return { ...fixtureData, amount }
  }
}

export const automatedLineOfCreditFixture = (
  [wallet]: Wallet[],
  provider: MockProvider,
) => _automatedLineOfCreditFixture([wallet], interestRatePolyline, provider)

export const automatedLineOfCreditWithInvertedPolylineFixture = (
  [wallet]: Wallet[],
  provider: MockProvider,
) =>
  _automatedLineOfCreditFixture(
    [wallet],
    invertedInterestRatePolyline,
    provider,
  )

async function _automatedLineOfCreditFixture(
  [wallet]: Wallet[],
  _interestRatePolyline: any,
  provider: MockProvider,
) {
  const {
    minInterestRate,
    minInterestRateUtilizationThreshold,
    optimumInterestRate,
    optimumUtilization,
    maxInterestRate,
    maxInterestRateUtilizationThreshold,
  } = _interestRatePolyline

  const token = await new MockUsdc__factory(wallet).deploy()
  await token.mint(wallet.address, parseUSDC(1_000_000_000))

  const allowAllLenderVerifier = await new AllowAllLenderVerifier__factory(
    wallet,
  ).deploy()
  const depositController = await new DepositController__factory(
    wallet,
  ).deploy()
  await depositController.initialize(allowAllLenderVerifier.address)
  const whitelistDepositController =
    await new LegacyWhitelistDepositController__factory(wallet).deploy()
  await whitelistDepositController.initialize(allowAllLenderVerifier.address)
  const withdrawController = await new WithdrawController__factory(
    wallet,
  ).deploy()
  const transferController = await new BlockedTransferController__factory(
    wallet,
  ).deploy()
  const interestRateController = await new LinearKinkInterestRateController__factory(
    wallet,
  ).deploy()

  await interestRateController.initialize(_interestRatePolyline)

  const protocolTreasury = Wallet.createRandom().address
  const protocolConfig = await deployBehindProxy(
    new ProtocolConfig__factory(wallet),
    protocolFeeRate,
    wallet.address,
    protocolTreasury,
    wallet.address,
  )

  const controllersAddresses = {
    depositController: depositController.address,
    withdrawController: withdrawController.address,
    transferController: transferController.address,
    interestRateController: interestRateController.address,
  }

  const portfolioDuration = YEAR
  const portfolio = await deployBehindProxy(
    new AutomatedLineOfCredit__factory(wallet),
    protocolConfig.address,
    portfolioDuration,
    token.address,
    wallet.address,
    maxSize,
    controllersAddresses,
    portfolioName,
    portfolioSymbol,
  )

  const DEFAULT_ADMIN_ROLE = await portfolio.DEFAULT_ADMIN_ROLE()
  const MANAGER_ROLE = await portfolio.MANAGER_ROLE()
  const CONTROLLER_ADMIN_ROLE = await portfolio.CONTROLLER_ADMIN_ROLE()
  const PAUSER_ROLE = await portfolio.PAUSER_ROLE()

  const setDepositController = portfolio.setDepositController
  const setWithdrawController = portfolio.setWithdrawController
  const setTransferController = portfolio.setTransferController
  const setInterestRateController = portfolio.setInterestRateController

  async function deposit(
    wallet: Wallet,
    amount: BigNumberish,
    receiver?: { address: string },
    timestamp?: number,
  ) {
    receiver = receiver || wallet
    await token.connect(wallet).approve(portfolio.address, amount)
    if (timestamp) {
      await setNextBlockTimestamp(timestamp)
    }
    return portfolio.connect(wallet).deposit(amount, receiver.address)
  }

  async function mint(
    wallet: Wallet,
    shares: BigNumberish,
    receiver?: { address: string },
    timestamp?: number,
  ) {
    receiver = receiver || wallet
    const assets = await portfolio.previewMint(shares)
    await token.connect(wallet).approve(portfolio.address, assets)
    if (timestamp) {
      await setNextBlockTimestamp(timestamp)
    }
    return portfolio.connect(wallet).mint(shares, receiver.address)
  }

  function withdraw(
    wallet: Wallet,
    amount: BigNumberish,
    receiver?: { address: string },
    owner?: { address: string },
  ) {
    receiver = receiver || wallet
    owner = owner || wallet
    return portfolio
      .connect(wallet)
      .withdraw(amount, receiver.address, owner.address)
  }

  function redeem(
    wallet: Wallet,
    shares: BigNumberish,
    receiver?: { address: string },
    owner?: { address: string },
  ) {
    receiver = receiver || wallet
    owner = owner || wallet
    return portfolio
      .connect(wallet)
      .redeem(shares, receiver.address, owner.address)
  }

  async function borrowAndSetNextTimestamp(
    amount: BigNumber,
    time: number = YEAR,
  ) {
    const borrow = await portfolio.borrow(amount)
    const interest = await calculateInterest(amount, time)
    const borrowTimestamp = await _getTxTimestamp(borrow, provider)
    await setNextBlockTimestamp(borrowTimestamp + time)
    return interest
  }

  async function borrowAndRepayWithInterest(
    amount: BigNumber,
    time: number = YEAR,
  ) {
    await token.approve(portfolio.address, amount.mul(2))
    const interest = await borrowAndSetNextTimestamp(amount, time)
    await portfolio.repayInFull()
    return interest
  }

  async function calculateInterest(
    amount: BigNumber,
    duration: number,
  ): Promise<BigNumber> {
    const interestRate = await portfolio.interestRate()
    return amount.mul(duration).mul(interestRate).div(YEAR).div(10000)
  }

  function calculateInterestRate(_utilization: BigNumber): number {
    const utilization = _utilization.toNumber()
    if (utilization <= minInterestRateUtilizationThreshold) {
      return minInterestRate
    } else if (utilization <= optimumUtilization) {
      return (
        minInterestRate +
        ((utilization - minInterestRateUtilizationThreshold) *
          (optimumInterestRate - minInterestRate)) /
          (optimumUtilization - minInterestRateUtilizationThreshold)
      )
    } else if (utilization <= maxInterestRateUtilizationThreshold) {
      return (
        optimumInterestRate +
        ((utilization - optimumUtilization) *
          (maxInterestRate - optimumInterestRate)) /
          (maxInterestRateUtilizationThreshold - optimumUtilization)
      )
    } else {
      return maxInterestRate
    }
  }

  const mockLenderVerifier = (config: MockLenderVerifierConfig) =>
    _mockLenderVerifier(wallet, portfolio, config)

  const mockDepositController = (config: MockDepositControllerConfig) =>
    _mockDepositController(wallet, setDepositController, config)

  const mockWithdrawController = (config: MockWithdrawControllerConfig) =>
    _mockWithdrawController(wallet, setWithdrawController, config)

  const timeTravel = (time: number) => _timeTravel(provider, time)
  const timeTravelTo = (time: number) => _timeTravelTo(provider, time)
  const mineBlock = () => skipBlocksWithProvider(provider, 1)
  const setNextBlockTimestamp = (timestamp: number) =>
    _setNextBlockTimestamp(provider, timestamp)
  const getTxTimestamp = async (
    tx: ContractTransaction | Promise<ContractTransaction>,
  ) => _getTxTimestamp(await tx, provider)
  const executeAndSetNextTimestamp = (
    tx: Promise<ContractTransaction>,
    timestamp: number,
  ) => _executeAndSetNextTimestamp(provider, tx, timestamp)
  const executeAndTimeTravel = async (
    tx: Promise<ContractTransaction>,
    timestamp: number,
  ) => {
    const txTimestamp = await getTxTimestamp(tx)
    await timeTravelTo(txTimestamp + timestamp)
  }

  const tokenDecimals = await token.decimals()
  const parseShares = (amount: BigNumberish) =>
    parseUnits(amount.toString(), tokenDecimals)

  return {
    portfolio,
    token,
    DEFAULT_ADMIN_ROLE,
    MANAGER_ROLE,
    CONTROLLER_ADMIN_ROLE,
    PAUSER_ROLE,
    depositController,
    withdrawController,
    transferController,
    deposit,
    withdraw,
    mint,
    redeem,
    setDepositController,
    setTransferController,
    setWithdrawController,
    portfolioDuration,
    timeTravel,
    timeTravelTo,
    calculateInterest,
    calculateInterestRate,
    interestRatePolyline: _interestRatePolyline,
    protocolConfig,
    maxSize,
    getTxTimestamp,
    executeAndSetNextTimestamp,
    executeAndTimeTravel,
    setNextBlockTimestamp,
    borrowAndRepayWithInterest,
    parseShares,
    mockLenderVerifier,
    mockWithdrawController,
    mockDepositController,
    borrowAndSetNextTimestamp,
    mineBlock,
    protocolFeeRate,
    protocolTreasury,
    whitelistDepositController,
    controllersAddresses,
    interestRateController,
    setInterestRateController,
  }
}
