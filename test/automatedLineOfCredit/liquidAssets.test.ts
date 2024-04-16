import { expect } from 'chai'
import { automatedLineOfCreditFixture } from 'fixtures'
import { setupFixtureLoader } from 'test/setup'
import { ONE_HUNDRED_PERCENT, ONE_PERCENT, parseUSDC, YEAR } from 'utils'

describe('AutomatedLineOfCredit.liquidAssets', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('is 0 initially', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.liquidAssets()).to.equal(0)
  })

  it('increases after deposit', async () => {
    const { portfolio, deposit, wallet } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    expect(await portfolio.liquidAssets()).to.equal(parseUSDC(amount))
  })

  it('decreases after withdraw', async () => {
    const { portfolio, deposit, wallet, withdraw } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await withdraw(wallet, parseUSDC(amount / 4))
    expect(await portfolio.liquidAssets()).to.equal(
      parseUSDC((amount * 3) / 4),
    )
  })

  it('decreases after borrow', async () => {
    const { portfolio, deposit, wallet } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await portfolio.borrow(parseUSDC(amount / 4))
    expect(await portfolio.liquidAssets()).to.equal(
      parseUSDC((amount * 3) / 4),
    )
  })

  it('increases after repay', async () => {
    const { portfolio, deposit, wallet, borrowAndRepayWithInterest } =
      await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    const interest = await borrowAndRepayWithInterest(
      parseUSDC(amount / 2),
      YEAR,
    )
    expect(await portfolio.liquidAssets()).to.equal(
      parseUSDC(amount).add(interest),
    )
  })

  it('is decreased by protocol continuous fee', async () => {
    const { portfolio, wallet, deposit, executeAndTimeTravel, protocolConfig } =
      await loadFixture()
    await protocolConfig.setProtocolFeeRate(ONE_PERCENT)
    await executeAndTimeTravel(deposit(wallet, parseUSDC(amount)), YEAR)
    const expectedFee = parseUSDC(amount)
      .mul(ONE_PERCENT)
      .div(ONE_HUNDRED_PERCENT)
    expect(await portfolio.liquidAssets()).to.equal(
      parseUSDC(amount).sub(expectedFee),
    )
  })

  it('is 0 when fees exceed virtualTokenBalance', async () => {
    const {
      portfolio,
      deposit,
      executeAndTimeTravel,
      wallet,
      token,
      protocolConfig,
    } = await loadFixture()
    await token.mint(wallet.address, parseUSDC(amount))
    await protocolConfig.setProtocolFeeRate(ONE_HUNDRED_PERCENT)
    await executeAndTimeTravel(deposit(wallet, parseUSDC(amount)), YEAR)
    expect(await portfolio.liquidAssets()).to.equal(0)
  })
})
