"""Compatibility entry point for the current unified documentation audit."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name("check_current_documents.py")), run_name="__main__")
