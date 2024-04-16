import { AutomatedLineOfCredit__factory } from 'contracts'
import { expect } from 'chai'
import {
  portfolioName,
  portfolioSymbol,
  maxSize,
} from 'config'
import { setupFixtureLoader } from 'test/setup'
import { deployBehindProxy } from 'utils/deployBehindProxy'
import { automatedLineOfCreditFixture } from 'fixtures'

describe('AutomatedLineOfCredit.initialize', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)

  it('initializes borrower', async () => {
    const { portfolio, wallet } = await loadFixture()
    expect(await portfolio.borrower()).to.equal(wallet.address)
  })

  it('initializes borrowedAmount', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.borrowedAmount()).to.equal(0)
  })

  it('correctly returns minimum interestRate', async () => {
    const { portfolio, interestRatePolyline } = await loadFixture()
    expect(await portfolio.interestRate()).to.equal(
      interestRatePolyline.minInterestRate,
    )
  })

  it('initializes lastProtocolFeeRate', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.lastProtocolFeeRate()).to.equal(0)
  })

  it('initializes name', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.name()).to.equal(portfolioName)
  })

  it('initializes symbol', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.symbol()).to.equal(portfolioSymbol)
  })

  it('initializes decimals', async () => {
    const { portfolio, token } = await loadFixture()
    expect(await portfolio.decimals()).to.equal(await token.decimals())
  })

  it('initializes max size', async () => {
    const { portfolio } = await loadFixture()
    expect(await portfolio.maxSize()).to.equal(maxSize)
  })

  it('initializes deposit controller', async () => {
    const { portfolio, depositController } = await loadFixture()
    expect(await portfolio.depositController()).to.equal(
      depositController.address,
    )
  })

  it('initializes withdraw controller', async () => {
    const { portfolio, withdrawController } = await loadFixture()
    expect(await portfolio.withdrawController()).to.equal(
      withdrawController.address,
    )
  })

  it('initializes transfer controller', async () => {
    const { portfolio, transferController } = await loadFixture()
    expect(await portfolio.transferController()).to.equal(
      transferController.address,
    )
  })

  it('initializes interest rate controller', async () => {
    const { portfolio, interestRateController } = await loadFixture()
    expect(await portfolio.interestRateController()).to.equal(
      interestRateController.address,
    )
  })

  it('end date', async () => {
    const { portfolio, portfolioDuration, getTxTimestamp } =
      await loadFixture()
    const timestamp = await getTxTimestamp(portfolio.deployTransaction)
    expect(await portfolio.endDate()).to.equal(timestamp + portfolioDuration)
  })

  it('asset', async () => {
    const { portfolio, token } = await loadFixture()
    expect(await portfolio.asset()).to.equal(token.address)
  })

  it('sets default admin', async () => {
    const { portfolio, protocolConfig, DEFAULT_ADMIN_ROLE } =
      await loadFixture()
    const protocolAdmin = await protocolConfig.protocolAdmin()

    expect(await portfolio.hasRole(DEFAULT_ADMIN_ROLE, protocolAdmin)).to.be
      .true
  })

  it('sets manager', async () => {
    const { portfolio, MANAGER_ROLE, wallet } = await loadFixture()

    expect(await portfolio.getRoleMemberCount(MANAGER_ROLE)).to.equal(1)
    expect(await portfolio.hasRole(MANAGER_ROLE, wallet.address)).to.be.true
  })

  it('sets strategy admin', async () => {
    const { portfolio, CONTROLLER_ADMIN_ROLE, wallet } = await loadFixture()

    expect(await portfolio.getRoleMemberCount(CONTROLLER_ADMIN_ROLE)).to.equal(
      1,
    )
    expect(await portfolio.hasRole(CONTROLLER_ADMIN_ROLE, wallet.address)).to.be
      .true
  })

  it('sets pauser', async () => {
    const { portfolio, PAUSER_ROLE, wallet } = await loadFixture()

    expect(await portfolio.getRoleMemberCount(PAUSER_ROLE)).to.equal(1)
    expect(await portfolio.hasRole(PAUSER_ROLE, wallet.address)).to.be.true
  })

  it('cannot create a portfolio with zero duration', async () => {
    const {
      wallet,
      token,
      protocolConfig,
      controllersAddresses,
    } = await loadFixture()
    await expect(
      deployBehindProxy(
        new AutomatedLineOfCredit__factory(wallet),
        protocolConfig.address,
        0,
        token.address,
        wallet.address,
        0,
        controllersAddresses,
        'ALOC',
        'ALOC',
      ),
    ).to.be.revertedWith('AutomatedLineOfCredit: Cannot have zero duration')
  })
})
