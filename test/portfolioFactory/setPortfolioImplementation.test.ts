import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { portfolioFactoryFixture } from 'fixtures'
import { Wallet } from 'ethers'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('PortfolioFactory.setPortfolioImplementation', () => {
  const loadFixture = setupFixtureLoader()
  const newImplementation = Wallet.createRandom().address

  it('only default admin can change', async () => {
    const { factory, other, DEFAULT_ADMIN_ROLE } = await loadFixture(
      portfolioFactoryFixture,
    )
    await expect(
      factory.connect(other).setPortfolioImplementation(newImplementation),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(other, DEFAULT_ADMIN_ROLE),
    )
  })

  it('changes implementation', async () => {
    const { factory, protocolOwner } = await loadFixture(
      portfolioFactoryFixture,
    )
    await factory
      .connect(protocolOwner)
      .setPortfolioImplementation(newImplementation)
    expect(await factory.portfolioImplementation()).to.equal(newImplementation)
  })

  it('reverts when setting the same implementation', async () => {
    const { factory, protocolOwner } = await loadFixture(
      portfolioFactoryFixture,
    )
    await factory
      .connect(protocolOwner)
      .setPortfolioImplementation(newImplementation)
    await expect(
      factory
        .connect(protocolOwner)
        .setPortfolioImplementation(newImplementation),
    ).to.be.revertedWith(
      'PortfolioFactory: New portfolio implementation needs to be different',
    )
  })

  it('emits event', async () => {
    const { factory, protocolOwner } = await loadFixture(
      portfolioFactoryFixture,
    )
    await expect(
      factory
        .connect(protocolOwner)
        .setPortfolioImplementation(newImplementation),
    )
      .to.emit(factory, 'PortfolioImplementationChanged')
      .withArgs(newImplementation)
  })
})
