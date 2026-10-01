-- Menüdeki "Ekip" sayfasının adı "Çalışanlar" oldu (proje ekipleriyle karışıyordu); başlangıç adımındaki metin de güncellenir.
UPDATE onboarding_steps
SET title = 'Çalışanları tanı',
    description = 'Çalışanlar sayfasında kimin hangi projede çalıştığına bak.'
WHERE link = '/team' AND title = 'Ekibini tanı';
