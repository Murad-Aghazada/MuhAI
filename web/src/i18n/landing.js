/* ============================================================
   Landing page copy, TR + EN.

   Kept out of translations.js because it is marketing prose and
   it is long; `translations.js` stays the product dictionary.
   Merged in under the `lp` key, so every string here is reached
   as t('lp.…') like any other.

   Rule for this file: nothing claims more than the code does.
   §6 of CLAUDE.md lists what the deck over-claims — the landing
   page is not allowed to join it. No invented customers, no live
   GİB/SGK connection, no app-store listing.
   ============================================================ */

export const landingCopy = {
  tr: {
    nav: { modules: 'Modüller', how: 'Nasıl çalışır', pricing: 'Fiyatlar', faq: 'SSS' },
    login: 'Giriş yap',
    start: 'Ücretsiz başla',

    hero: {
      title: 'Faturadan beyana, tek ekranda.',
      sub: 'Muhai faturanızı okur, KDV’nizi hesaplar ve nakdinizi önceden gösterir. Türk KOBİ’leri için, mevzuatı bilerek.',
      trust: 'KOBİ’ler ve mali müşavirler için tasarlandı',
    },

    strip: {
      head: 'Türkiye’nin dört bir yanındaki sektörler düşünülerek kuruldu',
      link: 'Nasıl çalıştığını gör',
      sectors: ['Tekstil', 'Lojistik', 'Gıda', 'Kimya', 'Ambalaj', 'İnşaat'],
    },

    say: {
      text: 'Muhai, Türk KOBİ’leri için kurulmuş bir muhasebe ve finans işletim sistemi — faturayı okur, vergiyi hesaplar ve nakdin nereye gittiğini önceden gösterir.',
      trio: [
        { b: 'Faturayı okur', s: 'Türkçe OCR' },
        { b: 'Vergiyi hesaplar', s: '2026 oranları' },
        { b: 'Nakdi tahmin eder', s: 'Prophet tahmini' },
      ],
    },

    slabs: [
      {
        badge: 'Fatura & OCR',
        title: 'Faturayı fotoğraflayın, alanlar kendiliğinden dolsun.',
        body: 'Tutar, KDV, tarih ve satıcı okunur. Her alan ölçülmüş bir güven değeri taşır; eşiğin altında kalan doğrudan onayınıza düşer.',
        foot: 'Artık satır satır elle giriş yok.',
      },
      {
        badge: 'Vergi & Beyan',
        title: '2026 oranları uygulamanın içinde duruyor.',
        body: 'KDV, stopaj, gelir, kurumlar, SGK ve damga. Beyan takvimi ve tutarlar hazır gelir — bir yere bağlanıp indirmesi gerekmez.',
        foot: 'Artık gözden kaçan beyanname yok.',
      },
      {
        badge: 'Nakit & Tahmin',
        title: 'Nakdinizin nereye gittiğini önceden görün.',
        body: 'Prophet ile 30 günlük tahmin; on noktanın altında hareketli ortalamaya düşer. Her figür kendi defterinizden gelir, hiçbiri örnek veri değildir.',
        foot: 'Artık ay sonunda sürpriz yok.',
      },
      {
        badge: 'Banka Mutabakatı',
        title: 'Hangi hareket deftere girdi, hangisi girmedi.',
        body: 'Bankanız API veriyorsa hareketleri doğrudan çeker; vermiyorsa aynı normalleştiriciye CSV ekstre yüklersiniz. Eşleşmeyenler listenin başında durur.',
        foot: 'Artık ekstreyi satır satır karşılaştırmak yok.',
      },
    ],

    bento: {
      eyebrow: 'Yetenekler',
      title: 'Küçük bir yüzey, tam bir defter',
      sub: '27 uç nokta ve 296 test. Az sayıda, ama hepsi gerçekten çalışan bir yüzey.',
      cards: [
        { badge: 'Sınıflandır', title: 'Akıllı Kategori', body: 'Bir satıcıyı bir kez düzeltin; sonraki faturası doğru kategoriyle gelsin.' },
        { badge: 'Bağlan', title: 'Banka Senkronu', body: 'Hareketler içeri akar, tekrar edenler ayıklanır.' },
        { badge: 'Ölç', title: 'Muhai Skoru', body: 'Sekiz ağırlıklı başlıkta işletmenizin finansal sağlığı.' },
        { badge: 'Takip et', title: 'Fatura Durumu', body: 'Ödenen, bekleyen ve geciken tek temiz listede.' },
        { badge: 'Planla', title: 'Yaklaşan Vergiler', body: 'Vadesi yaklaşan beyanlar, tutarıyla birlikte.' },
        { badge: 'Koru', title: 'Uyum Uyarıları', body: 'Mükerrer fatura ve tutmayan KDV oranı erkenden yakalanır.' },
      ],
    },

    show: {
      eyebrow: 'Tek ekran',
      title: 'Bütün defter, tek bakışta',
      sub: 'Her rakam kendi verinizden türer. Hesaplama servisi kapalıysa yerel toplamaya düşer — asla boş ekran, asla uydurulmuş bir rakam.',
      h3: 'Nakit akışınıza hakim olun.',
      list: [
        { t: 'Görünürlük', d: 'Fatura, kasa, stok ve bordro aynı panelde.' },
        { t: 'Tahmin', d: '30 günlük nakit tahmini ve risk penceresi.' },
        { t: 'Otomasyon', d: 'Okuma, kategori ve beyan takvimi elle iş istemez.' },
      ],
    },

    price: {
      eyebrow: 'Fiyatlandırma',
      title: 'Ücretsiz başlayın, işletme büyüdükçe genişletin',
      sub: 'Sözleşme yok, gizli ücret yok. İstediğiniz zaman yükseltin, düşürün ya da bırakın.',
      yearly: 'Yıllık',
      monthly: 'Aylık',
      per: 'iş yeri başına',
      plans: [
        {
          name: 'Başlangıç',
          note: 'Defterini yeni düzene sokan küçük işletmeler için.',
          m: '0', y: '0',
          cta: 'Ücretsiz başla',
          feats: ['Fatura ve kasa kaydı', 'Türkçe OCR ile fatura okuma', '2026 vergi takvimi', 'Temel nakit akışı', '1 iş yeri'],
        },
        {
          name: 'Pro',
          note: 'Büyüyen KOBİ’ler ve mali müşavirler için.',
          m: '490', y: '349',
          cta: '14 gün ücretsiz dene',
          feats: ['Başlangıç’taki her şey', '30 günlük nakit tahmini', 'Banka mutabakatı', 'Uyum ve risk uyarıları', '5 iş yeri'],
        },
        {
          name: 'Kurumsal',
          note: 'Çok şirketli yapılar ve yüksek hacim için.',
          m: '1.190', y: '899',
          cta: '14 gün ücretsiz dene',
          feats: ['Pro’daki her şey', 'Çoklu şirket ve konsolidasyon', 'Banka API entegrasyonu', 'API erişimi', 'Öncelikli kurulum desteği'],
        },
      ],
      entBadge: 'Kendi sunucunuzda',
      entTitle: 'İsterseniz tamamını kendiniz barındırın',
      entBody: 'Muhai baştan sona kendi kendine barındırılır: Postgres, FastAPI ve Docker’lı bir sunucu. Üçüncü taraf bir servis yoktur, veriniz sizin makinenizde kalır.',
      entCta: 'Bize ulaşın',
    },

    spot: {
      eyebrow: 'Öne çıkanlar',
      title: 'Gerçekten çalışan kısım',
      sub: 'Demoda gösterilebilen, ölçülmüş yetenekler. Henüz olmayan hiçbir şey bu sayfada yok.',
      cards: [
        {
          title: 'Fatura okuma',
          body: 'Türkçe eğitimli Tesseract, tek blok okuma ve ön işleme. Güven değeri sabit bir sayı değil; kelime bazında ölçülür.',
          facts: [
            { k: 'Ölçülen sonuç', v: 'Temiz, elde ve loş çekimde 4/4 alan' },
            { k: 'İnceleme eşiği', v: '0,70' },
            { k: 'İnternet', v: 'Gerekmez — tarayıcı ve sunucu' },
          ],
        },
        {
          title: 'Nakit tahmini',
          body: 'Prophet gerçek veriyle çalışır. On noktanın altında ve her Prophet hatasında hareketli ortalamaya düşer.',
          facts: [
            { k: 'Model', v: 'Prophet 1.1.5' },
            { k: 'Yedek yöntem', v: 'Hareketli ortalama' },
            { k: 'Ufuk', v: '30 gün' },
          ],
        },
        {
          title: 'Finansal asistan',
          body: 'Çevrimiçiyken Gemini 2.5 Flash, ağ ya da kota kesildiğinde yerel BM25 bilgi tabanı. Arayüz hangisinin yanıtladığını söyler.',
          facts: [
            { k: 'Çevrimiçi', v: 'Gemini 2.5 Flash' },
            { k: 'Çevrimdışı', v: 'Yerel BM25 + hazır yanıtlar' },
            { k: 'Dil', v: 'Türkçe' },
          ],
        },
        {
          title: 'Banka mutabakatı',
          body: 'Gerçek bir banka API’si için hazır; yapılandırma ile bağlanır, kod değişikliği istemez. Banka yoksa CSV ekstre aynı yoldan geçer.',
          facts: [
            { k: 'Aktarım', v: 'OAuth2 + karşılıklı TLS' },
            { k: 'Bankasız yol', v: 'CSV ekstre, aynı eşleştirici' },
            { k: 'Test', v: 'Senaryolu bankaya karşı 90 test' },
          ],
        },
      ],
    },

    faq: {
      eyebrow: 'SSS',
      titleA: 'Merak',
      titleB: 'edilenler',
      sub: 'Kurulumdan mevzuata, en sık sorulanlar. Aradığınız yoksa yazın, cevaplayalım.',
      tabs: ['Genel', 'Tahmin & Yapay zeka', 'Kurulum', 'Güvenlik'],
      groups: [
        [
          { q: 'Muhai tam olarak nedir?', a: 'Türk KOBİ’leri için kurulmuş bir muhasebe ve finans işletim sistemi. Fatura, vergi, stok, bordro ve nakit akışı tek yerde durur; rakamlar kendi defterinizden gelir.' },
          { q: 'Mali müşavirimin yerini alır mı?', a: 'Hayır. Muhai sizin iç görünümünüzü temiz ve güncel tutar; müşavirinizle çalışmanızı kolaylaştırır, onun yerine geçmez.' },
          { q: 'Hangi dilleri konuşuyor?', a: 'Arayüz Türkçe ve İngilizce. Fatura okuma Türkçe için eğitilmiş modelle çalışır, asistan Türkçe yanıt verir.' },
        ],
        [
          { q: 'Tahmin nasıl hesaplanıyor?', a: 'Prophet ile, gerçek hareketleriniz üzerinden. On veri noktasının altında ya da Prophet bir hata verirse hareketli ortalamaya düşer — boş bir grafik yerine daha basit bir yöntem.' },
          { q: 'Yapay zeka tam olarak ne yapıyor?', a: 'Faturayı okur, harcamayı kategoriye ayırır, mükerrer kaydı ve tutmayan KDV oranını yakalar ve sorularınızı kendi verinize bakarak yanıtlar.' },
          { q: 'İnternet kesilirse ne olur?', a: 'Fatura okuma her iki tarafta da internetsiz çalışır. Asistan yerel bilgi tabanına düşer ve yanıtın çevrimdışı geldiğini açıkça söyler.' },
        ],
        [
          { q: 'Kurulum ne kadar sürüyor?', a: 'Hesap açıp şirket bilgilerinizi girmeniz birkaç dakika. Kendi sunucunuza kuracaksanız Docker’lı bir makine ve tek bir yapılandırma dosyası yeterli.' },
          { q: 'Bankama bağlanabiliyor mu?', a: 'Banka entegrasyonu hazır ve yapılandırmayla bağlanıyor — kod değişikliği istemez. Henüz canlı bir banka kimlik bilgisiyle çalıştırılmadı; bankasız durumda CSV ekstre aynı yoldan geçer.' },
          { q: 'GİB veya SGK’ya bağlanıyor mu?', a: 'Hayır. Vergi tarafı yerel bir 2026 takvimi ve oran tablosu okur; dışarıya bir çağrı yapmaz.' },
        ],
        [
          { q: 'Verim nerede duruyor?', a: 'Sizin veritabanınızda. Muhai baştan sona kendi kendine barındırılır — Postgres, FastAPI ve Docker. Yolda üçüncü taraf bir servis yoktur.' },
          { q: 'Başka bir şirket verimi görebilir mi?', a: 'Göremez. Oturum anahtarı şirket kapsamının kendisidir; her sorgu çağıranın şirket kimliğiyle filtrelenir, bu da veritabanının uyguladığı bir kuraldır.' },
          { q: 'Şifremi unutursam?', a: 'Şu an parola sıfırlama e-postası yok — kendi kendine barındırılan bir kurulumda bunun için bir posta sunucusu gerekir. Yönetici hesabınızdan parolanızı değiştirebilirsiniz.' },
        ],
      ],
      askBadge: 'İletişim',
      askTitle: 'Sorunuz burada yoksa, yazın.',
      askBody: 'Kurulum, mevzuat ya da kendi sunucunuzda çalıştırma — hangisi olursa olsun cevaplıyoruz.',
      askCta: 'Bize ulaşın',
    },

    close: {
      title: 'Defterinizi düzene sokmaya hazır mısınız?',
      sub: 'Muhai faturanızı okur, verginizi hesaplar ve nakdinizin nereye gittiğini önceden gösterir.',
      cta: 'Ücretsiz başla',
    },

    foot: {
      tagline: 'Türk KOBİ’leri için yapay zeka destekli muhasebe ve finans işletim sistemi.',
      cols: [
        { h: 'Ürün', items: ['Modüller', 'Fiyatlar', 'SSS', 'Panel'] },
        { h: 'Şirket', items: ['Hakkımızda', 'Yol haritası', 'İletişim'] },
        { h: 'Kaynaklar', items: ['Dokümantasyon', 'Sürüm notları', 'Destek'] },
        { h: 'Yasal', items: ['KVKK', 'Gizlilik', 'Kullanım şartları'] },
      ],
      rights: 'Tüm hakları saklıdır.',
    },
  },

  en: {
    nav: { modules: 'Modules', how: 'How it works', pricing: 'Pricing', faq: 'FAQ' },
    login: 'Sign in',
    start: 'Start free',

    hero: {
      title: 'From invoice to filing, on one screen.',
      sub: 'Muhai reads your invoice, computes the VAT and shows where the cash is going before it gets there. Built for Turkish SMEs, with the rules already in it.',
      trust: 'Built for SMEs and their accountants',
    },

    strip: {
      head: 'Built with sectors across Türkiye in mind',
      link: 'See how it works',
      sectors: ['Textiles', 'Logistics', 'Food', 'Chemicals', 'Packaging', 'Construction'],
    },

    say: {
      text: 'Muhai is an accounting and finance operating system built for Turkish SMEs — it reads the invoice, computes the tax, and shows where the cash is going before it gets there.',
      trio: [
        { b: 'Reads the invoice', s: 'Turkish OCR' },
        { b: 'Computes the tax', s: '2026 rates' },
        { b: 'Forecasts the cash', s: 'Prophet forecast' },
      ],
    },

    slabs: [
      {
        badge: 'Invoices & OCR',
        title: 'Photograph the invoice, let the fields fill themselves.',
        body: 'Amount, VAT, date and vendor are read out. Every field carries a measured confidence, and anything under the threshold lands in your review queue.',
        foot: 'No more typing invoices line by line.',
      },
      {
        badge: 'Tax & filings',
        title: 'The 2026 rates live inside the app.',
        body: 'VAT, withholding, income, corporate, SGK and stamp. The filing calendar and the amounts arrive ready — nothing has to be fetched from anywhere.',
        foot: 'No more filings that slip past you.',
      },
      {
        badge: 'Cash & forecast',
        title: 'See where your cash is heading before it gets there.',
        body: 'A 30-day forecast from Prophet, dropping to a moving average under ten data points. Every figure comes from your own books — none of it is sample data.',
        foot: 'No more month-end surprises.',
      },
      {
        badge: 'Bank reconciliation',
        title: 'Which movement is in the books, and which is not.',
        body: 'If your bank exposes an API it pulls movements directly; if it does not, a CSV statement lands in the same normaliser. Unmatched rows sit at the top.',
        foot: 'No more comparing statements row by row.',
      },
    ],

    bento: {
      eyebrow: 'Capabilities',
      title: 'A small surface, a complete ledger',
      sub: '27 endpoints and 296 tests. A surface small enough to explain, and all of it works.',
      cards: [
        { badge: 'Sort', title: 'Smart Categories', body: 'Correct a vendor once; the next invoice from them arrives already sorted.' },
        { badge: 'Connect', title: 'Bank Sync', body: 'Movements flow in and duplicates are filtered out.' },
        { badge: 'Measure', title: 'Muhai Score', body: 'Your financial health across eight weighted categories.' },
        { badge: 'Track', title: 'Invoice Status', body: 'Paid, pending and overdue in one clean list.' },
        { badge: 'Plan', title: 'Upcoming Taxes', body: 'Filings approaching their deadline, with the amount attached.' },
        { badge: 'Protect', title: 'Compliance Alerts', body: 'Duplicate invoices and VAT that matches no legal rate, caught early.' },
      ],
    },

    show: {
      eyebrow: 'One screen',
      title: 'The whole ledger, at a glance',
      sub: 'Every number derives from your own data. If the compute service is down it falls back to local aggregation — never a blank screen, never an invented figure.',
      h3: 'Master your cash flow.',
      list: [
        { t: 'Visibility', d: 'Invoices, cash, stock and payroll on one panel.' },
        { t: 'Forecasting', d: 'A 30-day cash forecast and the risk window with it.' },
        { t: 'Automation', d: 'Reading, categories and the filing calendar need no manual work.' },
      ],
    },

    price: {
      eyebrow: 'Pricing',
      title: 'Start free, widen it as the business grows',
      sub: 'No contracts, no hidden fees. Upgrade, downgrade or leave whenever you want.',
      yearly: 'Yearly',
      monthly: 'Monthly',
      per: 'per workspace',
      plans: [
        {
          name: 'Starter',
          note: 'For small businesses putting their books in order.',
          m: '0', y: '0',
          cta: 'Start free',
          feats: ['Invoice and cash entry', 'Turkish OCR invoice reading', '2026 tax calendar', 'Basic cash flow', '1 workspace'],
        },
        {
          name: 'Pro',
          note: 'For growing SMEs and their accountants.',
          m: '490', y: '349',
          cta: 'Try free for 14 days',
          feats: ['Everything in Starter', '30-day cash forecast', 'Bank reconciliation', 'Compliance and risk alerts', '5 workspaces'],
        },
        {
          name: 'Enterprise',
          note: 'For multi-company structures and high volume.',
          m: '1,190', y: '899',
          cta: 'Try free for 14 days',
          feats: ['Everything in Pro', 'Multi-company consolidation', 'Bank API integration', 'API access', 'Priority onboarding'],
        },
      ],
      entBadge: 'On your own server',
      entTitle: 'Host the whole thing yourself if you want to',
      entBody: 'Muhai is self-hosted end to end: Postgres, FastAPI and a machine with Docker on it. There is no third-party service in the path and your data stays on your own hardware.',
      entCta: 'Talk to us',
    },

    spot: {
      eyebrow: 'Spotlight',
      title: 'The part that actually works',
      sub: 'Measured capabilities you can demo today. Nothing on this page is something the code does not do yet.',
      cards: [
        {
          title: 'Invoice reading',
          body: 'Tesseract with the Turkish pack, single-block reading and preprocessing. Confidence is not a constant — it is measured per word.',
          facts: [
            { k: 'Measured result', v: '4/4 fields on clean, handheld and dim' },
            { k: 'Review threshold', v: '0.70' },
            { k: 'Internet', v: 'Not required — browser or server' },
          ],
        },
        {
          title: 'Cash forecast',
          body: 'Prophet, on real data. It drops to a moving average under ten points and on any Prophet failure.',
          facts: [
            { k: 'Model', v: 'Prophet 1.1.5' },
            { k: 'Fallback', v: 'Moving average' },
            { k: 'Horizon', v: '30 days' },
          ],
        },
        {
          title: 'Financial assistant',
          body: 'Gemini 2.5 Flash while online, a local BM25 knowledge base when the network or the quota goes. The UI says which one answered.',
          facts: [
            { k: 'Online', v: 'Gemini 2.5 Flash' },
            { k: 'Offline', v: 'Local BM25 + prepared answers' },
            { k: 'Language', v: 'Turkish' },
          ],
        },
        {
          title: 'Bank reconciliation',
          body: 'Ready for a real bank API and connected by configuration, not by a code change. With no bank, a CSV statement takes the same path.',
          facts: [
            { k: 'Transport', v: 'OAuth2 + mutual TLS' },
            { k: 'Without a bank', v: 'CSV statement, same matcher' },
            { k: 'Tests', v: '90 against a scripted bank' },
          ],
        },
      ],
    },

    faq: {
      eyebrow: 'FAQ',
      titleA: 'We have the',
      titleB: 'answers',
      sub: 'From setup to legislation, the questions that come up most. If yours is not here, write to us.',
      tabs: ['General', 'Forecasting & AI', 'Setup', 'Security'],
      groups: [
        [
          { q: 'What exactly is Muhai?', a: 'An accounting and finance operating system built for Turkish SMEs. Invoices, tax, stock, payroll and cash flow live in one place, and the figures come from your own books.' },
          { q: 'Does it replace my accountant?', a: 'No. Muhai keeps your internal view clean and current, which makes working with your accountant easier — it does not stand in for them.' },
          { q: 'What languages does it speak?', a: 'The interface is Turkish and English. Invoice reading runs on a model trained for Turkish, and the assistant answers in Turkish.' },
        ],
        [
          { q: 'How is the forecast computed?', a: 'With Prophet, over your real movements. Under ten data points, or on any Prophet failure, it drops to a moving average — a simpler method rather than an empty chart.' },
          { q: 'What does the AI actually do?', a: 'It reads the invoice, sorts spending into categories, catches duplicates and VAT that matches no legal rate, and answers your questions against your own data.' },
          { q: 'What happens if the internet drops?', a: 'Invoice reading works without internet on both paths. The assistant falls back to a local knowledge base and says plainly that the answer came from offline.' },
        ],
        [
          { q: 'How long does setup take?', a: 'A few minutes to open an account and enter your company details. To run it on your own server you need a machine with Docker and one configuration file.' },
          { q: 'Can it connect to my bank?', a: 'The bank integration is built and connects by configuration — no code change. It has not yet run against a live bank credential; with no bank, a CSV statement takes the same path.' },
          { q: 'Does it connect to GİB or SGK?', a: 'No. The tax side reads a local 2026 calendar and rate table; it makes no external call.' },
        ],
        [
          { q: 'Where does my data sit?', a: 'In your database. Muhai is self-hosted end to end — Postgres, FastAPI and Docker. There is no third-party service in the path.' },
          { q: 'Can another company see my data?', a: 'No. The session token is the company scope itself: every query is filtered by the caller’s company, and the database is what enforces it.' },
          { q: 'What if I forget my password?', a: 'There is no reset email today — a self-hosted install would need its own mail sender for that. You can change your password from inside your account.' },
        ],
      ],
      askBadge: 'Contact',
      askTitle: 'If your question is not here, write to us.',
      askBody: 'Setup, legislation, or running it on your own server — whichever it is, we answer.',
      askCta: 'Talk to us',
    },

    close: {
      title: 'Ready to put your books in order?',
      sub: 'Muhai reads your invoice, computes your tax, and shows where the cash is going before it gets there.',
      cta: 'Start free',
    },

    foot: {
      tagline: 'An AI-powered accounting and finance operating system for Turkish SMEs.',
      cols: [
        { h: 'Product', items: ['Modules', 'Pricing', 'FAQ', 'Dashboard'] },
        { h: 'Company', items: ['About', 'Roadmap', 'Contact'] },
        { h: 'Resources', items: ['Documentation', 'Release notes', 'Support'] },
        { h: 'Legal', items: ['KVKK', 'Privacy', 'Terms of use'] },
      ],
      rights: 'All rights reserved.',
    },
  },
}
