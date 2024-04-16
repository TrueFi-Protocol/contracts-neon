import { Wallet } from 'ethers'
import { deployBehindProxy } from 'utils/deployBehindProxy'
import { ProtocolConfig__factory } from 'contracts'
import { protocolFeeRate } from 'config'

export async function protocolConfigFixture([
  wallet,
  otherWallet,
  protocol,
]: Wallet[]) {
  const protocolTreasury = Wallet.createRandom()
  const config = await deployBehindProxy(
    new ProtocolConfig__factory(wallet),
    protocolFeeRate,
    protocol.address,
    protocolTreasury.address,
    wallet.address,
  )
  const DEFAULT_ADMIN_ROLE = await config.DEFAULT_ADMIN_ROLE()
  const PAUSER_ROLE = await config.PAUSER_ROLE()
  return {
    config,
    wallet,
    protocol,
    otherWallet,
    protocolFeeRate,
    protocolTreasury,
    DEFAULT_ADMIN_ROLE,
    PAUSER_ROLE,
  }
}
