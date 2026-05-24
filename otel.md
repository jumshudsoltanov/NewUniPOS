1. Admin Panelə Əlavə Olunmalı Funksiyalar (Arxa Fon)
Admin panel otelin idarəetmə mərkəzi (PMS - Property Management System) rolunu oynamalıdır.

Otaqların İdarə Edilməsi (Room Management):

Otaq növlərinin (Single, Double, Suite) və tariflərinin (gözləmə, gecələmə, mövsümi qiymətlər) təyin edilməsi.

Otaq statuslarının idarəsi: Boş, Dolu, Təmizlənir (Housekeeping), Təmirdə.

Rezervasiya Modulu (Booking & Check-in/Check-out):

Qonaqların qeydiyyatı (Ad, soyad, pasport məlumatları, əlaqə).

Giriş (Check-in) və Çıxış (Check-out) tarixlərinin təqvimi.

Qonaq Folio (Hesap Faktura) Sistemi:

Hər bir otaq üçün ayrıca bir "balans" və ya "hesat vərəqi" (Folio) yaradılmalıdır.

Qonağın oteldə etdiyi bütün xərclər (otaq pulu, mini-bar, restoran, camaşırxana) avtomatik bu hesaba yazılmalıdır.

Housekeeping (Təmizlik) Paneli:

Xadimələr üçün otaqların təmizlik statusunu dəyişmək imkanı (məsələn, POS-da otaq boşaldıqda admin paneldə otaq avtomatik "Təmizlənməlidir" statusuna düşsün).

2. Restoran POS Ekranına Əlavə Olunmalı Funksiyalar (Ön Sifariş)
POS ekranında əsas dəyişiklik ödəniş metodları və masa təyinatı hissəsində olacaq.

"Otağa Yaz" (Charge to Room) Ödəniş Metodu:

Masa hesabı bağlanarkən Nağd/Kart/Nisyə ilə yanaşı "Otağa Yaz" düyməsi olmalıdır.

Bu düymə sıxıldıqda POS ekranında aktiv (Check-in olunmuş) otaqların siyahısı və qonağın adı çıxmalıdır (məsələn: Otaq 104 - Cümşüd S.).

Seçim edildikdə restoran hesabı sıfırlanır, lakin məbləğ həmin otağın admin paneldəki "Folio" hesabına borc olaraq əlavə edilir.

Mini-Bar İdarəetməsi:

POS interfeysində "Mini-bar" adlı xüsusi bir bölmə yaradıla bilər. Otaqdan hər hansı bir məhsul istifadə edildikdə, admin və ya xidmətçi POS-dan birbaşa otağı seçib mini-bar məhsullarını hesaba vura bilsin.

Otağa Servis (Room Service):

Sifariş növü seçilərkən (Masa, Paket) yanına "Otağa Servis" seçimi əlavə edilməlidir. Burada sifariş birbaşa masa nömrəsinə yox, otaq nömrəsinə bağlanır.

3. Texniki Arxitektura və Verilənlər Bazası (DB) üçün Təkliflər
Əgər sistemi özün yığırsansa (məsələn, Node.js, PHP və ya C# ilə), verilənlər bazasında növbəti addımları atmalısan:

Yeni Cədvəllər (Tables):

rooms (id, room_number, type, status, price)

bookings (id, guest_name, guest_details, check_in_date, check_out_date, status)

room_folios (id, booking_id, total_amount, paid_amount, status)

Restoran orders cədvəlinə əlaqə (Foreign Key):

orders cədvəlinə room_id və payment_type (e.g., 'cash', 'card', 'room') sütunları əlavə etməlisən. Əgər payment_type = 'room' olarsa, sifarişin məbləği SQL Trigger və ya API daxilində room_folios cədvəlindəki müvafiq booking_id-nin balansına INSERT və ya UPDATE olunmalıdır.