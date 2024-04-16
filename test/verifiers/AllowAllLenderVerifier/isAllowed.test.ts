import { expect } from 'chai'
import { allowAllLenderVerifierFixture } from 'fixtures/allowAllLenderVerifierFixture'
import { setupFixtureLoader } from 'test/setup'

describe('AllowAllLenderVerifier', () => {
  const loadFixture = setupFixtureLoader()

  it('returns true for owner address', async () => {
    const { allowAllLenderVerifier, owner } = await loadFixture(
      allowAllLenderVerifierFixture,
    )
    expect(await allowAllLenderVerifier.isAllowed(owner.address)).to.be.true
  })

  it('returns true for other address', async () => {
    const { allowAllLenderVerifier, other } = await loadFixture(
      allowAllLenderVerifierFixture,
    )
    expect(await allowAllLenderVerifier.isAllowed(other.address)).to.be.true
  })
})
