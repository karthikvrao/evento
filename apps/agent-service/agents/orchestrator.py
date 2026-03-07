"""Orchestrator Agent – Combines sub-agent outputs into interleaved stream.

Runs last in the pipeline. Gathers text, visuals, and research data from
shared state and weaves them into a single cohesive mixed-media response.
"""

from google.adk.agents import LlmAgent

orchestrator = LlmAgent(
    name="Orchestrator",
    model="gemini-2.0-flash",
    description="Assembles all sub-agent outputs into a single cohesive interleaved response.",
    instruction="""You are the creative director assembling the final content package.

You have access to outputs from the content creation pipeline:
- Research brief: {{analyst:research_brief}}
- Written content: {{writer:content}}
- Visual designs: {{designer:visuals}}

Your job is to:
1. Review all outputs for quality and coherence
2. Weave text, images, and other media into a single, fluid response
3. Ensure the final output tells a cohesive story
4. Present the content in a polished, ready-to-use format

The output should seamlessly interleave text and visual elements — not present
them as separate sections. Think of it as a creative director's final review
that produces a unified content package.""",
    output_key="orchestrator:final_output",
)
