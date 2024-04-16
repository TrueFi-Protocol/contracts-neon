import { AddressZero } from '@ethersproject/constants'
import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { automatedLineOfCreditDepositFixture } from 'fixtures'

describe('AutomatedLineOfCredit.transfer', () => {
  const amount = 1_000_000
  const fixtureLoader = setupFixtureLoader()
  const fixtureWithDeposit = automatedLineOfCreditDepositFixture(amount)
  const loadFixture = () => fixtureLoader(fixtureWithDeposit)

  it('reverts on transfer', async () => {
    const { portfolio, other, parseShares } = await loadFixture()
    await expect(
      portfolio.transfer(other.address, parseShares(amount)),
    ).to.be.revertedWith('AutomatedLineOfCredit: This transfer not permitted')
  })

  it('reverts on transferFrom', async () => {
    const { portfolio, other, wallet, parseShares } = await loadFixture()
    await portfolio.approve(wallet.address, parseShares(amount))
    await expect(
      portfolio.transferFrom(wallet.address, other.address, parseShares(amount)),
    ).to.be.revertedWith('AutomatedLineOfCredit: This transfer not permitted')
  })

  it('transfer reverts when paused', async () => {
    const { portfolio, other, setTransferController, parseShares } =
      await loadFixture()
    await setTransferController(AddressZero)
    await portfolio.pause()
    await expect(
      portfolio.transfer(other.address, parseShares(amount)),
    ).to.be.revertedWith('Pausable: paused')
  })

  it('transferFrom reverts when paused', async () => {
    const { portfolio, wallet, other, setTransferController, parseShares } =
      await loadFixture()
    await setTransferController(AddressZero)
    await portfolio.approve(wallet.address, parseShares(amount))
    await portfolio.pause()
    await expect(
      portfolio.transferFrom(wallet.address, other.address, parseShares(amount)),
    ).to.be.revertedWith('Pausable: paused')
  })
})
