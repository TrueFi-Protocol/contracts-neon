import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { portfolioFactoryFixture } from 'fixtures'

describe('PortfolioFactory.initializer', () => {
  const loadFixture = setupFixtureLoader()

  it('sets implementation', async () => {
    const { factory, portfolioImplementation } = await loadFixture(
      portfolioFactoryFixture,
    )
    expect(await factory.portfolioImplementation()).to.equal(
      portfolioImplementation.address,
    )
  })

  it('sets protocol config', async () => {
    const { factory, protocolConfig } = await loadFixture(
      portfolioFactoryFixture,
    )
    expect(await factory.protocolConfig()).to.equal(protocolConfig.address)
  })

  it('sets default admin', async () => {
    const { factory, wallet, DEFAULT_ADMIN_ROLE } = await loadFixture(
      portfolioFactoryFixture,
    )

    expect(await factory.hasRole(DEFAULT_ADMIN_ROLE, wallet.address)).to.be
      .true
  })

  it('sets pauser', async () => {
    const { factory, wallet, PAUSER_ROLE } = await loadFixture(
      portfolioFactoryFixture,
    )

    expect(await factory.hasRole(PAUSER_ROLE, wallet.address)).to.be.true
  })
})
