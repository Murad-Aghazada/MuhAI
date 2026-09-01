# TEKNOFEST 2026 — Finansal Teknolojiler Yarışması
## Muhai — Yapay Zekâ Muhasebecisi & KOBİ Finans İşletim Sistemi
### Sözlü Sunum Konuşma Metni

**Takım Adı:** Nasimi BHOS · **Takım ID:** 821808 · **Başvuru ID:** 4579275
**Okul:** Bakü Yüksek Petrol Okulu (Baku Higher Oil School)

**Toplam süre:** 10 dakika sunum + 5 dakika soru-cevap
**Slayt sayısı:** 15 (kapak dahil)
**Yaklaşık kelime sayısı:** ~1.400 kelime (ortalama konuşma hızında 10 dakikaya denk gelecek şekilde hesaplanmıştır)

---

## BÖLÜM A — SLAYT SLAYT KONUŞMA METNİ

---

### Slayt 1 — Kapak / Giriş
**[0 dk 20 sn]**

Sayın jüri üyeleri, değerli TEKNOFEST temsilcileri, hepinizi saygıyla selamlıyorum. Nasimi BHOS takımı olarak Bakü Yüksek Petrol Okulu'ndan geliyoruz ve bugün Finansal Teknolojiler kategorisinde geliştirdiğimiz projemizi sunacağız: Muhai — Yapay Zekâ Muhasebecisi ve KOBİ Finans İşletim Sistemi. İzninizle, çözmeye çalıştığımız problemle başlayalım.

---

### Slayt 2 — Problem I: KOBİ'lerin Ağırlığı ve Maliyet Yükü
**[0 dk 40 sn]**

Türkiye ekonomisinde 3 milyon 710 bin KOBİ bulunuyor; bu rakam tüm işletmelerin yüzde 99,7'sine ve toplam istihdamın yüzde 70,5'ine karşılık geliyor — yani ekonominin gerçek bel kemiği bu işletmeler. Ama muhasebe hizmeti hâlâ elle ve pahalı bir şekilde yürütülüyor. Bugün bir limited ya da anonim şirket, dışarıdan muhasebeci için ayda 3 bin ile 6 bin lira arasında ödeme yapıyor; şahıs şirketleri için bu rakam 1500 ile 2500 lira arasında. Muhai ile bu maliyeti aylık 299 ile 999 liraya indiriyoruz — yani yaklaşık yüzde 90'a varan bir tasarruf sağlıyoruz.

---

### Slayt 3 — Problem II: Parçalı Dijitalleşme ve Bağımlılık
**[0 dk 45 sn]**

Peki bu maliyetin arkasında ne var? KOBİ'lerin yüzde 93'ü zaten dijital bir araç kullanıyor, ama yalnızca yüzde 24'ü bulut, yüzde 22'si ise ERP çözümünden faydalanabiliyor — dijitalleşme var, fakat parçalı. Üç temel sorun öne çıkıyor: milyonlarca mikro işletme uygun fiyatlı, Türkçe bir finans aracına erişemiyor; KDV, e-fatura ve SGK bildirimleri hâlâ elle giriliyor ve bu da hatalara, kaybedilen KDV'ye yol açıyor; yoğun iş temposunda vergi ve SGK son ödeme tarihleri kaçırılıyor, bu da cezalara ve gecikme faizine neden oluyor. Sonuç olarak muhasebe, finans ve belge yönetimi birbirinden kopuk yürüyor, işletme sahibi tamamen muhasebeciye bağımlı kalıyor ve kararlar yavaşlıyor. İşte tam bu noktada Muhai devreye giriyor.

---

### Slayt 4 — Çözüm I: Altı Temel Modül
**[0 dk 55 sn]**

Muhai, işletme sahibini finansının içine çeken, aynı zamanda muhasebecinin iş yükünü azaltan tek bir sistem sunuyor — her iki taraf için de kazan-kazan bir model. Altı temel modülümüz var. Fatura OCR: bir fişin fotoğrafını çekmeniz yeterli, Türkçeye göre ayarlanmış motorumuz satıcıyı, vergi kimlik numarasını, tarihi ve KDV'yi otomatik okuyor. Vergi ve e-Beyanname: KDV, stopaj ve gelir vergisini 2026 kurallarına göre hesaplayıp GİB e-Belge gönderimine hazırlıyor. Nakit Akışı Tahmini: güven aralıklı 30 günlük bir projeksiyonla paranız tükenmeden sizi uyarıyor. Akıllı Stok: tükenme hızını izleyip yeniden sipariş uyarısı veriyor. Bordro ve SGK: brütten nete hesaplamaları ve SGK bildirgelerini otomatik oluşturuyor. Ve Türkçe Yapay Zekâ Asistanımız, "Ne kadar KDV borcum var?" gibi soruları saniyeler içinde, mevzuata uygun şekilde yanıtlıyor.

