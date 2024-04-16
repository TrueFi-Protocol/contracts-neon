import { TestUpgradeable__factory } from 'contracts'
import { expect } from 'chai'
import { upgradeableFixture } from 'fixtures/upgradeableFixture'
import { setupFixtureLoader } from 'test/setup'
import { extractImplementationAddress } from 'utils/extractImplementationAddress'

describe('Upgradeable.initialize', () => {
  const loadFixture = setupFixtureLoader()

  it('sets default admin', async () => {
    const { upgradeable, wallet, DEFAULT_ADMIN_ROLE } = await loadFixture(
      upgradeableFixture,
    )

    expect(await upgradeable.hasRole(DEFAULT_ADMIN_ROLE, wallet.address)).to.be
      .true
  })

  it('sets pauser', async () => {
    const { upgradeable, wallet, PAUSER_ROLE } = await loadFixture(
      upgradeableFixture,
    )

    expect(await upgradeable.hasRole(PAUSER_ROLE, wallet.address)).to.be.true
  })

  it('does not allow to initialize implementation contract', async () => {
    const { upgradeable, wallet } = await loadFixture(upgradeableFixture)

    const implementationAddress = await extractImplementationAddress(
      upgradeable,
    )
    const implementation = new TestUpgradeable__factory(wallet).attach(
      implementationAddress,
    )

    await expect(implementation.initialize(wallet.address)).to.be.revertedWith(
      'Initializable: contract is already initialized',
    )
  })
})
