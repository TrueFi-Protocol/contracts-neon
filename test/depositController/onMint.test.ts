import { setupFixtureLoader } from 'test/setup'
import { expect } from 'chai'
import { automatedLineOfCreditFixture } from 'fixtures/automatedLineOfCreditFixture'

describe('DepositController.onMint', () => {
  const loadFixture = setupFixtureLoader()

  it('only allowed can mint', async () => {
    const { wallet, other, portfolio, mockLenderVerifier, token } =
      await loadFixture(automatedLineOfCreditFixture)
    await token.mint(other.address, 1)
    await token.connect(other).approve(portfolio.address, 1)
    await token.approve(portfolio.address, 1)
    await mockLenderVerifier({ whitelistedAddresses: [wallet.address] })
    await expect(portfolio.mint(1, other.address)).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation not allowed',
    )
    await expect(portfolio.mint(1, wallet.address)).to.not.be.reverted
  })
})
