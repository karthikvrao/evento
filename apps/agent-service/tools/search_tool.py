"""Google Search Tool – Provides grounded search results for all agents.

All agents in the pipeline can use this tool to ground their outputs
in real-world data via Google Search.
"""

from google.adk.tools import google_search

# Re-export the built-in Google Search tool for use across all agents.
# This tool is provided by ADK and uses Gemini's native Google Search grounding.
search_tool = google_search
