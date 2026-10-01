"""Var olan görevlere örnek iş gücü verisi: tahmini süre (önceliğe göre) ve tamamlanan / devam eden görevler için
mesai saatlerine düşen geçmiş çalışma oturumu. Yalnızca tahmini süresi boş olan görevlere dokunur."""
import subprocess, datetime as dt


IST = dt.timezone(dt.timedelta(hours=3))  # Türkiye yaz saati uygulamaz
UTC = dt.timezone.utc
PERIODS = [(dt.time(9), dt.time(12)), (dt.time(13), dt.time(18))]


def q(sql):
    out = subprocess.run(['docker', 'exec', '-i', 'devhub-mysql', 'mysql', '-uroot', '-proot', '-N', '--default-character-set=utf8mb4', 'devhub'],
                         input=sql.encode(), capture_output=True).stdout.decode()
    return [line.split('\t') for line in out.strip().splitlines() if line]


holidays = {r[0] for r in q('select date from holidays;')}


def workday(d):
    return d.weekday() < 5 and d.isoformat() not in holidays


def walk_back(end_utc, minutes):
    """end_utc'dan geriye, mesai saatlerinde 'minutes' dakika birikene kadar gidip başlangıcı döner."""
    end = end_utc.replace(tzinfo=UTC).astimezone(IST)
    need = dt.timedelta(minutes=minutes)
    day = end.date()
    cursor = end
    while need > dt.timedelta(0):
        if workday(day):
            for ps, pe in reversed(PERIODS):
                a = dt.datetime.combine(day, ps, IST)
                b = min(dt.datetime.combine(day, pe, IST), cursor)
                if b <= a:
                    continue
                if b - a >= need:
                    return (b - need).astimezone(UTC).replace(tzinfo=None)
                need -= b - a
                cursor = a
        day -= dt.timedelta(days=1)
        cursor = dt.datetime.combine(day, dt.time(23, 59), IST)
    return cursor.astimezone(UTC).replace(tzinfo=None)


BASE = {'YUKSEK': 16, 'ORTA': 8, 'DUSUK': 4}
rows = q("select id, user_id, status, priority, completed_at from tasks where estimated_minutes is null;")
now = dt.datetime.now(UTC).replace(tzinfo=None, microsecond=0)
sql = []
for tid, uid, status, prio, completed in rows:
    tid = int(tid)
    est_h = BASE.get(prio, 8) + [0, 2, -2, 4, 0][tid % 5] if BASE.get(prio, 8) > 4 else [2, 3, 4, 6, 4][tid % 5]
    est = max(1, est_h) * 60
    sql.append(f'update tasks set estimated_minutes = {est} where id = {tid};')
    factor = [0.8, 1.0, 1.15, 0.9, 1.35, 0.7, 1.05][tid % 7]
    if status == 'TAMAMLANDI' and completed and completed != 'NULL':
        end = dt.datetime.fromisoformat(completed)
        start = walk_back(end, int(est * factor))
        sql.append(f"insert into task_work_sessions (task_id, user_id, started_at, ended_at) values ({tid}, {uid}, '{start}', '{end}');")
    elif status == 'DEVAM':
        start = walk_back(now, int(est * [0.3, 0.5, 0.65, 0.85, 1.2][tid % 5]))
        sql.append(f"update task_work_sessions set started_at = '{start}' where task_id = {tid} and ended_at is null;")
q('\n'.join(sql))
print(len(rows), 'görev güncellendi')
print(q("select status, count(*), round(avg(estimated_minutes)/60,1) from tasks group by status;"))
print(q("select count(*), sum(ended_at is null) from task_work_sessions;"))
