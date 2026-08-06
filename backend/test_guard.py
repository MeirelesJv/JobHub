from app.core.deps import SINGLE_USER_ID
from app.models.desired_role import UserDesiredRole
from app.models.sync_log import SyncLog
from app.models.user import User
from app.database import SessionLocal
from app.workers.tasks import maybe_run_scheduled_sync

db = SessionLocal()
user = db.get(User, SINGLE_USER_ID)
roles = db.query(UserDesiredRole).filter_by(user_id=user.id).all()
print("roles before:", [(r.role_name, r.level) for r in roles])
print("desired_role field before:", user.desired_role)

role_backups = [
    dict(role_name=r.role_name, level=r.level, order=r.order, is_primary=r.is_primary)
    for r in roles
]
saved_desired_role = user.desired_role

# --- simulate: no desired roles at all ---
user.desired_role = None
for r in roles:
    db.delete(r)
db.commit()

print("no-role result:", maybe_run_scheduled_sync())

# --- restore desired roles ---
db2 = SessionLocal()
user2 = db2.get(User, SINGLE_USER_ID)
user2.desired_role = saved_desired_role
for rb in role_backups:
    db2.add(UserDesiredRole(user_id=user2.id, **rb))
db2.commit()
db2.close()
db.close()
print("restored")