---

### Slayt 5 — Çözüm II: Canlı Demo
**[0 dk 50 sn]**

Bu modüllerin pratikte nasıl çalıştığını şimdi gösterelim. Fatura OCR motorumuz şu anda yüzde 98,6 doğrulukla çalışıyor; bir fatura fotoğrafı yüklediğinizde tedarikçi bilgisi, vergi kimlik numarası ve tutarlar saniyeler içinde çıkarılıyor. Vergi ve e-Beyanname ekranında bu dönemin KDV'si, stopajı ve beyan takvimi tek bakışta görülüyor. Çalışan bir prototipimizi de hazırladık; demo videomuzun bağlantısını sunum içinde paylaştık, dilerseniz sunum sonrasında incelemenizi rica ederiz.

---

### Slayt 6 — Kullanılacak Yöntem I: Sistem Mimarisi
**[0 dk 50 sn]**

Şimdi bu çözümün arkasındaki teknik mimariye geçelim. Muhai, modern ve üretim seviyesinde bir teknoloji yığını üzerine kurulu. Ön yüzde Expo, React Native ve TypeScript kullanıyoruz; tek kod tabanıyla hem Android hem iOS'ta çalışıyoruz. Arka uçta Python 3.11, FastAPI ve Celery ile asenkron ve ölçeklenebilir bir REST API sunuyoruz. Yapay zekâ motorumuzda Tesseract 5 fatura OCR'ı için, Prophet nakit akışı tahmini için, Google Gemini ise Türkçe asistanımız için çalışıyor. Veri tarafında PostgreSQL 15 ana depomuz, Redis 7 önbelleğimiz; her şey Docker Compose ile konteynerleştirildi. En kritik nokta şu: sistemimiz GİB e-Belge, SGK e-Bildirge ve banka API'lerine doğrudan bağlanacak şekilde, mevzuata tam uyumlu olarak tasarlandı.

---

### Slayt 7 — Kullanılacak Yöntem II: Üç Ana Yöntem
**[1 dk 00 sn]**

Bu mimariyi üç ana yöntem başlığında biraz daha derinleştirelim. Birincisi Fatura OCR hattı: Türkçe dil paketli Tesseract 5, LSTM tabanlı bir modelle fatura görüntüsünü okuyor; kural tabanlı ayrıştırıcımız vergi kimlik numarasını, KDV oranını ve tutarı çıkarıyor. Güven skoru 0,7'nin üzerindeyse alanı otomatik dolduruyoruz, altındaysa kullanıcıya tek dokunuşla inceleme için işaretliyoruz. İkincisi Nakit Akışı Tahmini: Prophet algoritmasıyla yaklaşık 90 günlük geçmiş veriyi trend ve mevsimsellik olarak ayrıştırıp, belirsizlik aralığıyla birlikte önümüzdeki 30 günü öngörüyoruz; veri azsa hafif bir regresyon modeli devreye giriyor. Üçüncüsü Türkçe Yapay Zekâ Asistanımız: Google Gemini'yi bir "Türk-CFO" sistem komutuyla çalıştırıp kullanıcının canlı verilerini bağlama ekliyoruz; internet olmadığında ise deterministik bir anahtar kelime motoru devreye girip asistanın çevrimdışı da çalışmasını sağlıyor.

---

### Slayt 8 — Kullanılacak Yöntem III: Uçtan Uca Veri Akışı
**[0 dk 45 sn]**

