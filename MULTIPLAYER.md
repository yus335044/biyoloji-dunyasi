# Online Oyun: Teknik Belge ve Yayın Rehberi

## Teknolojiler
- **Sunucu:** Node.js 20+ ve `ws` (WebSocket). Oyunun sayfası da aynı adresten verilir.
- **İstemci:** Mevcut oyun; yeni kod `src/net/` ve `src/ui/online.js` içinde.
- **Paylaşılan kod:** `src/world/height.js` (arazi) ve `src/core/data.js` hem tarayıcıda hem sunucuda çalışır.

## Dosyalar
| Dosya | Görev |
|---|---|
| `server/index.js` | HTTP, WebSocket, IP sınırı, kalp atışı |
| `server/rooms.js` | Odalar, oyuncular, hareket ve puan doğrulaması, 15 Hz yayın |
| `server/protocol.js` | Girdi temizleme yardımcıları |
| `server/test/protocol.mjs` | Gerçek soketlerle protokol testi (`npm test`) |
| `server/test/load.mjs` | Yük testi ve test botu |
| `src/net/client.js` | Bağlantı, yeniden bağlanma, konum gönderimi |
| `src/net/remote.js` | Diğer oyuncuların karakterleri, yumuşatma |
| `src/ui/online.js` | Oda ekranları, lobi, bağlantı durumu, oda paneli |

## Mimari kararlar
- **Hareket:** İstemci kendi karakterini anında oynatır, sunucu doğrular. Hız, harita sınırı, derin su ve bölüm geçişleri denetlenir; geçersiz konum geri alınır. Ağaç ve bina çarpışmaları sunucuda denetlenmez.
- **Ağ:** İstemci ve sunucu yaklaşık 15 Hz. Yalnızca değişen oyuncular, yalnızca aynı bölümdekilere gönderilir. Diğer oyuncular 130 ms gecikmeyle yumuşatılır.
- **Mini oyunlar:** Tarayıcıda çalışır. Sunucu kilit, oturum eşleşmesi, en kısa süre (8 sn) ve puan aralığını denetler, yıldızı kendisi hesaplar. Akla yatkın uydurma bir puanı ayırt edemez.
- **İlerleme:** XP, kart ve başarım cihazda kalır. Oda puan tablosu yalnızca o odada kazanılan en iyi puanları gösterir.
- **Veri:** Hesap yok, kalıcı veri yok; odalar sunucu belleğindedir. Sunucu yeniden başlarsa odalar kaybolur.
- **Kopma:** Oyuncunun 30 saniyesi vardır; süre içinde aynı kimlik ve puanla döner.

## Yerelde çalıştırma
Node bu projede `.node/` altındadır (Git'e girmez).
```bash
.node/bin/node server/index.js
```
Adres: `http://localhost:8080`. Aynı Wi-Fi'daki cihazlar `http://<Mac'in IP adresi>:8080` ile bağlanır; macOS güvenlik duvarı izin isteyebilir.

## Test
```bash
.node/bin/node server/test/protocol.mjs
```
Yük testi için sunucuyu `MAX_PER_IP=1000` ile başlatıp: `.node/bin/node server/test/load.mjs 10 30 8`

## İnternette yayınlama (Render)
1. Projeyi bir GitHub deposuna yükleyin.
2. render.com'da hesap açıp **New → Blueprint** ile depoyu seçin; `render.yaml` ayarları otomatik okur.
3. Oluşan `https://....onrender.com` adresini öğrencilerle paylaşın.

Ücretsiz planda sunucu boştayken uyur; ilk açılış bir dakika kadar sürebilir ve yeniden başlayınca odalar kaybolur. Dersten önce linki açıp hazır olmasını bekleyin. Yoğun kullanımda ücretli plan daha güvenlidir.

`dist/photosynthesis-world.html` tek kişiliktir, online özelliği sunucu adresinden açılınca çalışır.
