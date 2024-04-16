import { ContractTransaction, providers } from 'ethers'
import { Web3Provider } from '@ethersproject/providers'
import { getTxTimestamp } from './getTxTimestamp'
import { MockProvider } from 'ethereum-waffle'

export const timeTravel = async (
  provider: providers.JsonRpcProvider,
  time: number,
) => {
  await provider.send('evm_increaseTime', [time])
  await provider.send('evm_mine', [])
}

export const timeTravelTo = async (
  provider: providers.JsonRpcProvider,
  timestamp: number,
) => {
  await provider.send('evm_mine', [timestamp])
}

export const setNextBlockTimestamp = async (
  provider: providers.JsonRpcProvider,
  timestamp: number,
) => {
  await provider.send('evm_setNextBlockTimestamp', [timestamp])
}

export const skipBlocksWithProvider = async (
  provider: providers.JsonRpcProvider,
  numberOfBlocks: number,
) => {
  for (let i = 0; i < numberOfBlocks; i++) {
    await provider.send('evm_mine', [])
  }
}

export const getBlockNumber = async (provider: Web3Provider) =>
  Number.parseInt(await provider.send('eth_blockNumber', []))

export const skipToBlockWithProvider = async (
  provider: Web3Provider,
  targetBlock: number,
) => {
  const block = await getBlockNumber(provider)
  if (block > targetBlock) {
    throw new Error('Already past target block')
  }
  while ((await getBlockNumber(provider)) < targetBlock) {
    await provider.send('evm_mine', [])
  }
}

export const executeAndSetNextTimestamp = async (
  provider: MockProvider,
  contractFunction: Promise<ContractTransaction>,
  timestamp: number,
) => {
  const tx = await contractFunction
  const txTimestamp = await getTxTimestamp(tx, provider)
  await setNextBlockTimestamp(provider, txTimestamp + timestamp)
}
