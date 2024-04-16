import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditDepositFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR, DAY } from 'utils/constants'

describe('AutomatedLineOfCredit.repay', () => {
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithDeposit = automatedLineOfCreditDepositFixture(amount)
  const loadFixture = () => fixtureLoader(fixtureWithDeposit)

  it('transfers funds to portfolio', async () => {
    const { portfolio, token, wallet } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount))

    const portfolioBalanceBefore = await token.balanceOf(portfolio.address)
    const portfolioVirtualBalanceBefore = await portfolio.virtualTokenBalance()
    const borrowerBalanceBefore = await token.balanceOf(wallet.address)

    await token.approve(portfolio.address, parseUSDC(amount))
    await portfolio.repay(parseUSDC(amount))

    const portfolioBalanceAfter = await token.balanceOf(portfolio.address)
    const portfolioVirtualBalanceAfter = await portfolio.virtualTokenBalance()
    const borrowerBalanceAfter = await token.balanceOf(wallet.address)

    expect(portfolioBalanceAfter).to.equal(
      portfolioBalanceBefore.add(parseUSDC(amount)),
    )
    expect(portfolioVirtualBalanceAfter).to.equal(
      portfolioVirtualBalanceBefore.add(parseUSDC(amount)),
    )
    expect(portfolioVirtualBalanceAfter).to.equal(portfolioBalanceAfter)
    expect(borrowerBalanceAfter).to.equal(
      borrowerBalanceBefore.sub(parseUSDC(amount)),
    )
  })

  it('decreases borrowedAmount when repaying over interest', async () => {
    const { portfolio, token, borrowAndSetNextTimestamp } = await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount / 2))
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount),
      YEAR / 2,
    )
    await portfolio.repay(parseUSDC(amount / 2))

    expect(await portfolio.accruedInterest()).to.equal(0)
    expect(await portfolio.borrowedAmount()).to.equal(
      parseUSDC(amount / 2).add(interest),
    )
  })

  it('decreases accruedInterest when repaying below interest', async () => {
    const { portfolio, token, borrowAndSetNextTimestamp } = await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount / 2))
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount),
      YEAR / 2,
    )
    await portfolio.repay(interest.div(2))

    expect(await portfolio.accruedInterest()).to.equal(interest.div(2))
    expect(await portfolio.borrowedAmount()).to.equal(parseUSDC(amount))
  })

  it('can repay past end date', async () => {
    const { portfolio, borrowAndSetNextTimestamp, token } = await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount / 2))
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount),
      YEAR + DAY,
    )
    await portfolio.repay(parseUSDC(amount / 2))

    expect(await portfolio.borrowedAmount()).to.equal(
      parseUSDC(amount / 2).add(interest),
    )
  })

  it('reverts if paused', async () => {
    const { portfolio, token } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount))
    await token.approve(portfolio.address, parseUSDC(amount))

    await portfolio.pause()

    await expect(portfolio.repay(parseUSDC(amount))).to.be.revertedWith(
      'Pausable: paused',
    )
  })

  it('reverts if caller is not borrower', async () => {
    const { portfolio, token, other } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount))
    await token.approve(portfolio.address, parseUSDC(amount))
    await expect(
      portfolio.connect(other).repay(parseUSDC(amount)),
    ).to.be.revertedWith('AutomatedLineOfCredit: Caller is not the borrower')
  })

  it('emits Repaid event', async () => {
    const { portfolio, token } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount))
    await token.approve(portfolio.address, parseUSDC(amount))

    await expect(portfolio.repay(parseUSDC(amount)))
      .to.emit(portfolio, 'Repaid')
      .withArgs(parseUSDC(amount))
  })

  it('updates last protocol fee rate', async () => {
    const { portfolio, protocolConfig, token, protocolFeeRate } =
      await loadFixture()
    await portfolio.borrow(parseUSDC(amount))

    const newFeeRate = 100
    await protocolConfig.setProtocolFeeRate(newFeeRate)
    expect(await portfolio.lastProtocolFeeRate()).to.equal(protocolFeeRate)

    await token.approve(portfolio.address, parseUSDC(amount))
    await portfolio.repay(parseUSDC(amount))
    expect(await portfolio.lastProtocolFeeRate()).to.equal(newFeeRate)
  })

  it('reverts when repaying 0', async () => {
    const { portfolio, token } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount))
    await token.approve(portfolio.address, parseUSDC(amount))
    await expect(portfolio.repay(0)).to.be.revertedWith(
      'AutomatedLineOfCredit: Repayment amount must be greater than 0',
    )
  })

  it('transfers fee', async () => {
    const {
      token,
      protocolConfig,
      protocolTreasury,
      executeAndSetNextTimestamp,
      portfolio,
      calculateInterest,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await token.approve(portfolio.address, parseUSDC(amount / 2))
    await executeAndSetNextTimestamp(portfolio.borrow(parseUSDC(amount)), YEAR)
    const interest = await calculateInterest(parseUSDC(amount), YEAR)
    await portfolio.repay(parseUSDC(amount / 2))

    expect(await token.balanceOf(protocolTreasury)).to.equal(
      parseUSDC(amount).add(interest).div(10),
    )
  })

  it('updates unpaidFee', async () => {
    const {
      token,
      protocolConfig,
      portfolio,
      executeAndSetNextTimestamp,
      calculateInterest,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await token.approve(portfolio.address, parseUSDC(amount))
    await executeAndSetNextTimestamp(portfolio.borrow(parseUSDC(amount)), YEAR)
    const interest = await calculateInterest(parseUSDC(amount), YEAR)
    await portfolio.repay(parseUSDC(1))

    expect(await portfolio.unpaidFee()).to.equal(
      parseUSDC(amount).add(interest).div(10).sub(parseUSDC(1)),
    )
  })

  it('decreases accruedInterest when repaying below fee', async () => {
    const {
      token,
      protocolConfig,
      executeAndSetNextTimestamp,
      portfolio,
      calculateInterest,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await token.approve(portfolio.address, parseUSDC(amount))
    await executeAndSetNextTimestamp(portfolio.borrow(parseUSDC(amount)), YEAR)
    const interest = await calculateInterest(parseUSDC(amount), YEAR)
    await portfolio.repay(parseUSDC(1))

    expect(await portfolio.accruedInterest()).to.equal(
      interest.sub(parseUSDC(1)),
    )
    expect(await portfolio.borrowedAmount()).to.equal(parseUSDC(amount))
  })

  it('decreases borrowedAmount when repaying below fee', async () => {
    const {
      token,
      protocolConfig,
      portfolio,
      executeAndSetNextTimestamp,
      calculateInterest,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await token.approve(portfolio.address, parseUSDC(amount))
    await executeAndSetNextTimestamp(portfolio.borrow(parseUSDC(amount)), YEAR)
    const interest = await calculateInterest(parseUSDC(amount), YEAR)
    await portfolio.repay(interest.add(parseUSDC(1)))

    expect(await portfolio.accruedInterest()).to.equal(0)
    expect(await portfolio.borrowedAmount()).to.equal(parseUSDC(amount - 1))
  })

  it('emits FeePaid event', async () => {
    const {
      token,
      protocolConfig,
      executeAndTimeTravel,
      portfolio,
      protocolTreasury,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await portfolio.borrow(parseUSDC(amount))
    await executeAndTimeTravel(
      token.approve(portfolio.address, parseUSDC(amount)),
      YEAR,
    )
    await expect(portfolio.repay(parseUSDC(1)))
      .to.emit(portfolio, 'FeePaid')
      .withArgs(protocolTreasury, parseUSDC(1))
  })

  it('can repay everything', async () => {
    const { portfolio, borrowAndSetNextTimestamp, token } = await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount * 2))
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount),
      YEAR / 2,
    )
    await portfolio.repay(parseUSDC(amount).add(interest))
    expect(await portfolio.totalDebt()).to.equal(0)
  })

  it('cannot repay more than total debt', async () => {
    const { portfolio, borrowAndSetNextTimestamp, token } = await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount * 2))
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount),
      YEAR / 2,
    )
    await expect(
      portfolio.repay(parseUSDC(amount).add(interest).add(1)),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: Amount must be less than total debt',
    )
  })
})
