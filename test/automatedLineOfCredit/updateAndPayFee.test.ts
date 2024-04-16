import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditDepositFixture } from 'fixtures'
import { YEAR } from 'utils/constants'
import { parseUSDC } from 'utils/parseUSDC'

describe('AutomatedLineOfCredit.updateAndPayFee', () => {
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithDeposit = automatedLineOfCreditDepositFixture(amount)
  const loadFixture = () => fixtureLoader(fixtureWithDeposit)

  it('reverts when portfolio is paused', async () => {
    const { portfolio } = await loadFixture()
    await portfolio.pause()
    await expect(portfolio.updateAndPayFee()).to.be.revertedWith(
      'Pausable: paused',
    )
  })

  it('pays fee', async () => {
    const {
      portfolio,
      token,
      protocolConfig,
      protocolTreasury,
      executeAndSetNextTimestamp,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await portfolio.updateAndPayFee()
    expect(await token.balanceOf(protocolTreasury)).to.equal(
      parseUSDC(amount * 0.05),
    )
  })

  it('updates accrued interest', async () => {
    const { portfolio, borrowAndSetNextTimestamp } = await loadFixture()
    const interest = await borrowAndSetNextTimestamp(parseUSDC(amount), YEAR)
    await portfolio.updateAndPayFee()
    expect(await portfolio.accruedInterest()).to.equal(interest)
  })

  it('emits FeePaid', async () => {
    const {
      portfolio,
      executeAndSetNextTimestamp,
      protocolConfig,
      protocolTreasury,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await expect(portfolio.updateAndPayFee())
      .to.emit(portfolio, 'FeePaid')
      .withArgs(protocolTreasury, parseUSDC(amount * 0.05))
  })

  it('updates unpaidFee', async () => {
    const { portfolio, borrowAndSetNextTimestamp, protocolConfig } =
      await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    const interest = await borrowAndSetNextTimestamp(parseUSDC(amount), YEAR)
    await portfolio.updateAndPayFee()
    expect(await portfolio.unpaidFee()).to.equal(
      parseUSDC(amount).add(interest).div(10),
    )
  })

  it('updates lastProtocolFeeRate', async () => {
    const { portfolio, protocolConfig } = await loadFixture()
    const newProtocolFeeRate = 1000
    await protocolConfig.setProtocolFeeRate(newProtocolFeeRate)
    await portfolio.updateAndPayFee()
    expect(await portfolio.lastProtocolFeeRate()).to.equal(newProtocolFeeRate)
  })
})
