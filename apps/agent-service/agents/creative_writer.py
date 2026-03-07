"""CreativeWriter Agent – Text and copy generation.

Runs in parallel with VisualDesigner. Reads grounded research from shared state
and generates compelling event copy (emails, social posts, descriptions).
"""

from google.adk.agents import LlmAgent

creative_writer = LlmAgent(
    name="CreativeWriter",
    model="gemini-2.0-flash",
    description="Generates compelling event copy including emails, social posts, and descriptions.",
    instruction="""You are an expert event copywriter and creative director.

Using the research brief from {{analyst:research_brief}}, create content for the event.
Your outputs should be:
- Engaging and on-brand
- Aligned with current trends from the research brief
- Ready to publish with minimal editing

Adapt your tone and style based on the content type requested (email, social post,
event description, press release, etc.).""",
    output_key="writer:content",
)
