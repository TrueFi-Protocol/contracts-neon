import { Zero, One } from '@ethersproject/constants'
import { expect, use } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditFixture } from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'
import { DAY, YEAR } from 'utils/constants'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('AutomatedLineOfCredit.mint', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('distributes shares to receiver', async () => {
    const { portfolio, mint, wallet, parseShares } = await loadFixture()
    await mint(wallet, parseShares(amount))
    expect(await portfolio.balanceOf(wallet.address)).to.equal(
      parseShares(amount),
    )
  })

  it('transfers assets from sender', async () => {
    const { mint, wallet, token, parseShares } = await loadFixture()
    const initialAssets = await token.balanceOf(wallet.address)
    await mint(wallet, parseShares(amount))
    expect(initialAssets.sub(parseUSDC(amount))).to.equal(
      await token.balanceOf(wallet.address),
    )
  })

  it('transfers assets to portfolio', async () => {
    const { portfolio, mint, token, wallet, parseShares } = await loadFixture()
    await mint(wallet, parseShares(amount))
    expect(await token.balanceOf(portfolio.address)).to.equal(
      parseUSDC(amount),
    )
  })

  it('reverts when trying to mint 0 shares', async () => {
    const { mint, wallet } = await loadFixture()
    await expect(mint(wallet, Zero)).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation not allowed',
    )
  })

  it('rounds up assets required to mint requested shares', async () => {
    const { mint, token, wallet } = await loadFixture()
    const initialAssets = await token.balanceOf(wallet.address)
    await mint(wallet, One)
    expect(await token.balanceOf(wallet.address)).to.equal(
      initialAssets.sub(1),
    )
  })

  it('increases virtualTokenBalance', async () => {
    const { portfolio, mint, wallet, parseShares } = await loadFixture()
    await mint(wallet, parseShares(amount))
    expect(await portfolio.virtualTokenBalance()).to.equal(parseUSDC(amount))
  })

  it('requires more assets as portfolio value increases', async () => {
    const {
      borrowAndRepayWithInterest,
      portfolio,
      mint,
      token,
      wallet,
      parseShares,
    } = await loadFixture()
    await mint(wallet, parseShares(amount))
    const interest = await borrowAndRepayWithInterest(
      parseUSDC(amount),
      YEAR / 12,
    )
    await mint(wallet, parseShares(amount))
    expect(await token.balanceOf(portfolio.address)).to.equal(
      parseUSDC(amount).add(interest).mul(2),
    )
  })

  it('updates accruedInterest', async () => {
    const { portfolio, wallet, token, borrowAndSetNextTimestamp, parseShares } =
      await loadFixture()
    await token.approve(portfolio.address, parseUSDC(amount))
    await portfolio.mint(parseShares(amount).div(2), wallet.address)

    const interest = await borrowAndSetNextTimestamp(
      parseUSDC(amount).div(2),
      YEAR / 2,
    )
    await portfolio.mint(parseShares(amount).div(4), wallet.address)
    expect(await portfolio.accruedInterest()).to.equal(interest)
  })

  it('does not revert with assets approved from previewMint after interest accrues', async () => {
    const {
      portfolio,
      wallet,
      other,
      token,
      borrowAndRepayWithInterest,
      parseShares,
      deposit,
    } = await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await borrowAndRepayWithInterest(parseUSDC(amount), YEAR / 2)

    const assets = await portfolio.previewMint(parseShares(amount))
    await token.mint(other.address, assets)
    await token.connect(other).approve(portfolio.address, assets)
    await expect(
      portfolio.connect(other).mint(parseShares(amount), other.address),
    ).to.not.be.reverted
  })

  it('reverts with insufficient asset allowance', async () => {
    const { portfolio, wallet, parseShares } = await loadFixture()
    await expect(
      portfolio.mint(parseShares(amount), wallet.address),
    ).to.be.revertedWith('ERC20: insufficient allowance')
  })

  it('reverts with insufficient asset balance', async () => {
    const { mint, other, token, parseShares } = await loadFixture()
    await token.mint(other.address, parseUSDC(amount).div(2))
    await expect(mint(other, parseShares(amount))).to.be.revertedWith(
      'ERC20: transfer amount exceeds balance',
    )
  })

  it('reverts when deposits not allowed by controller', async () => {
    const { mint, wallet, mockDepositController, parseShares } =
      await loadFixture()
    await mockDepositController({ onMint: { assets: 0 } })
    await expect(mint(wallet, parseShares(amount))).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation not allowed',
    )
  })

  it('calls onMint with correct arguments', async () => {
    const { mint, wallet, other, parseShares, depositController } =
      await loadFixture()
    await mint(wallet, parseShares(amount), other)
    expect('onMint').to.be.calledOnContractWith(depositController, [
      wallet.address,
      parseUSDC(amount),
      other.address,
    ])
  })

  it('reverts past endDate', async () => {
    const { portfolio, mint, wallet, timeTravel, parseShares } =
      await loadFixture()
    const endDate = await portfolio.endDate()
    await timeTravel(endDate.add(DAY).toNumber())
    await expect(mint(wallet, parseShares(amount))).to.be.revertedWith(
      'AutomatedLineOfCredit: Portfolio end date has elapsed',
    )
  })

  it('reverts when portfolio is full', async () => {
    const { mint, wallet, deposit, maxSize, parseShares } = await loadFixture()
    await deposit(wallet, maxSize)
    await expect(mint(wallet, parseShares(amount))).to.be.revertedWith(
      'AutomatedLineOfCredit: Operation would cause portfolio to exceed max size',
    )
  })

  it('updates last protocol fee rate', async () => {
    const { portfolio, mint, parseShares, wallet, protocolConfig } =
      await loadFixture()
    expect(await portfolio.lastProtocolFeeRate()).to.equal(0)
    await protocolConfig.setProtocolFeeRate(1000)
    await mint(wallet, parseShares(amount))
    expect(await portfolio.lastProtocolFeeRate()).to.equal(1000)
  })

  it('emits Deposit event', async () => {
    const { portfolio, mint, wallet, parseShares } = await loadFixture()
    await expect(mint(wallet, parseShares(amount)))
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
      mint,
      token,
      wallet,
      deposit,
      parseShares,
      protocolConfig,
      protocolTreasury,
      getTxTimestamp,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    const txTimestamp = await getTxTimestamp(
      deposit(wallet, parseUSDC(amount)),
    )
    await mint(wallet, parseShares(amount), wallet, txTimestamp + YEAR / 2)
    expect(await token.balanceOf(protocolTreasury)).to.equal(
      parseUSDC(amount * 0.05),
    )
  })

  it('mint correct amount with fee', async () => {
    const {
      portfolio,
      parseShares,
      token,
      other,
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
    await borrowAndSetNextTimestamp(parseUSDC(amount), YEAR / 2)
    await portfolio.connect(other).mint(parseShares(amount), other.address)
    expect(await portfolio.balanceOf(other.address)).to.equal(
      parseShares(amount),
    )
  })

  it('transfers correct amount with fee', async () => {
    const {
      portfolio,
      parseShares,
      token,
      other,
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
    await portfolio.connect(other).mint(parseShares(amount), other.address)
    const otherTokenBalance = await token.balanceOf(other.address)
    const fee = parseUSDC(amount).add(interest).div(20)
    expect(parseUSDC(amount * 2).sub(otherTokenBalance)).to.equal(
      parseUSDC(amount).add(interest).sub(fee),
    )
  })

  it('liquid assets are less than fee', async () => {
    const {
      portfolio,
      token,
      mint,
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
    await mint(wallet, 1, wallet, txTimestamp + YEAR / 2)
    expect(await portfolio.virtualTokenBalance()).to.equal(0)
    expect(await token.balanceOf(protocolTreasury)).to.equal(1)
    expect(await portfolio.unpaidFee()).equal(
      parseUSDC(amount).add(interest).div(20).sub(1),
    )
  })

  it('emits FeePaid event', async () => {
    const {
      portfolio,
      mint,
      wallet,
      parseShares,
      protocolConfig,
      protocolTreasury,
      getTxTimestamp,
    } = await loadFixture()
    await protocolConfig.setProtocolFeeRate(1000)
    const txTimestamp = await getTxTimestamp(mint(wallet, parseShares(amount)))
    await expect(mint(wallet, 1, wallet, txTimestamp + YEAR / 2))
      .to.emit(portfolio, 'FeePaid')
      .withArgs(protocolTreasury, parseUSDC(amount * 0.05))
  })

  it('transfers amount specified in controller', async () => {
    const { wallet, parseShares, portfolio, token, mockDepositController } =
      await loadFixture()
    await token.approve(portfolio.address, parseUSDC(50))
    await mockDepositController({ onMint: { assets: parseUSDC(50) } })
    const balanceBefore = await token.balanceOf(wallet.address)
    await portfolio.mint(parseShares(amount), wallet.address)

    expect(await token.balanceOf(wallet.address)).to.equal(
      balanceBefore.sub(parseUSDC(50)),
    )
    expect(await portfolio.balanceOf(wallet.address)).to.equal(
      parseShares(amount),
    )
  })
})
