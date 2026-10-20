import sys
from pathlib import Path

# Permite importar los módulos del pipeline (config, asignacion, …) desde los tests
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
