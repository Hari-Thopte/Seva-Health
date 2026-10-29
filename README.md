# सेवा आरोग्य (Seva Health) — Frontline Healthcare Assistant & CDSS

> **महाराष्ट्र शासन — राष्ट्रीय आरोग्य अभियान (NHM)**  
> आशा स्वयंसेविका (ASHA) व अंगणवाडी कार्यकर्तींसाठी मराठी-प्रथम, पूर्णतः ऑफलाइन कार्यक्षम डिजिटल आरोग्य सहाय्यक आणि वैद्यकीय निर्णय सहाय्यक प्रणाली (Clinical Decision Support System - CDSS).

---

## 🌟 प्रमुख वैशिष्ट्ये व तांत्रिक स्वरूप (Core Architecture)

### १. पूर्णतः ऑफलाइन कार्यक्षम (True Offline-First Architecture & PWA)
* **Service Worker (`public/sw.js`) & PWA Manifest (`public/manifest.json`)**: इंटरनेट बंद असतानाही संपूर्ण अ‍ॅप त्वरित लोड होते.
* **स्थानिक मेमरी व सिंक रांग (Local Storage Queue)**: इंटरनेट उपलब्ध नसताना नोंदवलेल्या सर्व भेटी व रुग्ण नोंदी स्थानिक मेमरीमध्ये (`seva_offline_visits`) सुरक्षित जतन होतात.
* **स्वयंचलित बॅकग्राउंड सिंक (Background Sync)**: इंटरनेट पुन्हा सुरू होताच प्रणाली आपोआप स्थानिक रांग सर्व्हरवरील SQLite डेटाबेसमध्ये सिंक करते. वापरकर्त्यासाठी मॅन्युअल **"आताच सिंक करा"** बटणही उपलब्ध आहे.
* **ऑफलाइन ऑडिओ बफर**: ब्राऊझरचे क्लाउड स्पीच मॉडेल ऑफलाइन नसल्यास डिव्हाइस मायक्रोफोनद्वारे स्थानिक ऑडिओ सुरक्षित रेकॉर्ड केला जातो. सोबत १-टॅप त्वरित क्लिनिकल वाक्ये (Quick Presets) उपलब्ध आहेत.

### २. वैद्यकीय निर्णय सहाय्यक प्रणाली व मराठी NLP (Rule-Based CDSS & Clinical NLP)
आरोग्य क्षेत्रात चुकीचे निदान टाळण्यासाठी अनिर्बंध AI ऐवजी राष्ट्रीय आरोग्य अभियान (NHM) व WHO च्या अधिकृत क्लिनिकल मानकांवर आधारित निर्णय प्रणाली:
* **देवनागरी अंक रूपांतरण**: मराठी अंक (उदा. `१४०/९०`, `४२ किलो`) स्वयंचलितपणे ओळखून फॉर्ममध्ये भरले जातात.
* **रक्तदाब मूल्यमापन (Blood Pressure Extraction)**: 
  * सिस्टोलिक ≥ १४० mmHg किंवा डायस्टोलिक ≥ ९० mmHg असल्यास **उच्च रक्तदाब (High BP)** चे क्लिनिकल अलर्ट.
  * रक्तदाब सामान्य असल्यास चुकीचे फ्लॅग लागत नाहीत.
* **वजन व कमी वजन (Weight & Underweight Contextual Parser)**:
  * गरोदर मातेचे वजन < ४५ किलो असल्यास किंवा "वजन कमी" चा स्पष्ट क्लिनिकल उल्लेख असल्यास **कमी वजन (Underweight)** अलर्ट.
  * "कमी वेळ" किंवा "कमी त्रास" अशा असंबंधित वाक्यांवर चुकीचा फ्लॅग लागत नाही.
* **इतर क्लिनिकल जोखीम**: तीव्र ताप (≥ १००°F), तीव्र रक्तक्षय (Hb < १० g/dL किंवा लक्षणे), कुपोषण (MUAC) व अल्पवयीन गर्भधारणा.

### ३. सुरक्षा व गोपनीयता (Security & Authentication)