Peki tüm bu bileşenler pratikte nasıl bir araya geliyor? Fatura görüntüsü, işletme verisi ya da Türkçe bir soru önce OCR ve ayrıştırma katmanından geçiyor. Ardından Firebase tabanlı bilgi tabanından, RAG yöntemiyle vergi ve SGK mevzuatına dair en ilgili belgeler çekiliyor. Bu bağlam Gemini 2.5 Flash ve Prophet motoruna aktarılıp kullanıcının canlı işletme verisiyle zenginleştiriliyor. Çıktı olarak kaynağı gösterilen, mevzuata uygun bir Türkçe yanıt, kayda hazır yapılandırılmış fatura verisi ve nakit tükenmeden önce uyaran projeksiyonlar üretiliyor. Gizlilik açısından da OCR işlemi cihaz üzerinde çalışıyor.

---

### Slayt 9 — Rakip Analizi
**[0 dk 40 sn]**

Şimdi Muhai'yi pazardaki mevcut alternatiflerle karşılaştıralım. Piyasada dört ana alternatif var: Paraşüt ve Bizmu gibi yerel bulut uygulamaları, Logo ve Mikro gibi eski masaüstü yazılımları, QuickBooks ve Xero gibi küresel araçlar, ve dışarıdan muhasebeci tutmak. GİB e-Belge entegrasyonunu çoğu sunuyor; ama Türkçeye özel fatura OCR'ını, yapay zekâ destekli nakit akışı tahminini ve RAG tabanlı Türkçe asistanı bir arada sunan tek çözüm Muhai. Giriş fiyatımız ayda 299 lira; en yakın rakibin çok altında, muhasebeci tutmanın ise onda birinden daha ucuz.

---

### Slayt 10 — Pazar Büyüklüğü
**[0 dk 40 sn]**

Peki bu farkın hedeflediği pazar ne büyüklükte? Pazar büyüklüğümüzü aşağıdan yukarıya, resmi TÜİK verileriyle hesapladık. Toplam pazarımız, yani TAM, Türkiye'deki 3,8 milyon KOBİ'nin yıllık 9 bin liralık harcamasıyla 34,2 milyar lira. Ulaşılabilir pazarımız, yani SAM, e-fatura ve e-arşiv kullanan, dijital muhasebeye ihtiyaç duyan 1,4 milyon işletmeyle 12,6 milyar lira. Hizmet verebileceğimiz elde edilebilir pazar, yani SOM ise, genç SMMM portföyündeki dijital odaklı işletmeler ve teknoloji meraklısı girişimlerden oluşan 60 bin işletmeyle 540 milyon lira olarak öngörülüyor.

---

### Slayt 11 — İş Modeli
**[0 dk 50 sn]**

Bu büyüklükteki bir pazarda gelir modelimizi nasıl kurguladığımızı anlatalım. İş modelimiz yüksek kâr marjlı bir SaaS abonelik sistemi; işletmeyle birlikte büyüyen üç katmanımız var. Başlangıç planı ayda 299 lira; fatura tarama ve temel gider takibi sunuyor, mikro işletmeler ve serbest çalışanlar için. Pro plan ayda 599 lira; yapay zekâ destekli nakit akışı tahmini ve Muhai Skoru içeriyor, büyüyen KOBİ'ler için. İşletme planı ayda 999 lira; çoklu kullanıcı desteği ve tam muhasebe entegrasyonu sunuyor, yerleşik firmalar için. Gelirimizi uygulama mağazası ve dijital pazarlama yanında, muhasebeciler, KOSGEB ve TOBB gibi kanal ortaklıkları üzerinden büyütüyoruz.

---

### Slayt 12 — Risk Analizi
**[0 dk 40 sn]**

Her büyüme hikâyesinin riskleri vardır; bizim risk yönetimimize kısaca değinelim. Mevzuat değişikliğine karşı modüler mikroservis mimarimizle güncellemeleri anlık olarak dağıtıyoruz. Düşük kaliteli taramalarda oluşan OCR hatalarına karşı güven eşiği algoritmamız ve SMMM onay panelimiz var. En yüksek etkili risk olan veri güvenliği ve KVKK uyumu için verileri AES-256 ile şifreliyor, yerli veri merkezlerinde barındırıp düzenli sızma testleri yapıyoruz. Yapay zekânın yanlış bilgi üretme riskine karşı da RAG teknolojisiyle yanıtlarımızı yalnızca doğrulanmış mevzuat ve şirket verisine dayandırıyoruz.

---

### Slayt 13 — Proje Takvimi
**[0 dk 25 sn]**

