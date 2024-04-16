import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { protocolConfigFixture } from 'fixtures'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('setPauserAddress', () => {
  const loadFixture = setupFixtureLoader()

  it('changes pauser address', async () => {
    const { config, otherWallet } = await loadFixture(protocolConfigFixture)
    await config.setPauserAddress(otherWallet.address)
    expect(await config.pauserAddress()).to.equal(otherWallet.address)
  })

  it('only default admin can change pauser address', async () => {
    const { config, otherWallet, DEFAULT_ADMIN_ROLE } = await loadFixture(
      protocolConfigFixture,
    )
    await expect(
      config.connect(otherWallet).setPauserAddress(otherWallet.address),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(otherWallet, DEFAULT_ADMIN_ROLE),
    )
  })

  it('prevents from setting the same pauser address', async () => {
    const { config, wallet } = await loadFixture(protocolConfigFixture)

    await expect(config.setPauserAddress(wallet.address)).to.be.revertedWith(
      'ProtocolConfig: New pauser address needs to be different',
    )
  })

  it('emits event', async () => {
    const { config, otherWallet } = await loadFixture(protocolConfigFixture)
    await expect(config.setPauserAddress(otherWallet.address))
      .to.emit(config, 'PauserAddressChanged')
      .withArgs(otherWallet.address)
  })
})
