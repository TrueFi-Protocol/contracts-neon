import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditDepositFixture } from 'fixtures'

describe('AutomatedLineOfCredit.approve', () => {
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithDeposit = automatedLineOfCreditDepositFixture(amount)
  const loadFixture = () => fixtureLoader(fixtureWithDeposit)

  it('sets allowance when not paused', async () => {
    const { portfolio, wallet, other, parseShares } = await loadFixture()
    await portfolio.approve(other.address, parseShares(amount))
    expect(await portfolio.allowance(wallet.address, other.address)).to.equal(
      parseShares(amount),
    )
  })

  it('reverts when paused', async () => {
    const { portfolio, other, parseShares } = await loadFixture()
    await portfolio.pause()
    await expect(
      portfolio.approve(other.address, parseShares(amount)),
    ).to.be.revertedWith('Pausable: paused')
  })
})
