import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { DAY, YEAR } from 'utils'

describe('AutomatedLineOfCredit.previewDeposit', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  describe('default deposit controller', () => {
    it('returns 0 when 0 provided', async () => {
      const { portfolio } = await loadFixture()
      expect(await portfolio.previewDeposit(0)).to.equal(0)
    })

    it('returns assets when total shares are zero', async () => {
      const { portfolio, parseShares } = await loadFixture()
      expect(await portfolio.previewDeposit(parseUSDC(amount))).to.equal(
        parseShares(amount),
      )
    })

    it('returns less shares when portfolio value appreciates', async () => {
      const {
        portfolio,
        wallet,
        deposit,
        parseShares,
        borrowAndRepayWithInterest,
      } = await loadFixture()
      await deposit(wallet, parseUSDC(amount))
      const interest = await borrowAndRepayWithInterest(
        parseUSDC(amount),
        YEAR / 4,
      )
      const newPortfolioValue = parseUSDC(amount).add(interest)
      const expectedShares = parseUSDC(amount)
        .mul(parseShares(amount))
        .div(newPortfolioValue)
      expect(await portfolio.previewDeposit(parseUSDC(amount))).to.equal(
        expectedShares,
      )
    })

    it('reverts when portfolio is closed', async () => {
      const { portfolio, portfolioDuration, timeTravel } = await loadFixture()
      await timeTravel(portfolioDuration + DAY)
      await expect(
        portfolio.previewDeposit(parseUSDC(amount)),
      ).to.be.revertedWith(
        'AutomatedLineOfCredit: Portfolio end date has elapsed',
      )
    })

    it('accounts for protocol fee', async () => {
      const {
        portfolio,
        executeAndTimeTravel,
        deposit,
        protocolConfig,
        wallet,
      } = await loadFixture()
      await protocolConfig.setProtocolFeeRate(1000)
      await executeAndTimeTravel(deposit(wallet, parseUSDC(amount)), YEAR / 2)
      const expectedShares = await portfolio.convertToShares(parseUSDC(amount))
      expect(await portfolio.previewDeposit(parseUSDC(amount))).to.equal(
        expectedShares,
      )
    })
  })

  describe('non-default deposit controller is set', () => {
    it('returns correct amount of shares', async () => {
      const { portfolio, parseShares, mockDepositController } =
        await loadFixture()
      await mockDepositController({ onDeposit: { shares: parseShares(20) } })
      expect(await portfolio.previewDeposit(parseUSDC(amount))).to.equal(
        parseShares(20),
      )
    })
  })
})
