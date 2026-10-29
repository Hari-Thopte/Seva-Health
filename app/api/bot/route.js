import { NextResponse } from 'next/server'

// Comprehensive Clinical, ASHA, and NORVA Knowledge Base
const KNOWLEDGE_BASE = [
  {
    keywords: ['गरोदर', 'तपासणी', 'anc', 'गर्भवती', 'प्रसूती', 'pregnancy', 'pregnant', 'trimester'],
    answerMr: `**गरोदर मातांची काळजी व तपासणी (ANC मार्गदर्शक):**
1. **नोंदणी:** गर्भधारणा समजल्यापासून पहिल्या १२ आठवड्यांत (३ महिन्यांत) PCTS / RCH पोर्टलवर नोंदणी करणे बंधनकारक.
2. **किमान ४ तपासण्या:**
   - पहिली तपासणी: १२ आठवड्यांच्या आत (रक्त, लघवी, वजन, BP)
   - दुसरी तपासणी: १४ ते २६ आठवडे (USG सोनोग्राफी, TT/Td पहिला डोस)
   - तिसरी तपासणी: २८ ते ३४ आठवडे (Td दुसरा डोस, HB तपासणी)
   - चौथी तपासणी: ३६ आठवड्यांनंतर ते प्रसूतीपर्यंत.
3. **औषधे:** आयर्न-फॉलिक ॲसिड (IFA) १८० गोळ्या व कॅल्शियम ३६० गोळ्या दररोज १.
4. **धोक्याची लक्षणे:** तीव्र डोकेदुखी, पायांवर सूज, रक्तस्त्राव, अंधारी येणे — आढळल्यास त्वरित प्राथमिक आरोग्य केंद्रात (PHC) पाठवा.
**तातडीची मदत: १०२ (जननी एक्सप्रेस) / १०८ (रुग्णवाहिका)**`,
    answerEn: `**Antenatal Care (ANC) Guidelines:**
1. **Registration:** Mandatory within first 12 weeks of pregnancy.
2. **Minimum 4 ANC Visits:**
   - 1st Visit: Within 12 weeks (Weight, BP, Blood & Urine tests)
   - 2nd Visit: 14–26 weeks (USG, Td 1st dose)
   - 3rd Visit: 28–34 weeks (Td 2nd dose, Hb recheck)
   - 4th Visit: 36 weeks onwards until delivery.
3. **Supplements:** 180 IFA tablets and 360 Calcium tablets.
4. **Danger Signs:** Severe headache, leg edema, bleeding, blurred vision — refer immediately to PHC.
**Emergency: 102 (Janani Express) / 108 (Ambulance)**`
  },
  {
    keywords: ['लसीकरण', 'लस', 'vaccine', 'vaccination', 'immunization', 'bcg', 'polio', 'pentavalent', 'measles', 'mr'],
    answerMr: `**बाल लसीकरण वेळापत्रक (National Immunization Schedule):**
• **जन्माच्या वेळी:** BCG, OPV शून्य डोस, Hepatitis-B (२४ तासांत).
• **६ आठवडे (दीड महिना):** Pentavalent-1, OPV-1, Rotavirus-1, fIPV-1, PCV-1.
• **१० आठवडे (अडीच महिने):** Pentavalent-2, OPV-2, Rotavirus-2.
• **१४ आठवडे (साडेतीन महिने):** Pentavalent-3, OPV-3, Rotavirus-3, fIPV-2, PCV-2.
• **९ ते १२ महिने:** MR (गोवर-रुबेला)-1, PCV बूस्टर, JE-1, व्हिटॅमिन 'ए' पहिला डोस.
• **१६ ते २४ महिने:** DPT बूस्टर-1, MR-2, OPV बूस्टर.
• **५ ते ६ वर्षे:** DPT बूस्टर-2.
*टीप:* प्रत्येक बालकाचे लसीकरण कार्ड (MCP Card) अद्ययावत ठेवावे.`,
    answerEn: `**Child Immunization Schedule:**
• **At Birth:** BCG, OPV 0, Hepatitis B (within 24 hrs).
• **6 Weeks:** Pentavalent-1, OPV-1, Rotavirus-1, fIPV-1, PCV-1.
• **10 Weeks:** Pentavalent-2, OPV-2, Rotavirus-2.
• **14 Weeks:** Pentavalent-3, OPV-3, Rotavirus-3, fIPV-2, PCV-2.
• **9–12 Months:** MR-1, PCV Booster, JE-1, Vitamin A (1st dose).
• **16–24 Months:** DPT Booster-1, MR-2, OPV Booster.
• **5–6 Years:** DPT Booster-2.
*Tip:* Always ensure the MCP card is marked after vaccination.`
  },
  {
    keywords: ['कुपोषण', 'वजन', 'sam', 'mam', 'muac', 'malnutrition', 'सॅम', 'मॅम'],
    answerMr: `**बाल कुपोषण तपासणी व वर्गवारी (SAM / MAM):**
1. **मध्यम तीव्र कुपोषण (MAM - पिवळा पट्टा):**
   - वजन व उंची गुणोत्तर -2SD ते -3SD दरम्यान.
   - MUAC पट्टी: ११.५ सेमी ते १२.५ सेमी.
   - उपाय: अंगणवाडीत अतिरिक्त पोषण आहार (THR) व नियमित वजन नोंद.
2. **अति तीव्र कुपोषण (SAM - लाल पट्टा):**
   - वजन व उंची गुणोत्तर <-3SD किंवा दोन्ही पायांवर सूज.
   - MUAC पट्टी: < ११.५ सेमी.
   - उपाय: त्वरित **बाल विकास केंद्र (VCDC) किंवा पोषण पुनर्वसन केंद्र (NRC)** येथे दाखल करणे अनिवार्य.`,
    answerEn: `**Child Malnutrition Classification (SAM / MAM):**
1. **Moderate Acute Malnutrition (MAM - Yellow Zone):**
   - Weight-for-height between -2SD and -3SD.
   - MUAC: 11.5 cm to 12.5 cm.
   - Intervention: Supplementary nutrition (THR) & fortnightly growth tracking.
2. **Severe Acute Malnutrition (SAM - Red Zone):**
   - Weight-for-height < -3SD or bilateral pitting edema.
   - MUAC: < 11.5 cm.
   - Intervention: Immediate referral to Nutrition Rehabilitation Center (NRC) or VCDC.`
  },
  {
    keywords: ['norva', 'स्टाफिंग', 'कामगार', 'भरती', 'staffing', 'activation', 'crew', 'company'],
    answerMr: `**आरोग्य सेवा व्यासपीठ काय आहे?**
NORVA हे उच्च-जोखीम आणि संवेदनशील औद्योगिक प्रकल्पांसाठी प्रमाणित कुशल मनुष्यबळ पुरवणारे डिजिटल व्यासपीठ आहे:
1. **सक्रियीकरण (Activation, simplified):** एका कॉलने थेट कामासाठी सज्जता.
2. **पूर्ण पात्रता (Cleared to count):** कायदेशीर पार्श्वभूमी, फिटनेस व परवाने तपासणी.
3. **अचूक जुळवणी (Proven field match):** जड उद्योग, पवनऊर्जा, बंदर व लॉजिस्टिक्स साठी तज्ज्ञ कारागीर.
4. **तत्पर आगमन (Seamless arrival):** पहिल्या दिवसापासून डिजिटल हजेरी व सुरक्षा नियोजन.
मुख्य पृष्ठावरील **"पोर्टल प्रवेश"** बटण दाबून आपण पोर्टलमध्ये प्रवेश करू शकता.`,
    answerEn: `**What is the Seva Health portal?**
NORVA is a turnkey workforce deployment platform for mission-critical industrial environments:
1. **Activation, simplified:** Immediate dispatch to vetted crews without escalations.
2. **Cleared to count:** Pre-screened for compliance, safety certifications, and fitness.
3. **Proven field match:** Heavy industry, renewable energy, and container maritime logistics.
4. **Seamless arrival:** Turnkey digital badge check-in from shift one.
Select **"Portal Login"** on the home page to sign in.`
  },
  {
    keywords: ['otp', 'ओटीपी', 'लॉगिन', 'पासवर्ड', 'login', 'sms', 'textbee', 'code', 'error'],
    answerMr: `**लॉगिन आणि OTP मदत:**
1. **ASHA / कुशल कामगार:** नोंदणीकृत क्रमांक **९८७६५४३२१०** (सुनिता पवार).
2. **पर्यवेक्षक:** नोंदणीकृत क्रमांक **९४३२१०९८७६** (देसाई).
3. **OTP येत नाहीये?** 
   - Dev मोडमध्ये स्क्रीनवर हिरव्या अक्षरात चाचणी OTP (उदा. 123456) स्वयंचलित भरला जातो.
   - थेट SMS मिळवण्यासाठी **TextBee API Key** .env.local मध्ये जोडावी.
4. **पुन्हा प्रयत्न करा:** ३० सेकंदांनंतर 'पुन्हा कोड पाठवा' बटण सक्रिय होते.`,
    answerEn: `**Login & OTP Troubleshooting:**
1. **ASHA / Crew Member:** Demo number **9876543210** (Sunita Pawar).
2. **Supervisor:** Demo number **9432109876** (Supervisor Desai).
3. **Not receiving SMS?**
   - In local dev mode, the security Dev OTP auto-fills in green.
   - For real SMS delivery, configure your free **TextBee API Key** in .env.local.
4. **Resend:** The resend button unlocks after 30 seconds.`
  },
  {
    keywords: ['आणीबाणी', 'नंबर', 'फोन', 'हेल्पलाइन', 'emergency', 'ambulance', 'hospital', 'रुग्णवाहिका'],
    answerMr: `**महत्त्वाचे आपत्कालीन दूरध्वनी क्रमांक (Maharashtra Emergency Numbers):**
• **१०८** — शासकीय मोफत रुग्णवाहिका सेवा (Emergency Ambulance)
• **१०२** — जननी एक्सप्रेस (गरोदर माता व नवजात बालकांसाठी)
• **१०४** — शासकीय आरोग्य माहिती व समुपदेशन केंद्र (Health Helpline)
• **१०९८** — चाईल्ड लाईन (बाल संरक्षण व मदत)
• **११२** — राष्ट्रीय आपत्कालीन पोलीस/अग्निशामक मदत
• **१८१** — महिला सहाय्यता केंद्र`,
    answerEn: `**Essential Emergency Contacts (Maharashtra):**
• **108** — Free Emergency Ambulance Services
• **102** — Janani Express (Maternal & Infant Transport)
• **104** — National Health Advice & Tele-consultation
• **1098** — Childline Emergency
• **112** — Police & Disaster Response
• **181** — Women Helpline`
  },
  {
    keywords: ['अहवाल', 'फॉर्म', 'सर्व्हे', 'report', 'survey', 'submit', 'dashboard', 'डॅशबोर्ड'],
    answerMr: `**आरोग्य अहवाल सादर करण्याची पद्धत:**
1. आशा सेविका डॅशबोर्डवर जा.
2. **"नवीन सर्वेक्षण"** किंवा **"मासिक अहवाल"** टॅब निवडा.
3. लाभार्थीचे नाव, वय, लसीकरण स्थिती व पोषण श्रेणी भरा.
4. जर इंटरनेट नसेल, तरीही PWA मुळे डेटा **ऑफलाइन साठवला जातो** आणि इंटरनेट येताच स्वयंचलित सिंक होतो!
5. पर्यवेक्षक त्यांच्या नियंत्रण कक्षातून हा अहवाल थेट मंजूर करू शकतात.`,
    answerEn: `**How to Submit Health Surveys & Reports:**
1. Log in to the ASHA Worker Dashboard.
2. Select **"New Survey"** or **"Monthly Reporting"**.
3. Record beneficiary vitals, vaccination, and nutrition status.
4. The system operates **offline-first** via PWA; records will automatically sync once connectivity resumes!
5. Supervisors can review and approve reports in real-time.`
  }
]

