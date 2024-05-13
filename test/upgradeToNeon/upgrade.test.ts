import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { berylliumAutomatedLineOfCreditFactoryFixture } from 'fixtures/berylliumAutomatedLineOfCreditFactoryFixture'
import {
  AutomatedLineOfCreditFactory__factory as NeonAutomatedLineOfCreditFactory__factory,
  AutomatedLineOfCredit__factory as NeonAutomatedLineOfCredit__factory,
} from 'contracts'

describe('Upgrade from beryllium to neon', () => {
  const loadFixture = setupFixtureLoader()

  it('upgrade does not change storage slots', async () => {
    const { createPortfolio, protocolOwner, factory } = await loadFixture(
      berylliumAutomatedLineOfCreditFactoryFixture,
    )
    const { portfolio: berylliumPortfolio } = await createPortfolio()
    const transferControllerBeforeUpgrade = await berylliumPortfolio.transferController()
    const withdrawControllerBeforeUpgrade = await berylliumPortfolio.withdrawController()
    const depositControllerBeforeUpgrade = await berylliumPortfolio.depositController()

    const neonPortfolioImplementation = await new NeonAutomatedLineOfCredit__factory(protocolOwner).deploy()
    const neonFactoryImplementation = await new NeonAutomatedLineOfCreditFactory__factory(protocolOwner).deploy()

    await berylliumPortfolio.upgradeTo(neonPortfolioImplementation.address)
    await factory.upgradeTo(neonFactoryImplementation.address)
    await factory.setPortfolioImplementation(neonPortfolioImplementation.address)

    const transferControllerAfterUpgrade = await berylliumPortfolio.transferController()
    const withdrawControllerAfterUpgrade = await berylliumPortfolio.withdrawController()
    const depositControllerAfterUpgrade = await berylliumPortfolio.depositController()

    const neonPortfolio = new NeonAutomatedLineOfCredit__factory(protocolOwner).attach(berylliumPortfolio.address)
    expect(() => neonPortfolio.interestRateController()).to.not.throw()

    expect(transferControllerBeforeUpgrade).to.equal(transferControllerAfterUpgrade)
    expect(withdrawControllerBeforeUpgrade).to.equal(withdrawControllerAfterUpgrade)
    expect(depositControllerBeforeUpgrade).to.equal(depositControllerAfterUpgrade)
  })
})
