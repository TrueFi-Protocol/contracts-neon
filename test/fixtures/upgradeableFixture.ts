import { TestUpgradeable__factory } from 'contracts'
import { Wallet } from 'ethers'
import { deployBehindProxy } from 'utils/deployBehindProxy'

export async function upgradeableFixture([wallet, other]: Wallet[]) {
  const upgradeable = await deployBehindProxy(
    new TestUpgradeable__factory(wallet),
    wallet.address,
  )
  const DEFAULT_ADMIN_ROLE = await upgradeable.DEFAULT_ADMIN_ROLE()
  const PAUSER_ROLE = await upgradeable.PAUSER_ROLE()

  return { upgradeable, other, DEFAULT_ADMIN_ROLE, PAUSER_ROLE }
}
