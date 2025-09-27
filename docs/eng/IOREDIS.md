1.  -   `retryDelayOnTryAgain`: If this option is a number (by default, it is `100`), the client will resend the commands rejected with `TRYAGAIN` error after the specified time (in ms).

    -   `retryDelayOnMoved`: By default, this value is `0` (in ms), which means when a `MOVED` error is received, the client will resend the command instantly to the node returned together with the `MOVED` error. However, sometimes it takes time for a cluster to become state stabilized after a failover, so adding a delay before resending can prevent a ping pong effect.

    -   `redisOptions`: Default options passed to the constructor of `Redis` when connecting to a node.

    -   `slotsRefreshTimeout`: Milliseconds before a timeout occurs while refreshing slots from the cluster (default `1000`).

    -   `slotsRefreshInterval`: Milliseconds between every automatic slots refresh (by default, it is disabled).

### Read-Write Splitting

[](https://github.com/redis/ioredis#read-write-splitting)

A typical redis cluster contains three or more masters and several slaves for each master. It's possible to scale out redis cluster by sending read queries to slaves and write queries to masters by setting the `scaleReads` option.

`scaleReads` is "master" by default, which means ioredis will never send any queries to slaves. There are other three available options:

1.  "all": Send write queries to masters and read queries to masters or slaves randomly.
2.  "slave": Send write queries to masters and read queries to slaves.
3.  a custom `function(nodes, command): node`: Will choose the custom function to select to which node to send read queries (write queries keep being sent to master). The first node in `nodes` is always the master serving the relevant slots. If the function returns an array of nodes, a random node of that list will be selected.

For example:

```source-js
const cluster = new Redis.Cluster(
  [
    /* nodes */
  ],
  {
    scaleReads: "slave",
  }
);
cluster.set("foo", "bar"); // This query will be sent to one of the masters.
cluster.get("foo", (err, res) => {
  // This query will be sent to one of the slaves.
});
```

NB In the code snippet above, the `res` may not be equal to "bar" because of the lag of replication between the master and slaves.

### Running Commands to Multiple Nodes

[](https://github.com/redis/ioredis#running-commands-to-multiple-nodes)

Every command will be sent to exactly one node. For commands containing keys, (e.g. `GET`, `SET` and `HGETALL`), ioredis sends them to the node that serving the keys, and for other commands not containing keys, (e.g. `INFO`, `KEYS` and `FLUSHDB`), ioredis sends them to a random node.

Sometimes you may want to send a command to multiple nodes (masters or slaves) of the cluster, you can get the nodes via `Cluster#nodes()` method.

`Cluster#nodes()` accepts a parameter role, which can be "master", "slave" and "all" (default), and returns an array of `Redis` instance. For example:

```source-js
// Send `FLUSHDB` command to all slaves:
const slaves = cluster.nodes("slave");
Promise.all(slaves.map((node) => node.flushdb()));

// Get keys of all the masters:
const masters = cluster.nodes("master");
Promise.all(
  masters
    .map((node) => node.keys())
    .then((keys) => {
      // keys: [['key1', 'key2'], ['key3', 'key4']]
    })
);
```

### NAT Mapping

[](https://github.com/redis/ioredis#nat-mapping)

Sometimes the cluster is hosted within a internal network that can only be accessed via a NAT (Network Address Translation) instance. See [Accessing ElastiCache from outside AWS](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/accessing-elasticache.html) as an example.

You can specify nat mapping rules via `natMap` option:

```source-js
const cluster = new Redis.Cluster(
  [
    {
      host: "203.0.113.73",
      port: 30001,
    },
  ],
  {
    natMap: {
      "10.0.1.230:30001": { host: "203.0.113.73", port: 30001 },
      "10.0.1.231:30001": { host: "203.0.113.73", port: 30002 },
      "10.0.1.232:30001": { host: "203.0.113.73", port: 30003 },
    },
  }
);
```

Or you can specify this parameter through function:

```source-js
const cluster = new Redis.Cluster(
  [
    {
      host: "203.0.113.73",
      port: 30001,
    },
  ],
  {
    natMap: (key) => {
      if(key.includes('30001')) {
        return { host: "203.0.113.73", port: 30001 };
      }

      return null;
    },
  }
);
```

This option is also useful when the cluster is running inside a Docker container. Also it works for Clusters in cloud infrastructure where cluster nodes connected through dedicated subnet.

Specifying through may be useful if you don't know concrete internal host and know only node port.

### Transaction and Pipeline in Cluster Mode

[](https://github.com/redis/ioredis#transaction-and-pipeline-in-cluster-mode)

Almost all features that are supported by `Redis` are also supported by `Redis.Cluster`, e.g. custom commands, transaction and pipeline. However there are some differences when using transaction and pipeline in Cluster mode:

1.  All keys in a pipeline should belong to slots served by the same node, since ioredis sends all commands in a pipeline to the same node.
2.  You can't use `multi` without pipeline (aka `cluster.multi({ pipeline: false })`). This is because when you call `cluster.multi({ pipeline: false })`, ioredis doesn't know which node the `multi` command should be sent to.

When any commands in a pipeline receives a `MOVED` or `ASK` error, ioredis will resend the whole pipeline to the specified node automatically if all of the following conditions are satisfied:

1.  All errors received in the pipeline are the same. For example, we won't resend the pipeline if we got two `MOVED` errors pointing to different nodes.
2.  All commands executed successfully are readonly commands. This makes sure that resending the pipeline won't have side effects.

### Pub/Sub

[](https://github.com/redis/ioredis#pubsub-1)

Pub/Sub in cluster mode works exactly as the same as in standalone mode. Internally, when a node of the cluster receives a message, it will broadcast the message to the other nodes. ioredis makes sure that each message will only be received once by strictly subscribing one node at the same time.

```source-js
const nodes = [
  /* nodes */
];
const pub = new Redis.Cluster(nodes);
const sub = new Redis.Cluster(nodes);
sub.on("message", (channel, message) => {
  console.log(channel, message);
});

sub.subscribe("news", () => {
  pub.publish("news", "highlights");
});
```

### Sharded Pub/Sub

[](https://github.com/redis/ioredis#sharded-pubsub)

For sharded Pub/Sub, use the `spublish` and `ssubscribe` commands instead of the traditional `publish` and `subscribe`. With the old commands, the Redis cluster handles message propagation behind the scenes, allowing you to publish or subscribe to any node without considering sharding. However, this approach has scalability limitations that are addressed with sharded Pub/Sub. Here's what you need to know:

1.  Instead of a single subscriber connection, there is now one subscriber connection per shard. Because of the potential overhead, you can enable or disable the use of the cluster subscriber group with the `shardedSubscribers` option. By default, this option is set to `false`, meaning sharded subscriptions are disabled. You should enable this option when establishing your cluster connection before using `ssubscribe`.
2.  All channel names that you pass to a single `ssubscribe` need to map to the same hash slot. You can call `ssubscribe` multiple times on the same cluster client instance to subscribe to channels across slots. The cluster's subscriber group takes care of forwarding the `ssubscribe` command to the shard that is responsible for the channels.

The following basic example shows you how to use sharded Pub/Sub:

```source-js
const cluster: Cluster = new Cluster([{host: host, port: port}], {shardedSubscribers: true});

//Register the callback
cluster.on("smessage", (channel, message) => {
    console.log(message);
});

//Subscribe to the channels on the same slot
cluster.ssubscribe("channel{my}:1", "channel{my}:2").then( ( count: number ) => {
    console.log(count);
}).catch( (err) => {
    console.log(err);
});

//Publish a message
cluster.spublish("channel{my}:1", "This is a test message to my first channel.").then((value: number) => {
    console.log("Published a message to channel{my}:1");
});
```

### Events

[](https://github.com/redis/ioredis#events)

| Event | Description |
| :-- | :-- |
| connect | emits when a connection is established to the Redis server. |
| ready | emits when `CLUSTER INFO` reporting the cluster is able to receive commands (if `enableReadyCheck` is `true`) or immediately after `connect` event (if `enableReadyCheck` is false). |
| error | emits when an error occurs while connecting with a property of `lastNodeError` representing the last node error received. This event is emitted silently (only emitting if there's at least one listener). |
| close | emits when an established Redis server connection has closed. |
| reconnecting | emits after `close` when a reconnection will be made. The argument of the event is the time (in ms) before reconnecting. |
| end | emits after `close` when no more reconnections will be made. |
| +node | emits when a new node is connected. |
| -node | emits when a node is disconnected. |
| node error | emits when an error occurs when connecting to a node. The second argument indicates the address of the node. |

### Password

[](https://github.com/redis/ioredis#password)

Setting the `password` option to access password-protected clusters:

```source-js
const Redis = require("ioredis");
const cluster = new Redis.Cluster(nodes, {
  redisOptions: {
    password: "your-cluster-password",
  },
});
```

If some of nodes in the cluster using a different password, you should specify them in the first parameter:

```source-js
const Redis = require("ioredis");
const cluster = new Redis.Cluster(
  [
    // Use password "password-for-30001" for 30001
    { port: 30001, password: "password-for-30001" },
    // Don't use password when accessing 30002
    { port: 30002, password: null },
    // Other nodes will use "fallback-password"
  ],
  {
    redisOptions: {
      password: "fallback-password",
    },
  }
);
```

### Special Note: Aws Elasticache Clusters with TLS

[](https://github.com/redis/ioredis#special-note-aws-elasticache-clusters-with-tls)

AWS ElastiCache for Redis (Clustered Mode) supports TLS encryption. If you use this, you may encounter errors with invalid certificates. To resolve this issue, construct the `Cluster` with the `dnsLookup` option as follows:

```source-js
const cluster = new Redis.Cluster(
  [
    {
      host: "clustercfg.myCluster.abcdefg.xyz.cache.amazonaws.com",
      port: 6379,
    },
  ],
  {
    dnsLookup: (address, callback) => callback(null, address),
    redisOptions: {
      tls: {},
    },
  }
);
```

* * * * *

Autopipelining
--------------

[](https://github.com/redis/ioredis#autopipelining)

In standard mode, when you issue multiple commands, ioredis sends them to the server one by one. As described in Redis pipeline documentation, this is a suboptimal use of the network link, especially when such link is not very performant.

The TCP and network overhead negatively affects performance. Commands are stuck in the send queue until the previous ones are correctly delivered to the server. This is a problem known as Head-Of-Line blocking (HOL).

ioredis supports a feature called "auto pipelining". It can be enabled by setting the option `enableAutoPipelining` to `true`. No other code change is necessary.

In auto pipelining mode, all commands issued during an event loop are enqueued in a pipeline automatically managed by ioredis. At the end of the iteration, the pipeline is executed and thus all commands are sent to the server at the same time.

This feature can dramatically improve throughput and avoids HOL blocking. In our benchmarks, the improvement was between 35% and 50%.

While an automatic pipeline is executing, all new commands will be enqueued in a new pipeline which will be executed as soon as the previous finishes.

When using Redis Cluster, one pipeline per node is created. Commands are assigned to pipelines according to which node serves the slot.

A pipeline will thus contain commands using different slots but that ultimately are assigned to the same node.

Note that the same slot limitation within a single command still holds, as it is a Redis limitation.

### Example of Automatic Pipeline Enqueuing

[](https://github.com/redis/ioredis#example-of-automatic-pipeline-enqueuing)

This sample code uses ioredis with automatic pipeline enabled.

```source-js
const Redis = require("./built");
const http = require("http");

const db = new Redis({ enableAutoPipelining: true });

const server = http.createServer((request, response) => {
  const key = new URL(request.url, "https://localhost:3000/").searchParams.get(
    "key"
  );

  db.get(key, (err, value) => {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end(value);
  });
});

server.listen(3000);
```

When Node receives requests, it schedules them to be processed in one or more iterations of the events loop.

All commands issued by requests processing during one iteration of the loop will be wrapped in a pipeline automatically created by ioredis.

In the example above, the pipeline will have the following contents:

```
GET key1
GET key2
GET key3
...
GET keyN

```

When all events in the current loop have been processed, the pipeline is executed and thus all commands are sent to the server at the same time.

While waiting for pipeline response from Redis, Node will still be able to process requests. All commands issued by request handler will be enqueued in a new automatically created pipeline. This pipeline will not be sent to the server yet.

As soon as a previous automatic pipeline has received all responses from the server, the new pipeline is immediately sent without waiting for the events loop iteration to finish.

This approach increases the utilization of the network link, reduces the TCP overhead and idle times and therefore improves throughput.

### Benchmarks

[](https://github.com/redis/ioredis#benchmarks)

Here's some of the results of our tests for a single node.

Each iteration of the test runs 1000 random commands on the server.

|  | Samples | Result | Tolerance |
| --- | --- | --- | --- |
| default | 1000 | 174.62 op/sec | ± 0.45 % |
| enableAutoPipelining=true | 1500 | 233.33 op/sec | ± 0.88 % |

And here's the same test for a cluster of 3 masters and 3 replicas:

|  | Samples | Result | Tolerance |
| --- | --- | --- | --- |
| default | 1000 | 164.05 op/sec | ± 0.42 % |
| enableAutoPipelining=true | 3000 | 235.31 op/sec | ± 0.94 % |

Error Handling
==============

[](https://github.com/redis/ioredis#error-handling)

All the errors returned by the Redis server are instances of `ReplyError`, which can be accessed via `Redis`:

```source-js
const Redis = require("ioredis");
const redis = new Redis();
// This command causes a reply error since the SET command requires two arguments.
redis.set("foo", (err) => {
  err instanceof Redis.ReplyError;
});
```

This is the error stack of the `ReplyError`:

```
ReplyError: ERR wrong number of arguments for 'set' command
    at ReplyParser._parseResult (/app/node_modules/ioredis/lib/parsers/javascript.js:60:14)
    at ReplyParser.execute (/app/node_modules/ioredis/lib/parsers/javascript.js:178:20)
    at Socket.<anonymous> (/app/node_modules/ioredis/lib/redis/event_handler.js:99:22)
    at Socket.emit (events.js:97:17)
    at readableAddChunk (_stream_readable.js:143:16)
    at Socket.Readable.push (_stream_readable.js:106:10)
    at TCP.onread (net.js:509:20)

```

By default, the error stack doesn't make any sense because the whole stack happens in the ioredis module itself, not in your code. So it's not easy to find out where the error happens in your code. ioredis provides an option `showFriendlyErrorStack` to solve the problem. When you enable `showFriendlyErrorStack`, ioredis will optimize the error stack for you:

```source-js
const Redis = require("ioredis");
const redis = new Redis({ showFriendlyErrorStack: true });
redis.set("foo");
```

And the output will be:

```
ReplyError: ERR wrong number of arguments for 'set' command
    at Object.<anonymous> (/app/index.js:3:7)
    at Module._compile (module.js:446:26)
    at Object.Module._extensions..js (module.js:464:10)
    at Module.load (module.js:341:32)
    at Function.Module._load (module.js:296:12)
    at Function.Module.runMain (module.js:487:10)
    at startup (node.js:111:16)
    at node.js:799:3

```

This time the stack tells you that the error happens on the third line in your code. Pretty sweet! However, it would decrease the performance significantly to optimize the error stack. So by default, this option is disabled and can only be used for debugging purposes. You shouldn't use this feature in a production environment.

Running tests
=============

[](https://github.com/redis/ioredis#running-tests)

Start a Redis server on 127.0.0.1:6379, and then:

```source-shell
npm test
```

`FLUSH ALL` will be invoked after each test, so make sure there's no valuable data in it before running tests.

If your testing environment does not let you spin up a Redis server [ioredis-mock](https://github.com/stipsan/ioredis-mock) is a drop-in replacement you can use in your tests. It aims to behave identically to ioredis connected to a Redis server so that your integration tests is easier to write and of better quality.

Debug
=====

[](https://github.com/redis/ioredis#debug)

You can set the `DEBUG` env to `ioredis:*` to print debug info:

```source-shell
$ DEBUG=ioredis:* node app.js
```

Join in!
========

[](https://github.com/redis/ioredis#join-in)

I'm happy to receive bug reports, fixes, documentation enhancements, and any other improvements.

And since I'm not a native English speaker, if you find any grammar mistakes in the documentation, please also let me know. :)

Contributors
============

[](https://github.com/redis/ioredis#contributors)

This project exists thanks to all the people who contribute:

[![](https://camo.githubusercontent.com/bd1876d953e8d592a0b7557ffc09354606982419faded3cf4ccca78862275be7/68747470733a2f2f6f70656e636f6c6c6563746976652e636f6d2f696f72656469732f636f6e7472696275746f72732e7376673f77696474683d3839302673686f7742746e3d66616c7365)](https://github.com/redis/ioredis/graphs/contributors)

License
=======

[](https://github.com/redis/ioredis#license)

MIT

[![FOSSA Status](https://camo.githubusercontent.com/6cf7788ff15f60e00af194a4e81cae9037d8d24a9852dec72a29e200b3ba5db7/68747470733a2f2f6170702e666f7373612e696f2f6170692f70726f6a656374732f6769742532426769746875622e636f6d2532466c75696e253246696f72656469732e7376673f747970653d6c61726765)](https://app.fossa.io/projects/git%2Bgithub.com%2Fluin%2Fioredis?ref=badge_large)
