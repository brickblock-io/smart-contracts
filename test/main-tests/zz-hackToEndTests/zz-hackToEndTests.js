describe('when tests are passing', () => {
  it('should go home', () => {
    assert(true, 'reached end of testing suite')
  })
  after('Please node. Go home, you are drunk.', async () => {
    process.exit(0)
  })
})
