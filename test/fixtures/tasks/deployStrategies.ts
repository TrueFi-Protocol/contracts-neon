import {
  DepositController__factory,
  WithdrawController__factory,
  AllowAllLenderVerifier__factory,
  BlockedTransferController__factory,
  LinearKinkInterestRateController__factory,
} from 'contracts'
import { interestRatePolyline as _interestRatePolyline } from 'config'
import { Wallet } from 'ethers'

export async function deployBasicControllers(protocolOwner: Wallet) {
  const allowAllLenderVerifier = await new AllowAllLenderVerifier__factory(
    protocolOwner,
  ).deploy()

  const depositControllerImplementation = await new DepositController__factory(
    protocolOwner,
  ).deploy()
  const withdrawControllerImplementation =
    await new WithdrawController__factory(protocolOwner).deploy()
  const transferControllerImplementation =
    await new BlockedTransferController__factory(protocolOwner).deploy()
  const interestRateControllerImplementation =
    await new LinearKinkInterestRateController__factory(protocolOwner).deploy()

  const controllersDeployData = {
    depositControllerImplementation: depositControllerImplementation.address,
    depositControllerInitData:
      depositControllerImplementation.interface.encodeFunctionData(
        'initialize',
        [allowAllLenderVerifier.address],
      ),
    withdrawControllerImplementation: withdrawControllerImplementation.address,
    withdrawControllerInitData:
      withdrawControllerImplementation.interface.encodeFunctionData(
        'initialize',
      ),
    transferControllerImplementation: transferControllerImplementation.address,
    transferControllerInitData:
      transferControllerImplementation.interface.encodeFunctionData(
        'initialize',
      ),
    interestRateControllerImplementation: interestRateControllerImplementation.address,
    interestRateControllerInitData:
      interestRateControllerImplementation.interface.encodeFunctionData(
        'initialize',
        [_interestRatePolyline],
      ),
    interestRateControllerClone: true,
  }

  return {
    depositControllerImplementation,
    withdrawControllerImplementation,
    transferControllerImplementation,
    controllersDeployData,
    allowAllLenderVerifier,
    interestRateControllerImplementation,
  }
}
