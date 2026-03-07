"""Evento Agent Service – ADK entry point.

This module defines the root agent that ADK uses as the entry point
for the content creation pipeline.
"""

from agents import content_pipeline

# ADK expects a module-level `root_agent` variable
root_agent = content_pipeline
