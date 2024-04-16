import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('AutomatedLineOfCredit.setMaxSize', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('lets borrower update max size', async () => {
    const { portfolio } = await loadFixture()
    await portfolio.setMaxSize(parseUSDC(amount))
    expect(await portfolio.maxSize()).to.equal(parseUSDC(amount))
  })

  it('prevents non-borrower from updating max size', async () => {
    const { portfolio, other, MANAGER_ROLE } = await loadFixture()
    await expect(
      portfolio.connect(other).setMaxSize(parseUSDC(amount)),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(other, MANAGER_ROLE),
    )
  })

  it('prevents setting max size to the existing max size', async () => {
    const { portfolio } = await loadFixture()
    const maxSize = await portfolio.maxSize()
    await expect(portfolio.setMaxSize(maxSize)).to.be.revertedWith(
      'AutomatedLineOfCredit: New max size needs to be different',
    )
  })

  it('emits event', async () => {
    const { portfolio } = await loadFixture()
    await expect(portfolio.setMaxSize(parseUSDC(amount)))
      .to.emit(portfolio, 'MaxSizeChanged')
      .withArgs(parseUSDC(amount))
  })
})
