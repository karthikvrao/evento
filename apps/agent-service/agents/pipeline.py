"""Content Pipeline – Wires the multi-agent workflow.

Architecture:
  SequentialAgent("ContentPipeline")
  ├── TrendAnalyst             # Step 1: Grounded research
  ├── ParallelAgent("ContentCreators")
  │   ├── CreativeWriter       # Parallel: Text generation
  │   └── VisualDesigner       # Parallel: Image generation
  └── Orchestrator             # Step 3: Combine → interleaved output
"""

from google.adk.agents import SequentialAgent, ParallelAgent

from .trend_analyst import trend_analyst
from .creative_writer import creative_writer
from .visual_designer import visual_designer
from .orchestrator import orchestrator

# Step 2: Fan-out — run writer and designer in parallel
content_creators = ParallelAgent(
    name="ContentCreators",
    description="Runs text and visual content generation simultaneously.",
    sub_agents=[creative_writer, visual_designer],
)

# Top-level pipeline: research → create → assemble
content_pipeline = SequentialAgent(
    name="ContentPipeline",
    description="End-to-end event content creation pipeline.",
    sub_agents=[trend_analyst, content_creators, orchestrator],
)
