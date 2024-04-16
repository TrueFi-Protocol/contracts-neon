import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { protocolConfigFixture } from 'fixtures'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('setProtocolTreasury', () => {
  const loadFixture = setupFixtureLoader()

  it('changes protocol treasury', async () => {
    const { config, otherWallet } = await loadFixture(protocolConfigFixture)
    await config.setProtocolTreasury(otherWallet.address)
    expect(await config.protocolTreasury()).to.equal(otherWallet.address)
  })

  it('reverts when new address is the same', async () => {
    const { config, otherWallet } = await loadFixture(protocolConfigFixture)
    await config.setProtocolTreasury(otherWallet.address)
    await expect(
      config.setProtocolTreasury(otherWallet.address),
    ).to.be.revertedWith(
      'ProtocolConfig: New protocol treasury address needs to be different',
    )
  })

  it('only default admin can change protocol treasury', async () => {
    const { config, otherWallet, DEFAULT_ADMIN_ROLE } = await loadFixture(
      protocolConfigFixture,
    )
    await expect(
      config.connect(otherWallet).setProtocolTreasury(otherWallet.address),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(otherWallet, DEFAULT_ADMIN_ROLE),
    )
  })

  it('emits event', async () => {
    const { config, otherWallet } = await loadFixture(protocolConfigFixture)
    await expect(config.setProtocolTreasury(otherWallet.address))
      .to.emit(config, 'ProtocolTreasuryChanged')
      .withArgs(otherWallet.address)
  })
})
