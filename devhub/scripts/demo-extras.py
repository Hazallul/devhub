"""Yeni modüller için örnek veri: departmanlar, etiketler, alt görevler, bağımlılıklar, atanmamış görevler,
şirket içi destek talepleri ve anketler. demo-data.sql ve demo-effort.py'den sonra çalıştırılır.
Her bölüm yalnızca o veri henüz yoksa eklenir; tekrar çalıştırmak bir şeyi çoğaltmaz."""
import subprocess, datetime as dt, random

random.seed(7)
IST = dt.timezone(dt.timedelta(hours=3))  # Türkiye yaz saati uygulamaz
UTC = dt.timezone.utc
PERIODS = [(dt.time(9), dt.time(12)), (dt.time(13), dt.time(18))]
NOW = dt.datetime.now(UTC).replace(microsecond=0, tzinfo=None)  # sunucu UTC saklar
ADMIN = 1


def q(sql):
    res = subprocess.run(['docker', 'exec', '-i', 'devhub-mysql', 'mysql', '-uroot', '-proot', '-N', '--default-character-set=utf8mb4', 'devhub'],
                         input=sql.encode(), capture_output=True)
    if res.returncode:
        raise SystemExit(res.stderr.decode())
    return [line.split('\t') for line in res.stdout.decode().strip().splitlines() if line]


def s(v):
    """SQL değeri: None → NULL, sayı olduğu gibi, metin tırnaklı."""
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return "b'1'" if v else "b'0'"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dt.datetime, dt.date)):
        return f"'{v:%Y-%m-%d %H:%M:%S}'" if isinstance(v, dt.datetime) else f"'{v.isoformat()}'"
    return "'" + str(v).replace('\\', '\\\\').replace("'", "''") + "'"


def count(sql):
    return int(q(sql)[0][0])


holidays = {r[0] for r in q('select date from holidays;')}


def add_work(start_utc, hours):
    """Mesai saatlerinde 'hours' saat sonrası (WorkTimeService.addWorkSeconds'ın basit karşılığı)."""
    cur = start_utc.replace(tzinfo=UTC).astimezone(IST)
    need = dt.timedelta(hours=hours)
    while True:
        d = cur.date()
        if d.weekday() < 5 and d.isoformat() not in holidays:
            for a, b in PERIODS:
                ps, pe = dt.datetime.combine(d, a, IST), dt.datetime.combine(d, b, IST)
                if cur >= pe:
                    continue
                begin = max(cur, ps)
                if begin + need <= pe:
                    return (begin + need).astimezone(UTC).replace(tzinfo=None)
                need -= pe - begin
                cur = pe
        cur = dt.datetime.combine(d + dt.timedelta(days=1), dt.time(0), IST)


users = {r[1]: int(r[0]) for r in q("select id, full_name from users where active = 1;")}
projects = {r[1]: int(r[0]) for r in q('select id, name from projects;')}
tasks = {r[1]: int(r[0]) for r in q('select id, content from tasks;')}


def task(prefix):
    return next((i for c, i in tasks.items() if c.startswith(prefix)), None)


# ------------------------------------------------------------------ departmanlar
DEPARTMENTS = {
    'Yazılım': ['Developer', 'Team Lead', 'UI/UX Designer', 'stajyer'],
    'Test': ['QA Engineer'],
    'Altyapı': ['DevOps Engineer'],
    'Ürün': ['Product Owner', 'Scrum Master'],
    'Veri': ['Data Analyst'],
}
for dep, titles in DEPARTMENTS.items():
    cond = ' or '.join(f"job_title like {s('%' + t + '%')}" for t in titles)
    q(f"update users set department = {s(dep)} where department is null and role = 'EMPLOYEE' and ({cond});")
print('Departmanlar:', ', '.join(f'{r[0]} {r[1]}' for r in q('select department, count(*) from users where department is not null group by department;')))

# ------------------------------------------------------------------ etiketler
if count('select count(*) from labels') == 0:
    for name, color in [('Hata', 'red'), ('Müşteri isteği', 'blue'), ('Performans', 'amber'), ('Güvenlik', 'violet'), ('Teknik borç', 'gray'), ('Tasarım', 'pink')]:
        q(f"insert into labels (name, color, created_by_id, created_at) values ({s(name)}, {s(color)}, {ADMIN}, {s(NOW)});")
    labels = {r[1]: int(r[0]) for r in q('select id, name from labels;')}
    for prefix, names in [('iOS 19 çökme', ['Hata']), ('Yavaş çalışan tüketim', ['Performans']), ('Auth servisinde', ['Güvenlik']),
                          ('Müşteri geri bildirimlerini', ['Müşteri isteği']), ('KPI kartlarını yeni', ['Tasarım']), ('Boş durum ve hata', ['Tasarım']),
                          ('KPI kartları için gerçek', ['Performans']), ('Filtre çubuğunu mobil', ['Tasarım', 'Hata']), ('Bildirim merkezi için', ['Teknik borç']),
                          ('Rapor tablolarında sıralama', ['Teknik borç', 'Müşteri isteği']), ('Ödeme ekranı için uçtan', ['Hata'])]:
        tid = task(prefix)
        for n in names if tid else []:
            q(f'insert ignore into task_labels (task_id, label_id) values ({tid}, {labels[n]});')
    print('Etiketler eklendi')