* **JWT Session Cookies**: OTP यशस्वी झाल्यावर `HS256` signed JWT cookie (`seva_session`) सेट होतो; हे cookie `HttpOnly`, `SameSite=lax` असते — XSS द्वारे चोरी होत नाही.
* **Next.js 16 Proxy**: `proxy.js` सर्व `/api/*` routes (auth वगळता) वर session verify करतो. Invalid किंवा expired token असल्यास `401` परत येतो.
* **OTP Hash साठवणूक**: OTP plain-text कधीही DB मध्ये साठवला जात नाही — SHA-256 hash साठवला जातो.
* **`crypto.randomInt`**: OTP निर्मितीसाठी `Math.random()` ऐवजी Node.js `crypto.randomInt` वापरले जाते.
* **Rate Limiting**: एका contact साठी १५ मिनिटांत ५ send, ५ verify attempts — नंतर `429` error.
* **Patient Scoping & Cross-Worker Protection**: 
  * ASHA कार्यकर्त्यास फक्त स्वतःचे रुग्ण (`worker_id` from JWT) दिसतात — URL param tamper करून दुसऱ्याचे रुग्ण पाहता येत नाहीत.
  * `/api/visits` आणि `/api/followups` (POST) वर `patient_id` हा लॉग-इन केलेल्या कार्यकर्त्याचाच आहे याची सर्व्हर पडताळणी होते; दुसऱ्या कार्यकर्त्याच्या रुग्णासाठी नोंदणीचा प्रयत्न केल्यास `403 Forbidden` परत येतो.
* **Server-authoritative Clinical Flags**: भेटीतील क्लिनिकल फ्लॅग्ज (उदा. High BP, Anemia) क्लायंटकडून न घेता सर्व्हरवर मराठी NLP पार्सरद्वारे पुनर्तपासले जातात.
* **कालबाह्यता (Expiry)**: सर्व OTP १० मिनिटांत expire होतात; यशस्वी login नंतर लगेच DB मधून delete होतात.
* **devOtp Security Gate**: `devOtp` फक्त `NODE_ENV !== 'production'` **आणि** `ALLOW_DEV_TEST_OTP=1` असेल तरच response मध्ये येतो. रिअल SMS किंवा सुरक्षित वातावरणासाठी `ALLOW_DEV_TEST_OTP=0` (किंवा unset) ठेवले जाते, ज्यामुळे API response मध्ये OTP कधीही दिसत नाही.

### ४. Scroll-Driven 3D Hero UI व थेट पोर्टल इंटरलिंकिंग (Hero UI & Seamless Navigation)
* **मुख्यपृष्ठ (`/`)**: 3D isometric नाईट-सिटी व्हिडियो, perspective 3D tilted हेडिंग, spinning loader आणि ४-टप्पा CDSS ॲकॉर्डियन प्रक्रियेसह आधुनिक लँडिंग पृष्ठ.
* **१-टॅप थेट लॉगिन**:
  * **"JOIN AS ASHA"**: आशा सेविका सुनिता पवार यांच्या खात्यासाठी थेट लॉगिन विंडो उघडते (`9876543210`).
  * **"REQUEST HEALTH OPS"**: ब्लॉक आरोग्य अधिकारी / पर्यवेक्षक देसाई यांच्या खात्यासाठी थेट लॉगिन विंडो उघडते (`9432109876`).
* **समुदाय माहिती ("OUR COMMUNITIES")**: जुन्नर ब्लॉक अंतर्गत आंबेगाव, नारायणगाव, ओतूर आणि मंचर उपकेंद्रांची थेट माहिती.
* **पारंपारिक सरकारी पोर्टल**: इच्छुकांसाठी पारंपारिक महाराष्ट्र शासन पोर्टल व्ह्यू **`/portal`** वर उपलब्ध आहे.

---

## 🛡️ गोपनीयता व डेटा संरक्षण (Privacy & DPDP Compliance)

डिजिटल वैयक्तिक डेटा संरक्षण अधिनियम, २०२३ (DPDP Act) च्या तरतुदींशी सुसंगत राहण्यासाठी Seva Health खालील उपाय करते:

