import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditDepositFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR } from 'utils/constants'

describe('AutomatedLineOfCredit.totalDebt', () => {
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithDeposit = automatedLineOfCreditDepositFixture(amount)
  const loadFixture = () => fixtureLoader(fixtureWithDeposit)

  it('is zero in the begging', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.totalDebt()).to.equal(0)
  })

  it('returns borrowed amount right after borrow', async () => {
    const { portfolio } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount))
    expect(await portfolio.totalDebt()).to.equal(parseUSDC(amount))
  })

  it('grows over time by unincludedInterest', async () => {
    const { portfolio, borrowAndSetNextTimestamp, mineBlock } =
      await loadFixture()
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount),
      YEAR / 2,
    )
    await mineBlock()
    expect(await portfolio.totalDebt()).to.equal(
      parseUSDC(amount).add(interest),
    )
  })

  it('is zero after repay in full', async () => {
    const { portfolio, borrowAndRepayWithInterest } = await loadFixture()
    await borrowAndRepayWithInterest(parseUSDC(amount), YEAR / 2)
    expect(await portfolio.totalDebt()).to.equal(0)
  })

  it('decreases after repay', async () => {
    const { token, portfolio, borrowAndSetNextTimestamp } = await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount * 2))
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount),
      YEAR / 2,
    )
    await portfolio.repay(parseUSDC(amount / 2))

    expect(await portfolio.totalDebt()).to.equal(
      parseUSDC(amount / 2).add(interest),
    )
  })
})
