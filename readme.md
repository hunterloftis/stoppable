# Stoppable

```js
const server = stoppable(http.createServer(handler))
server.stop()
```

This module implements Node's `server.close()` in the way you probably
[expected it to work by default](https://github.com/nodejs/node/issues/2642):
It stops accepting new connections and closes existing, idle connections (including keep-alives)
without killing requests that are in-flight.

## Installation

```
yarn add stoppable
```

(or use npm)

## Usage

**Constructor**

Decorates the server instance with a `stop` method.
Returns the server instance, so can be chained, or can be run as a standalone statement.

```js
stoppable(server, grace)
```

- server: Any HTTP or HTTPS Server instance
- grace: Milliseconds to wait before force-closing connections

`grace` defaults to Infinity (don't force-close).
If you want to immediately kill all sockets you can use a grace of 0.

**server.stop()**

Stops (closes) the server.

```js
server.close(callback)
```

- callback: passed along to the existing `server.close` function to auto-register a 'close' event