Son olarak projemizin zaman çizelgesine bakalım. 13 servisten oluşan altyapımız hâlihazırda geliştirildi ve test edildi. Nisan-Mayıs döneminde mimari ve OCR geliştirmeyi tamamladık; yüzde 92 üzerinde doğrulukla çalışan bir prototipimiz var. Haziran-Temmuz'da nakit akışı modelini doğrulayıp ilk MVP'mizi tamamladık. Ağustos-Eylül'de saha testleri yapıyoruz; Ekim'de ise güvenlik testleri ve final teslimatıyla süreci tamamlayacağız.

---

### Slayt 14 — Takım
**[0 dk 25 sn]**

Bu projeyi hayata geçiren ekibimizi tanıtalım. Takım danışmanımız Emiliya Ahmedova; takım kaptanımız Uğur Kambarov proje yönetimi ile UX/UI tasarımından sorumlu. Vusal Huseynov, Django tabanlı backend'i ve GİB/SGK API entegrasyonlarını geliştiriyor. Emin Baxishli, OCR modelimizi, Prophet tabanlı tahminlemeyi ve RAG chatbot'umuzu kuruyor, aynı zamanda sistem güvenliğinden sorumlu. Murad Agayev ise pazar araştırması, gelir modeli, rakip analizi ve veri şifreleme konularında çalışıyor. Hepimiz Bakü Yüksek Petrol Okulu öğrencisiyiz.

---

### Slayt 15 — Teşekkürler
**[0 dk 15 sn]**

Sunumumuzu toparlayacak olursak: Muhai ile diyoruz ki, rakamları Muhai'ye bırakın, finansı Muhai'ye bırakın. Bizi dinlediğiniz için çok teşekkür ederiz; sorularınızı memnuniyetle bekliyoruz.

---
---

## BÖLÜM B — OLASI SORULAR VE CEVAPLAR (5 Dakikalık Soru-Cevap İçin Hazırlık)

### 1. Backend Mimarisi

**S1: Backend'inizi hangi teknolojilerle kurdunuz?**
Kısa cevap: Çekirdek dilimiz Python 3.11; API katmanında FastAPI, ORM olarak SQLAlchemy 2, veri doğrulama için Pydantic v2 ve arka plan işleri için Celery kullanıyoruz.
Detay: FastAPI'yi tercih etmemizin nedeni asenkron çalışabilmesi ve otomatik API dokümantasyonu üretmesi; bu, GİB ve SGK gibi dış servislerle çok sayıda eş zamanlı istek yapılırken performans kaybını önlüyor. Celery, fatura OCR gibi zaman alan işlemleri arka planda kuyruğa alarak kullanıcı arayüzünün donmasını engelliyor.

**S2: Veritabanı olarak neden PostgreSQL'i seçtiniz?**
Kısa cevap: PostgreSQL 15'i ana depo, Redis 7'yi ise önbellek ve mesaj aracısı olarak kullanıyoruz.
Detay: PostgreSQL'in ilişkisel bütünlüğü ve JSON alan desteği, hem yapılandırılmış muhasebe verisini hem de OCR'dan gelen yarı yapılandırılmış fatura verisini aynı sistemde tutmamıza imkân veriyor. Redis ise sık sorgulanan verileri (örneğin güncel döviz kuru veya vergi oranları) önbelleğe alarak yanıt sürelerini kısaltıyor.

**S3: GİB ve SGK API entegrasyonu teknik olarak nasıl işliyor?**
Kısa cevap: Sistemimiz, GİB e-Belge (e-Fatura/e-Arşiv) ve SGK e-Bildirge servislerine doğrudan bağlanacak konektörlerle tasarlandı; her konektör bağımsız bir mikroservis olarak çalışıyor.
Detay: Mevzuat sık değiştiği için bu bağlayıcıları ana iş mantığından ayırdık; bir kural değiştiğinde yalnızca ilgili mikroservisi güncelliyoruz, tüm sistemi yeniden dağıtmamıza gerek kalmıyor. Bu, "Tasarım ilkeleri" bölümünde belirttiğimiz saf, yan etkisiz servis mimarisinin doğrudan bir sonucu.

**S4: Sistem neden Docker ve Docker Compose ile paketlendi?**
Kısa cevap: Dört servisli yığınımızı (API, veritabanı, önbellek, arka plan işçisi) tutarlı ve taşınabilir şekilde çalıştırmak için.
Detay: Konteynerleştirme, geliştirme ortamı ile üretim ortamı arasındaki farkları ortadan kaldırıyor ve ileride Kubernetes gibi bir orkestrasyon katmanına geçişi kolaylaştırıyor.

