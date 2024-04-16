import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR } from 'utils'

describe('AutomatedLineOfCredit.convertToShares', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('returns 0 when 0 provided', async () => {
    const { portfolio, wallet, deposit } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    expect(await portfolio.convertToShares(0)).to.equal(0)
  })

  it('returns assets when total shares are zero', async () => {
    const { portfolio, parseShares } = await loadFixture()
    expect(await portfolio.convertToShares(parseUSDC(amount))).to.equal(
      parseShares(amount),
    )
  })

  it('returns less shares when portfolio value appreciates', async () => {
    const {
      portfolio,
      wallet,
      deposit,
      borrowAndRepayWithInterest,
      parseShares,
    } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    const interest = await borrowAndRepayWithInterest(parseUSDC(amount), YEAR)
    const expectedShares = parseUSDC(amount)
      .mul(parseShares(amount))
      .div(parseUSDC(amount).add(interest))
    expect(await portfolio.convertToShares(parseUSDC(amount))).to.equal(
      expectedShares,
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
    const expectedShares = parseUSDC(amount)
      .mul(parseShares(amount))
      .div(parseUSDC(amount * 0.95))
    expect(await portfolio.convertToShares(parseUSDC(amount))).to.equal(
      expectedShares,
    )
  })
})
