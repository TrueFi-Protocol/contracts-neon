import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditDepositFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR } from 'utils/constants'

describe('AutomatedLineOfCredit.repayInFull', () => {
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithDeposit = automatedLineOfCreditDepositFixture(amount)
  const loadFixture = () => fixtureLoader(fixtureWithDeposit)

  it('transfers funds to portfolio', async () => {
    const { portfolio, token, wallet, borrowAndSetNextTimestamp } =
      await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount * 2))
    const interest = await borrowAndSetNextTimestamp(parseUSDC(amount))
    const virtualTokenBalanceBefore = await portfolio.virtualTokenBalance()
    const borrowerBalanceBefore = await token.balanceOf(wallet.address)

    await portfolio.repayInFull()

    const repaidAmount = parseUSDC(amount).add(interest)
    expect(await token.balanceOf(wallet.address)).to.equal(
      borrowerBalanceBefore.sub(repaidAmount),
    )
    expect(await portfolio.virtualTokenBalance()).to.equal(
      virtualTokenBalanceBefore.add(repaidAmount),
    )
    expect(await token.balanceOf(portfolio.address)).to.equal(
      await portfolio.virtualTokenBalance(),
    )
  })

  it('sets borrowed amount to 0', async () => {
    const { portfolio, token } = await loadFixture()
    await portfolio.borrow(amount)
    await token.approve(portfolio.address, parseUSDC(amount).add(parseUSDC(1)))
    await portfolio.repayInFull()

    expect(await portfolio.borrowedAmount()).to.equal(0)
  })

  it('sets accrued interest to 0', async () => {
    const { portfolio, token } = await loadFixture()
    await portfolio.borrow(amount)
    await token.approve(portfolio.address, parseUSDC(amount).add(parseUSDC(1)))
    await portfolio.repayInFull()

    expect(await portfolio.accruedInterest()).to.equal(0)
    expect(await portfolio.unincludedInterest()).to.equal(0)
  })

  it('correctly calculates interest owed', async () => {
    const { portfolio, token, borrowAndSetNextTimestamp } = await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount * 2))
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount),
      YEAR / 2,
    )
    await portfolio.repayInFull()

    expect(await token.balanceOf(portfolio.address)).to.equal(
      parseUSDC(amount).add(interest),
    )
  })

  it('reverts if paused', async () => {
    const { portfolio, token } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount))
    await token.approve(portfolio.address, parseUSDC(amount))

    await portfolio.pause()

    await expect(portfolio.repayInFull()).to.be.revertedWith(
      'Pausable: paused',
    )
  })

  it('reverts if caller is not borrower', async () => {
    const { portfolio, token, other, wallet } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount))
    await token.mint(wallet.address, parseUSDC(amount))
    await token
      .connect(wallet)
      .approve(portfolio.address, parseUSDC(amount * 2))

    await expect(portfolio.connect(other).repayInFull()).to.be.revertedWith(
      'AutomatedLineOfCredit: Caller is not the borrower',
    )
  })

  it('updates last protocol fee rate', async () => {
    const { portfolio, protocolConfig, token, protocolFeeRate } =
      await loadFixture()
    await portfolio.borrow(parseUSDC(amount))

    const newFeeRate = 100
    await protocolConfig.setProtocolFeeRate(newFeeRate)
    expect(await portfolio.lastProtocolFeeRate()).to.equal(protocolFeeRate)

    await token.approve(portfolio.address, parseUSDC(amount * 2))
    await portfolio.repayInFull()
    expect(await portfolio.lastProtocolFeeRate()).to.equal(newFeeRate)
  })

  it('emits Repaid event', async () => {
    const { portfolio, token, borrowAndSetNextTimestamp } = await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount * 2))
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount),
      YEAR / 2,
    )
    await expect(portfolio.repayInFull())
      .to.emit(portfolio, 'Repaid')
      .withArgs(parseUSDC(amount).add(interest))
  })

  it('transfers fee', async () => {
    const {
      token,
      protocolConfig,
      protocolTreasury,
      portfolio,
      executeAndSetNextTimestamp,
      calculateInterest,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await token.approve(portfolio.address, parseUSDC(amount * 2))
    await executeAndSetNextTimestamp(portfolio.borrow(parseUSDC(amount)), YEAR)
    const interest = await calculateInterest(parseUSDC(amount), YEAR)
    await portfolio.repayInFull()

    expect(await token.balanceOf(protocolTreasury)).to.equal(
      parseUSDC(amount).add(interest).div(10),
    )
  })

  it('updates unpaidFee', async () => {
    const { token, protocolConfig, executeAndSetNextTimestamp, portfolio } =
      await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await token.approve(portfolio.address, parseUSDC(amount * 2))
    await executeAndSetNextTimestamp(
      portfolio.borrow(parseUSDC(amount)),
      YEAR / 2,
    )
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await portfolio.repayInFull()

    expect(await portfolio.unpaidFee()).to.equal(0)
  })

  it('emits FeePaid event', async () => {
    const {
      token,
      protocolConfig,
      executeAndSetNextTimestamp,
      portfolio,
      protocolTreasury,
      calculateInterest,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await token.approve(portfolio.address, parseUSDC(amount * 2))
    await executeAndSetNextTimestamp(portfolio.borrow(parseUSDC(amount)), YEAR)
    const interest = await calculateInterest(parseUSDC(amount), YEAR)

    await expect(portfolio.repayInFull())
      .to.emit(portfolio, 'FeePaid')
      .withArgs(protocolTreasury, parseUSDC(amount).add(interest).div(10))
  })

  it('correctly calculates fee after repay', async () => {
    const {
      executeAndTimeTravel,
      protocolConfig,
      getTxTimestamp,
      portfolio,
      token,
      setNextBlockTimestamp,
      calculateInterest,
    } = await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount * 2))
    const txTimestamp = await getTxTimestamp(
      portfolio.borrow(parseUSDC(amount)),
    )
    const interest = await calculateInterest(parseUSDC(amount), YEAR / 2)
    await protocolConfig.setProtocolFeeRate(1000)
    await setNextBlockTimestamp(txTimestamp + YEAR / 2)
    await executeAndTimeTravel(portfolio.repayInFull(), YEAR)

    expect(await portfolio.getFee()).to.equal(
      parseUSDC(amount).add(interest).div(10),
    )
  })
})
