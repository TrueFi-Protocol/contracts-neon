import { LinearKinkInterestRateController__factory } from 'contracts'
import { expect } from 'chai'
import { interestRatePolyline } from 'config'
import { setupFixtureLoader } from 'test/setup'
import { deployBehindProxy } from 'utils/deployBehindProxy'
import { automatedLineOfCreditFixture } from 'fixtures'

describe('LinearKinkInterestRateController.initialize', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)

  it('reverts if minInterestRateUtilizationThreshold is greater than optimumUtilization', async () => {
    const { wallet } =
      await loadFixture()
    const wrongPolyline = {
      ...interestRatePolyline,
      minInterestRateUtilizationThreshold:
        interestRatePolyline.optimumUtilization,
      optimumUtilization:
        interestRatePolyline.minInterestRateUtilizationThreshold,
    }
    await expect(
      deployBehindProxy(
        new LinearKinkInterestRateController__factory(wallet),
        wrongPolyline,
      ),
    ).to.be.revertedWith(
      'LinearKinkInterestRateController: optimum utilzation smaller than min.',
    )
  })

  it('reverts if optimumUtilization is greater than maxInterestRateUtilizationThreshold', async () => {
    const { wallet } =
      await loadFixture()
    const wrongPolyline = {
      ...interestRatePolyline,
      optimumUtilization:
        interestRatePolyline.maxInterestRateUtilizationThreshold,
      maxInterestRateUtilizationThreshold:
        interestRatePolyline.optimumUtilization,
    }
    await expect(
      deployBehindProxy(
        new LinearKinkInterestRateController__factory(wallet),
        wrongPolyline,
      ),
    ).to.be.revertedWith(
      'LinearKinkInterestRateController: optimum utilization bigger than max.',
    )
  })

  it('initializes interest rate params', async () => {
    const { wallet } =
      await loadFixture()
    const controller = await deployBehindProxy(
      new LinearKinkInterestRateController__factory(wallet),
      interestRatePolyline,
    )
    expect(await controller.interestRateParameters()).to.deep.equal(
      Object.values(interestRatePolyline),
    )
  })

  it('cannot reinitialize', async () => {
    const { wallet } =
      await loadFixture()
    const controller = await deployBehindProxy(
      new LinearKinkInterestRateController__factory(wallet),
      interestRatePolyline,
    )
    // ensure that the controller is initialized
    expect(await controller.interestRateParameters()).to.deep.equal(
      Object.values(interestRatePolyline),
    )

    await expect(controller.initialize(interestRatePolyline)).to.be.revertedWith('Initializable: contract is already initialized')
  })
})
