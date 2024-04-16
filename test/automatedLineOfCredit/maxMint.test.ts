import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { DAY, YEAR } from 'utils'

describe('AutomatedLineOfCredit.maxMint', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)

  it('returns maxSize converted to shares when portfolio is empty', async () => {
    const { portfolio, wallet, maxSize } = await loadFixture()
    const expectedShares = await portfolio.convertToShares(maxSize)
    expect(await portfolio.maxMint(wallet.address)).to.equal(expectedShares)
  })

  it('returns 0 when full', async () => {
    const { portfolio, wallet, deposit } = await loadFixture()
    const maxSize = await portfolio.maxSize()
    await deposit(wallet, maxSize)
    expect(await portfolio.maxMint(wallet.address)).to.equal(0)
  })

  it('returns 0 when portfolio is paused', async () => {
    const { portfolio, wallet } = await loadFixture()
    await portfolio.pause()
    expect(await portfolio.maxMint(wallet.address)).to.equal(0)
  })

  it('returns 0 when portfolio is closed', async () => {
    const { portfolio, wallet, portfolioDuration, timeTravel } =
      await loadFixture()
    await timeTravel(portfolioDuration + DAY)
    expect(await portfolio.maxMint(wallet.address)).to.equal(0)
  })

  it('returns correct amount when space remains in portfolio', async () => {
    const { portfolio, wallet, deposit, maxSize } = await loadFixture()
    await deposit(wallet, maxSize.div(2))
    const expectedShares = await portfolio.convertToShares(maxSize.div(2))
    expect(await portfolio.maxMint(wallet.address)).to.equal(expectedShares)
  })

  it('decreases when portfolio value appreciates', async () => {
    const { portfolio, wallet, borrowAndRepayWithInterest, deposit, maxSize } =
      await loadFixture()
    await deposit(wallet, maxSize.div(2))
    const interest = await borrowAndRepayWithInterest(maxSize.div(2), YEAR / 4)
    const newPortfolioValue = maxSize.div(2).add(interest)
    const expectedShares = await portfolio.convertToShares(
      maxSize.sub(newPortfolioValue),
    )
    expect(await portfolio.maxMint(wallet.address)).to.equal(expectedShares)
  })

  it('returns 0 after portfolio value appreciates past maxSize', async () => {
    const { portfolio, wallet, borrowAndRepayWithInterest, deposit, maxSize } =
      await loadFixture()
    await deposit(wallet, maxSize.sub(1))
    await borrowAndRepayWithInterest(maxSize.sub(1), YEAR / 4)
    expect(await portfolio.maxMint(wallet.address)).to.equal(0)
  })

  it('is limited by deposit controller', async () => {
    const { portfolio, wallet, mockDepositController, parseShares } =
      await loadFixture()
    const mintLimit = parseShares(15)
    await mockDepositController({ mintLimit })
    expect(await portfolio.maxMint(wallet.address)).to.equal(mintLimit)
  })

  it('returns 0 when portfolio is full and controller is set', async () => {
    const {
      portfolio,
      wallet,
      mockDepositController,
      parseShares,
      deposit,
      maxSize,
    } = await loadFixture()
    const mintLimit = parseShares(15)
    await deposit(wallet, maxSize)
    await mockDepositController({ mintLimit })
    expect(await portfolio.maxMint(wallet.address)).to.equal(0)
  })

  it('includes fee', async () => {
    const {
      portfolio,
      wallet,
      maxSize,
      protocolConfig,
      executeAndTimeTravel,
      deposit,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndTimeTravel(deposit(wallet, maxSize.div(2)), YEAR / 2)
    const fee = maxSize.div(2).div(20)
    const expectedShares = await portfolio.convertToShares(
      maxSize.div(2).add(fee),
    )
    expect(await portfolio.maxMint(wallet.address)).to.equal(expectedShares)
  })
})
