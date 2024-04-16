import { expect, use } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditDepositFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { DAY, YEAR } from 'utils/constants'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('AutomatedLineOfCredit.redeem', () => {
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithDeposit = automatedLineOfCreditDepositFixture(amount)
  const loadFixture = () => fixtureLoader(fixtureWithDeposit)

  it('cannot redeem 0 shares', async () => {
    const { redeem, wallet } = await loadFixture()
    await expect(redeem(wallet, 0)).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation not allowed',
    )
  })

  it('cannot redeem without shares', async () => {
    const { redeem, other } = await loadFixture()
    await expect(redeem(other, 1)).to.be.revertedWith(
      'ERC20: burn amount exceeds balance',
    )
  })

  it('cannot redeem more shares than owned', async () => {
    const { redeem, deposit, wallet, token, other, parseShares } =
      await loadFixture()
    await token.mint(other.address, parseUSDC(amount))
    await deposit(other, parseUSDC(amount))
    await expect(redeem(wallet, parseShares(amount).add(1))).to.be.revertedWith(
      'ERC20: burn amount exceeds balance',
    )
  })

  it('burns owner\'s shares', async () => {
    const { portfolio, wallet, parseShares, redeem } = await loadFixture()
    await redeem(wallet, parseShares(amount))
    expect(await portfolio.balanceOf(wallet.address)).to.equal(0)
  })

  it('transfers assets from portfolio to receiver', async () => {
    const { portfolio, token, wallet, other, parseShares, redeem } =
      await loadFixture()
    await redeem(wallet, parseShares(amount), other)
    expect(await token.balanceOf(portfolio.address)).to.equal(0)
    expect(await token.balanceOf(other.address)).to.equal(parseUSDC(amount))
  })

  it('decreases virtualTokenBalance', async () => {
    const { portfolio, wallet, parseShares, redeem } = await loadFixture()
    await redeem(wallet, parseShares(amount / 2))
    expect(await portfolio.virtualTokenBalance()).to.equal(
      parseUSDC(amount / 2),
    )
  })

  it('returns amount of redeemed assets', async () => {
    const { portfolio, wallet, parseShares } = await loadFixture()
    expect(
      await portfolio.callStatic.redeem(
        parseShares(amount),
        wallet.address,
        wallet.address,
      ),
    ).to.equal(parseUSDC(amount))
  })

  it('transfer assets provided by strategy', async () => {
    const {
      wallet,
      redeem,
      mockWithdrawController,
      parseShares,
      portfolio,
      token,
      other,
    } = await loadFixture()
    await mockWithdrawController({ onRedeem: { assets: 1, fee: 0 } })
    await redeem(wallet, parseShares(amount / 2), other)

    expect(await portfolio.virtualTokenBalance()).to.equal(
      parseUSDC(amount).sub(1),
    )
    expect(await token.balanceOf(portfolio.address)).to.equal(
      parseUSDC(amount).sub(1),
    )
    expect(await token.balanceOf(other.address)).to.equal(1)
  })

  it('allows partial redeem with two lenders', async () => {
    const { redeem, token, deposit, other, parseShares } = await loadFixture()
    const otherAmount = 20
    await token.mint(other.address, parseUSDC(otherAmount))
    await deposit(other, parseUSDC(otherAmount))
    await redeem(other, parseShares(otherAmount / 2))

    expect(await token.balanceOf(other.address)).to.equal(
      parseShares(otherAmount / 2),
    )
  })

  it('redeems more after interest accrues', async () => {
    const {
      portfolio,
      wallet,
      parseShares,
      borrowAndRepayWithInterest,
      redeem,
    } = await loadFixture()
    const interest = await borrowAndRepayWithInterest(
      parseUSDC(amount),
      YEAR / 2,
    )
    await redeem(wallet, parseShares(amount / 2))
    const expectedPortfolioBalance = parseUSDC(amount / 2).add(interest.div(2))
    expect(await portfolio.virtualTokenBalance()).to.equal(
      expectedPortfolioBalance,
    )
  })

  it('burns owner shares when redeeming by non-owner', async () => {
    const { portfolio, wallet, other, parseShares, redeem } =
      await loadFixture()
    await portfolio.approve(other.address, parseShares(amount))
    await redeem(other, parseShares(amount), wallet, wallet)
    expect(await portfolio.balanceOf(wallet.address)).to.equal(0)
  })

  it('can redeem to another address', async () => {
    const { redeem, wallet, other, token, parseShares } = await loadFixture()
    await redeem(wallet, parseShares(amount), other, wallet)
    expect(await token.balanceOf(other.address)).to.equal(parseUSDC(amount))
  })

  it('cannot redeem to portfolio', async () => {
    const { portfolio, wallet, parseShares, redeem } = await loadFixture()
    await expect(
      redeem(wallet, parseShares(amount), portfolio, wallet),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: Portfolio cannot be the receiver',
    )
  })

  it('cannot redeem from portfolio', async () => {
    const { portfolio, wallet, parseShares, redeem } = await loadFixture()
    await expect(
      redeem(wallet, parseShares(amount), wallet, portfolio),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: Portfolio cannot be the owner',
    )
  })

  it('can redeem by approved non-owner to designated recipient', async () => {
    const { portfolio, token, wallet, other, another, parseShares, redeem } =
      await loadFixture()
    await portfolio.approve(other.address, parseShares(amount))
    await redeem(other, parseShares(amount), another, wallet)
    expect(await token.balanceOf(another.address)).to.equal(parseUSDC(amount))
  })

  it('decreases allowance when non-owner redeems', async () => {
    const { portfolio, wallet, other, parseShares, redeem } =
      await loadFixture()
    await portfolio.approve(other.address, parseShares(amount))
    await redeem(other, parseShares(amount / 2), wallet, wallet)
    expect(await portfolio.allowance(wallet.address, other.address)).to.equal(
      parseShares(amount / 2),
    )
  })

  it('reverts if redeeming exceeds portfolio liquidity', async () => {
    const { portfolio, wallet, parseShares, redeem } = await loadFixture()
    await portfolio.borrow(parseUSDC(amount))
    await expect(redeem(wallet, parseShares(amount))).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation exceeds portfolio liquidity',
    )
  })

  it('reverts if portfolio is paused', async () => {
    const { portfolio, wallet, parseShares, redeem } = await loadFixture()
    await portfolio.pause()
    await expect(redeem(wallet, parseShares(amount))).to.be.revertedWith(
      'Pausable: paused',
    )
  })

  it('cannot redeem when not allowed by withdrawController', async () => {
    const { wallet, redeem, mockWithdrawController } = await loadFixture()
    await mockWithdrawController({ onRedeem: { assets: 0, fee: 0 } })
    await expect(redeem(wallet, 1)).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation not allowed',
    )
  })

  it('reverts from non-owner if not approved', async () => {
    const { wallet, other, parseShares, redeem } = await loadFixture()
    await expect(
      redeem(other, parseShares(amount), wallet, wallet),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: Caller not approved to burn given amount of shares',
    )
  })

  it('reverts from non-owner if approved amount is exceeded', async () => {
    const { portfolio, wallet, other, parseShares, redeem } =
      await loadFixture()
    await portfolio.approve(other.address, parseShares(amount / 2))
    await expect(
      redeem(other, parseShares(amount), other, wallet),
    ).to.be.revertedWith(
      'AutomatedLineOfCredit: Caller not approved to burn given amount of shares',
    )
  })

  it('updates last protocol fee rate', async () => {
    const {
      portfolio,
      wallet,
      parseShares,
      redeem,
      protocolConfig,
      protocolFeeRate,
    } = await loadFixture()
    const newFeeRate = 100
    await protocolConfig.setProtocolFeeRate(newFeeRate)
    expect(await portfolio.lastProtocolFeeRate()).to.equal(protocolFeeRate)

    await redeem(wallet, parseShares(amount), wallet, wallet)
    expect(await portfolio.lastProtocolFeeRate()).to.equal(newFeeRate)
  })

  it('emits a \'Withdraw\' event', async () => {
    const {
      portfolio,
      wallet,
      parseShares,
      borrowAndRepayWithInterest,
      other,
      redeem,
    } = await loadFixture()
    const interest = await borrowAndRepayWithInterest(
      parseUSDC(amount),
      YEAR / 2,
    )
    await expect(redeem(wallet, parseShares(amount), other, wallet))
      .to.emit(portfolio, 'Withdraw')
      .withArgs(
        wallet.address,
        other.address,
        wallet.address,
        parseUSDC(amount).add(interest),
        parseShares(amount),
      )
  })

  it('updates accruedInterest', async () => {
    const {
      portfolio,
      wallet,
      borrowAndSetNextTimestamp,
      parseShares,
      redeem,
    } = await loadFixture()
    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount / 2),
      YEAR / 2,
    )
    await redeem(wallet, parseShares(amount / 4))
    expect(await portfolio.accruedInterest()).to.equal(interest)
  })

  it('can redeem past end date', async () => {
    const {
      wallet,
      timeTravel,
      parseShares,
      redeem,
      portfolio,
      portfolioDuration,
    } = await loadFixture()
    await timeTravel(portfolioDuration + DAY)
    await expect(redeem(wallet, parseShares(amount))).not.to.be.reverted
    expect(await portfolio.balanceOf(wallet.address)).to.equal(0)
  })

  it('transfers fee', async () => {
    const {
      portfolio,
      token,
      protocolConfig,
      protocolTreasury,
      executeAndSetNextTimestamp,
      redeem,
      wallet,
      parseShares,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await redeem(wallet, parseShares(1))
    expect(await token.balanceOf(protocolTreasury)).to.equal(
      parseUSDC(amount * 0.05),
    )
  })

  it('redeems less assets after applying fees', async () => {
    const {
      portfolio,
      executeAndSetNextTimestamp,
      protocolConfig,
      redeem,
      wallet,
      parseShares,
      token,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    const walletBalanceBefore = await token.balanceOf(wallet.address)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await redeem(wallet, parseShares(amount))
    expect(await token.balanceOf(wallet.address)).to.equal(
      walletBalanceBefore.add(parseUSDC(amount * 0.95)),
    )
  })

  it('calls onRedeem with correct arguments', async () => {
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
      .redeem(parseShares(amount), another.address, wallet.address)
    expect('onRedeem').to.be.calledOnContractWith(withdrawController, [
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
      redeem,
      wallet,
      parseShares,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    await executeAndSetNextTimestamp(portfolio.updateAndPayFee(), YEAR / 2)
    await expect(redeem(wallet, parseShares(1)))
      .to.emit(portfolio, 'FeePaid')
      .withArgs(protocolTreasury, parseUSDC(amount * 0.05))
  })
})
