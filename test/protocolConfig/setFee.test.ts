import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { protocolConfigFixture } from 'fixtures'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('setFee', () => {
  const loadFixture = setupFixtureLoader()

  it('changes fee', async () => {
    const { config } = await loadFixture(protocolConfigFixture)
    await config.setProtocolFeeRate(100)
    expect(await config.protocolFeeRate()).to.equal(100)
  })

  it('reverts when new fee is the same', async () => {
    const { config } = await loadFixture(protocolConfigFixture)
    await config.setProtocolFeeRate(100)
    await expect(config.setProtocolFeeRate(100)).to.be.revertedWith(
      'ProtocolConfig: New fee needs to be different',
    )
  })

  it('only default admin can change fee', async () => {
    const { config, protocol, DEFAULT_ADMIN_ROLE } = await loadFixture(
      protocolConfigFixture,
    )
    await expect(
      config.connect(protocol).setProtocolFeeRate(100),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(protocol, DEFAULT_ADMIN_ROLE),
    )
  })

  it('emits event', async () => {
    const { config } = await loadFixture(protocolConfigFixture)
    await expect(config.setProtocolFeeRate(100))
      .to.emit(config, 'ProtocolFeeRateChanged')
      .withArgs(100)
  })
})
