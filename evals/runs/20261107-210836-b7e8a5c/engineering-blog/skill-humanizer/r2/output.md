# How Rivergate Queue handles backpressure

Every distributed system eventually has to decide what happens when producers send messages faster than consumers can process them. Rivergate Queue is how we answered that question, and this post explains how it works. After a year of internal use, Rivergate Queue is now generally available.

## The problem with naive queues

There are far more message queues than there were ten years ago, but many of them still fall over when load spikes in ways nobody predicted. Before choosing a design, we spent time reading through the backpressure strategies already out there. Most of them solved part of the problem and left the rest alone.

We think this design will change how our services handle load. Our bet is that backpressure-aware queues will matter as much to the next round of infrastructure as containers did to the last one.

Teams usually hit the throughput ceiling when one consumer can't keep up with ten producers. In our fleet, most outages trace back to unbounded queues rather than unbounded traffic. The network isn't the problem here; flow control is. So we rebuilt the client to be predictable under load, and fast as well.

## How it works

By "credit-based flow control" I mean this: each consumer advertises how many messages it can accept, and producers stick to that number until the consumer changes it. It works like a bouncer at a door who counts people in and out instead of guessing how full the room is.

Most open-source queues still default to unbounded buffering, though the field moves fast enough that this could change soon.

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

The design cuts tail latency by an order of magnitude, and once you see the credit loop, the implementation is simple. The API is small too. Of all the queue clients we evaluated, it probably has the smallest surface area.

The reference implementation at <https://docs.rivergate.dev/queue?utm_source=chatgpt.com&ref=blog> walks through the full protocol.

## Why we chose this approach

Rivergate Queue is a thin layer on top of our existing broker, not a replacement for it. The credit protocol is the only new moving part, and the client library is the one place every service integrates with it. For teams already on the old client, migration costs almost nothing.

The team had a working prototype in six weeks. We didn't understand the hard parts, or the opportunities, until we ran it against production traffic. People on the team joke about the "coordination tax," their made-up name for what it costs when every service writes its own backpressure handling by hand.

Three teams reviewed the design, and the API surface got trimmed twice along the way. We tested the final client against every internal producer, and it shipped without a single breaking change. We staged the rollout over two weeks, and no downstream service had to pause.

The new client gets three things right: it is correct, it is observable, and when it fails, it fails in boring ways.

## What engineers are saying

"It just works," one backend engineer told us. The team now treats that as "the bar" for every internal library. She said queues had never been reliable before this rewrite.

We're thrilled with the results. No message has been dropped since rollout, on-call load has gone down, and every team that adopted the client reports the same thing. The incidents simply stopped, and the pager went quiet.

After shipping the client, we tracked the rollout, kept a close eye on the dashboards, and wrote up what we saw. We wanted to know what changed, why on-call load dropped, when the last backpressure incident happened, and how much toil the work really removed.

Queues seem simple until they aren't. This time the outcome was a quieter on-call rotation and a calmer launch week.

Over two quarters in production, we went from guessing about queue behavior to measuring it, and then to trusting it. The design is simple and lightweight, but it has been complete enough for every team that has adopted it.

## Results in production

Our staging cluster handled a tenfold traffic spike without dropping a single message. After that, we rolled the client out to every internal service over two weeks.

Our analysis points to backpressure as the source of most of the improvement. Latency variance may have dropped as well, but the sample may be too small to say. The results might carry over to other teams' workloads, at least in part.

Queue depth went down after rollout, stayed flat, and hasn't spiked since.

None of this was magic. When traffic tripled during a launch, the client paused producers for four seconds, and nothing fell over.

## Try it yourself

First, install the client library from our package registry. Next, wrap your existing producer calls with the credit-aware client. Then put it under real load and watch the backpressure callback fire.

That covers the core mechanism. The redelivery logic is a topic for another post.

Credit-based flow control took a failure mode we couldn't predict and made it boring and visible. You don't have to rewrite your queue. It's a small client change that stops the queue from lying about how much it can hold. We should have shipped it two years ago: it was cheap to build, and in hindsight it was obvious.
