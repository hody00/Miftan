import sys
from pathlib import Path
import time
try:sys.exit(0 if time.time()-Path('/tmp/miftan-heartbeat').stat().st_mtime<120 else 1)
except OSError:sys.exit(1)
