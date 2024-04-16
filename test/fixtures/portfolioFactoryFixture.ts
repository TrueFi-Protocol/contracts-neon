import {
  AutomatedLineOfCredit__factory,
  MockUsdc__factory,
  ProtocolConfig__factory,
} from 'contracts'
import { Wallet } from 'ethers'
import { deployBehindProxy } from 'utils/deployBehindProxy'
import { AutomatedLineOfCreditFactory__factory } from 'build/types'
import { protocolFeeRate } from 'config'

export async function portfolioFactoryFixture([
  protocolOwner,
  manager,
]: Wallet[]) {
  const portfolioImplementation = await new AutomatedLineOfCredit__factory(
    protocolOwner,
  ).deploy()
  const protocolConfig = await deployBehindProxy(
    new ProtocolConfig__factory(protocolOwner),
    protocolFeeRate,
    protocolOwner.address,
    protocolOwner.address,
    protocolOwner.address,
  )
  const factory = await deployBehindProxy(
    new AutomatedLineOfCreditFactory__factory(protocolOwner),
    portfolioImplementation.address,
    protocolConfig.address,
  )
  const token = await new MockUsdc__factory(protocolOwner).deploy()

  const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE()
  const MANAGER_ROLE = await factory.MANAGER_ROLE()
  const PAUSER_ROLE = await factory.PAUSER_ROLE()

  await factory.grantRole(MANAGER_ROLE, manager.address)

  return {
    factory,
    protocolOwner,
    manager,
    token,
    portfolioImplementation,
    protocolConfig,
    DEFAULT_ADMIN_ROLE,
    MANAGER_ROLE,
    PAUSER_ROLE,
  }
}