export async function POST(request) {
  try {
    const { query = '', lang = 'mr' } = await request.json()
    const cleanQuery = query.trim().toLowerCase()

    if (!cleanQuery) {
      return NextResponse.json({
        answer: lang === 'en'
          ? "Please type your doubt or question above!"
          : "कृपया आपली कोणतीही शंका किंवा प्रश्न वर टाईप करा!"
      })
    }

    // 1. Check if Gemini / OpenAI API key is provided for generative responses
    const geminiKey = process.env.GEMINI_API_KEY?.trim()
    if (geminiKey) {
      try {
        const sysPrompt = `You are "आरोग्य मित्र / Seva Health AI Bot", an intelligent, empathetic medical and staffing digital assistant for Maharashtra National Health Mission (NHM) and NORVA Staffing.
The user's query is in ${lang === 'mr' ? 'Marathi' : 'English'}.
Answer concisely, with empathy, clear bullet points, and actionable guidance. Always mention emergency numbers (108/102) if health emergency is detected. Reply in ${lang === 'mr' ? 'Marathi' : 'English'}.`

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: sysPrompt },
                    { text: `User Question: ${query}` }
                  ]
                }
              ]
            })
          }
        )

        const geminiData = await geminiRes.json()
        const genText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
        if (genText) {
          return NextResponse.json({
            answer: genText,
            source: 'Gemini AI'
          })
        }
      } catch (err) {
        console.warn('Gemini API call skipped/failed, falling back to Knowledge Base:', err)
      }
    }

    // 2. Intelligent Match against Local Clinical & Operational Knowledge Base
    let bestMatch = null
    let maxScore = 0

    for (const item of KNOWLEDGE_BASE) {
      let score = 0
      for (const kw of item.keywords) {
        if (cleanQuery.includes(kw)) {
          score += 2
        }
      }
      if (score > maxScore) {
        maxScore = score
        bestMatch = item
      }
    }

    if (bestMatch && maxScore > 0) {
      return NextResponse.json({
        answer: lang === 'en' ? bestMatch.answerEn : bestMatch.answerMr,
        source: 'Seva Health Verified Knowledge Base'
      })
    }

    // 3. Helpful Default Fallback
    const fallbackMr = `नमस्कार! मी तुमचा **आरोग्य मित्र AI सहाय्यक** आहे.
आपण खालील विषयांबद्दल विचारू शकता:
• **गरोदर माता तपासणी (ANC Care)**
• **बाल लसीकरण वेळापत्रक (Immunization)**
• **कुपोषण श्रेणी व उपचार (SAM / MAM)**
• **आरोग्य सेवा व कार्यपद्धती**
• **लॉगिन व OTP सहाय्य**
• **आपत्कालीन मदत: १०८ / १०२**

आपला प्रश्न अधिक स्पष्टपणे विचारल्यास मी अधिक अचूक माहिती देऊ शकेन!`

    const fallbackEn = `Hello! I am your **Seva Health AI Assistant**.
You can ask me doubts regarding:
• **Maternal ANC Checkups & Nutrition**
• **National Child Vaccination Schedule**
• **Malnutrition Criteria (SAM / MAM)**
• **Health services and procedures**
• **Login, Roles & OTP Assistance**
• **Emergency Helplines (108 / 102)**

Please ask your question or pick one of the quick doubt chips below!`

    return NextResponse.json({
      answer: lang === 'en' ? fallbackEn : fallbackMr,
      source: 'Default Assistant'
    })
  } catch (error) {
    console.error('Doubt bot API error:', error)
    return NextResponse.json(
      { error: 'उत्तर मिळवण्यात त्रुटी आली. कृपया पुन्हा प्रयत्न करा.' },
      { status: 500 }
    )
  }
}