---

### 2. Yapay Zekâ / Makine Öğrenmesi Modeli

**S5: Fatura okuma için hangi model/algoritma kullanıldı, neden bu seçildi?**
Kısa cevap: Tesseract 5, LSTM tabanlı OCR motorunu Türkçe dil paketiyle kullanıyoruz; üzerine kural tabanlı bir ayrıştırıcı ekledik.
Detay: Tesseract'ı seçmemizin nedeni açık kaynak olması, Türkçe karakterleri (ç, ğ, ı, ö, ş, ü) desteklemesi ve cihaz üzerinde (on-device) çalışabilmesi; bu da hem maliyet hem gizlilik açısından avantaj sağlıyor. Motor değiştirilebilir şekilde tasarlandı; ileride ince ayarlı bir CNN ya da bulut tabanlı görü modeli aynı arayüzle (OcrEngine sözleşmesiyle) sisteme eklenebilir.

**S6: Nakit akışı tahmininde neden Prophet tercih edildi?**
Kısa cevap: Facebook'un geliştirdiği Prophet, zaman serisi verisini trend ve mevsimsellik bileşenlerine ayırarak güven aralıklı tahmin üretebiliyor.
Detay: KOBİ'lerin nakit akışı genellikle mevsimsel dalgalanmalar gösteriyor (örneğin vergi dönemleri, sezonluk satışlar); Prophet bu örüntüleri az veriyle bile yakalayabiliyor. Veri 10 noktanın altındaysa, güvenilirliği artırmak için hafif bir EKK/OLS regresyon modeline geçiyoruz.

**S7: Yapay zekâ asistanınız hangi modeli kullanıyor ve RAG nasıl çalışıyor?**
Kısa cevap: Google Gemini 2.5 Flash modelini bir "Türk-CFO" sistem komutuyla çalıştırıyoruz; RAG (Retrieval-Augmented Generation) ile yanıtları Firebase tabanlı bir bilgi tabanından çektiğimiz vergi ve SGK mevzuatı belgeleriyle destekliyoruz.
Detay: Kullanıcının sorusu önce Türkçe bir tokenizer ile işleniyor, ardından bilgi tabanından en ilgili üç belge getiriliyor. Bu belgeler, kullanıcının canlı işletme verisiyle (gelir, ödenecek KDV, Muhai Skoru) birlikte modele bağlam olarak veriliyor. Bu sayede model kendi başına "uydurmak" yerine, gerçek ve güncel verilere dayanarak yanıt üretiyor.

**S8: Modelin eğitim süreci nasıl işledi, hangi veri seti kullanıldı?**
Kısa cevap: OCR tarafında 10.000'in üzerinde sektörel fatura ve fiş verisi topladık, etiketledik ve modeli bu veriyle ince ayara tabi tuttuk; GİB mevzuatını analiz ederek kural tabanlı ayrıştırıcımızı bu verilerle doğruladık.
Detay: Gemini ve Prophet gibi bileşenler önceden eğitilmiş modeller olduğu için bizim asıl emeğimiz veri hazırlığı, alan adaptasyonu (domain adaptation) ve doğrulama sürecinde yoğunlaştı. Nisan-Mayıs döneminde topladığımız veri seti "Muhai Veri Seti" olarak dokümante edildi ve teknik dökümanımızda yer alıyor.

**S9: Doğruluk oranınız ve diğer metrikleriniz nedir?**
Kısa cevap: Fatura OCR hattımız şu anda yüzde 98,6 doğruluk oranıyla çalışıyor; alan bazında güven skoru 0,7 eşiğinin altındaki alanlar otomatik olarak kullanıcı incelemesine işaretleniyor.
Detay: Bu, tam otomasyon ile insan denetimi arasında bir denge kuruyor — düşük güvenli alanlar asla sessizce yanlış kaydedilmiyor, SMMM onay paneline düşüyor. Nakit akışı tahmininde ise Prophet'in ürettiği belirsizlik aralığını (confidence interval) kullanıcıya doğrudan gösteriyoruz, böylece tahminin kesinliği şeffaf kalıyor.

