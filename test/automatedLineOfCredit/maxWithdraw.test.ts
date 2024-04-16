import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { parseUSDC, YEAR } from 'utils'

describe('AutomatedLineOfCredit.maxWithdraw', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('returns 0 when portfolio is empty', async () => {
    const { portfolio, wallet } = await loadFixture()
    expect(await portfolio.maxWithdraw(wallet.address)).to.equal(0)
  })

  it('returns 0 when owner has no shares', async () => {
    const { portfolio, wallet, other, deposit } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    expect(await portfolio.maxWithdraw(other.address)).to.equal(0)
  })

  it('returns 0 when portfolio is paused', async () => {
    const { portfolio, deposit, wallet } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await portfolio.pause()
    expect(await portfolio.maxWithdraw(wallet.address)).to.equal(0)
  })

  it('returns 0 when not allowed by withdraw controller', async () => {
    const { portfolio, deposit, wallet, mockWithdrawController } =
      await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await mockWithdrawController({ withdrawLimit: parseUSDC(0) })
    expect(await portfolio.maxWithdraw(wallet.address)).to.equal(0)
  })

  it('limited by withdraw controller', async () => {
    const { portfolio, deposit, wallet, mockWithdrawController } =
      await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    const withdrawLimit = parseUSDC(amount).div(2)
    await mockWithdrawController({ withdrawLimit })
    expect(await portfolio.maxWithdraw(wallet.address)).to.equal(withdrawLimit)
  })

  it('is limited by liquid assets', async () => {
    const { portfolio, wallet, deposit } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await portfolio.borrow(parseUSDC(amount).div(2))
    expect(await portfolio.maxWithdraw(wallet.address)).to.equal(
      parseUSDC(amount).div(2),
    )
  })

  it('returns more with accrued interest', async () => {
    const { portfolio, deposit, wallet, borrowAndRepayWithInterest } =
      await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    const accruedInterest = await borrowAndRepayWithInterest(parseUSDC(amount))
    expect(await portfolio.maxWithdraw(wallet.address)).to.equal(
      parseUSDC(amount).add(accruedInterest),
    )
  })

  it('includes fee', async () => {
    const { portfolio, wallet, protocolConfig, executeAndTimeTravel, deposit } =
      await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndTimeTravel(deposit(wallet, parseUSDC(amount)), YEAR / 2)
    expect(await portfolio.maxWithdraw(wallet.address)).to.equal(
      parseUSDC(amount * 0.95),
    )
  })
})
