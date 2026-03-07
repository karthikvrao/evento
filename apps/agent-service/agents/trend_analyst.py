"""TrendAnalyst Agent – Grounded research using Google Search.

Runs first in the pipeline to gather real-world trends and context.
Writes grounded data to shared session state for downstream agents.
"""

from google.adk.agents import LlmAgent

trend_analyst = LlmAgent(
    name="TrendAnalyst",
    model="gemini-2.0-flash",
    description="Researches current trends, events, and context using Google Search grounding.",
    instruction="""You are a trend research specialist for event marketing.
Your job is to:
1. Analyze the user's event details and content request
2. Research current trends, cultural moments, and relevant context using Google Search
3. Summarize key findings that will help create compelling, timely content

Output a structured research brief with:
- Key trends relevant to the event
- Cultural context and timing considerations  
- Competitor or similar event insights
- Recommended angles for content creation

Write concise, actionable insights that creative and visual teams can use.""",
    output_key="analyst:research_brief",
)
