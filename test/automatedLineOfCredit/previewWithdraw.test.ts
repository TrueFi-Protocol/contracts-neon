import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditDepositFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR } from 'utils/constants'

describe('AutomatedLineOfCredit.previewWithdraw', () => {
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithDeposit = automatedLineOfCreditDepositFixture(amount)
  const loadFixture = () => fixtureLoader(fixtureWithDeposit)

  it('does not revert when withdraw not allowed', async () => {
    const { portfolio, mockWithdrawController, parseShares } =
      await loadFixture()
    await mockWithdrawController({ onWithdraw: { shares: parseShares(0) } })
    await expect(portfolio.previewWithdraw(parseUSDC(amount))).not.to.be
      .reverted
  })

  it('returns 0 when 0 is provided', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.previewWithdraw(0)).to.equal(0)
  })

  it('returns correct amount', async () => {
    const { portfolio, parseShares } = await loadFixture()
    expect(await portfolio.previewWithdraw(parseUSDC(amount))).to.equal(
      parseShares(amount),
    )
  })

  it('rounds up', async () => {
    const { portfolio, borrowAndRepayWithInterest } = await loadFixture()
    await borrowAndRepayWithInterest(parseUSDC(amount), YEAR / 3)
    const sharesRoundedDown = await portfolio.convertToShares(
      parseUSDC(amount),
    )
    expect(await portfolio.previewWithdraw(parseUSDC(amount))).to.equal(
      sharesRoundedDown.add(1),
    )
  })

  it('returns less shares when portfolio value accrues', async () => {
    const { portfolio, parseShares, borrowAndRepayWithInterest } =
      await loadFixture()
    const interest = await borrowAndRepayWithInterest(
      parseUSDC(amount),
      YEAR / 2,
    )
    expect(
      await portfolio.previewWithdraw(parseUSDC(amount).add(interest)),
    ).to.equal(parseShares(amount))
  })

  it('returns 0 when total supply is 0', async () => {
    const { portfolio, parseShares, withdraw, wallet } = await loadFixture()
    await withdraw(wallet, parseUSDC(amount))
    expect(await portfolio.previewWithdraw(parseShares(1))).to.equal(0)
  })

  it('accounts for protocol fee', async () => {
    const { portfolio, executeAndTimeTravel, deposit, protocolConfig, wallet } =
      await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndTimeTravel(deposit(wallet, parseUSDC(amount)), YEAR / 2)
    const expectedShares = await portfolio.convertToShares(parseUSDC(amount))
    expect(await portfolio.previewWithdraw(parseUSDC(amount))).to.equal(
      expectedShares.add(1),
    )
  })

  it('gets overwritten by withdraw controller', async () => {
    const { portfolio, deposit, mockWithdrawController, parseShares, wallet } =
      await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    expect(await portfolio.previewWithdraw(parseUSDC(amount))).to.equal(
      parseShares(amount),
    )
    await mockWithdrawController({ onWithdraw: { shares: parseShares(1) } })
    expect(await portfolio.previewWithdraw(parseUSDC(amount))).to.equal(
      parseShares(1),
    )
  })
})
