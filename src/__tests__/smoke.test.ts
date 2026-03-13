import { describe, it, expect } from 'vitest'

describe('Smoke Test', () => {
  it('should pass basic assertion', () => {
    expect(true).toBe(true)
  })

  it('should verify environment', () => {
    expect(process.version).toBeDefined()
    expect(process.platform).toBeDefined()
  })

  it('should have Node.js version 18+', () => {
    const majorVersion = parseInt(process.version.slice(1).split('.')[0], 10)
    expect(majorVersion).toBeGreaterThanOrEqual(18)
  })
})
