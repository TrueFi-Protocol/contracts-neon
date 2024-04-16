import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR } from 'utils'

describe('AutomatedLineOfCredit.utilization', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('is 0 if no funds are borrowed', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.utilization()).to.equal(0)
  })

  describe('On borrow', () => {
    it('is increased', async () => {
      const { portfolio, token, other, deposit } = await loadFixture()
      await token.mint(other.address, parseUSDC(amount))
      await deposit(other, parseUSDC(amount))
      await portfolio.borrow(parseUSDC(amount / 2))
      expect(await portfolio.utilization()).to.equal(5000)
    })

    it('can be pushed to 100%, but no further without fees', async () => {
      const { portfolio, token, other, deposit, timeTravel } =
        await loadFixture()
      await token.mint(other.address, parseUSDC(amount))
      await deposit(other, parseUSDC(amount))
      await portfolio.borrow(parseUSDC(amount))
      await timeTravel(YEAR)
      expect(await portfolio.utilization()).to.equal(10000)
    })

    it('cannot be pushed past 100% with fees', async () => {
      const { portfolio, wallet, deposit, timeTravel, protocolConfig } =
        await loadFixture()
      await deposit(wallet, parseUSDC(amount))
      await protocolConfig.setProtocolFeeRate(5000)
      await portfolio.borrow(parseUSDC(amount))
      await timeTravel(YEAR / 2)
      await deposit(wallet, 1)
      expect(await portfolio.utilization()).to.equal(10000)
    })
  })

  describe('On repay', () => {
    it('is decreased', async () => {
      const { portfolio, token, other, deposit } = await loadFixture()
      await token.mint(other.address, parseUSDC(amount))

      await deposit(other, parseUSDC(amount))
      await portfolio.borrow(parseUSDC(amount / 2))
      expect(await portfolio.utilization()).to.equal(5000)

      await token.approve(portfolio.address, parseUSDC(amount / 4))
      await portfolio.repay(parseUSDC(amount / 4))
      expect(await portfolio.utilization()).to.equal(2500)
    })
  })

  describe('On deposit', () => {
    it('is not affected if no funds are borrowed', async () => {
      const { portfolio, other, token, deposit } = await loadFixture()
      await token.mint(other.address, parseUSDC(amount))
      await deposit(other, parseUSDC(amount))
      expect(await portfolio.utilization()).to.equal(0)
    })

    it('is decreased if funds are borrowed', async () => {
      const { portfolio, other, token, deposit } = await loadFixture()
      await token.mint(other.address, parseUSDC(amount * 2))
      await deposit(other, parseUSDC(amount))
      await portfolio.borrow(parseUSDC(amount))
      expect(await portfolio.utilization()).to.equal(10000)

      await deposit(other, parseUSDC(amount))
      expect(await portfolio.utilization()).to.equal(5000)
    })
  })

  describe('On withdraw', () => {
    it('is not affected if no funds are borrowed', async () => {
      const { portfolio, other, token, deposit, withdraw } =
        await loadFixture()
      await token.mint(other.address, parseUSDC(amount))

      await deposit(other, parseUSDC(amount))
      expect(await portfolio.utilization()).to.equal(0)

      await withdraw(other, parseUSDC(amount / 2))
      expect(await portfolio.utilization()).to.equal(0)
    })

    it('is increased', async () => {
      const { portfolio, other, token, deposit, withdraw, parseShares } =
        await loadFixture()
      await token.mint(other.address, parseUSDC(amount * 2))

      await deposit(other, parseUSDC(amount * 2))
      await portfolio.borrow(parseUSDC(amount / 2))
      expect(await portfolio.utilization()).to.equal(2500)

      await withdraw(other, parseShares(amount))
      expect(await portfolio.utilization()).to.equal(5000)
    })
  })

  it('does not include interest', async () => {
    const { portfolio, token, other, deposit, timeTravel } =
      await loadFixture()
    await token.mint(other.address, parseUSDC(amount))
    await deposit(other, parseUSDC(amount))
    await portfolio.borrow(parseUSDC(amount / 2))
    await timeTravel(YEAR)
    expect(await portfolio.utilization()).to.equal(5000)
  })

  it('is 100% when unpaid fee is bigger than debt and liquidity', async () => {
    const {
      portfolio,
      wallet,
      deposit,
      protocolConfig,
      borrowAndSetNextTimestamp,
    } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))

    await protocolConfig.setProtocolFeeRate(20000)
    await borrowAndSetNextTimestamp(parseUSDC(amount), YEAR / 2)
    await portfolio.updateAndPayFee()
    expect(await portfolio.utilization()).to.equal(10000)
  })
})
