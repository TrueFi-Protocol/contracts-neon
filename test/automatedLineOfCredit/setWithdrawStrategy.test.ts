import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { AddressZero } from '@ethersproject/constants'
import { WithdrawController__factory } from 'contracts'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('AutomatedLineOfCredit.setWithdrawController', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)

  it('remove strategy', async () => {
    const { portfolio } = await loadFixture()
    await portfolio.setWithdrawController(AddressZero)
    expect(await portfolio.withdrawController()).to.equal(AddressZero)
  })

  it('sets a new strategy', async () => {
    const { portfolio, wallet } = await loadFixture()
    const newWithdrawController = await new WithdrawController__factory(
      wallet,
    ).deploy()
    await portfolio.setWithdrawController(newWithdrawController.address)
    expect(await portfolio.withdrawController()).to.equal(
      newWithdrawController.address,
    )
  })

  it('can only be set by a strategy admin', async () => {
    const { portfolio, other, CONTROLLER_ADMIN_ROLE } = await loadFixture()
    await expect(
      portfolio.connect(other).setWithdrawController(AddressZero),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(other, CONTROLLER_ADMIN_ROLE),
    )
  })

  it('must be set to a new strategy', async () => {
    const { portfolio, withdrawController } = await loadFixture()
    await expect(
      portfolio.setWithdrawController(withdrawController.address),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: New withdraw controller needs to be different',
    )
  })

  it('emits event', async () => {
    const { portfolio, wallet } = await loadFixture()
    const newWithdrawController = await new WithdrawController__factory(
      wallet,
    ).deploy()
    await expect(portfolio.setWithdrawController(newWithdrawController.address))
      .to.emit(portfolio, 'WithdrawControllerChanged')
      .withArgs(newWithdrawController.address)
  })
})
