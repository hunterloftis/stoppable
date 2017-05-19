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

**constructor**

```js
stoppable(server, grace)
```

Decorates the server instance with a `stop` method.
Returns the server instance, so can be chained, or can be run as a standalone statement.

- server: Any HTTP or HTTPS Server instance
- grace: Milliseconds to wait before force-closing connections

`grace` defaults to Infinity (don't force-close).
If you want to immediately kill all sockets you can use a grace of 0.

**stop()**

```js
server.stop(callback)
```

Closes the server.

- callback: passed along to the existing `server.close` function to auto-register a 'close' event

## Design decisions

- Monkey patching generally sucks, but in this case it's the nicest APIs. Let's call it "decorating."
- `grace` could be specified on the stop method, but it's better to match the existing `server.close` API
- Clients should be handled respectfully, so we aren't just destroying sockets, we're sending `FIN` packets first.
- Any solution to this problem requires bookkeeping on every connection and request/response.
We're doing a minimum of work on these "hot" code paths and delaying as much as possible to the actual `stop` method.
