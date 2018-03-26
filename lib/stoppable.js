'use strict'

module.exports = (server, grace) => {
  grace = typeof grace === 'undefined' ? Infinity : grace
  const reqsPerSocket = new Map()
  let stopped = false

  server.on('connection', onConnection)
  server.on('secureConnection', onConnection)
  server.on('request', onRequest)
  server.stop = stop
  server._pendingSockets = reqsPerSocket
  return server

  function onConnection (socket) {
    reqsPerSocket.set(socket, 0)
    socket.once('close', () => reqsPerSocket.delete(socket))
  }

  function onRequest (req, res) {
    reqsPerSocket.set(req.socket, reqsPerSocket.get(req.socket) + 1)
    res.once('finish', () => {
      const pending = reqsPerSocket.get(req.socket) - 1
      reqsPerSocket.set(req.socket, pending)
      if (stopped && pending === 0) {
        req.socket.end()
      }
    })
  }

  function stop (callback) {
    // allow request handlers to update state before we act on that state
    setImmediate(() => {
      stopped = true
      if (grace < Infinity) {
        setTimeout(destroyAll, grace).unref()
      }
      server.close(callback)
      reqsPerSocket.forEach(endIfIdle)
    })
  }

  function endIfIdle (requests, socket) {
    if (requests === 0) socket.end()
  }

  function destroyAll () {
    reqsPerSocket.forEach((reqs, socket) => socket.end())
    setImmediate(() => {
      reqsPerSocket.forEach((reqs, socket) => socket.destroy())
    })
  }
}
