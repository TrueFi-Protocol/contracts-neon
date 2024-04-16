import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditDepositFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR } from 'utils'

describe('AutomatedLineOfCredit.previewRedeem', () => {
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithDeposit = automatedLineOfCreditDepositFixture(amount)
  const loadFixture = () => fixtureLoader(fixtureWithDeposit)

  describe('default withdraw controller', () => {
    it('returns 0 when 0 is provided', async () => {
      const { portfolio } = await loadFixture()
      expect(await portfolio.previewRedeem(0)).to.equal(0)
    })

    it('returns correct amount', async () => {
      const { portfolio, parseShares } = await loadFixture()
      const claimableAssets = await portfolio.convertToAssets(
        parseShares(amount),
      )
      expect(await portfolio.previewRedeem(parseShares(amount))).to.equal(
        claimableAssets,
      )
    })

    it('returns 0 when total supply is 0', async () => {
      const { portfolio, parseShares, withdraw, wallet } = await loadFixture()
      await withdraw(wallet, parseUSDC(amount))
      expect(await portfolio.previewRedeem(parseShares(1))).to.equal(0)
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
      expect(await portfolio.previewRedeem(parseShares(amount))).to.equal(
        expectedAssets,
      )
    })
  })

  describe('non-default withdraw controller is set', () => {
    it('does not revert when Operation not allowed', async () => {
      const {
        portfolio,
        parseShares,
        deposit,
        wallet,
        mockWithdrawController,
      } = await loadFixture()
      const amount = 1
      await deposit(wallet, parseUSDC(amount))
      await mockWithdrawController({ onRedeem: { assets: parseUSDC(0) } })
      await expect(portfolio.previewRedeem(parseShares(amount))).to.not.be
        .reverted
    })

    it('returns correct amount of assets', async () => {
      const {
        portfolio,
        deposit,
        parseShares,
        wallet,
        mockWithdrawController,
      } = await loadFixture()
      const amount = 1
      await deposit(wallet, parseUSDC(amount))
      await mockWithdrawController({ onRedeem: { assets: parseUSDC(amount) } })
      expect(await portfolio.previewRedeem(parseShares(amount))).to.equal(
        parseUSDC(amount),
      )
    })
  })
})
