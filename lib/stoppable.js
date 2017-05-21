module.exports = (server, grace = Infinity) => {
  const sockets = new Set()
  let stopped = false

  server.on('connection', onConnection)
  server.on('secureConnection', onConnection)
  server.on('request', onRequest)
  server.stop = stop
  server._pendingSockets = sockets
  return server

  function onConnection (socket) {
    socket._pendingRequests = 0
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  }

  function onRequest (req, res) {
    req.socket._pendingRequests++
    res.once('finish', () => {
      req.socket._pendingRequests--
      if (stopped && req.socket._pendingRequests === 0) {
        req.socket.end()
      }
    })
  }

  function stop(callback) {
    // allow request handlers to update state before we act on that state
    setImmediate(() => {
      stopped = true
      if (grace < Infinity) {
        setTimeout(destroyAll, grace).unref()
      }
      server.close(callback)
      sockets.forEach(endIfIdle)
    })
  }

  function endIfIdle (socket) {
    if (socket._pendingRequests === 0) {
      socket.end()
    }
  }

  function destroyAll() {
    sockets.forEach(socket => socket.end())
    setImmediate(() => {
      sockets.forEach(socket => socket.destroy())
    })
  }
}
