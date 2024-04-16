import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { parseUSDC, YEAR } from 'utils'

describe('AutomatedLineOfCredit.convertToAssets', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('returns zero when zero provided', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.convertToAssets(0)).to.equal(0)
  })

  it('returns zero when total shares are zero', async () => {
    const { portfolio, parseShares } = await loadFixture()
    expect(await portfolio.convertToAssets(parseShares(amount))).to.equal(0)
  })

  it('returns correct value after deposit', async () => {
    const { portfolio, deposit, wallet, parseShares } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    expect(await portfolio.convertToAssets(parseShares(amount))).to.equal(
      parseUSDC(amount),
    )
  })

  it('returns larger amount when portfolio value appreciates', async () => {
    const {
      portfolio,
      parseShares,
      borrowAndRepayWithInterest,
      deposit,
      wallet,
    } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    const interest = await borrowAndRepayWithInterest(parseUSDC(amount), YEAR)
    expect(await portfolio.convertToAssets(parseShares(amount))).to.equal(
      parseUSDC(amount).add(interest),
    )
  })

  it('accounts for fees', async () => {
    const {
      portfolio,
      executeAndTimeTravel,
      deposit,
      protocolConfig,
      wallet,
      parseShares,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndTimeTravel(deposit(wallet, parseUSDC(amount)), YEAR / 2)
    const expectedAssets = parseShares(amount)
      .mul(parseUSDC(amount * 0.95))
      .div(parseShares(amount))
    expect(await portfolio.convertToAssets(parseShares(amount))).to.equal(
      expectedAssets,
    )
  })
})
