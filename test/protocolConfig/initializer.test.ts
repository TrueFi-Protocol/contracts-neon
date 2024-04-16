import { expect } from 'chai'
import { protocolFeeRate } from 'config'
import { setupFixtureLoader } from 'test/setup'
import { protocolConfigFixture } from 'fixtures'

describe('ProtocolConfig.initializer', () => {
  const loadFixture = setupFixtureLoader()

  it('sets fee rate', async () => {
    const { config } = await loadFixture(protocolConfigFixture)
    expect(await config.protocolFeeRate()).to.equal(protocolFeeRate)
  })

  it('sets protocol admin', async () => {
    const { config, protocol } = await loadFixture(protocolConfigFixture)
    expect(await config.protocolAdmin()).to.equal(protocol.address)
  })

  it('sets protocol treasury', async () => {
    const { config, protocolTreasury } = await loadFixture(
      protocolConfigFixture,
    )
    expect(await config.protocolTreasury()).to.equal(protocolTreasury.address)
  })

  it('sets pauser address', async () => {
    const { config, wallet } = await loadFixture(protocolConfigFixture)
    expect(await config.pauserAddress()).to.equal(wallet.address)
  })

  it('sets pauser as pauser role', async () => {
    const { config, wallet, PAUSER_ROLE } = await loadFixture(
      protocolConfigFixture,
    )
    expect(await config.hasRole(PAUSER_ROLE, wallet.address)).to.be.true
  })

  it('sets creator as default admin', async () => {
    const { config, wallet, DEFAULT_ADMIN_ROLE } = await loadFixture(
      protocolConfigFixture,
    )
    expect(await config.hasRole(DEFAULT_ADMIN_ROLE, wallet.address)).to.be.true
  })
})