**S10: Modelin sınırlamaları neler?**
Kısa cevap: OCR, çok düşük kaliteli ya da el yazısı içeren görüntülerde hata payı artırabiliyor; nakit akışı tahmini de yalnızca geçmiş örüntülere dayandığı için ani, öngörülemeyen olaylarda (örneğin beklenmedik büyük bir sözleşme) sapabiliyor.
Detay: Bu sınırlamaları azaltmak için güven eşiği mekanizması ve SMMM onay paneli gibi insan-döngüde (human-in-the-loop) kontrol noktaları ekledik. Ayrıca yapay zekâ asistanımızın yanıtları her zaman kaynak göstererek geliyor, böylece kullanıcı yanıtı doğrulayabiliyor.

---

### 3. Ölçeklenebilirlik, Güvenlik, Gerçek Zamanlı Performans ve Arayüz

**S11: Sisteminiz büyüdükçe ne kadar ölçeklenebilir?**
Kısa cevap: Mikroservis mimarimiz ve konteynerleştirilmiş yapımız sayesinde her bileşeni (OCR, tahmin motoru, API) bağımsız olarak yatay şekilde ölçeklendirebiliyoruz.
Detay: FastAPI'nin asenkron yapısı ve Redis önbelleği, artan kullanıcı sayısında da yanıt sürelerini düşük tutuyor. İleride kullanıcı sayısı arttıkça, Docker Compose yapımızı Kubernetes gibi bir orkestrasyon katmanına taşımayı planlıyoruz.

**S12: Veri güvenliği ve KVKK uyumu için hangi önlemleri aldınız?**
Kısa cevap: Verileri AES-256 ile şifreliyoruz, yerli Tier-3 veri merkezlerinde barındırıyoruz ve düzenli sızma testleri (pentest) yapıyoruz.
Detay: Ayrıca OCR işlemi mümkün olduğunca cihaz üzerinde (on-device) çalışıyor; bu, hassas fatura görüntülerinin gereksiz yere sunucuya taşınmasını önlüyor. KVKK kapsamında kullanıcı verisi yalnızca hizmetin gerektirdiği ölçüde işleniyor ve erişim yetkilendirmesi katmanlı şekilde uygulanıyor.

**S13: Gerçek zamanlı performansı nasıl sağlıyorsunuz?**
Kısa cevap: Zaman alan işlemleri (OCR, tahminleme) Celery ile arka planda kuyruğa alıyoruz; kullanıcı arayüzü bu sırada donmuyor, sonuç hazır olduğunda bildirim alıyor.
Detay: Redis önbelleği sık erişilen verileri (örneğin güncel vergi oranları) bellekte tutarak veritabanına gereksiz yük binmesini engelliyor; bu da API yanıt sürelerini önemli ölçüde kısaltıyor.

**S14: Neden mobil öncelikli bir tasarım tercih ettiniz?**
Kısa cevap: Hedef kitlemiz olan mikro işletmeler ve KOBİ sahipleri günlük işlerinde masaüstü yerine telefonlarını kullanıyor; bu yüzden Expo ve React Native ile mobil öncelikli bir deneyim kurduk.
Detay: Rakip analizimizde de gördüğümüz gibi, eski masaüstü çözümleri mobil deneyim sunmuyor; biz ise "bir fişin fotoğrafını çekmek" gibi basit ve hızlı etkileşimleri merkeze alarak kullanım kolaylığını önceliklendirdik.

---

### 4. Projenin Özgünlüğü ve Gelecek Planları

**S15: Projenizin benzer çözümlerden farkı ne?**
Kısa cevap: Muhai, Türkçeye özel fatura OCR'ını, yapay zekâ destekli nakit akışı tahminini ve RAG tabanlı Türkçe bir yapay zekâ asistanını tek bir mobil öncelikli uygulamada, mikro işletme bütçesine uygun bir fiyatla birleştiren tek çözüm.
Detay: Yerel bulut uygulamaları (Paraşüt, Bizmu) ve küresel araçlar (QuickBooks, Xero) bu üç yeteneği bir arada sunmuyor; eski masaüstü yazılımları ise yapay zekâ özelliklerinden tamamen yoksun. Muhasebeci tutmanın maliyetinin onda birine, benzer özellik setini sunuyoruz.