# ------------------------------------------------------------------ alt görevler
if count('select count(*) from task_subtasks') == 0:
    for prefix, steps in [
        ('Auth servisinde', [('Token yenileme uç noktası', True), ("Eski token'ları geçersiz kılma", True), ('Mobil istemci entegrasyonu', False), ('Birim testleri', False)]),
        ('KPI kartları için gerçek', [('Sunucu tarafı yayın kanalı', True), ('Yeniden bağlanma ve geri çekilme', False), ('KPI kartlarını bağla', False)]),
        ('Veri ambarı için CI/CD', [('Derleme adımı', True), ('Test adımı', True), ("Staging'e otomatik dağıtım", True), ('Geri alma senaryosu', False)]),
        ('Sprint 15 planlamasını', [("Backlog'u önceliklendir", True), ('Ekip kapasitesini hesapla', False), ('Sprint hedefini yaz', False)]),
    ]:
        tid = task(prefix)
        if not tid:
            continue
        owner = q(f'select user_id from tasks where id = {tid}')[0][0]
        for pos, (title, done) in enumerate(steps):
            q(f"insert into task_subtasks (task_id, title, done, position, done_by_id, done_at, created_at) values ({tid}, {s(title)}, {s(done)}, {pos}, "
              f"{owner if done else 'NULL'}, {s(NOW - dt.timedelta(hours=pos + 1)) if done else 'NULL'}, {s(NOW - dt.timedelta(days=2))});")
    print('Alt görevler eklendi')

# ------------------------------------------------------------------ bağımlılıklar
if count('select count(*) from task_dependencies') == 0:
    for waiting, blocker in [('Staging ortamında ilk veri', 'Eski raporlama tablolarının'), ('Veri kalitesi kontrolleri', 'Staging ortamında ilk veri'),
                             ('Rapor dışa aktarma', 'Yavaş çalışan tüketim')]:
        a, b = task(waiting), task(blocker)
        if a and b:
            q(f'insert into task_dependencies (task_id, blocked_by_id, created_by_id, created_at) values ({a}, {b}, {ADMIN}, {s(NOW - dt.timedelta(days=1))});')
    print('Bağımlılıklar eklendi')

# ------------------------------------------------------------------ atanmamış görevler
if count('select count(*) from tasks where user_id is null') == 0:
    for content, prio, minutes, project, days in [
        ('Bağımlılıklarda güvenlik açığı taraması yap', 'YUKSEK', 240, 'Devhub Core', 3),
        ('Müşteri Portalı giriş sayfası tasarımı', 'ORTA', 480, 'Müşteri Portalı', 8),
        ('Kod inceleme rehberini güncelle', 'DUSUK', 120, None, 12),
    ]:
        due = (NOW + dt.timedelta(days=days)).date()
        q(f"insert into tasks (user_id, content, created_at, status, priority, due_date, project_id, created_by_id, estimated_minutes) values "
          f"(NULL, {s(content)}, {s(NOW - dt.timedelta(hours=5))}, 'YAPILACAK', {s(prio)}, {s(due)}, {projects.get(project) if project else 'NULL'}, {ADMIN}, {minutes});")
    print('Atanmamış görevler eklendi')

