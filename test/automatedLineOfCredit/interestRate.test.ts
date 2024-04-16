import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import {
  automatedLineOfCreditFixture,
  automatedLineOfCreditWithInvertedPolylineFixture,
} from 'fixtures'
import { parseUSDC } from 'utils/parseUSDC'

describe('AutomatedLineOfCredit.interestRate', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(automatedLineOfCreditFixture)
  const amount = 1_000_000

  it('is minimum at 0% utilization', async () => {
    const { portfolio, interestRatePolyline } = await loadFixture()
    expect(await portfolio.interestRate()).to.equal(
      interestRatePolyline.minInterestRate,
    )
  })

  it('is minimum at minimum utilization threshold', async () => {
    const {
      portfolio,
      deposit,
      wallet,
      calculateInterestRate,
      interestRatePolyline,
    } = await loadFixture()
    const { minInterestRateUtilizationThreshold } = interestRatePolyline
    await deposit(wallet, parseUSDC(amount))
    await portfolio.borrow(
      parseUSDC((amount * minInterestRateUtilizationThreshold) / 10000),
    )
    const utilization = await portfolio.utilization()
    expect(utilization).to.equal(minInterestRateUtilizationThreshold)
    expect(await portfolio.interestRate()).to.equal(
      calculateInterestRate(utilization),
    )
  })

  it('is optimum at optimum utilization threshold', async () => {
    const {
      portfolio,
      deposit,
      wallet,
      calculateInterestRate,
      interestRatePolyline,
    } = await loadFixture()
    const { optimumUtilization } = interestRatePolyline
    await deposit(wallet, parseUSDC(amount))
    await portfolio.borrow(parseUSDC((amount * optimumUtilization) / 10000))
    const utilization = await portfolio.utilization()
    expect(utilization).to.equal(optimumUtilization)
    expect(await portfolio.interestRate()).to.equal(
      calculateInterestRate(utilization),
    )
  })

  it('is maximum at maximum utilization threshold', async () => {
    const {
      portfolio,
      deposit,
      wallet,
      calculateInterestRate,
      interestRatePolyline,
    } = await loadFixture()
    const { maxInterestRateUtilizationThreshold } = interestRatePolyline
    await deposit(wallet, parseUSDC(amount))
    await portfolio.borrow(
      parseUSDC((amount * maxInterestRateUtilizationThreshold) / 10000),
    )
    const utilization = await portfolio.utilization()
    expect(utilization).to.equal(maxInterestRateUtilizationThreshold)
    expect(await portfolio.interestRate()).to.equal(
      calculateInterestRate(utilization),
    )
  })

  it('is maximum at 100% utilization', async () => {
    const { portfolio, deposit, wallet, calculateInterestRate } =
      await loadFixture()
    await deposit(wallet, parseUSDC(amount))
    await portfolio.borrow(parseUSDC(amount))
    const utilization = await portfolio.utilization()
    expect(utilization).to.equal(10000)
    expect(await portfolio.interestRate()).to.equal(
      calculateInterestRate(utilization),
    )
  })

  describe('interpolates between minimum and optimum (standard polyline)', () => {
    [0.25, 0.5, 0.75].map((pointBetweenThresholds) =>
      it(`at ${pointBetweenThresholds} distance`, async () => {
        const {
          portfolio,
          deposit,
          wallet,
          calculateInterestRate,
          interestRatePolyline,
        } = await loadFixture()
        const { minInterestRateUtilizationThreshold, optimumUtilization } =
          interestRatePolyline
        await deposit(wallet, parseUSDC(amount))

        const minOptimumInterestRateUtilizationThresholdPoint =
          minInterestRateUtilizationThreshold +
          pointBetweenThresholds *
            (optimumUtilization - minInterestRateUtilizationThreshold)
        await portfolio.borrow(
          parseUSDC(
            (amount * minOptimumInterestRateUtilizationThresholdPoint) / 10000,
          ),
        )
        const utilization = await portfolio.utilization()

        expect(utilization).to.equal(
          minOptimumInterestRateUtilizationThresholdPoint,
        )
        expect(await portfolio.interestRate()).to.equal(
          calculateInterestRate(utilization),
        )
      }),
    )
  })

  describe('interpolates between optimum and maximum (standard polyline)', () => {
    [0.25, 0.5, 0.75].map((pointBetweenThresholds) =>
      it(`at ${pointBetweenThresholds} distance`, async () => {
        const {
          portfolio,
          deposit,
          wallet,
          calculateInterestRate,
          interestRatePolyline,
        } = await loadFixture()
        const { optimumUtilization, maxInterestRateUtilizationThreshold } =
          interestRatePolyline
        await deposit(wallet, parseUSDC(amount))

        const optimumMaxInterestRateUtilizationThresholdPoint =
          optimumUtilization +
          pointBetweenThresholds *
            (maxInterestRateUtilizationThreshold - optimumUtilization)
        await portfolio.borrow(
          parseUSDC(
            (amount * optimumMaxInterestRateUtilizationThresholdPoint) / 10000,
          ),
        )
        const utilization = await portfolio.utilization()

        expect(utilization).to.equal(
          optimumMaxInterestRateUtilizationThresholdPoint,
        )
        expect(await portfolio.interestRate()).to.equal(
          calculateInterestRate(utilization),
        )
      }),
    )
  })

  describe('interpolates between minimum and optimum (inverted polyline)', () => {
    [0.25, 0.5, 0.75].map((pointBetweenThresholds) =>
      it(`at ${pointBetweenThresholds} distance`, async () => {
        const {
          portfolio,
          deposit,
          wallet,
          calculateInterestRate,
          interestRatePolyline,
        } = await fixtureLoader(
          automatedLineOfCreditWithInvertedPolylineFixture,
        )
        const { minInterestRateUtilizationThreshold, optimumUtilization } =
          interestRatePolyline
        await deposit(wallet, parseUSDC(amount))

        const minOptimumUtilizationThresholdPoint =
          minInterestRateUtilizationThreshold +
          pointBetweenThresholds *
            (optimumUtilization - minInterestRateUtilizationThreshold)
        await portfolio.borrow(
          parseUSDC((amount * minOptimumUtilizationThresholdPoint) / 10000),
        )
        const utilization = await portfolio.utilization()

        expect(utilization).to.equal(minOptimumUtilizationThresholdPoint)
        expect(await portfolio.interestRate()).to.equal(
          calculateInterestRate(utilization),
        )
      }),
    )
  })

  describe('interpolates between optimum and maximum (inverted polyline)', () => {
    [0.25, 0.5, 0.75].map((pointBetweenThresholds) =>
      it(`at ${pointBetweenThresholds} distance`, async () => {
        const {
          portfolio,
          deposit,
          wallet,
          calculateInterestRate,
          interestRatePolyline,
        } = await fixtureLoader(
          automatedLineOfCreditWithInvertedPolylineFixture,
        )
        const { optimumUtilization, maxInterestRateUtilizationThreshold } =
          interestRatePolyline
        await deposit(wallet, parseUSDC(amount))

        const optimumMaxInterestRateUtilizationThresholdPoint =
          optimumUtilization +
          pointBetweenThresholds *
            (maxInterestRateUtilizationThreshold - optimumUtilization)
        await portfolio.borrow(
          parseUSDC(
            (amount * optimumMaxInterestRateUtilizationThresholdPoint) / 10000,
          ),
        )
        const utilization = await portfolio.utilization()

        expect(utilization).to.equal(
          optimumMaxInterestRateUtilizationThresholdPoint,
        )
        expect(await portfolio.interestRate()).to.equal(
          calculateInterestRate(utilization),
        )
      }),
    )
  })
})