**S16: Gelecekteki geliştirme planlarınız neler?**
Kısa cevap: Kısa vadede saha testleri ve model kalibrasyonuna, orta vadede ise banka API entegrasyonlarının genişletilmesine ve OcrEngine'in bulut tabanlı bir görü modeliyle güçlendirilmesine odaklanıyoruz.
Detay: Proje takvimimizde belirttiğimiz gibi Ağustos-Eylül döneminde KOBİ ve mali müşavirlerle saha testleri yapıyoruz; bu geri bildirimler doğrultusunda Muhai Skoru algoritmasını ve chatbot'un mevzuat kapsamını genişletmeyi planlıyoruz.

**S17: Fiyatlandırma stratejinizi nasıl belirlediniz?**
Kısa cevap: TÜRMOB'un 2025 asgari hizmet ücret tarifesini referans alarak, dışarıdan muhasebeci maliyetinin çok altında, üç kademeli bir SaaS fiyatlandırması oluşturduk.
Detay: Başlangıç planı (299 TL) mikro işletmeleri sisteme çekmeyi, Pro (599 TL) ve İşletme (999 TL) planları ise büyüyen işletmelerden daha yüksek gelir elde etmeyi hedefliyor; bu katmanlı yapı, kullanıcı büyüdükçe gelir de büyüsün diye tasarlandı.

**S18: Bu kadar kapsamlı bir sistemi bu sürede nasıl geliştirdiniz?**
Kısa cevap: Takım üyelerimiz arasında net bir sorumluluk paylaşımı yaptık — backend, yapay zekâ/OCR ve iş geliştirme ayrı ayrı yürütüldü; 13 servisli platformun tamamı hâlihazırda geliştirildi ve test edildi.
Detay: Nisan ayından itibaren paralel çalışan üç ekip (mimari/OCR, model doğrulama, entegrasyon) sayesinde geliştirme süreci hızlandı; şu anda sırada pilot uygulamalar, canlı entegrasyonlar ve lansman var.

---
---

## ÖNEMLİ HATIRLATMALAR (Sunumu Yapacak Takım Üyesi İçin)

1. **Süreye dikkat edin.** Sunum tam olarak 10 dakika; slayt başına verilen süreleri prova ederken bir kronometreyle takip edin, özellikle Kullanılacak Yöntem bölümünde (3 slayt, toplam 2 dk 35 sn) hızlanmamaya özen gösterin.
2. **Kameranızın açık ve net olduğundan emin olun.** TEKNOFEST değerlendirmesinde görüntü ve ses kalitesi önemlidir; sunumdan önce bağlantıyı test edin.
3. **Yalnızca KYS'ye (Katılımcı Yönetim Sistemi) kayıtlı takım üyesi konuşabilir.** Sunum ve soru-cevap sırasında kayıt dışı kişilerin ekranda görünmemesine veya konuşmamasına dikkat edin.
4. **Metni ezbere değil, akışına hâkim olarak sunun.** Kağıttan okunuyormuş gibi değil, doğal bir konuşma temposuyla, jüriyle göz teması kurarak anlatın.
5. **Soru-cevapta sakin ve kendinden emin olun.** Bilmediğiniz bir soruyla karşılaşırsanız dürüstçe "şu anki sürümde bu özelliği henüz eklemedik, ama yol haritamızda yer alıyor" gibi net bir çerçeve çizin; kısa cevaptan sonra gerekiyorsa detay paragrafına geçin.
6. **Geçiş cümlelerini atlamayın.** "Şimdi ... geçelim" gibi bağlayıcı cümleler sunumun akıcı görünmesini sağlar; jüri bölümler arasındaki mantıksal bağı böyle takip eder.
7. **Rakamları doğru telaffuz edin.** 3,71 milyon KOBİ, yüzde 98,6 doğruluk, 34,2 milyar TL gibi rakamlar projenizin güvenilirliğini gösteriyor; karışmamaları için birkaç kez prova edin.
8. **Demo linkini ve ekran görüntülerini önceden test edin.** Sunum sırasında teknik bir aksaklık yaşamamak için video bağlantısının ve ekran paylaşımının çalıştığından emin olun.
9. **Son slaytta (Teşekkürler) tempo düşürün.** Kapanışı aceleye getirmeyin; net ve sıcak bir şekilde teşekkür edip soru-cevaba geçişi işaret edin.
