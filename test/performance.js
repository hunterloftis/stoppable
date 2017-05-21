const http = require('http')
const stoppable = require('..')

setTimeout(() => {
  server.close(() => {
    console.log('\nstopped performance testing server')
    process.exit()
  })
}, 30000)

const server = http.createServer((req, res) => {
  res.end('hello world')
})

if (process.argv[2] === '1') stoppable(server, 5000)

server.listen(8000, () => {
  console.log('\nstarted performance testing server')
})
