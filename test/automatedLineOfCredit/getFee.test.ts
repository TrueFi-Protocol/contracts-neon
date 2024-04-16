import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFeeFixture } from 'fixtures/automatedLineOfCreditFixture'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR } from 'utils/constants'

describe('AutomatedLineOfCredit.getFee', () => {
  const feeRate = 1000 // 10%
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithFee = automatedLineOfCreditFeeFixture(feeRate)
  const loadFixture = () => fixtureLoader(fixtureWithFee)

  it('is 0 initialy', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.getFee()).to.equal(0)
  })

  it('returns correct amount after year', async () => {
    const { portfolio, deposit, wallet, executeAndTimeTravel } =
      await loadFixture()
    await executeAndTimeTravel(deposit(wallet, parseUSDC(amount)), YEAR)
    expect(await portfolio.getFee()).to.equal(parseUSDC(amount * 0.1))
  })

  it('returns correct amount after half a year', async () => {
    const { portfolio, deposit, wallet, executeAndTimeTravel } =
      await loadFixture()
    await executeAndTimeTravel(deposit(wallet, parseUSDC(amount)), YEAR / 2)
    expect(await portfolio.getFee()).to.equal(parseUSDC((amount * 0.1) / 2))
  })

  it('returns 0 after value drops to 0', async () => {
    const {
      portfolio,
      deposit,
      wallet,
      executeAndTimeTravel,
      withdraw,
      executeAndSetNextTimestamp,
    } = await loadFixture()
    await executeAndSetNextTimestamp(
      deposit(wallet, parseUSDC(amount)),
      YEAR / 2,
    )
    await executeAndTimeTravel(
      withdraw(wallet, parseUSDC(amount - amount * 0.05)),
      YEAR,
    )
    expect(await portfolio.getFee()).to.equal(0)
  })

  it('returns only most recent update block', async () => {
    const { portfolio, deposit, wallet, getTxTimestamp, executeAndTimeTravel } =
      await loadFixture()
    const txTimestamp = await getTxTimestamp(
      deposit(wallet, parseUSDC(amount)),
    )
    await executeAndTimeTravel(
      deposit(wallet, parseUSDC(amount), wallet, txTimestamp + YEAR / 2),
      YEAR,
    )
    expect(await portfolio.getFee()).to.equal(
      parseUSDC(0.95 * amount + amount).div(10),
    )
  })

  it('returns totalAssets if fee is bigger than totalAssets', async () => {
    const { portfolio, deposit, wallet, executeAndTimeTravel } =
      await loadFixture()
    await executeAndTimeTravel(deposit(wallet, parseUSDC(amount)), YEAR * 20)
    expect(await portfolio.getFee()).to.equal(parseUSDC(amount))
  })
})
