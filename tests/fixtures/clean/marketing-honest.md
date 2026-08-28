# Kettlebridge backup: what it actually does

Kettlebridge backs up your database every six hours and keeps 30 days of history by default. Restore
a table to any snapshot in that window in under two minutes, without taking the database offline.

## What's included

Every plan includes point-in-time restore down to the minute, cross-region replication to a second
data center, and encrypted storage using your own key if you provide one. Backups run on a schedule
you set, from every hour down to once a day.

## What it costs

Pricing is $0.02 per gigabyte stored per month, with no charge for restores and no charge for
egress during a restore. A typical 50 gigabyte database costs about a dollar a month to back up. You
can see the exact number for your database before you commit, using the calculator on our pricing
page.

## What it doesn't do

Kettlebridge does not back up file storage or object storage buckets; it only covers relational
databases. It does not replace a disaster recovery plan for your application layer. If your database
is larger than 2 terabytes, restore times will run longer than the two-minute figure above; we list
measured restore times by database size on the benchmarks page.

## How we tested the two-minute number

We restored a 10 gigabyte production snapshot 50 times across three regions and measured wall-clock
time from request to first successful query. The median was 94 seconds; the 95th percentile was 118
seconds. Full methodology and raw data are posted alongside the benchmark.
