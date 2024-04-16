import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { upgradeableFixture } from 'fixtures/upgradeableFixture'
import { TestUpgradeable__factory } from 'contracts'
import { extractImplementationAddress } from 'utils'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('Upgradeable.upgradeTo', () => {
  const loadFixture = setupFixtureLoader()

  it('performs upgrade', async () => {
    const { upgradeable, wallet } = await loadFixture(upgradeableFixture)

    const newImplementation = await new TestUpgradeable__factory(
      wallet,
    ).deploy()
    await upgradeable.upgradeTo(newImplementation.address)
    const proxyImplementationAddress = await extractImplementationAddress(
      upgradeable,
    )

    expect(proxyImplementationAddress).to.equal(newImplementation.address)
  })

  it('reverts if not called by default admin', async () => {
    const { upgradeable, other, DEFAULT_ADMIN_ROLE } = await loadFixture(
      upgradeableFixture,
    )

    const newImplementation = await new TestUpgradeable__factory(
      other,
    ).deploy()

    await expect(
      upgradeable.connect(other).upgradeTo(newImplementation.address),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(other, DEFAULT_ADMIN_ROLE),
    )
  })
})
