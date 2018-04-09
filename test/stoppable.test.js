const http = require('http')
const https = require('https')
const parse = require('url').parse
const a = require('awaiting')
const request = require('requisition')
const assert = require('chai').assert
const fs = require('fs')
const stoppable = require('..')
const child = require('child_process')
const path = require('path')

describe('http.Server', () => {
  describe('.close()', () => {
    describe('without keep-alive connections', () => {
      let closed = 0
      it('stops accepting new connections', async () => {
        const server = http.createServer((req, res) => res.end('hello'))
        server.on('close', () => closed++)
        server.listen(8000)
        await a.event(server, 'listening')
        const res1 = await request('http://localhost:8000').agent(new http.Agent())
        const text1 = await res1.text()
        assert.equal(text1, 'hello')
        server.close()
        const err = await a.failure(request('http://localhost:8000').agent(new http.Agent()))
        assert.match(err.message, /ECONNREFUSED/)
      })
      it('closes', () => {
        assert.equal(closed, 1)
      })
    })
    describe('with keep-alive connections', () => {
      let closed = 0
      it('stops accepting new connections', async () => {
        const server = http.createServer((req, res) => res.end('hello'))
        server.on('close', () => closed++)
        server.listen(8000)
        await a.event(server, 'listening')
        const res1 = await request('http://localhost:8000').agent(new http.Agent({ keepAlive: true }))
        const text1 = await res1.text()
        assert.equal(text1, 'hello')
        server.close()
        const err = await a.failure(request('http://localhost:8000').agent(new http.Agent({ keepAlive: true })))
        assert.match(err.message, /ECONNREFUSED/)
      })
      it("doesn't close", () => {
        assert.equal(closed, 0)
      })
    })
  })
  describe('.stop()', () => {
    describe('without keep-alive connections', () => {
      let closed = 0
      it('stops accepting new connections', async () => {
        const server = stoppable(http.createServer((req, res) => res.end('hello')))
        server.on('close', () => closed++)
        server.listen(8000)
        await a.event(server, 'listening')
        const res1 = await request('http://localhost:8000').agent(new http.Agent())
        const text1 = await res1.text()
        assert.equal(text1, 'hello')
        server.stop()
        const err = await a.failure(request('http://localhost:8000').agent(new http.Agent()))
        assert.match(err.message, /ECONNREFUSED/)
      })
      it('closes', () => {
        assert.equal(closed, 1)
      })
    })
    describe('with keep-alive connections', () => {
      let closed = 0
      let server
      it('stops accepting new connections', async () => {
        server = http.createServer((req, res) => res.end('hello'))
        stoppable(server)
        server.on('close', () => closed++)
        server.listen(8000)
        await a.event(server, 'listening')
        const res1 = await request('http://localhost:8000').agent(new http.Agent({ keepAlive: true }))
        const text1 = await res1.text()
        assert.equal(text1, 'hello')
        server.stop()
        const err = await a.failure(request('http://localhost:8000').agent(new http.Agent({ keepAlive: true })))
        assert.match(err.message, /ECONNREFUSED/)
      })
      it('closes', () => {
        assert.equal(closed, 1)
      })
      it('empties all sockets once closed', () => {
        assert.equal(server._pendingSockets.size, 0)
      })
      it('registers the "close" callback', (done) => {
        const server = stoppable(http.createServer((req, res) => res.end('hello')))
        server.listen(8000)
        server.stop(done)
      })
    })
    describe('with a 0.5s grace period', () => {
      let server
      it('kills connections after 0.5s', async () => {
        server = http.createServer((req, res) => {
          res.writeHead(200)
          res.write('hi')
        })
        stoppable(server, 500)
        server.listen(8000)
        await a.event(server, 'listening')
        const res = await Promise.all([
          request('http://localhost:8000').agent(new http.Agent({ keepAlive: true })),
          request('http://localhost:8000').agent(new http.Agent({ keepAlive: true }))
        ])
        const bodies = res.map(r => r.text())
        const start = Date.now()
        server.stop()
        await a.event(server, 'close')
        assert.closeTo(Date.now() - start, 500, 50)
      })
      it('empties all sockets', () => {
        assert.equal(server._pendingSockets.size, 0)
      })
    })
    describe('with requests in-flight', () => {
      it('closes their sockets once they finish', async () => {
        const server = http.createServer((req, res) => {
          const delay = parseInt(req.url.slice(1), 10)
          res.writeHead(200)
          res.write('hello')
          setTimeout(() => res.end('world'), delay)
        })
        stoppable(server)
        server.listen(8000)
        await a.event(server, 'listening')
        const start = Date.now()
        const res = await Promise.all([
          request('http://localhost:8000/250').agent(new http.Agent({ keepAlive: true })),
          request('http://localhost:8000/500').agent(new http.Agent({ keepAlive: true }))
        ])
        server.stop()
        const bodies = await Promise.all(res.map(r => r.text()))
        await a.event(server, 'close')
        assert.equal(bodies[0], 'helloworld')
        assert.closeTo(Date.now() - start, 500, 100)
      })
    })
    describe('with in-flights finishing before grace period ends', () => {
      it('exits immediately', async () => {
        const file = path.join(__dirname, 'server.js')
        const server = child.spawn('node', [file, '500'])
        await a.event(server.stdout, 'data')
        const start = Date.now()
        const res = await request('http://localhost:8000/250').agent(new http.Agent({ keepAlive: true }))
        const body = await res.text()
        const code = await a.event(server, 'close')
        assert.equal(body, 'helloworld')
        assert.closeTo(Date.now() - start, 250, 100)
      })
    })
  })
})

describe('https.Server', () => {
  describe('.stop()', () => {
    describe('with keep-alive connections', () => {
      let closed = 0
      it('stops accepting new connections', async () => {
        const server = https.createServer({
          key: fs.readFileSync('test/fixture.key'),
          cert: fs.readFileSync('test/fixture.cert')
        }, (req, res) => res.end('hello'))
        stoppable(server)
        server.on('close', () => closed++)
        server.listen(8000)
        await a.event(server, 'listening')
        const res1 = await request('https://localhost:8000').agent(new https.Agent({
          keepAlive: true,
          rejectUnauthorized: false
        }))
        const text1 = await res1.text()
        assert.equal(text1, 'hello')
        server.stop()
        const err = await a.failure(request('https://localhost:8000').agent(new https.Agent({
          keepAlive: true,
          rejectUnauthorized: false
        })))
        assert.match(err.message, /ECONNREFUSED/)
      })
      it('closes', () => {
        assert.equal(closed, 1)
      })
    })
  })
})
