import { expect } from 'chai'
import { upgradeableFixture } from 'fixtures/upgradeableFixture'
import { setupFixtureLoader } from 'test/setup'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('Upgradeable.grantDefaultAdminRole', () => {
  const loadFixture = setupFixtureLoader()

  it('reverts if called by non default admin', async () => {
    const { upgradeable, other, DEFAULT_ADMIN_ROLE } = await loadFixture(
      upgradeableFixture,
    )

    await expect(
      upgradeable.connect(other).grantRole(DEFAULT_ADMIN_ROLE, other.address),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(other, DEFAULT_ADMIN_ROLE),
    )
  })

  it('does not revoke its own default admin', async () => {
    const { upgradeable, wallet, other, DEFAULT_ADMIN_ROLE } =
      await loadFixture(upgradeableFixture)

    await upgradeable.grantRole(DEFAULT_ADMIN_ROLE, other.address)

    expect(await upgradeable.hasRole(DEFAULT_ADMIN_ROLE, wallet.address)).to.be
      .true
  })

  it('grants default admin to other', async () => {
    const { upgradeable, other, DEFAULT_ADMIN_ROLE } = await loadFixture(
      upgradeableFixture,
    )

    await upgradeable.grantRole(DEFAULT_ADMIN_ROLE, other.address)

    expect(await upgradeable.hasRole(DEFAULT_ADMIN_ROLE, other.address)).to.be
      .true
  })
})