# ------------------------------------------------------------------ şirket içi talepler
SLA = {'ACIL': 4, 'YUKSEK': 8, 'NORMAL': 24, 'DUSUK': 40}
if count("select count(*) from tickets where title like 'İkinci monitör%'") == 0:
    def ticket(title, desc, type_, prio, status, requester, assignee, ago_hours, events):
        created = NOW - dt.timedelta(hours=ago_hours)
        due = add_work(created, SLA[prio])
        resolved = NOW - dt.timedelta(hours=2) if status in ('COZULDU', 'KAPANDI') else None
        first = created + dt.timedelta(minutes=40) if status != 'YENI' else None
        q(f"insert into tickets (title, description, type, priority, status, assignee_id, requester_id, due_at, first_response_at, resolved_at, created_at, updated_at) values "
          f"({s(title)}, {s(desc)}, {s(type_)}, {s(prio)}, {s(status)}, {users[assignee] if assignee else 'NULL'}, {users[requester]}, {s(due)}, {s(first)}, {s(resolved)}, {s(created)}, {s(NOW)});")
        tid = int(q('select max(id) from tickets')[0][0])
        q(f"insert into ticket_activity (ticket_id, actor_id, kind, message, created_at) values ({tid}, {users[requester]}, 'EVENT', 'talebi açtı', {s(created)});")
        for minutes, actor, kind, msg in events:
            q(f"insert into ticket_activity (ticket_id, actor_id, kind, message, created_at) values ({tid}, {users[actor]}, {s(kind)}, {s(msg)}, {s(created + dt.timedelta(minutes=minutes))});")

    ticket('Laptop çok yavaş, derleme 10 dakikayı buluyor', 'Gradle derlemesi ve emülatör aynı anda açıkken bilgisayar donuyor. 16 GB bellek yetmiyor gibi.',
           'ARIZA', 'YUKSEK', 'INCELENIYOR', 'Ahmet Şahin', 'Mustafa Koç', 26,
           [(30, 'Admin', 'EVENT', 'talebi Mustafa Koç kişisine atadı'), (40, 'Mustafa Koç', 'EVENT', 'durumu değiştirdi: Yeni → İnceleniyor'),
            (55, 'Mustafa Koç', 'COMMENT', 'Bellek kullanımına baktım, yükseltme mümkün. Yarın 32 GB modülü takıyorum.')])
    ticket('Veri ambarı staging sunucusuna SSH erişimi', 'Staging üzerinde aktarım denemesini yapabilmem için okuma yetkili bir hesap gerekiyor.',
           'ERISIM', 'NORMAL', 'YENI', 'Merve Can', None, 3, [])
    ticket('İkinci monitör talebi', 'Rapor tasarımlarını incelerken tek ekran yetmiyor.',
           'EKIPMAN', 'DUSUK', 'YANIT_BEKLENIYOR', 'Elif Arslan', 'Admin', 30,
           [(20, 'Admin', 'EVENT', 'talebi üstlendi'), (25, 'Admin', 'COMMENT', '24 mü 27 inç mi tercih edersiniz? Masanızda yer var mı?'),
            (26, 'Admin', 'EVENT', 'durumu değiştirdi: Yeni → Yanıt bekleniyor')])
    ticket('Test için Android 15 cihaz', 'Regresyon testlerinde Android 15 davranışını gerçek cihazda görmemiz gerekiyor.',
           'EKIPMAN', 'NORMAL', 'COZULDU', 'Zeynep Öztürk', 'Admin', 50,
           [(15, 'Admin', 'EVENT', 'talebi üstlendi'), (300, 'Admin', 'COMMENT', 'Cihaz test dolabına kondu, anahtar Mustafa Bey\'de.'),
            (301, 'Admin', 'EVENT', 'durumu değiştirdi: İnceleniyor → Çözüldü')])
    ticket('Ödeme Altyapısı reposuna yazma yetkisi', 'Canlıdaki ödeme hatası için düzeltme göndermem gerekiyor, şu an yalnızca okuma yetkim var.',
           'ERISIM', 'ACIL', 'YENI', 'Can Doğan', None, 5, [])
    print('Talepler eklendi')

# ------------------------------------------------------------------ anketler
employees = [i for n, i in users.items() if i != ADMIN]


def survey(title, desc, state, anonymous, results_public, created_ago_days, closes_in_days, questions, responders, answer):
    created = NOW - dt.timedelta(days=created_ago_days)
    published = created + dt.timedelta(hours=1) if state != 'TASLAK' else None
    closes = NOW + dt.timedelta(days=closes_in_days) if closes_in_days is not None else None
    closed = closes if state == 'KAPALI' else None
    q(f"insert into surveys (title, description, state, anonymous, results_public, audience_type, closes_at, created_by_id, created_at, published_at, closed_at) values "
      f"({s(title)}, {s(desc)}, {s(state)}, {s(anonymous)}, {s(results_public)}, 'HERKES', {s(closes)}, {ADMIN}, {s(created)}, {s(published)}, {s(closed)});")
    sid = int(q('select max(id) from surveys')[0][0])
    qids = []
    for pos, (type_, text, required, options) in enumerate(questions):
        q(f"insert into survey_questions (survey_id, position, type, text, required, options) values ({sid}, {pos}, {s(type_)}, {s(text)}, {s(required)}, {s(chr(10).join(options) if options else None)});")
        qids.append(int(q('select max(id) from survey_questions')[0][0]))
    if state == 'TASLAK':
        return
    for uid in employees:
        q(f"insert into survey_recipients (survey_id, user_id, responded) values ({sid}, {uid}, {s(uid in responders)});")
    for uid in responders:
        when = published + dt.timedelta(hours=random.randint(1, 30))
        submitted = dt.datetime.combine(when.date(), dt.time(0)) if anonymous else when  # anonimde yalnızca gün tutulur
        q(f"insert into survey_responses (survey_id, user_id, submitted_at) values ({sid}, {'NULL' if anonymous else uid}, {s(submitted)});")
        rid = int(q('select max(id) from survey_responses')[0][0])
        for (type_, _, _, options), qid in zip(questions, qids):
            choices, rating, text = answer(type_, options)
            if choices is None and rating is None and text is None:
                continue
            q(f"insert into survey_answers (response_id, question_id, choices, rating, text_value) values ({rid}, {qid}, {s(choices)}, {s(rating)}, {s(text)});")


