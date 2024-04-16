import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { YEAR } from 'utils/constants'

describe('AutomatedLineOfCredit.getStatus', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  enum AutomatedLineOfCreditStatus {
    Open,
    Full,
    Closed,
  }

  it('is Open after portfolio creation', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.getStatus()).to.equal(
      AutomatedLineOfCreditStatus.Open,
    )
  })

  it('is Open when some funds are borrowed', async () => {
    const { portfolio, deposit, wallet, maxSize } = await loadFixture()
    await deposit(wallet, maxSize.div(2))
    await portfolio.borrow(maxSize.div(2))
    expect(await portfolio.getStatus()).to.equal(
      AutomatedLineOfCreditStatus.Open,
    )
  })

  it('is Full when deposited amount exceeds max size', async () => {
    const { portfolio, deposit, wallet, maxSize } = await loadFixture()
    await deposit(wallet, maxSize)
    expect(await portfolio.getStatus()).to.equal(
      AutomatedLineOfCreditStatus.Full,
    )
  })

  it('is Closed when end date elapses', async () => {
    const { portfolio, timeTravel } = await loadFixture()
    await timeTravel(YEAR)
    expect(await portfolio.getStatus()).to.equal(
      AutomatedLineOfCreditStatus.Closed,
    )
  })
})
