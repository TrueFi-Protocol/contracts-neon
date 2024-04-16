import { expect } from 'chai'
import { upgradeableFixture } from 'fixtures/upgradeableFixture'
import { setupFixtureLoader } from 'test/setup'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('Upgradeable.revokeDefaultAdminRole', () => {
  const loadFixture = setupFixtureLoader()

  it('reverts if called by non default admin', async () => {
    const { upgradeable, wallet, other, DEFAULT_ADMIN_ROLE } =
      await loadFixture(upgradeableFixture)

    await expect(
      upgradeable.connect(other).revokeRole(DEFAULT_ADMIN_ROLE, wallet.address),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(other, DEFAULT_ADMIN_ROLE),
    )
  })

  it('revokes other default admin', async () => {
    const { upgradeable, other, DEFAULT_ADMIN_ROLE } = await loadFixture(
      upgradeableFixture,
    )

    await upgradeable.grantRole(DEFAULT_ADMIN_ROLE, other.address)
    expect(await upgradeable.hasRole(DEFAULT_ADMIN_ROLE, other.address)).to.be
      .true
    await upgradeable.revokeRole(DEFAULT_ADMIN_ROLE, other.address)
    expect(await upgradeable.hasRole(DEFAULT_ADMIN_ROLE, other.address)).to.be
      .false
  })

  it('revokes its own default admin', async () => {
    const { upgradeable, wallet, DEFAULT_ADMIN_ROLE } = await loadFixture(
      upgradeableFixture,
    )

    await upgradeable.revokeRole(DEFAULT_ADMIN_ROLE, wallet.address)
    expect(await upgradeable.hasRole(DEFAULT_ADMIN_ROLE, wallet.address)).to.be
      .false
  })
})
