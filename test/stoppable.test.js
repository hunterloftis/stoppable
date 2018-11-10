/* eslint-env mocha */

const http = require('http')
const https = require('https')
const a = require('awaiting')
const request = require('requisition')
const assert = require('chai').assert
const fs = require('fs')
const stoppable = require('..')
const child = require('child_process')
const path = require('path')

const PORT = 8000

const schemes = {
  http: {
    agent: (opts = {}) => new http.Agent(opts),
    server: handler => http.createServer(handler || ((req, res) => res.end('hello')))
  },
  https: {
    agent: (opts = {}) => https.Agent(Object.assign({rejectUnauthorized: false}, opts)),
    server: handler => https.createServer({
      key: fs.readFileSync('test/fixture.key'),
      cert: fs.readFileSync('test/fixture.cert')
    }, handler || ((req, res) => res.end('hello')))
  }
}

Object.keys(schemes).forEach(schemeName => {
  const scheme = schemes[schemeName]

  describe(`${schemeName}.Server`, function () {
    describe('.close()', () => {
      let server

      beforeEach(function () {
        server = scheme.server()
      })

      describe('without keep-alive connections', () => {
        let closed = 0
        it('stops accepting new connections', async () => {
          server.on('close', () => closed++)
          server.listen(PORT)
          await a.event(server, 'listening')
          const res1 =
              await request(`${schemeName}://localhost:${PORT}`).agent(scheme.agent())
          const text1 = await res1.text()
          assert.equal(text1, 'hello')
          server.close()
          const err = await a.failure(
            request(`${schemeName}://localhost:${PORT}`).agent(scheme.agent()))
          assert.match(err.message, /ECONNREFUSED/)
        })

        it('closes', () => {
          assert.equal(closed, 1)
        })
      })

      describe('with keep-alive connections', () => {
        let closed = 0

        it('stops accepting new connections', async () => {
          server.on('close', () => closed++)
          server.listen(PORT)
          await a.event(server, 'listening')
          const res1 = await request(`${schemeName}://localhost:${PORT}`)
            .agent(scheme.agent({keepAlive: true}))
          const text1 = await res1.text()
          assert.equal(text1, 'hello')
          server.close()
          const err =
              await a.failure(request(`${schemeName}://localhost:${PORT}`)
              .agent(scheme.agent({keepAlive: true})))
          assert.match(err.message, /ECONNREFUSED/)
        })

        it("doesn't close", () => {
          assert.equal(closed, 0)
        })
      })
    })

    describe('.stop()', function () {
      describe('without keep-alive connections', function () {
        let closed = 0
        let gracefully = false
        let server

        beforeEach(function () {
          server = stoppable(scheme.server())
        })

        it('stops accepting new connections', async () => {
          server.on('close', () => closed++)
          server.listen(PORT)
          await a.event(server, 'listening')
          const res1 =
              await request(`${schemeName}://localhost:${PORT}`).agent(scheme.agent())
          const text1 = await res1.text()
          assert.equal(text1, 'hello')
          server.stop((e, g) => {
            gracefully = g
          })
          const err = await a.failure(
            request(`${schemeName}://localhost:${PORT}`).agent(scheme.agent()))
          assert.match(err.message, /ECONNREFUSED/)
        })

        it('closes', () => {
          assert.equal(closed, 1)
        })

        it('gracefully', () => {
          assert.isOk(gracefully)
        })

        it('should error if already closed', function (done) {
          server.stop(e => {
            assert.propertyVal(e, 'code', 'ERR_SERVER_NOT_RUNNING')
            done()
          })
        })
      })

      describe('with keep-alive connections', () => {
        let closed = 0
        let gracefully = false
        let server

        beforeEach(function () {
          server = stoppable(scheme.server())
        })

        it('stops accepting new connections', async () => {
          server.on('close', () => closed++)
          server.listen(PORT)
          await a.event(server, 'listening')
          const res1 = await request(`${schemeName}://localhost:${PORT}`)
            .agent(scheme.agent({keepAlive: true}))
          const text1 = await res1.text()
          assert.equal(text1, 'hello')
          server.stop((e, g) => {
            gracefully = g
          })
          const err = await a.failure(request(`${schemeName}://localhost:${PORT}`)
            .agent(scheme.agent({ keepAlive: true })))
          assert.match(err.message, /ECONNREFUSED/)
        })

        it('closes', () => { assert.equal(closed, 1) })

        it('gracefully', () => {
          assert.isOk(gracefully)
        })

        it('empties all sockets once closed',
          () => { assert.equal(server._pendingSockets.size, 0) })

        it('registers the "close" callback', (done) => {
          server.listen(PORT)
          server.stop(done)
        })

        it('should error if already closed', function (done) {
          server.stop(e => {
            assert.propertyVal(e, 'code', 'ERR_SERVER_NOT_RUNNING')
            done()
          })
        })
      })
    })

    describe('.stopAsync()', function () {
      describe('without keep-alive connections', function () {
        let gracefully = false
        let server

        beforeEach(async function () {
          server = stoppable(scheme.server())
          server.listen(PORT)
          await a.event(server, 'listening')
          const res1 =
              await request(`${schemeName}://localhost:${PORT}`).agent(scheme.agent())
          const text1 = await res1.text()
          assert.equal(text1, 'hello')
          gracefully = (await Promise.all([
            server.stopAsync(),
            a.event(server, 'close')
          ]))
            .shift()
        })

        it('stops accepting new connections', async () => {
          const err = await a.failure(
            request(`${schemeName}://localhost:${PORT}`).agent(scheme.agent()))
          assert.match(err.message, /ECONNREFUSED/)
        })

        it('gracefully', () => {
          assert.isOk(gracefully)
        })

        it('should reject if already closed', async function () {
          const err = await a.failure(server.stopAsync())
          assert.propertyVal(err, 'code', 'ERR_SERVER_NOT_RUNNING')
        })
      })

      describe('with keep-alive connections', () => {
        let gracefully = false
        let server
        let result

        beforeEach(async function () {
          server = stoppable(scheme.server())
          server.listen(PORT)
          await a.event(server, 'listening')
          result = await request(`${schemeName}://localhost:${PORT}`)
            .agent(scheme.agent({keepAlive: true}))
          gracefully = (await Promise.all([
            server.stopAsync(),
            a.event(server, 'close')
          ]))
            .shift()
        })

        it('returns the correct response', async function () {
          const text1 = await result.text()
          assert.equal(text1, 'hello')
        })

        it('stops accepting new connections', async () => {
          const err = await a.failure(request(`${schemeName}://localhost:${PORT}`)
            .agent(scheme.agent({ keepAlive: true })))
          assert.match(err.message, /ECONNREFUSED/)
        })

        it('gracefully', () => {
          assert.isOk(gracefully)
        })

        it('empties all sockets once closed', async () => {
          await a.failure(request(`${schemeName}://localhost:${PORT}`)
            .agent(scheme.agent({ keepAlive: true })))
          assert.equal(server._pendingSockets.size, 0)
        })

        it('registers the "close" callback', async () => {
          server.listen(PORT)
          await server.stopAsync()
        })

        it('should reject if already closed', async function () {
          const err = await a.failure(server.stopAsync())
          assert.propertyVal(err, 'code', 'ERR_SERVER_NOT_RUNNING')
        })
      })
    })

    describe('with a 0.5s grace period', () => {
      let gracefully = true
      let server

      beforeEach(function () {
        server = stoppable(scheme.server((req, res) => {
          res.writeHead(200)
          res.write('hi')
        }), 500)
      })

      it('kills connections after 0.5s', async () => {
        server.listen(PORT)
        await a.event(server, 'listening')
        await Promise.all([
          request(`${schemeName}://localhost:${PORT}`)
            .agent(scheme.agent({keepAlive: true})),
          request(`${schemeName}://localhost:${PORT}`)
            .agent(scheme.agent({keepAlive: true}))
        ])
        const start = Date.now()
        server.stop((e, g) => {
          gracefully = g
        })
        await a.event(server, 'close')
        assert.closeTo(Date.now() - start, 500, 50)
      })

      it('gracefully', () => {
        assert.isNotOk(gracefully)
      })

      it('empties all sockets', () => {
        assert.equal(server._pendingSockets.size, 0)
      })
    })

    describe('with requests in-flight', () => {
      let server
      let gracefully = false

      beforeEach(function () {
        server = stoppable(scheme.server((req, res) => {
          const delay = parseInt(req.url.slice(1), 10)
          res.writeHead(200)
          res.write('hello')
          setTimeout(() => res.end('world'), delay)
        }))
      })

      it('closes their sockets once they finish', async () => {
        server.listen(PORT)
        await a.event(server, 'listening')
        const start = Date.now()
        const res = await Promise.all([
          request(`${schemeName}://localhost:${PORT}/250`)
            .agent(scheme.agent({keepAlive: true})),
          request(`${schemeName}://localhost:${PORT}/500`)
            .agent(scheme.agent({keepAlive: true}))
        ])
        server.stop((e, g) => {
          gracefully = g
        })
        const bodies = await Promise.all(res.map(r => r.text()))
        await a.event(server, 'close')
        assert.equal(bodies[0], 'helloworld')
        assert.closeTo(Date.now() - start, 500, 100)
      })
      it('gracefully', () => {
        assert.isOk(gracefully)
      })

      describe('with in-flights finishing before grace period ends', function () {
        if (schemeName !== 'http') {
          return
        }

        it('exits immediately', async () => {
          const file = path.join(__dirname, 'server.js')
          const server = child.spawn('node', [file, '500'])
          await a.event(server.stdout, 'data')
          const start = Date.now()
          const res = await request(`${schemeName}://localhost:${PORT}/250`)
            .agent(scheme.agent({keepAlive: true}))
          const body = await res.text()
          assert.equal(body, 'helloworld')
          assert.closeTo(Date.now() - start, 250, 100)
        })
      })
    })
  })
})
