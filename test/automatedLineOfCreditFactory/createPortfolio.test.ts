import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFactoryFixture } from 'fixtures/automatedLineOfCreditFactoryFixture'
import { YEAR } from 'utils/constants'
import { portfolioName, portfolioSymbol } from 'config'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'
import { extractMinimalProxyImplementationAddress } from 'utils/extractImplementationAddress'

describe('AutomatedLineOfCreditFactory.createPortfolio', () => {
  const loadFixture = setupFixtureLoader()

  it('only manager can create portfolio', async () => {
    const { other, MANAGER_ROLE, attemptCreatingPortfolio } = await loadFixture(
      automatedLineOfCreditFactoryFixture,
    )
    const { tx } = await attemptCreatingPortfolio(other)
    await expect(tx).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(other, MANAGER_ROLE),
    )
  })

  it('reverts after manager role revoked from caller', async () => {
    const { factory, MANAGER_ROLE, protocolOwner, attemptCreatingPortfolio } =
      await loadFixture(automatedLineOfCreditFactoryFixture)

    const { tx } = await attemptCreatingPortfolio(protocolOwner)
    expect((await (await tx).wait()).status).to.equal(1)

    await factory.revokeRole(MANAGER_ROLE, protocolOwner.address)
    const { tx: anotherTx } = await attemptCreatingPortfolio(protocolOwner)
    await expect(anotherTx).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(protocolOwner, MANAGER_ROLE),
    )
  })

  it('sets manager and borrower', async () => {
    const { wallet, createPortfolio } = await loadFixture(
      automatedLineOfCreditFactoryFixture,
    )
    const { portfolio, MANAGER_ROLE } = await createPortfolio()

    expect(await portfolio.hasRole(MANAGER_ROLE, wallet.address)).to.be.true
    expect(await portfolio.borrower()).to.equal(wallet.address)
  })

  it('sets asset', async () => {
    const { token, createPortfolio } = await loadFixture(
      automatedLineOfCreditFactoryFixture,
    )
    const { portfolio } = await createPortfolio()

    expect(await portfolio.asset()).to.equal(token.address)
  })

  it('sets endDate', async () => {
    const { createPortfolio, extractCreationTimestamp } = await loadFixture(
      automatedLineOfCreditFactoryFixture,
    )
    const { portfolio, tx } = await createPortfolio()

    const creationTimestamp = await extractCreationTimestamp(tx)
    expect(await portfolio.endDate()).to.equal(creationTimestamp + YEAR)
  })

  it('sets name and symbol', async () => {
    const { createPortfolio } = await loadFixture(
      automatedLineOfCreditFactoryFixture,
    )
    const { portfolio } = await createPortfolio()

    expect(await portfolio.name()).to.equal(portfolioName)
    expect(await portfolio.symbol()).to.equal(portfolioSymbol)
  })

  it('sets depositController', async () => {
    const { createPortfolio, depositControllerImplementation } =
      await loadFixture(automatedLineOfCreditFactoryFixture)
    const { portfolio } = await createPortfolio()
    const usedDepositController = await portfolio.depositController()
    const usedImplementation = await extractMinimalProxyImplementationAddress(
      usedDepositController,
    )
    expect(usedImplementation).to.equal(
      depositControllerImplementation.address.toLocaleLowerCase(),
    )
  })

  it('sets withdrawController', async () => {
    const { createPortfolio, withdrawControllerImplementation } =
      await loadFixture(automatedLineOfCreditFactoryFixture)
    const { portfolio } = await createPortfolio()
    const usedWithdrawController = await portfolio.withdrawController()
    const usedImplementation = await extractMinimalProxyImplementationAddress(
      usedWithdrawController,
    )
    expect(usedImplementation).to.equal(
      withdrawControllerImplementation.address.toLocaleLowerCase(),
    )
  })

  it('sets transferController', async () => {
    const { createPortfolio, transferControllerImplementation } =
      await loadFixture(automatedLineOfCreditFactoryFixture)
    const { portfolio } = await createPortfolio()
    const usedTransferController = await portfolio.transferController()
    const usedImplementation = await extractMinimalProxyImplementationAddress(
      usedTransferController,
    )
    expect(usedImplementation).to.equal(
      transferControllerImplementation.address.toLocaleLowerCase(),
    )
  })

  it('sets interestRateController', async () => {
    const { createPortfolio, interestRateControllerImplementation } =
      await loadFixture(automatedLineOfCreditFactoryFixture)
    const { portfolio } = await createPortfolio()
    const usedInterestRateController = await portfolio.interestRateController()
    const usedImplementation = await extractMinimalProxyImplementationAddress(
      usedInterestRateController,
    )
    expect(usedImplementation).to.equal(
      interestRateControllerImplementation.address.toLocaleLowerCase(),
    )
  })

  it('sets interestRateController directly (without cloning)', async () => {
    const { createDefaultPortfolioWithDirectInterestRateController, interestRateControllerImplementation } =
      await loadFixture(automatedLineOfCreditFactoryFixture)
    const { portfolio } = await createDefaultPortfolioWithDirectInterestRateController()
    const usedInterestRateController = await portfolio.interestRateController()
    expect(usedInterestRateController).to.equal(
      interestRateControllerImplementation.address,
    )
  })
})
