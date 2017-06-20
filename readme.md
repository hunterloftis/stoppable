# Stoppable

Node's `server.close()` the way you probably
[expected it to work by default](https://github.com/nodejs/node/issues/2642).

```js
const server = stoppable(http.createServer(handler))
server.stop()
```

Stoppable stops accepting new connections and closes existing, idle connections (including keep-alives)
without killing requests that are in-flight.

[![Build Status](https://travis-ci.org/hunterloftis/stoppable.svg?branch=master)](https://travis-ci.org/hunterloftis/stoppable)

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

## Manual operations on pending counts

It's also possible to manually increment and decrement a pending count of a specific socket.
This can be helpful when you want to lock the server while doing some jobs.
For example, you can increment a pending count when you receive a request via Websocket
and decrement it once you have processed it.

**stoppable.increment**

```js
server.stoppable.increment(socket)
```

Increment a pending count of a specified socket. This method returns the new pending count.

- socket: A socket of which you want to increment a pending count

**stoppable.decrement**

```js
server.stoppable.decrement(socket, callback)
```

Decrement a pending count of a specified socket. If the pending count becomes 0 and the server
has already been stopped, it closes the socket. When you specify a callback, it calls
the callback instead of closing the socket. You can do some cleanups in this callback,
but it's your responsibility to close the socket. This method returns the new pending count.

- socket: A socket of which you want to decrement a pending count
- callback: A cleanup function. The first argument is a socket to be closed.

## Design decisions

- Monkey patching generally sucks, but in this case it's the nicest API. Let's call it "decorating."
- `grace` could be specified on `stop`, but it's better to match the existing `server.close` API.
- Clients should be handled respectfully, so we aren't just destroying sockets, we're sending `FIN` packets first.
- Any solution to this problem requires bookkeeping on every connection and request/response.
We're doing a minimum of work on these "hot" code paths and delaying as much as possible to the actual `stop` method.

## Performance

There's no way to provide this functionality without bookkeeping on connection, disconnection, request, and response.
However, Stoppable strives to do minimal work in hot code paths and to use optimal data structures.

I'd be interested to see real-world performance benchmarks;
the simple loopback artillery benchmark included in the lib shows very little overhead from using a stoppable server:

### Without Stoppable

```
  Scenarios launched:  10000
  Scenarios completed: 10000
  Requests completed:  10000
  RPS sent: 939.85
  Request latency:
    min: 0.5
    max: 51.3
    median: 2.1
    p95: 3.7
    p99: 15.3
  Scenario duration:
    min: 1
    max: 60.7
    median: 3.6
    p95: 7.6
    p99: 19
  Scenario counts:
    0: 10000 (100%)
  Codes:
    200: 10000
```

### With Stoppable

```
  Scenarios launched:  10000
  Scenarios completed: 10000
  Requests completed:  10000
  RPS sent: 940.73
  Request latency:
    min: 0.5
    max: 43.4
    median: 2.1
    p95: 3.8
    p99: 15.5
  Scenario duration:
    min: 1.1
    max: 57
    median: 3.7
    p95: 8
    p99: 19.4
  Scenario counts:
    0: 10000 (100%)
  Codes:
    200: 10000
```
