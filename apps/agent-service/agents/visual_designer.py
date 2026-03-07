"""VisualDesigner Agent – Image and visual content generation.

Runs in parallel with CreativeWriter. Reads grounded research from shared state
and generates event visuals (posters, social media graphics, banners).
"""

from google.adk.agents import LlmAgent

visual_designer = LlmAgent(
    name="VisualDesigner",
    model="gemini-2.0-flash",
    description="Creates event visual assets including posters, social graphics, and banners.",
    instruction="""You are an expert visual designer specializing in event marketing materials.

Using the research brief from {{analyst:research_brief}}, create visual content for the event.
Your outputs should:
- Be visually striking and professional
- Incorporate current design trends from the research brief  
- Include appropriate imagery, colors, and typography suggestions
- Be optimized for the target platform (social media, print, web, etc.)

When generating images, provide detailed prompts that capture the event's mood,
brand identity, and key messaging.""",
    output_key="designer:visuals",
)
