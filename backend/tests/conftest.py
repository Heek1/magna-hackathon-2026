import os
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("ACTIONS_DB", os.path.join(tempfile.mkdtemp(), "test_actions.db"))

from app import data  # noqa: E402

DATA_PATH = BACKEND.parent / "data" / "oee.xlsx"


@pytest.fixture(scope="session")
def ds():
    return data.load(DATA_PATH)