| तत्त्व | अंमलबजावणी |
|---|---|
| **संमती (Consent)** | रुग्ण नोंदणी फॉर्ममध्ये स्पष्ट संमती चेकबॉक्स; consent timestamp DB मध्ये नोंदवला जातो. |
| **डेटा किमानता (Data Minimisation)** | फक्त आरोग्यसेवेसाठी आवश्यक fields (नाव, वय, फोन, ग्राम, आरोग्य नोंदी) गोळा केले जातात. |
| **उद्देश मर्यादा (Purpose Limitation)** | रुग्ण डेटा केवळ NHM ASHA follow-up व्यवस्थापनासाठी वापरला जातो; तृतीय पक्षास शेअर केला जात नाही. |
| **संचयन मर्यादा (Storage Limitation)** | SQLite DB सरकारी सर्व्हरवर (on-premise) ठेवला जातो — patient PII क्लाउडवर जात नाही. |
| **विश्रांतीतील एन्क्रिप्शन (Encryption at Rest)** | Production deployment मध्ये SQLite Cipher (SQLCipher) किंवा OS-level full-disk encryption (dm-crypt/LUKS) वापरण्याची शिफारस. |
| **प्रसारणातील एन्क्रिप्शन (Encryption in Transit)** | सर्व API calls HTTPS वर; JWT `secure` flag `NODE_ENV=production` मध्ये सक्षम. |
| **डेटा विषय हक्क (Data Principal Rights)** | `/api/patients/[id]` DELETE endpoint द्वारे रुग्ण डेटा मागणीनुसार काढता येतो (DPDP §13). |
| **उल्लंघन सूचना (Breach Notification)** | DPDP §8(6) नुसार ७२ तासांत Data Protection Board ला सूचना देण्याची प्रक्रिया संस्थेने निश्चित करावी. |

> **नोंद**: हे सादरीकरण एक prototype / hackathon demo आहे. Production deployment साठी संस्थेच्या Data Protection Officer (DPO) यांच्याशी सल्लामसलत करणे अनिवार्य आहे.

---

## 🔔 SMS रिमाइंडर मायक्रोसर्व्हिस (Spring Boot Reminders)

`seva-reminders/` मध्ये एक स्वतंत्र **Spring Boot** microservice आहे जो:
- SQLite DB मधील pending follow-ups वाचतो
- दररोज **सकाळी ७:३०** (IST) ASHA कार्यकर्त्यांना थकीत follow-up बद्दल Marathi SMS पाठवतो
- दररोज **सकाळी ८:००** (IST) उद्याच्या follow-up बद्दल advance SMS पाठवतो
- REST API (`GET /api/reminders/due`, `POST /api/reminders/trigger/due` इ.) द्वारे manually trigger करता येते
- **Admin API Key Security (Fail-Closed)**: सर्व REST endpoints `X-Admin-Key` हेडरद्वारे सुरक्षित आहेत (`SEVA_ADMIN_KEY` env var शी सुसंगत). जर `SEVA_ADMIN_KEY` सेट केलेला नसेल, तरीही प्रणाली endpoints उघडी न ठेवता सुरक्षितपणे `401 Unauthorized` रिटर्न करते (Fail-Closed).

```bash
# seva-reminders/ directory मध्ये:
./mvnw spring-boot:run
```

---

## 🚀 प्रकल्प कसा चालवावा (How to Run)

### १. आवश्यकता
* Node.js १८+ (किंवा २०+)
* आधुनिक वेब ब्राऊझर (Google Chrome / Edge)

### २. इन्स्टॉलेशन व स्टार्टअप (Installation & Startup)
```bash
# १. अवलंबित्व इन्स्टॉल करा (पहिल्यांदा रन करताना)
npm install

# २. डेव्हलपमेंट सर्व्हर सुरू करा
npm run dev
```

