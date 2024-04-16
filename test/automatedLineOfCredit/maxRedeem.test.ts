import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR } from 'utils/constants'

describe('AutomatedLineOfCredit.maxRedeem', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('returns 0 when portfolio is empty', async () => {
    const { portfolio, wallet } = await loadFixture()
    expect(await portfolio.maxRedeem(wallet.address)).to.equal(0)
  })

  it('returns 0 when owner has no shares', async () => {
    const { portfolio, wallet, other, deposit } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    expect(await portfolio.maxRedeem(other.address)).to.equal(0)
  })

  it('returns 0 when portfolio is paused', async () => {
    const { portfolio, deposit, wallet } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await portfolio.pause()
    expect(await portfolio.maxRedeem(wallet.address)).to.equal(0)
  })

  it('is limited by withdraw controller', async () => {
    const { portfolio, deposit, wallet, parseShares, mockWithdrawController } =
      await loadFixture()
    await mockWithdrawController({ redeemLimit: parseShares(5) })
    await deposit(wallet, parseUSDC(amount))
    expect(await portfolio.maxRedeem(wallet.address)).to.equal(parseShares(5))
  })

  it('is limited by liquid assets', async () => {
    const { portfolio, wallet, deposit, parseShares } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await portfolio.borrow(parseUSDC(amount / 2))
    const maxRedeemableShares = await portfolio.maxRedeem(wallet.address)
    expect(maxRedeemableShares).to.equal(parseShares(amount / 2))
  })

  it('is limited by user\'s share balance', async () => {
    const {
      portfolio,
      wallet,
      deposit,
      parseShares,
      borrowAndRepayWithInterest,
    } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await borrowAndRepayWithInterest(parseUSDC(amount), YEAR / 2)
    expect(await portfolio.maxRedeem(wallet.address)).to.equal(
      parseShares(amount),
    )
  })

  it('is not affected by fee', async () => {
    const {
      portfolio,
      wallet,
      protocolConfig,
      executeAndTimeTravel,
      mint,
      parseShares,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndTimeTravel(mint(wallet, parseShares(amount)), YEAR / 2)
    expect(await portfolio.maxRedeem(wallet.address)).to.equal(
      parseShares(amount),
    )
  })
})
