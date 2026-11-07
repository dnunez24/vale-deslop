# How Rivergate Queue handles backpressure

Every distributed system eventually has to decide what happens when producers send messages faster than consumers can process them. Rivergate Queue is how we decided to handle it, and this post explains how it works. After a year of internal use, Rivergate Queue is now generally available.

## The problem with naive queues

There are far more message queues than there were ten years ago, but many of them still fall over when load spikes in a way nobody predicted. Before picking a backpressure strategy, we looked closely at the options people use today, and most of them only solved part of the problem.

We expect this design to change how our services handle load. Our bet is that backpressure-aware queues will matter as much to the next generation of infrastructure as containers did to the last one.

Teams usually hit the throughput ceiling when a single consumer can't keep up with ten producers. In our fleet, most outages trace back to unbounded queues, not unbounded traffic. The network isn't the problem; flow control is. So when we rebuilt the client, we aimed for predictable behavior under load as well as speed.

## How it works

In credit-based flow control, each consumer advertises how many messages it can accept, and producers stay under that number until the consumer changes it. A bouncer at a club door works the same way: they count people in and out instead of guessing how full the room is.

Most open-source queues still default to unbounded buffering, though the field moves quickly and that may have changed by the time you read this.

```go
q := rivergate.New(rivergate.Config{
    Credits: 500,
    OnBackpressure: func(pending int) {
        log.Printf("queue backpressure: %d pending", pending)
    },
})
```

The client library has three settings you should know about:

- **Credits:** the number of in-flight messages a consumer allows before it pauses
- **Backoff:** how long a producer waits after it hits the credit limit
- **Timeout:** how long an unacknowledged message waits before it is redelivered

This design cuts tail latency by an order of magnitude, and the implementation is simple once you understand the credit loop. The API is small, probably the smallest of any queue client we evaluated.

The reference implementation at <https://docs.rivergate.dev/queue?utm_source=chatgpt.com&ref=blog> walks through the full protocol.

## Why we chose this approach

Rivergate Queue is a thin layer over our existing broker, not a replacement for it. The credit protocol is the only new moving part, and every service integrates through the client library alone. For teams already on the old client, migrating costs almost nothing.

The team had a working prototype in six weeks, but we didn't understand the real problems, or the real opportunities, until we ran it against production traffic. People on the team joke about the "coordination tax," their made-up name for what it costs when every service implements its own backpressure by hand.

Three teams reviewed the design, and the API surface shrank twice along the way. We tested the final client against every internal producer, and it shipped without a single breaking change. The rollout took two weeks in stages and never paused a downstream service.

The new client is better in three ways that matter to us: it's correct, it's observable, and when it fails, it fails in boring ways.

## What engineers are saying

"It just works," one backend engineer told us. The team now treats that as "the bar" for every internal library. She said queues had never been reliable before this rewrite.

Since rollout, we haven't dropped a single message. On-call load has gone down, and every team that adopted the client reports the same thing.

The pages stopped, and the alerts went quiet.

After shipping the client, we measured the rollout, watched the dashboards closely, and wrote up the results.

That left us with a few questions. What changed after rollout? Why did on-call load drop? When was the last backpressure incident? How much toil did the client actually remove?

Queues seem simple right up until they aren't. For us, the payoff was a quieter on-call rotation and a calmer launch week.

Over two quarters in production, we went from guessing about queue behavior to measuring it, and then to trusting it. The design is simple and lightweight, and it has covered the needs of every team that adopted it.

## Results in production

Our staging cluster survived a ten-times traffic spike without dropping a single message. After that, we rolled the client out to every internal service over two weeks.

Our analysis suggests that backpressure accounts for most of the improvement. Latency variance may have dropped too, but the sample may be too small to say for sure. The results might carry over to other teams' workloads.

After rollout, queue depth dropped, stayed flat, and never spiked again.

This wasn't magic. When traffic tripled during a launch, the client paused producers for four seconds, and nothing fell over.

## Try it yourself

First, install the client library from our package registry. Next, wrap your existing producer calls with the credit-aware client. Then watch the backpressure callback fire under real load.

That covers the core mechanism. The redelivery logic is a topic for a follow-up post.

Credit-based flow control turned an unpredictable failure mode into one that is boring and easy to see. You don't have to rewrite your queue. It's a small client change that stops the queue from lying about capacity. We should have shipped it two years ago: it was cheap to build, and in hindsight it was obvious.
