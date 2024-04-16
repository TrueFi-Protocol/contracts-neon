import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { YEAR } from 'utils/constants'

describe('AutomatedLineOfCredit.maxDeposit', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)

  it('returns 0 when portfolio is paused', async () => {
    const { portfolio, wallet } = await loadFixture()
    await portfolio.pause()
    expect(await portfolio.maxDeposit(wallet.address)).to.equal(0)
  })

  it('returns 0 when portfolio is closed', async () => {
    const { portfolio, wallet, timeTravel } = await loadFixture()
    await timeTravel(YEAR + 1)
    expect(await portfolio.maxDeposit(wallet.address)).to.equal(0)
  })

  describe('default deposit controller', () => {
    it('returns maxSize when portfolio is empty', async () => {
      const { portfolio, wallet, maxSize } = await loadFixture()
      expect(await portfolio.maxDeposit(wallet.address)).to.equal(maxSize)
    })

    it('returns 0 when portfolio is full', async () => {
      const { portfolio, wallet, deposit, maxSize } = await loadFixture()
      await deposit(wallet, maxSize)
      expect(await portfolio.maxDeposit(wallet.address)).to.equal(0)
    })

    it('returns correct amount when space remains in portfolio', async () => {
      const { portfolio, wallet, deposit, maxSize } = await loadFixture()
      await deposit(wallet, maxSize.div(2))
      expect(await portfolio.maxDeposit(wallet.address)).to.equal(
        maxSize.div(2),
      )
    })

    it('decreases when portfolio value appreciates', async () => {
      const {
        portfolio,
        wallet,
        deposit,
        maxSize,
        borrowAndRepayWithInterest,
      } = await loadFixture()
      await deposit(wallet, maxSize.div(2))
      const interest = await borrowAndRepayWithInterest(
        maxSize.div(2),
        YEAR / 4,
      )
      const newPortfolioValue = maxSize.div(2).add(interest)
      expect(await portfolio.maxDeposit(wallet.address)).to.equal(
        maxSize.sub(newPortfolioValue),
      )
    })

    it('returns 0 after portfolio value appreciates past maxSize', async () => {
      const {
        portfolio,
        wallet,
        deposit,
        maxSize,
        borrowAndRepayWithInterest,
      } = await loadFixture()
      await deposit(wallet, maxSize.sub(1))
      await borrowAndRepayWithInterest(maxSize.sub(1), YEAR / 4)
      expect(await portfolio.maxDeposit(wallet.address)).to.equal(0)
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
      expect(await portfolio.maxDeposit(wallet.address)).to.equal(
        maxSize.div(2).add(fee),
      )
    })
  })
})
