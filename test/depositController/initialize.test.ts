import { setupFixtureLoader } from 'test/setup'
import { expect } from 'chai'
import { DepositController__factory } from 'contracts'
import { Wallet } from 'ethers'

describe('DepositController.initialize', () => {
  const loadFixture = setupFixtureLoader()

  it('correctly sets fields', async () => {
    const { wallet } = await loadFixture(async () => {})
    const randomAddress = Wallet.createRandom().address
    const depositController = await new DepositController__factory(
      wallet,
    ).deploy()
    await depositController.initialize(randomAddress)

    expect(await depositController.lenderVerifier()).eq(randomAddress)
  })

  it('cannot initialize twice', async () => {
    const { wallet, other } = await loadFixture(async () => {})

    const depositController = await new DepositController__factory(
      wallet,
    ).deploy()

    await depositController.initialize(other.address)
    await expect(
      depositController.initialize(other.address),
    ).to.be.revertedWith('Initializable: contract is already initialized')
  })
})
