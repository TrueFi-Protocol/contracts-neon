import { Contract } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'
import { waffle } from 'hardhat'

const IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'

export async function extractImplementationAddress(proxyContract: Contract) {
  const implementationAddress = await waffle.provider.getStorageAt(
    proxyContract.address,
    IMPLEMENTATION_SLOT,
  )
  return defaultAbiCoder.decode(['address'], implementationAddress)[0]
}

export async function extractMinimalProxyImplementationAddress(
  proxyAddress: string,
) {
  const bytecode = await waffle.provider.getCode(proxyAddress)
  return '0x' + bytecode.slice(22, 62)
}
