"""Compatibility exports for older imports that use agents.path.

The canonical module is agents.paths. Keep this shim so existing scripts,
notebooks, or external callers do not break if they import agents.path.
"""

from agents.paths import *  # noqa: F401,F403
