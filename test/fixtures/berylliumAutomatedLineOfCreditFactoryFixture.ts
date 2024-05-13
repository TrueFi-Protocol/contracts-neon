import {
  BerylliumAutomatedLineOfCreditFactory__factory,
  BerylliumAutomatedLineOfCredit__factory,
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

export async function berylliumAutomatedLineOfCreditFactoryFixture([protocolOwner]: Wallet[], provider: MockProvider) {
  const portfolioImplementation = await new BerylliumAutomatedLineOfCredit__factory(protocolOwner).deploy()
  const protocolConfig = await deployBehindProxy(new ProtocolConfig__factory(protocolOwner), protocolFeeRate, protocolOwner.address, protocolOwner.address, protocolOwner.address)
  const factory = await deployBehindProxy(new BerylliumAutomatedLineOfCreditFactory__factory(protocolOwner), portfolioImplementation.address, protocolConfig.address)

  const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE()
  const MANAGER_ROLE = await factory.MANAGER_ROLE()
  const PAUSER_ROLE = await factory.PAUSER_ROLE()

  const token = await new MockUsdc__factory(protocolOwner).deploy()

  const extractPortfolioAddress = (pendingTx: Promise<ContractTransaction>) =>
    extractArgFromTx(pendingTx, [factory.address, 'PortfolioCreated', 'newPortfolio'])

  async function extractCreationTimestamp(pendingTx: Promise<ContractTransaction>) {
    const tx = await pendingTx
    const receipt = await tx.wait()
    const creationTimestamp = (await provider.getBlock(receipt.blockHash)).timestamp
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
  ) {
    return { tx: factory.connect(sender).createPortfolio(
      YEAR,
      asset,
      maxSize,
      interestRatePolyline,
      controllersDeployData,
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
  ) {
    const { tx } = await attemptCreatingPortfolio(
      protocolOwner,
      asset,
      interestRatePolyline,
      portfolioName,
      portfolioSymbol,
    )
    const portfolioAddress = await extractPortfolioAddress(tx)
    const portfolio = new BerylliumAutomatedLineOfCredit__factory(protocolOwner).attach(portfolioAddress)

    const MANAGER_ROLE = await portfolio.MANAGER_ROLE()

    return { portfolio, tx, DEFAULT_ADMIN_ROLE, MANAGER_ROLE, ...controllers }
  }

  await factory.grantRole(MANAGER_ROLE, protocolOwner.address)

  return { factory, protocolOwner, token, DEFAULT_ADMIN_ROLE, MANAGER_ROLE, PAUSER_ROLE, createPortfolio, attemptCreatingPortfolio, portfolioImplementation, extractCreationTimestamp, protocolConfig, ...controllers }
}
