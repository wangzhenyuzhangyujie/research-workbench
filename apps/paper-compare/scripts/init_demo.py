"""Create a new local workspace without overwriting existing manuscripts."""
import shutil
from build import APP, R

if __name__ == '__main__':
    if R.exists() and any(R.iterdir()):
        raise SystemExit(f'Workspace is not empty: {R}. Use another PAPER_WORKSPACE path.')
    shutil.copytree(APP / 'examples', R, dirs_exist_ok=True)
    for name in ('sources', 'qa', 'web', 'figures', 'annotations'):
        (R / name).mkdir(exist_ok=True)
    print(f'Created demonstration workspace: {R}')
