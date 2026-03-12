"""agents package – exports the root agent for ADK.

Only the orchestrator is exposed publicly. All sub-agents and tools
are imported transitively through the agent tree.
"""

from .orchestrator import orchestrator

__all__ = ["orchestrator"]
