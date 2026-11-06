import os
os.chdir(r"C:\Users\rambh\OneDrive\Desktop\DDUGU project\backend")

from alembic.config import Config
from alembic import command

alembic_cfg = Config("alembic.ini")
command.upgrade(alembic_cfg, "head")
print("Migration completed successfully!")