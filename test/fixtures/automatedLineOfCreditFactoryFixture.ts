import {
  AutomatedLineOfCreditFactory__factory,
  AutomatedLineOfCredit__factory,
  LinearKinkInterestRateController__factory,
  MockUsdc__factory,
  ProtocolConfig__factory,
} from 'contracts'
import { Wallet, ContractTransaction } from 'ethers'
import { extractArgFromTx } from 'utils'
import { deployBehindProxy } from 'utils/deployBehindProxy'
import { YEAR } from 'utils/constants'
import {
  interestRatePolyline as _interestRatePolyline,
  maxSize,
  portfolioName as _portfolioName,
  portfolioSymbol as _portfolioSymbol,
  protocolFeeRate,
} from 'config'
import { MockProvider } from 'ethereum-waffle'
import { deployBasicControllers } from './tasks'

export async function automatedLineOfCreditFactoryFixture(
  [protocolOwner]: Wallet[],
  provider: MockProvider,
) {
  const portfolioImplementation = await new AutomatedLineOfCredit__factory(
    protocolOwner,
  ).deploy()
  const protocolConfig = await deployBehindProxy(
    new ProtocolConfig__factory(protocolOwner),
    protocolFeeRate,
    protocolOwner.address,
    protocolOwner.address,
    protocolOwner.address,
  )
  const factory = await deployBehindProxy(
    new AutomatedLineOfCreditFactory__factory(protocolOwner),
    portfolioImplementation.address,
    protocolConfig.address,
  )

  const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE()
  const MANAGER_ROLE = await factory.MANAGER_ROLE()
  const PAUSER_ROLE = await factory.PAUSER_ROLE()

  const token = await new MockUsdc__factory(protocolOwner).deploy()

  const extractPortfolioAddress = (pendingTx: Promise<ContractTransaction>) =>
    extractArgFromTx(pendingTx, [
      factory.address,
      'PortfolioCreated',
      'newPortfolio',
    ])

  async function extractCreationTimestamp(
    pendingTx: Promise<ContractTransaction>,
  ) {
    const tx = await pendingTx
    const receipt = await tx.wait()
    const creationTimestamp = (await provider.getBlock(receipt.blockHash))
      .timestamp
    return creationTimestamp
  }

  const controllers = await deployBasicControllers(protocolOwner)
  const { controllersDeployData } = controllers

  function attemptCreatingPortfolio(
    sender: Wallet,
    asset = token.address,
    interestRatePolyline = _interestRatePolyline,
    portfolioName: string = _portfolioName,
    portfolioSymbol: string = _portfolioSymbol,
    directInterestRateController: string = undefined,
  ) {
    const newControllersDeployData = controllersDeployData
    if (directInterestRateController) {
      // We are telling the factory not to deploy a new interest rate controller, but to use the one provided
      newControllersDeployData.interestRateControllerImplementation = directInterestRateController
      newControllersDeployData.interestRateControllerInitData = '0x'
      newControllersDeployData.interestRateControllerClone = false
    } else {
      // A bit of a hack to get the portfolio to deploy with the correct interest rate controller data
      newControllersDeployData.interestRateControllerInitData =
        LinearKinkInterestRateController__factory.createInterface().encodeFunctionData(
          'initialize',
          [interestRatePolyline],
        )
    }

    return {
      tx: factory
        .connect(sender)
        .createPortfolio(
          YEAR,
          asset,
          maxSize,
          newControllersDeployData,
          portfolioName,
          portfolioSymbol,
        ),
    }
  }

  async function createPortfolio(
    asset = token.address,
    interestRatePolyline = _interestRatePolyline,
    portfolioName: string = _portfolioName,
    portfolioSymbol: string = _portfolioSymbol,
    directInterestRateController: string = undefined,
  ) {
    const { tx } = await attemptCreatingPortfolio(
      protocolOwner,
      asset,
      interestRatePolyline,
      portfolioName,
      portfolioSymbol,
      directInterestRateController,
    )
    const portfolioAddress = await extractPortfolioAddress(tx)
    const portfolio = new AutomatedLineOfCredit__factory(protocolOwner).attach(
      portfolioAddress,
    )

    const MANAGER_ROLE = await portfolio.MANAGER_ROLE()

    return { portfolio, tx, DEFAULT_ADMIN_ROLE, MANAGER_ROLE, ...controllers }
  }

  async function createDefaultPortfolioWithDirectInterestRateController() {
    const portfolio = await createPortfolio(
      token.address,
      _interestRatePolyline,
      _portfolioName,
      _portfolioSymbol,
      controllers.interestRateControllerImplementation.address,
    )

    return portfolio
  }

  await factory.grantRole(MANAGER_ROLE, protocolOwner.address)

  return {
    factory,
    protocolOwner,
    token,
    DEFAULT_ADMIN_ROLE,
    MANAGER_ROLE,
    PAUSER_ROLE,
    createPortfolio,
    attemptCreatingPortfolio,
    portfolioImplementation,
    extractCreationTimestamp,
    protocolConfig,
    ...controllers,
    createDefaultPortfolioWithDirectInterestRateController,
  }
}
