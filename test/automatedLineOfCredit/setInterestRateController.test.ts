import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { AddressZero } from '@ethersproject/constants'
import { LinearKinkInterestRateController__factory } from 'contracts'
import { accessControlMissingRoleRevertMessage } from 'utils/accessControlRevertMessage'

describe('AutomatedLineOfCredit.setInterestRateController', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)

  it('removes controller', async () => {
    const { portfolio, setInterestRateController } = await loadFixture()
    await setInterestRateController(AddressZero)
    expect(await portfolio.interestRateController()).to.equal(AddressZero)
  })

  it('sets controller to a new one', async () => {
    const { portfolio, setInterestRateController, wallet } = await loadFixture()
    const newInterestRateController = await new LinearKinkInterestRateController__factory(
      wallet,
    ).deploy()
    await setInterestRateController(newInterestRateController.address)
    expect(await portfolio.interestRateController()).to.equal(
      newInterestRateController.address,
    )
  })

  it('can only be set by a controller admin', async () => {
    const { portfolio, wallet, other, CONTROLLER_ADMIN_ROLE } =
      await loadFixture()
    const newInterestRateController = await new LinearKinkInterestRateController__factory(
      wallet,
    ).deploy()
    await expect(
      portfolio
        .connect(other)
        .setInterestRateController(newInterestRateController.address),
    ).to.be.revertedWith(
      accessControlMissingRoleRevertMessage(other, CONTROLLER_ADMIN_ROLE),
    )
  })

  it('prevents from setting the same controller', async () => {
    const { portfolio, interestRateController } = await loadFixture()
    await expect(
      portfolio.setInterestRateController(interestRateController.address),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: New interest rate controller needs to be different',
    )
  })

  it('emits event', async () => {
    const { portfolio, setInterestRateController, wallet } = await loadFixture()
    const newInterestRateController = await new LinearKinkInterestRateController__factory(
      wallet,
    ).deploy()
    await expect(setInterestRateController(newInterestRateController.address))
      .to.emit(portfolio, 'InterestRateControllerChanged')
      .withArgs(newInterestRateController.address)
  })
})
