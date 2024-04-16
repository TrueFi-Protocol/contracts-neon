import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { portfolioFactoryFixture } from 'fixtures'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('PortfolioFactory.setManagerRole', () => {
  const loadFixture = setupFixtureLoader()

  it('only default admin can change', async () => {
    const { factory, other, wallet, DEFAULT_ADMIN_ROLE, MANAGER_ROLE } =
      await loadFixture(portfolioFactoryFixture)
    await expect(
      factory.connect(other).grantRole(MANAGER_ROLE, wallet.address),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(other, DEFAULT_ADMIN_ROLE),
    )
  })

  it('can grant manager role to another account', async () => {
    const { factory, wallet, protocolOwner, MANAGER_ROLE } = await loadFixture(
      portfolioFactoryFixture,
    )
    expect(await factory.hasRole(MANAGER_ROLE, wallet.address)).to.be.false
    await factory
      .connect(protocolOwner)
      .grantRole(MANAGER_ROLE, wallet.address)
    expect(await factory.hasRole(MANAGER_ROLE, wallet.address)).to.be.true
  })

  it('can revoke manager role', async () => {
    const { factory, protocolOwner, wallet, MANAGER_ROLE } = await loadFixture(
      portfolioFactoryFixture,
    )
    await factory
      .connect(protocolOwner)
      .grantRole(MANAGER_ROLE, wallet.address)
    expect(await factory.hasRole(MANAGER_ROLE, wallet.address)).to.be.true
    await factory
      .connect(protocolOwner)
      .revokeRole(MANAGER_ROLE, wallet.address)
    expect(await factory.hasRole(MANAGER_ROLE, wallet.address)).to.be.false
  })

  it('emits event', async () => {
    const { factory, protocolOwner, wallet, MANAGER_ROLE } = await loadFixture(
      portfolioFactoryFixture,
    )
    await expect(
      factory.connect(protocolOwner).grantRole(MANAGER_ROLE, wallet.address),
    )
      .to.emit(factory, 'RoleGranted')
      .withArgs(MANAGER_ROLE, wallet.address, protocolOwner.address)
    await expect(
      factory.connect(protocolOwner).revokeRole(MANAGER_ROLE, wallet.address),
    )
      .to.emit(factory, 'RoleRevoked')
      .withArgs(MANAGER_ROLE, wallet.address, protocolOwner.address)
  })
})
