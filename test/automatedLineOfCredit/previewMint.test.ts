import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR, DAY } from 'utils'

describe('AutomatedLineOfCredit.previewMint', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('returns 0 when 0 provided', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.previewMint(0)).to.equal(0)
  })

  it('returns asset amount rounded up', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.previewMint(1)).to.equal(1)
  })

  it('returns correct asset amount', async () => {
    const { portfolio, parseShares } = await loadFixture()
    expect(await portfolio.previewMint(parseShares(amount))).to.equal(
      parseUSDC(amount),
    )
  })

  it('returns increased asset amount when portfolio value appreciates', async () => {
    const {
      portfolio,
      deposit,
      wallet,
      borrowAndRepayWithInterest,
      parseShares,
    } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    const interest = await borrowAndRepayWithInterest(
      parseUSDC(amount),
      YEAR / 2,
    )
    expect(await portfolio.previewMint(parseShares(amount))).to.equal(
      parseUSDC(amount).add(interest),
    )
  })

  it('rounds up when converting from share decimals to asset decimals', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.previewMint(1)).to.equal(1)
  })

  it('rounds up if necessary when portfolio value appreciates', async () => {
    const {
      portfolio,
      wallet,
      deposit,
      borrowAndRepayWithInterest,
      parseShares,
    } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    const interest = await borrowAndRepayWithInterest(
      parseUSDC(amount),
      YEAR / 2,
    )

    const sharesToMint = parseShares(amount).add(interest.div(3))
    const assetsRoundedUp = await portfolio.previewMint(sharesToMint)
    const assetsRoundedDown = await portfolio.convertToAssets(sharesToMint)
    expect(assetsRoundedUp.sub(assetsRoundedDown)).to.equal(1)
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
    const expectedAssets = await portfolio.convertToAssets(parseUSDC(amount))
    expect(await portfolio.previewMint(parseShares(amount))).to.equal(
      expectedAssets,
    )
  })

  it('reverts past end date', async () => {
    const { portfolio, timeTravel } = await loadFixture()
    await timeTravel(YEAR + DAY)
    await expect(portfolio.previewMint(parseUSDC(1))).to.be.revertedWith(
      'AutomatedLineOfCredit: Portfolio end date has elapsed',
    )
  })

  it('uses controller\'s previewMint when present', async () => {
    const { portfolio, mockDepositController, parseShares } =
      await loadFixture()
    await mockDepositController({ onMint: { assets: parseUSDC(50) } })
    expect(await portfolio.previewMint(parseShares(amount))).to.equal(
      parseUSDC(50),
    )
  })
})
