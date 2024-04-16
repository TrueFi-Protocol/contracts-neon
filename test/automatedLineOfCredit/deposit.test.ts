import { expect, use } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR, DAY } from 'utils/constants'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('AutomatedLineOfCredit.deposit', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('reverts when portfolio is receiver', async () => {
    const { portfolio } = await loadFixture()
    await expect(
      portfolio.deposit(amount, portfolio.address),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: Portfolio cannot be the receiver',
    )
  })

  it('reverts for 0 deposit', async () => {
    const { deposit, wallet } = await loadFixture()
    await expect(deposit(wallet, parseUSDC(0))).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation not allowed',
    )
  })

  it('distributes shares to receiver', async () => {
    const { portfolio, other, wallet, parseShares, token } =
      await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount))
    await portfolio.connect(wallet).deposit(parseUSDC(amount), other.address)
    expect(await portfolio.balanceOf(other.address)).to.equal(
      parseShares(amount),
    )
  })

  it('transfers funds from caller', async () => {
    const { portfolio, other, token, wallet } = await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount))
    const balanceBefore = await token.balanceOf(wallet.address)
    await portfolio.deposit(amount, other.address)
    const balanceAfter = await token.balanceOf(wallet.address)
    expect(balanceBefore.sub(balanceAfter)).to.equal(amount)
  })

  it('transfers funds to portfolio', async () => {
    const { portfolio, wallet, other, token } = await loadFixture()
    await token.approve(portfolio.address, amount)
    await portfolio.connect(wallet).deposit(amount, other.address)
    expect(await token.balanceOf(portfolio.address)).to.equal(amount)
    expect(await portfolio.virtualTokenBalance()).to.equal(amount)
  })

  it('distributes fewer tokens when portfolio value appreciates', async () => {
    const {
      portfolio,
      wallet,
      other,
      token,
      deposit,
      parseShares,
      borrowAndRepayWithInterest,
    } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    const interest = await borrowAndRepayWithInterest(
      parseUSDC(amount),
      YEAR / 4,
    )
    const newPortfolioValue = parseUSDC(amount).add(interest)

    await token.mint(other.address, parseUSDC(amount))
    const lpTokensMinted = parseUSDC(amount)
      .mul(parseShares(amount))
      .div(newPortfolioValue)
    await deposit(other, parseUSDC(amount))
    expect(await portfolio.balanceOf(other.address)).to.equal(lpTokensMinted)
  })

  it('updates accruedInterest', async () => {
    const { portfolio, wallet, deposit, timeTravel, calculateInterest } =
      await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await portfolio.borrow(parseUSDC(amount))
    await timeTravel(YEAR / 2)
    const interest = await calculateInterest(parseUSDC(amount), YEAR / 2)
    await deposit(wallet, parseUSDC(amount))
    expect(await portfolio.accruedInterest()).to.be.closeTo(
      interest,
      parseUSDC(1),
    )
  })

  it('cannot deposit past end date', async () => {
    const { wallet, deposit, timeTravel } = await loadFixture()
    await timeTravel(YEAR + DAY)
    await expect(deposit(wallet, parseUSDC(amount))).to.be.revertedWith(
      'AutomatedLineOfCredit: Portfolio end date has elapsed',
    )
  })

  it('cannot deposit past max size', async () => {
    const { other, maxSize, deposit } = await loadFixture()
    await expect(deposit(other, parseUSDC(maxSize).add(1))).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation would cause portfolio to exceed max size',
    )
  })

  it('max size set to 0', async () => {
    const { portfolio, wallet, deposit } = await loadFixture()
    await deposit(wallet, parseUSDC(amount / 2))
    await portfolio.setMaxSize(0)
    await expect(deposit(wallet, 1)).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation would cause portfolio to exceed max size',
    )
  })

  it('cannot deposit after manager decreases max size below value', async () => {
    const { portfolio, wallet, deposit } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await portfolio.setMaxSize(parseUSDC(900_000))
    await expect(deposit(wallet, 1)).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation would cause portfolio to exceed max size',
    )
  })

  it('cannot deposit after interest exceeds max size', async () => {
    const { portfolio, wallet, timeTravel, deposit } = await loadFixture()
    await portfolio.setMaxSize(parseUSDC(amount))
    await deposit(wallet, parseUSDC(amount))
    await portfolio.borrow(parseUSDC(amount))
    await timeTravel(YEAR / 2)
    await expect(deposit(wallet, parseUSDC(1))).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation would cause portfolio to exceed max size',
    )
  })

  it('can deposit when somebody withdraws below max size', async () => {
    const { portfolio, wallet, deposit, withdraw, parseShares } =
      await loadFixture()
    await portfolio.setMaxSize(parseUSDC(amount))

    await deposit(wallet, parseUSDC(amount))
    await expect(deposit(wallet, parseUSDC(1))).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation would cause portfolio to exceed max size',
    )

    await withdraw(wallet, parseShares(amount / 10))
    await expect(deposit(wallet, parseUSDC(1))).not.to.be.reverted
  })

  it('can\'t deposit when not allowed', async () => {
    const { deposit, wallet, mockDepositController } = await loadFixture()
    await mockDepositController({ onDeposit: { shares: 0 } })
    await expect(deposit(wallet, parseUSDC(1))).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation not allowed',
    )
  })

  it('calls onDeposit with correct arguments', async () => {
    const { deposit, wallet, other, mockDepositController } =
      await loadFixture()
    const strategyContract = await mockDepositController({
      onDeposit: { shares: 1 },
    })
    await deposit(wallet, parseUSDC(amount), other)
    expect('onDeposit').to.be.calledOnContractWith(strategyContract, [
      wallet.address,
      parseUSDC(amount),
      other.address,
    ])
  })

  it('returns the number of shares minted', async () => {
    const { portfolio, wallet, token, parseShares } = await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount))
    expect(
      await portfolio.callStatic.deposit(parseUSDC(amount), wallet.address),
    ).to.equal(parseShares(amount))
  })

  it('updates last protocol fee rate', async () => {
    const { portfolio, deposit, wallet, protocolConfig } = await loadFixture()
    expect(await portfolio.lastProtocolFeeRate()).to.equal(0)

    await deposit(wallet, parseUSDC(1))
    const protocolFeeRate = await protocolConfig.protocolFeeRate()
    expect(await portfolio.lastProtocolFeeRate()).to.equal(protocolFeeRate)
  })

  it('emits a Deposit event', async () => {
    const { deposit, portfolio, wallet, parseShares } = await loadFixture()
    await expect(deposit(wallet, parseUSDC(amount)))
      .to.emit(portfolio, 'Deposit')
      .withArgs(
        wallet.address,
        wallet.address,
        parseUSDC(amount),
        parseShares(amount),
      )
  })

  it('transfers fee', async () => {
    const {
      token,
      wallet,
      deposit,
      protocolConfig,
      protocolTreasury,
      getTxTimestamp,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    const txTimestamp = await getTxTimestamp(
      deposit(wallet, parseUSDC(amount)),
    )
    await deposit(wallet, parseUSDC(amount), wallet, txTimestamp + YEAR / 2)
    expect(await token.balanceOf(protocolTreasury)).to.equal(
      parseUSDC(amount * 0.05),
    )
  })

  it('mints correct amount with fee', async () => {
    const {
      portfolio,
      token,
      other,
      parseShares,
      wallet,
      deposit,
      borrowAndSetNextTimestamp,
      protocolConfig,
    } = await loadFixture()
    await token.mint(other.address, parseUSDC(amount * 2))
    await token
      .connect(other)
      .approve(portfolio.address, parseUSDC(amount * 2))
    await deposit(wallet, parseUSDC(amount))
    await protocolConfig.setProtocolFeeRate(1000)
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount),
      YEAR / 2,
    )
    const fee = parseUSDC(amount).add(interest).div(20)
    await portfolio
      .connect(other)
      .deposit(parseUSDC(amount).add(interest).sub(fee), other.address)
    expect(await portfolio.balanceOf(other.address)).to.equal(
      parseShares(amount),
    )
  })

  it('liquid assets are less than fee', async () => {
    const {
      portfolio,
      token,
      wallet,
      deposit,
      protocolConfig,
      protocolTreasury,
      getTxTimestamp,
      calculateInterest,
    } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await protocolConfig.setProtocolFeeRate(1000)
    const txTimestamp = await getTxTimestamp(
      portfolio.borrow(parseUSDC(amount)),
    )
    const interest = await calculateInterest(parseUSDC(amount), YEAR / 2)
    await deposit(wallet, 1, wallet, txTimestamp + YEAR / 2)
    expect(await portfolio.virtualTokenBalance()).to.equal(0)
    expect(await token.balanceOf(protocolTreasury)).to.equal(1)
    expect(await portfolio.unpaidFee()).equal(
      parseUSDC(amount).add(interest).div(20).sub(1),
    )
  })

  it('emits FeePaid event', async () => {
    const {
      portfolio,
      deposit,
      wallet,
      parseShares,
      protocolConfig,
      protocolTreasury,
      getTxTimestamp,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    const txTimestamp = await getTxTimestamp(
      deposit(wallet, parseShares(amount)),
    )
    await expect(deposit(wallet, 1, wallet, txTimestamp + YEAR / 2))
      .to.emit(portfolio, 'FeePaid')
      .withArgs(protocolTreasury, parseUSDC(amount * 0.05))
  })

  it('transfers amount specified in strategy', async () => {
    const {
      wallet,
      parseShares,
      portfolio,
      deposit,
      token,
      mockDepositController,
    } = await loadFixture()
    await mockDepositController({ onDeposit: { shares: parseShares(50) } })
    const balanceBefore = await token.balanceOf(wallet.address)
    await deposit(wallet, parseUSDC(amount))

    expect(await token.balanceOf(wallet.address)).to.equal(
      balanceBefore.sub(parseUSDC(amount)),
    )
    expect(await portfolio.balanceOf(wallet.address)).to.equal(parseShares(50))
  })

  describe('whitelist deposit strategy', () => {
    it('does not allow deposit when not whitelisted', async () => {
      const { other, portfolio, deposit, whitelistDepositController } =
        await loadFixture()
      await portfolio.setDepositController(whitelistDepositController.address)
      await expect(deposit(other, parseUSDC(amount))).to.be.revertedWith(
        'AutomatedLineOfCredit: Operation not allowed',
      )
    })

    it('allows deposit when whitelisted', async () => {
      const {
        other,
        portfolio,
        deposit,
        whitelistDepositController,
        parseShares,
        token,
      } = await loadFixture()
      await portfolio.setDepositController(whitelistDepositController.address)
      await whitelistDepositController.setWhitelistStatus(
        portfolio.address,
        other.address,
        true,
      )
      await token.mint(other.address, parseUSDC(amount))
      await deposit(other, parseUSDC(amount))
      expect(await portfolio.balanceOf(other.address)).to.equal(
        parseShares(amount),
      )
    })
  })
})
