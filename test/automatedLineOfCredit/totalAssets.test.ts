import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR } from 'utils/constants'

describe('AutomatedLineOfCredit.totalAssets', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('properly calculates totalAssets after borrow', async () => {
    const { portfolio, token, other, deposit } = await loadFixture()
    await token.mint(other.address, parseUSDC(amount))
    await deposit(other, parseUSDC(amount))
    await portfolio.borrow(parseUSDC(amount).div(2))

    expect(await portfolio.totalAssets()).to.equal(parseUSDC(amount))
  })

  it('is decreased by fees after withdraw', async () => {
    const { portfolio, token, other, deposit, withdraw, parseShares } =
      await loadFixture()
    await token.mint(other.address, parseUSDC(amount))
    await deposit(other, parseUSDC(amount))
    await withdraw(other, parseShares(amount / 2))

    expect(await portfolio.totalAssets()).to.equal(parseUSDC(amount / 2))
    expect(await token.balanceOf(portfolio.address)).to.equal(
      parseUSDC(amount / 2),
    )
  })

  it('grows over time after borrow', async () => {
    const {
      portfolio,
      token,
      other,
      deposit,
      borrowAndSetNextTimestamp,
      mineBlock,
    } = await loadFixture()
    await token.mint(other.address, parseUSDC(amount))
    await deposit(other, parseUSDC(amount))
    const interest = await borrowAndSetNextTimestamp(parseUSDC(amount), YEAR)
    await mineBlock()
    expect(await portfolio.totalAssets()).to.equal(
      parseUSDC(amount).add(interest),
    )
  })

  it('is not affected by direct transfers', async () => {
    const { portfolio, token, other } = await loadFixture()
    await token.mint(other.address, parseUSDC(amount))
    await token.connect(other).transfer(portfolio.address, parseUSDC(amount))

    expect(await portfolio.virtualTokenBalance()).to.equal(0)
    expect(await portfolio.totalAssets()).to.equal(0)
  })

  it('is decreased by accrued fee', async () => {
    const { portfolio, deposit, wallet, protocolConfig, executeAndTimeTravel } =
      await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndTimeTravel(deposit(wallet, parseUSDC(amount)), YEAR)
    expect(await portfolio.totalAssets()).to.equal(parseUSDC(amount * 0.9))
  })

  it('is decreased by unpaidFee', async () => {
    const {
      portfolio,
      deposit,
      wallet,
      protocolConfig,
      borrowAndSetNextTimestamp,
      executeAndTimeTravel,
    } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await protocolConfig.setProtocolFeeRate(1000)
    await borrowAndSetNextTimestamp(parseUSDC(amount), YEAR)
    await executeAndTimeTravel(portfolio.updateAndPayFee(), YEAR)

    const fee = await portfolio.getFee()
    const amountWithInterest = await portfolio.totalDebt()
    expect(await portfolio.totalAssets()).to.equal(amountWithInterest.sub(fee))
  })

  it('is 0 if fee is bigger than totalAssets', async () => {
    const { portfolio, deposit, wallet, protocolConfig, executeAndTimeTravel } =
      await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndTimeTravel(deposit(wallet, parseUSDC(amount)), YEAR * 10)
    expect(await portfolio.totalAssets()).to.equal(0)
  })
})
