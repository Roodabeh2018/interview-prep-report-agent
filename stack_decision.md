# Stack Decision

**Industry / use case:** Career services: personalized interview preparation for job seekers

**Primary stack:** n8n

**Author:** Roodabeh Seif

## Why n8n fits this problem

The workflow is a predictable sequence: collect the inputs, read the job posting, gather evidence about the candidate, research the company, write the report, and check it. The steps and the report structure are known in advance, so a visible, mostly linear workflow is the simplest design that fully solves the problem. n8n gives a ready-made form for job seekers, built-in HTTP and credential handling for the APIs, and visible branches for failure paths. Every step can be shown and explained in the demo, which matters because the user must be able to trust where each statement in the report comes from.

## Why LangGraph is secondary for this MVP

LangGraph gives more control over state, loops, and multi-step agent reasoning. This MVP does not need open-ended planning or a reasoning loop: the research steps are fixed, and quality is enforced by deterministic checks after the AI writes the report. LangGraph would add code and complexity without a clear benefit for the user. It becomes interesting for a later version with adaptive research (for example, deciding which sources to read based on the role) or a self-correction loop that rewrites rejected claims.

## Trade-offs

| Criterion | n8n | LangGraph | Decision for the MVP |
|---|---|---|---|
| Time to demo | Fast for a linear flow with API calls | More setup and code | n8n |
| Control over agent logic | Moderate | High | Sufficient in n8n |
| Integrations and credentials | Built-in form, HTTP, and credential nodes | Must be coded | n8n |
| Failure paths | Visible error outputs in the workflow | Defined in code | n8n |
| Explainability | Each step is visible on the canvas | Needs a graph walkthrough | n8n |

## Tools and APIs

| Capability | Tool | Purpose |
|---|---|---|
| Web search | Tavily | Company background with source links |
| News | GNews | Recent company news with dates and links |
| Public developer data | GitHub REST API | The candidate's public repositories |
| Analysis and writing | OpenAI (gpt-4o-mini) | Extract job requirements, match evidence, write the report |

## Grounding without a vector database

The MVP does not use Pinecone. Instead, every claim is grounded by deterministic checks in n8n:

- Each job requirement must quote the job posting exactly, or it is dropped.
- Each experience match must quote the candidate's CV text, or point to one of their real GitHub repositories.
- Company sources must come from the Tavily results, and news links must come from the GNews results.
- Anything that fails a check is removed and listed in `removed_claims`.

This is a better fit than RAG for the current inputs: the CV and job posting are short enough to send to the model in full, so retrieval could only miss evidence. A vector database becomes useful in a later version, for example to add a library of interview-preparation guides.

## Known limitations of this choice

- Large visual workflows become harder to read, so nodes are grouped and named by step.
- Version control is less natural than with Python code, so the workflow JSON is exported to GitHub after each meaningful change.
- Testing individual steps is manual, so each tool was tested on its own, including failure cases, before testing the full flow.
