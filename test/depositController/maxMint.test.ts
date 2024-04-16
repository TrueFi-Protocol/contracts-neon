import { setupFixtureLoader } from 'test/setup'
import { expect } from 'chai'
import { automatedLineOfCreditFixture } from 'fixtures/automatedLineOfCreditFixture'

describe('DepositController.maxMint', () => {
  const loadFixture = setupFixtureLoader()

  it('only allowed has maxMint', async () => {
    const { wallet, other, portfolio, mockLenderVerifier } = await loadFixture(
      automatedLineOfCreditFixture,
    )
    await mockLenderVerifier({ whitelistedAddresses: [wallet.address] })
    expect(await portfolio.maxMint(other.address)).eq(0)
    expect(await portfolio.maxMint(wallet.address)).eq(10000000000000)
  })
})
