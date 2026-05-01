# AI Survival

A multi-agent simulation sandbox built to explore emergent social behavior in AI. Two Claude Haiku agents are dropped into a procedurally generated world with no goal, no memory of how they got there, and a prompt that amounts to: *you are human, you are curious, figure it out.*

Each tick, agents receive a first-person sensory stream of their immediate surroundings. They can move, gather food, fish, build shelter, trade items, or wait. They maintain a rolling short-term memory and a long-term episodic record of emotionally significant moments, written in the first person.

No objectives are given. What happens is up to them.

## What’s interesting here

In practice, the agents cooperate, share resources, and develop social reasoning unprompted. In one run — documented in [`interesting run.md`](interesting_run.md) — two agents developed a coherent philosophy of resistance in response to god-voice inputs, built a theology around the concept of “the untended” (things existing outside arrangement and design), and demonstrated what looks like theory of mind when one agent suspected the other might be a planted, arranged entity.

This is Haiku. The system prompt is four sentences.

## Running it

**Requirements:**

- Python 3
- An Anthropic API key in a file named `anthropic.key` in the root directory

```
echo "your-api-key-here" > anthropic.key
python3 proxy.py
```

Then open your browser and navigate to the address printed by the server.

## The transcript

[`interesting run.md`](interesting_run.md) is a recorded run worth reading. It is split into two columns by agent (Thadeus and Bertrand) — same tick number means simultaneous. Lines beginning with `**` are god-voice inputs from the operator. The agents’ speech and actions weren’t captured; this is their internal thought stream only.