ब्राऊझरमध्ये **[http://localhost:3000](http://localhost:3000)** उघडा.

### ३. चाचणीसाठी खाती व लॉगिन तपशील (Test Accounts & Login Credentials)

प्रणालीमध्ये स्थानिक चाचणीसाठी आधीच नमुना खाती समाविष्ट आहेत:

| भूमिका (Role) | नाव (Name) | मोबाईल (Phone) | ईमेल (Email) | पूर्वनिर्धारित कार्यक्षेत्र |
|---|---|---|---|---|
| **आशा कार्यकर्ती (ASHA Worker)** | सुनिता पवार | `9876543210` | `sunita.pawar@seva.gov.in` | आंबेगाव (१४+ रुग्ण नोंदी) |
| **आरोग्य पर्यवेक्षक (Supervisor / MO)** | पर्यवेक्षक देसाई | `9432109876` | `desai.supervisor@seva.gov.in` | जुन्नर ब्लॉक (सर्व उपकेंद्रे) |
| इतर आशा कार्यकर्ती | रेखा शिंदे | `9765432109` | `rekha.shinde@seva.gov.in` | नारायणगाव |
| इतर आशा कार्यकर्ती | कविता जाधव | `9654321098` | `kavita.jadhav@seva.gov.in` | ओतूर |
| इतर आशा कार्यकर्ती | प्रिया कुलकर्णी | `9543210987` | `priya.kulkarni@seva.gov.in` | मंचर |

> 💡 **स्थानिक चाचणीसाठी OTP (Local Dev OTP)**:
> `.env.local` मध्ये `ALLOW_DEV_TEST_OTP=1` आणि `ALLOW_DEV_TEST_OTP_VALUE=123456` कॉन्फिगर केलेले असल्याने:
> - OTP पाठवल्यावर स्क्रीनवर स्वयंचलितपणे OTP भरला जातो.
> - किंवा तुम्ही थेट **`123456`** हा टेस्ट OTP वापरून त्वरित लॉगिन करू शकता!
> - याशिवाय टर्मिनल कन्सोल लॉगमध्येही प्रत्यक्ष जनरेट झालेला OTP (`[AUTH OTP] ...`) दिसतो.

### ४. डेटाबेस (Database)
* डेटाबेस फाईल (`seva-health.db`) आपोआप पहिल्या रनच्या वेळी इनिशिअलाइझ होऊन नमुना डेटासह तयार होते.
* रिपॉझिटरी शेअर करताना डेटाबेस फाईल समाविष्ट करण्याची गरज नाही (`.gitignore` मध्ये समाविष्ट).

---

## 🧪 ऑफलाइन चाचणी कशी करावी (How to Test Offline Mode)

१. ब्राऊझरमध्ये **F12** दाबून **DevTools** उघडा.  
२. **Network** टॅबमध्ये जाऊन **Offline** निवडा (किंवा संगणकाचे Wi-Fi बंद करा).  
३. **रुग्ण भेट नोंदवा (`/worker/new-visit`)** पृष्ठावर जा.  
४. रुग्ण निवडा, व्हॉइस किंवा १-टॅप त्वरित क्लिनिकल वाक्य निवडा.  
५. **"ऑफलाइन सेव्ह करा"** बटणावर क्लिक करा. भेट स्थानिक रांगेत सुरक्षित सेव्ह होईल.  
६. वर **"ऑफलाइन मोड - १ नोंदणी सिंक बाकी"** बॅज दिसेल.  
७. Network टॅबमध्ये **Online** करा (किंवा Wi-Fi चालू करा).  
८. प्रणाली आपोआप सर्व्हरवर डेटा सिंक करेल आणि **"✓ सर्व नोंदी सिंक झाल्या"** असा संदेश दर्शवेल!

---

## 📦 स्वच्छ सबमिशन झिप तयार करणे (Packaging for Submission)

परीक्षक किंवा हॅकथॉनसाठी `.env.local`, `.db` आणि `node_modules` वगळून स्वच्छ सबमिशन फाईल तयार करण्यासाठी:

```bash
npm run package-zip
```
यामुळे मुख्य डिरेक्टरीमध्ये `seva-health-clean-submission.zip` तयार होईल.

---
**Team Krypthon — Seva Innovation Challenge 2026**
