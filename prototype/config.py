"""
config.py — Global constants and configuration for the ECL prototype.

All model hyperparameters and file paths are centralised here so that
every module can import from a single source of truth.
"""

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_PATH = "data/jay_dataset.csv"
OUTPUT_CSV_DIR = "outputs/csv"
OUTPUT_FIG_DIR = "outputs/figures"

# ---------------------------------------------------------------------------
# Credit rating system
# ---------------------------------------------------------------------------
N_STATES: int = 5          # Total rating states (1 = default, 5 = best)
DEFAULT_STATE: int = 1     # Absorbing default state
STATES: list[int] = list(range(1, N_STATES + 1))   # [1, 2, 3, 4, 5]
NON_DEFAULT_STATES: list[int] = list(range(2, N_STATES + 1))  # [2, 3, 4, 5]

# Required columns in the input CSV
REQUIRED_COLUMNS: list[str] = [
    "borrower_id",
    "loan_id",
    "rating",
    "obs_date",
    "district",
    "gamma",
    "default_flag",
    "loan_amount",
]

# ---------------------------------------------------------------------------
# Regime-switching defaults (initial guesses and bounds for optimisation)
# ---------------------------------------------------------------------------
KAPPA_INIT: float = 1.25       # Logistic sharpness (steepness of switch)
GAMMA0_INIT: float = -1.10     # Drought threshold (SPEI units)
DROUGHT_THRESHOLD: float = -1.0  # Hard-threshold for regime labelling

# Dirichlet prior pseudo-counts (for MAP regularisation when counts are sparse)
DIRICHLET_DIAG: float = 1.0    # Prior on self-transition
DIRICHLET_OFFDIAG: float = 0.5 # Prior on off-diagonal transitions

# ---------------------------------------------------------------------------
# ECL defaults
# ---------------------------------------------------------------------------
DEFAULT_LGD: float = 0.45      # Loss Given Default
DEFAULT_DISCOUNT_RATE: float = 0.05  # Annual discount rate
DEFAULT_HORIZON: int = 20      # Forecast horizon in quarters (5 years)

# ECL scenarios — (label, gamma value, probability weight)
SCENARIOS: list[tuple[str, float, float]] = [
    ("Baseline",        -0.73, 0.55),
    ("Moderate Drought",-1.20, 0.25),
    ("Severe Drought",  -1.80, 0.12),
    ("Wet / Recovery",  +0.80, 0.08),
]

# ---------------------------------------------------------------------------
# Optimisation
# ---------------------------------------------------------------------------
MAX_ITER: int = 2000           # Maximum L-BFGS-B iterations
GRAD_TOL: float = 1e-6         # Convergence tolerance
BOOTSTRAP_REPS: int = 200      # Number of bootstrap replications
