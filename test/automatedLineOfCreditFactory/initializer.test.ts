import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFactoryFixture } from 'fixtures/automatedLineOfCreditFactoryFixture'

describe('AutomatedLineOfCreditFactory.initializer', () => {
  const loadFixture = setupFixtureLoader()

  it('sets portfolio implementation', async () => {
    const { factory, portfolioImplementation } = await loadFixture(
      automatedLineOfCreditFactoryFixture,
    )

    expect(await factory.portfolioImplementation()).to.equal(
      portfolioImplementation.address,
    )
  })

  it('sets protocolConfig', async () => {
    const { factory, protocolConfig } = await loadFixture(
      automatedLineOfCreditFactoryFixture,
    )

    expect(await factory.protocolConfig()).to.equal(protocolConfig.address)
  })

  it('sets default admin', async () => {
    const { factory, wallet, DEFAULT_ADMIN_ROLE } = await loadFixture(
      automatedLineOfCreditFactoryFixture,
    )

    expect(await factory.hasRole(DEFAULT_ADMIN_ROLE, wallet.address)).to.be
      .true
  })
})
