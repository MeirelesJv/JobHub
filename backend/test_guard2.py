from app.core.deps import SINGLE_USER_ID
from app.models.sync_log import SyncLog
from app.database import SessionLocal
from app.workers.tasks import maybe_run_scheduled_sync

db = SessionLocal()
logs = db.query(SyncLog).filter_by(user_id=SINGLE_USER_ID).all()
ids = [l.id for l in logs]
print("sync_log ids for user:", ids)

for l in logs:
    l.user_id = None
db.commit()
db.close()

print("never-searched result:", maybe_run_scheduled_sync())

db2 = SessionLocal()
for i in ids:
    row = db2.get(SyncLog, i)
    row.user_id = SINGLE_USER_ID
db2.commit()
db2.close()
print("restored ids:", ids)
