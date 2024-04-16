import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditDepositFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR, DAY } from 'utils'

describe('AutomatedLineOfCredit.borrow', () => {
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithDeposit = automatedLineOfCreditDepositFixture(amount)
  const loadFixture = () => fixtureLoader(fixtureWithDeposit)

  it('reverts if paused', async () => {
    const { portfolio } = await loadFixture()
    await portfolio.pause()
    await expect(portfolio.borrow(parseUSDC(amount))).to.be.revertedWith(
      'Pausable: paused',
    )
  })

  it('does not allow non-borrower to borrow', async () => {
    const { portfolio, other } = await loadFixture()
    await expect(
      portfolio.connect(other).borrow(parseUSDC(amount)),
    ).to.be.revertedWith('AutomatedLineOfCredit: Caller is not the borrower')
  })

  it('cannot borrow more funds than available', async () => {
    const { portfolio } = await loadFixture()
    await expect(portfolio.borrow(parseUSDC(amount + 1))).to.be.revertedWith(
      'AutomatedLineOfCredit: Amount exceeds portfolio balance',
    )
  })

  it('cannot borrow zero assets', async () => {
    const { portfolio } = await loadFixture()
    await expect(portfolio.borrow(0)).to.be.revertedWith(
      'AutomatedLineOfCredit: Cannot borrow zero assets',
    )
  })

  it('transfers funds to borrower', async () => {
    const { portfolio, token, wallet } = await loadFixture()
    const borrowerBalanceBefore = await token.balanceOf(wallet.address)
    await portfolio.borrow(parseUSDC(amount))
    expect(await token.balanceOf(wallet.address)).to.equal(
      borrowerBalanceBefore.add(parseUSDC(amount)),
    )
  })

  it('updates portfolio balance properly', async () => {
    const { portfolio, token } = await loadFixture()
    const portfolioBalanceBefore = await token.balanceOf(portfolio.address)
    const portfolioVirtualBalanceBefore = await portfolio.virtualTokenBalance()
    await portfolio.borrow(parseUSDC(amount))
    const portfolioBalanceAfter = await token.balanceOf(portfolio.address)
    const portfolioVirtualBalanceAfter = await portfolio.virtualTokenBalance()

    expect(portfolioBalanceAfter).to.equal(
      portfolioBalanceBefore.sub(parseUSDC(amount)),
    )
    expect(portfolioVirtualBalanceAfter).to.equal(
      portfolioVirtualBalanceBefore.sub(parseUSDC(amount)),
    )
    expect(portfolioVirtualBalanceAfter).to.equal(portfolioBalanceAfter)
  })

  it('updates borrowed amount in portfolio', async () => {
    const { portfolio } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount))
    expect(await portfolio.borrowedAmount()).to.equal(parseUSDC(amount))
  })

  it('updates accruedInterest', async () => {
    const { portfolio, timeTravel, calculateInterest } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount / 2))
    await timeTravel(YEAR / 2)
    const interest = await calculateInterest(parseUSDC(amount / 2), YEAR / 2)
    await portfolio.borrow(parseUSDC(amount / 2))
    expect(await portfolio.accruedInterest()).to.closeTo(
      interest,
      parseUSDC(1),
    )
  })

  it('cannot borrow past end date', async () => {
    const { portfolio, timeTravel } = await loadFixture()
    await timeTravel(YEAR + DAY)
    await expect(portfolio.borrow(parseUSDC(amount / 2))).to.be.revertedWith(
      'AutomatedLineOfCredit: Portfolio end date has elapsed',
    )
  })

  it('updates last protocol fee rate', async () => {
    const { portfolio, protocolConfig, protocolFeeRate } = await loadFixture()
    const newFeeRate = 100
    await protocolConfig.setProtocolFeeRate(newFeeRate)
    expect(await portfolio.lastProtocolFeeRate()).to.equal(protocolFeeRate)

    await portfolio.borrow(parseUSDC(amount))
    expect(await portfolio.lastProtocolFeeRate()).to.equal(newFeeRate)
  })

  it('emits Borrowed event', async () => {
    const { portfolio } = await loadFixture()
    await expect(portfolio.borrow(parseUSDC(amount)))
      .to.emit(portfolio, 'Borrowed')
      .withArgs(parseUSDC(amount))
  })

  it('transfers fee', async () => {
    const {
      portfolio,
      token,
      executeAndSetNextTimestamp,
      protocolConfig,
      protocolTreasury,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await portfolio.borrow(parseUSDC(1))
    expect(await token.balanceOf(protocolTreasury)).to.equal(
      parseUSDC(amount * 0.05),
    )
  })

  it('borrow limit includes fees', async () => {
    const { portfolio, executeAndSetNextTimestamp, protocolConfig } =
      await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await expect(portfolio.borrow(parseUSDC(amount))).to.be.revertedWith(
      'AutomatedLineOfCredit: Amount exceeds portfolio balance',
    )
  })

  it('emits FeePaid event', async () => {
    const {
      portfolio,
      executeAndSetNextTimestamp,
      protocolConfig,
      protocolTreasury,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await expect(portfolio.borrow(parseUSDC(1)))
      .to.emit(portfolio, 'FeePaid')
      .withArgs(protocolTreasury, parseUSDC(amount * 0.05))
  })
})
