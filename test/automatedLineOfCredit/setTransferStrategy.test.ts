import { AddressZero } from '@ethersproject/constants'
import { OpenTransferController__factory } from 'contracts'
import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('AutomatedLineOfCredit.setTransferController', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)

  it('remove strategy', async () => {
    const { portfolio, setTransferController } = await loadFixture()
    await setTransferController(AddressZero)
    expect(await portfolio.transferController()).to.equal(AddressZero)
  })

  it('set strategy to a new one', async () => {
    const { portfolio, setTransferController, wallet } = await loadFixture()
    const newTransferController = await new OpenTransferController__factory(
      wallet,
    ).deploy()
    await setTransferController(newTransferController.address)
    expect(await portfolio.transferController()).to.equal(
      newTransferController.address,
    )
  })

  it('can only be set by a strategy admin', async () => {
    const { portfolio, wallet, other, CONTROLLER_ADMIN_ROLE } =
      await loadFixture()
    const newTransferController = await new OpenTransferController__factory(
      wallet,
    ).deploy()
    await expect(
      portfolio
        .connect(other)
        .setTransferController(newTransferController.address),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(other, CONTROLLER_ADMIN_ROLE),
    )
  })

  it('prevents from setting the same strategy', async () => {
    const { portfolio, transferController } = await loadFixture()
    await expect(
      portfolio.setTransferController(transferController.address),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: New transfer controller needs to be different',
    )
  })

  it('emits event', async () => {
    const { portfolio, setTransferController, wallet } = await loadFixture()
    const newTransferController = await new OpenTransferController__factory(
      wallet,
    ).deploy()
    await expect(setTransferController(newTransferController.address))
      .to.emit(portfolio, 'TransferControllerChanged')
      .withArgs(newTransferController.address)
  })
})
