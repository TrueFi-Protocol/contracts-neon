import { parseUSDC } from 'utils'

export const interestRatePolyline = {
  // 20% utilization, 2% interest rate
  minInterestRate: 200,
  minInterestRateUtilizationThreshold: 2000,
  // 85% utilization, 4% interest rate
  optimumInterestRate: 400,
  optimumUtilization: 8500,
  // 95% utilization, 8% interest rate
  maxInterestRate: 800,
  maxInterestRateUtilizationThreshold: 9500,
}

export const invertedInterestRatePolyline = {
  ...interestRatePolyline,
  maxInterestRate: interestRatePolyline.minInterestRate,
  minInterestRate: interestRatePolyline.maxInterestRate,
}

export const maxSize = parseUSDC(1e7) // 10M

export const portfolioName = 'Automated Line of Credit'
export const portfolioSymbol = 'ALOC'

export const alocProtocolFeeRate = 0
