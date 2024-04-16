import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { protocolConfigFixture } from 'fixtures'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('setProtocolAdmin', () => {
  const loadFixture = setupFixtureLoader()

  it('changes protocol admin', async () => {
    const { config, otherWallet } = await loadFixture(protocolConfigFixture)
    await config.setProtocolAdmin(otherWallet.address)
    expect(await config.protocolAdmin()).to.equal(otherWallet.address)
  })

  it('reverts when new address is the same', async () => {
    const { config, otherWallet } = await loadFixture(protocolConfigFixture)
    await config.setProtocolAdmin(otherWallet.address)
    await expect(
      config.setProtocolAdmin(otherWallet.address),
    ).to.be.revertedWith(
      'ProtocolConfig: New protocol admin address needs to be different',
    )
  })

  it('only default admin can change protocol admin', async () => {
    const { config, otherWallet, DEFAULT_ADMIN_ROLE } = await loadFixture(
      protocolConfigFixture,
    )
    await expect(
      config.connect(otherWallet).setProtocolAdmin(otherWallet.address),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(otherWallet, DEFAULT_ADMIN_ROLE),
    )
  })

  it('emits event', async () => {
    const { config, otherWallet } = await loadFixture(protocolConfigFixture)
    await expect(config.setProtocolAdmin(otherWallet.address))
      .to.emit(config, 'ProtocolAdminChanged')
      .withArgs(otherWallet.address)
  })
})
