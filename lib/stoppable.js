module.exports = (server, grace = Infinity) => {
  const reqsPerSocket = new Map()
  let stopped = false

  server.on('connection', onConnection)
  server.on('secureConnection', onConnection)
  server.on('request', onRequest)
  server.stop = stop
  server.stoppable = {
    increment,
    decrement
  }
  server._pendingSockets = reqsPerSocket
  return server

  function onConnection (socket) {
    reqsPerSocket.set(socket, 0)
    socket.once('close', () => reqsPerSocket.delete(socket))
  }

  function onRequest (req, res) {
    increment(req.socket)
    res.once('finish', () => decrement(req.socket))
  }

  function increment (socket) {
    const counter = reqsPerSocket.get(socket) + 1
    reqsPerSocket.set(socket, counter)
    return counter
  }

  function decrement (socket, callback) {
    const counter = reqsPerSocket.get(socket) - 1
    reqsPerSocket.set(socket, counter)
    if (stopped && counter === 0) {
      (callback || (() => socket.end()))()
    }
    return counter
  }

  function stop(callback) {
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

  function destroyAll() {
    reqsPerSocket.forEach((reqs, socket) => socket.end())
    setImmediate(() => {
      reqsPerSocket.forEach((reqs, socket) => socket.destroy())
    })
  }
}
