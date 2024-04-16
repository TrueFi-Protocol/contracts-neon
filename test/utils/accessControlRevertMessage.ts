import { Wallet } from 'ethers'

export function accessControlMissingRoleRevertMessage(
  account: Wallet | string,
  missingRole: string,
) {
  const address = typeof account === 'string' ? account : account.address
  return `AccessControl: account ${address.toLowerCase()} is missing role ${missingRole}`
}
