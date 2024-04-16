import { setupFixtureLoader } from 'test/setup'
import { expect } from 'chai'
import { automatedLineOfCreditFixture } from 'fixtures/automatedLineOfCreditFixture'

describe('DepositController.maxDeposit', () => {
  const loadFixture = setupFixtureLoader()

  it('only allowed has maxDeposit', async () => {
    const { wallet, other, portfolio, mockLenderVerifier } = await loadFixture(
      automatedLineOfCreditFixture,
    )
    await mockLenderVerifier({ whitelistedAddresses: [wallet.address] })
    expect(await portfolio.maxDeposit(other.address)).eq(0)
    expect(await portfolio.maxDeposit(wallet.address)).eq(10000000000000)
  })
})