def pick(type_, options, weights=None):
    if type_ == 'PUAN':
        return None, random.choices([2, 3, 4, 5], [1, 3, 6, 4])[0], None
    if type_ == 'TEK_SECIM':
        return str(random.choices(range(len(options)), weights or None)[0]), None, None
    if type_ == 'COKLU_SECIM':
        return ','.join(str(i) for i in sorted(random.sample(range(len(options)), random.randint(1, min(3, len(options)))))), None, None
    return None, None, None


COMMENTS = ['Öğleden sonra toplantı odaları hep dolu, bir oda daha olsa iyi olur.', 'Klimalar çok soğuk, ayarlanabilir olsun.',
            'Mutfakta kahve makinesi sık bozuluyor.', 'Sessiz çalışma alanı ayrılabilir mi?']

if count("select count(*) from surveys where title = 'Ofis ve ekipman memnuniyeti'") == 0:
    open_responders = random.sample(employees, k=round(len(employees) * 0.6))
    comments = iter(COMMENTS)
    survey('Ofis ve ekipman memnuniyeti', 'Çalışma ortamını iyileştirmek için görüşlerinizi alıyoruz. Yanıtlar anonimdir; kimin ne yazdığı görünmez.',
           'ACIK', True, True, 2, 5, [
               ('PUAN', 'Çalışma ortamından genel olarak ne kadar memnunsunuz?', True, None),
               ('TEK_SECIM', 'Bilgisayarınız işinizi yetiştirmenize yetiyor mu?', True, ['Evet, rahatlıkla', 'Çoğu zaman', 'Hayır, beni yavaşlatıyor']),
               ('COKLU_SECIM', 'Hangi ekipmanlar işinizi kolaylaştırır?', True, ['İkinci monitör', 'Ergonomik sandalye', 'Gürültü engelleyici kulaklık', 'Daha güçlü bilgisayar', 'Ayarlanabilir masa']),
               ('METIN', 'Eklemek istedikleriniz', False, None),
           ], open_responders,
           lambda t, o: (None, None, next(comments, None)) if t == 'METIN' else pick(t, o, [5, 4, 2] if t == 'TEK_SECIM' else None))
    print('Açık anket eklendi')

if count("select count(*) from surveys where title = 'Uzaktan çalışma günleri'") == 0:
    survey('Uzaktan çalışma günleri', 'Yeni dönem çalışma düzenini birlikte belirleyelim.', 'KAPALI', False, True, 20, -10, [
        ('TEK_SECIM', 'Haftada kaç gün uzaktan çalışmak istersiniz?', True, ['Hiç', '1 gün', '2 gün', '3 gün', 'Tamamen uzaktan']),
        ('COKLU_SECIM', 'Hangi günler ofiste olmayı tercih edersiniz?', True, ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma']),
        ('PUAN', 'Şu anki hibrit düzenden memnuniyetiniz', True, None),
    ], employees[:-3], lambda t, o: pick(t, o, [1, 3, 8, 5, 2] if t == 'TEK_SECIM' else None))
    print('Kapanmış anket eklendi')

if count("select count(*) from surveys where title = 'Eğitim ihtiyaç analizi'") == 0:
    survey('Eğitim ihtiyaç analizi', 'Önümüzdeki çeyrekte hangi eğitimlere öncelik verelim?', 'TASLAK', False, False, 0, 14, [
        ('COKLU_SECIM', 'Hangi konularda eğitim almak istersiniz?', True, ['Kubernetes', 'Güvenli kodlama', 'Test otomasyonu', 'Sunum ve iletişim', 'Veri modelleme']),
        ('METIN', 'Önerdiğiniz bir kurs ya da eğitmen var mı?', False, None),
    ], [], None)
    print('Taslak anket eklendi')
print('Tamam.')
