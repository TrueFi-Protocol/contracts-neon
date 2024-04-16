import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { AddressZero } from '@ethersproject/constants'
import { DepositController__factory } from 'contracts'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('AutomatedLineOfCredit.setDepositController', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)

  it('removes controller', async () => {
    const { portfolio, setDepositController } = await loadFixture()
    await setDepositController(AddressZero)
    expect(await portfolio.depositController()).to.equal(AddressZero)
  })

  it('sets controller to a new one', async () => {
    const { portfolio, setDepositController, wallet } = await loadFixture()
    const newDepositController = await new DepositController__factory(
      wallet,
    ).deploy()
    await setDepositController(newDepositController.address)
    expect(await portfolio.depositController()).to.equal(
      newDepositController.address,
    )
  })

  it('can only be set by a controller admin', async () => {
    const { portfolio, wallet, other, CONTROLLER_ADMIN_ROLE } =
      await loadFixture()
    const newDepositController = await new DepositController__factory(
      wallet,
    ).deploy()
    await expect(
      portfolio
        .connect(other)
        .setDepositController(newDepositController.address),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(other, CONTROLLER_ADMIN_ROLE),
    )
  })

  it('prevents from setting the same controller', async () => {
    const { portfolio, depositController } = await loadFixture()
    await expect(
      portfolio.setDepositController(depositController.address),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: New deposit controller needs to be different',
    )
  })

  it('emits event', async () => {
    const { portfolio, setDepositController, wallet } = await loadFixture()
    const newDepositController = await new DepositController__factory(
      wallet,
    ).deploy()
    await expect(setDepositController(newDepositController.address))
      .to.emit(portfolio, 'DepositControllerChanged')
      .withArgs(newDepositController.address)
  })
})
