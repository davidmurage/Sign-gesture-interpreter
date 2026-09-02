"""Inference providers exposed by the browser-frame API."""

from .ksl import KSL_LABELS, KslInferenceEngine

__all__ = ["KSL_LABELS", "KslInferenceEngine"]
