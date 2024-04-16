import { expect } from 'chai'
import { automatedLineOfCreditFixture } from 'fixtures'
import { setupFixtureLoader } from 'test/setup'
import { erc165Selectors } from 'utils/erc165Selectors'

describe('AutomatedLineOfCredit.supportsInterface', () => {
  const loadFixture = setupFixtureLoader()

  for (const { name, selector } of erc165Selectors) {
    it(`returns true for ${name} interface`, async () => {
      const { portfolio } = await loadFixture(automatedLineOfCreditFixture)
      expect(await portfolio.supportsInterface(selector)).to.be.true
    })
  }

  it('returns false for null selector', async () => {
    const nullSelector = '0xffffffff'
    const { portfolio } = await loadFixture(automatedLineOfCreditFixture)
    expect(await portfolio.supportsInterface(nullSelector)).to.be.false
  })
})
