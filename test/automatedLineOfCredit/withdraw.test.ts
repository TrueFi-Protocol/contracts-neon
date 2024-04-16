import { expect, use } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditDepositFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { YEAR, DAY } from 'utils/constants'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('AutomatedLineOfCredit.withdraw', () => {
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithDeposit = automatedLineOfCreditDepositFixture(amount)
  const loadFixture = () => fixtureLoader(fixtureWithDeposit)

  it('cannot withdraw 0 assets', async () => {
    const { withdraw, wallet } = await loadFixture()
    await expect(withdraw(wallet, 0)).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation not allowed',
    )
  })

  it('cannot withdraw without assets', async () => {
    const { withdraw, other } = await loadFixture()
    await expect(withdraw(other, 1)).to.be.revertedWith(
      'ERC20: burn amount exceeds balance',
    )
  })

  it('cannot withdraw more assets than owned', async () => {
    const { withdraw, deposit, wallet, token, other } = await loadFixture()
    await token.mint(other.address, parseUSDC(amount))
    await deposit(other, parseUSDC(amount))
    await expect(withdraw(wallet, parseUSDC(amount + 1))).to.be.revertedWith(
      'ERC20: burn amount exceeds balance',
    )
  })

  it('burns owner LP tokens', async () => {
    const { withdraw, wallet, portfolio } = await loadFixture()
    await withdraw(wallet, parseUSDC(amount))
    expect(await portfolio.balanceOf(wallet.address)).to.equal(0)
  })

  it('burns owner LP tokens when sender is non-owner', async () => {
    const { withdraw, wallet, portfolio, other, parseShares } =
      await loadFixture()
    await portfolio.approve(other.address, parseShares(amount))
    await withdraw(other, parseUSDC(amount), wallet, wallet)
    expect(await portfolio.balanceOf(wallet.address)).to.equal(0)
  })

  it('burns LP tokens according to withdraw controller', async () => {
    const { withdraw, wallet, portfolio, mockWithdrawController, parseShares } =
      await loadFixture()
    await mockWithdrawController({ onWithdraw: { shares: parseShares(1) } })
    await withdraw(wallet, parseUSDC(amount))
    expect(await portfolio.balanceOf(wallet.address)).to.equal(
      parseShares(amount - 1),
    )
  })

  it('transfers funds from portfolio', async () => {
    const { withdraw, portfolio, wallet, token } = await loadFixture()
    await withdraw(wallet, parseUSDC(amount))
    expect(await token.balanceOf(portfolio.address)).to.equal(0)
    expect(await portfolio.virtualTokenBalance()).to.equal(0)
  })

  it('transfers funds to receiver', async () => {
    const { withdraw, wallet, token } = await loadFixture()
    const balanceBefore = await token.balanceOf(wallet.address)
    await withdraw(wallet, parseUSDC(amount))
    expect(await token.balanceOf(wallet.address)).to.equal(
      balanceBefore.add(parseUSDC(amount)),
    )
  })

  it('transfers funds to receiver when receiver is not owner', async () => {
    const { withdraw, wallet, other, token } = await loadFixture()
    await withdraw(wallet, parseUSDC(amount), other, wallet)
    expect(await token.balanceOf(other.address)).to.equal(parseUSDC(amount))
  })

  it('decreases allowance when non-owner withdraws', async () => {
    const { withdraw, wallet, portfolio, other, parseShares } =
      await loadFixture()
    await portfolio.approve(other.address, parseShares(amount))
    await withdraw(other, parseUSDC(amount / 2), wallet, wallet)
    expect(await portfolio.allowance(wallet.address, other.address)).to.equal(
      parseShares(amount / 2),
    )
  })

  it('reverts from non-owner if not approved', async () => {
    const { wallet, other, withdraw } = await loadFixture()
    await expect(
      withdraw(other, parseUSDC(amount), wallet, wallet),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: Caller not approved to burn given amount of shares',
    )
  })

  it('reverts from non-owner if approved amount is exceeded', async () => {
    const { portfolio, wallet, other, parseShares, withdraw } =
      await loadFixture()
    await portfolio.approve(other.address, parseShares(amount / 2))
    await expect(
      withdraw(other, parseUSDC(amount), other, wallet),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: Caller not approved to burn given amount of shares',
    )
  })

  it('returns amount of withdrawn shares', async () => {
    const { portfolio, wallet, parseShares } = await loadFixture()
    expect(
      await portfolio.callStatic.withdraw(
        parseUSDC(amount),
        wallet.address,
        wallet.address,
      ),
    ).to.equal(parseShares(amount))
  })

  it('allows partial withdraw with two lenders', async () => {
    const { withdraw, token, deposit, other } = await loadFixture()
    const otherAmount = 20
    await token.mint(other.address, parseUSDC(otherAmount))
    await deposit(other, parseUSDC(otherAmount))
    await withdraw(other, parseUSDC(otherAmount / 2))

    expect(await token.balanceOf(other.address)).to.equal(
      parseUSDC(otherAmount / 2),
    )
  })

  it('can withdraw accrued interest', async () => {
    const { portfolio, wallet, borrowAndRepayWithInterest, withdraw } =
      await loadFixture()
    const interest = await borrowAndRepayWithInterest(
      parseUSDC(amount),
      YEAR / 2,
    )
    await withdraw(wallet, parseUSDC(amount).add(interest))
    expect(await portfolio.totalAssets()).to.equal(0)
  })

  it('cannot withdraw to portfolio', async () => {
    const { portfolio, wallet, withdraw } = await loadFixture()
    await expect(withdraw(wallet, 1, portfolio, wallet)).to.be.revertedWith(
      'AutomatedLineOfCredit: Portfolio cannot be the receiver',
    )
  })

  it('cannot withdraw from portfolio', async () => {
    const { portfolio, wallet, withdraw } = await loadFixture()
    await expect(withdraw(wallet, 1, wallet, portfolio)).to.be.revertedWith(
      'AutomatedLineOfCredit: Portfolio cannot be the owner',
    )
  })

  it('reverts if withdrawing exceeds portfolio liquidity', async () => {
    const { portfolio, wallet, withdraw } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount))
    await expect(withdraw(wallet, 1)).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation exceeds portfolio liquidity',
    )
  })

  it('reverts if portfolio is paused', async () => {
    const { portfolio, wallet, withdraw } = await loadFixture()
    await portfolio.pause()
    await expect(withdraw(wallet, 1)).to.be.revertedWith('Pausable: paused')
  })

  it('rounds up', async () => {
    const { portfolio, borrowAndRepayWithInterest, wallet } =
      await loadFixture()
    await borrowAndRepayWithInterest(parseUSDC(amount), YEAR / 3)
    const sharesRoundedDown = await portfolio.convertToShares(
      parseUSDC(amount),
    )
    const burnedShares = await portfolio.callStatic.withdraw(
      parseUSDC(amount),
      wallet.address,
      wallet.address,
    )
    expect(burnedShares).to.equal(sharesRoundedDown.add(1))
  })

  it('cannot withdraw when not allowed by withdrawController', async () => {
    const { wallet, withdraw, mockWithdrawController, parseShares } =
      await loadFixture()
    await mockWithdrawController({ onWithdraw: { shares: parseShares(0) } })
    await expect(withdraw(wallet, 1)).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation not allowed',
    )
  })

  it('updates accruedInterest', async () => {
    const { portfolio, wallet, withdraw, borrowAndSetNextTimestamp } =
      await loadFixture()
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount / 2),
      YEAR / 2,
    )
    await withdraw(wallet, 1)
    expect(await portfolio.accruedInterest()).to.equal(interest)
  })

  it('can withdraw past end date', async () => {
    const { withdraw, wallet, portfolio, timeTravel, portfolioDuration } =
      await loadFixture()
    await timeTravel(portfolioDuration + DAY)
    await expect(withdraw(wallet, parseUSDC(amount))).not.to.be.reverted
    expect(await portfolio.balanceOf(wallet.address)).to.equal(0)
  })

  it('updates last protocol fee rate', async () => {
    const { wallet, portfolio, withdraw, protocolConfig, protocolFeeRate } =
      await loadFixture()
    const newFeeRate = 100
    await protocolConfig.setProtocolFeeRate(newFeeRate)
    expect(await portfolio.lastProtocolFeeRate()).to.equal(protocolFeeRate)

    await withdraw(wallet, parseUSDC(amount))
    expect(await portfolio.lastProtocolFeeRate()).to.equal(newFeeRate)
  })

  it('emits a Withdraw event', async () => {
    const {
      portfolio,
      wallet,
      parseShares,
      borrowAndRepayWithInterest,
      other,
      withdraw,
    } = await loadFixture()
    const interest = await borrowAndRepayWithInterest(
      parseUSDC(amount),
      YEAR / 2,
    )
    await expect(
      withdraw(wallet, parseUSDC(amount).add(interest), other, wallet),
    )
      .to.emit(portfolio, 'Withdraw')
      .withArgs(
        wallet.address,
        other.address,
        wallet.address,
        parseUSDC(amount).add(interest),
        parseShares(amount),
      )
  })

  it('transfers fee', async () => {
    const {
      portfolio,
      token,
      protocolConfig,
      protocolTreasury,
      executeAndSetNextTimestamp,
      withdraw,
      wallet,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await withdraw(wallet, parseUSDC(1))
    expect(await token.balanceOf(protocolTreasury)).to.equal(
      parseUSDC(amount * 0.05),
    )
  })

  it('withdraw limit includes fees', async () => {
    const {
      portfolio,
      executeAndSetNextTimestamp,
      protocolConfig,
      wallet,
      withdraw,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await expect(withdraw(wallet, parseUSDC(amount))).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation exceeds portfolio liquidity',
    )
  })

  it('burns more shares after applying fees', async () => {
    const {
      portfolio,
      executeAndSetNextTimestamp,
      protocolConfig,
      withdraw,
      wallet,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await withdraw(wallet, parseUSDC(amount * 0.95))
    expect(await portfolio.balanceOf(wallet.address)).to.equal(0)
  })

  it('calls onWithdraw with correct arguments', async () => {
    const {
      portfolio,
      wallet,
      other,
      another,
      parseShares,
      withdrawController,
    } = await loadFixture()
    await portfolio.approve(other.address, parseShares(amount))
    await portfolio
      .connect(other)
      .withdraw(parseUSDC(amount), another.address, wallet.address)
    expect('onWithdraw').to.be.calledOnContractWith(withdrawController, [
      other.address,
      parseUSDC(amount),
      another.address,
      wallet.address,
    ])
  })

  it('emits FeePaid event', async () => {
    const {
      portfolio,
      executeAndSetNextTimestamp,
      protocolConfig,
      protocolTreasury,
      wallet,
      withdraw,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await expect(withdraw(wallet, parseUSDC(1)))
      .to.emit(portfolio, 'FeePaid')
      .withArgs(protocolTreasury, parseUSDC(amount * 0.05))
  })
})
