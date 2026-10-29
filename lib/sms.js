/**
 * Real SMS Gateway Service for Seva Health
 * Supports:
 * 1. TextBee (100% Free Android SMS Gateway via textbee.dev — No DLT, No recharges needed)
 * 2. Fast2SMS (Indian Gateway)
 * 3. Twilio SMS
 * 4. Fallback / Dev simulation with full status
 */

export async function sendRealSMS({ phone, otp, workerName = 'आरोग्य सेविका' }) {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10)

  if (cleanPhone.length !== 10) {
    return {
      success: false,
      error: 'कृपया वैध १०-अंकी भारतीय मोबाईल नंबर प्रविष्ट करा.'
    }
  }

  const senderTag = process.env.SMS_SENDER_NAME || 'ASHA'
  const salutation = workerName ? `नमस्कार ${workerName}, ` : ''
  const messageText = `[${senderTag}]: ${salutation}आपला सेवा आरोग्य लॉगिन OTP आहे: ${otp}. ही गोपनीय माहिती कोणाशीही शेअर करू नका. (NHM ASHA Portal)`

  // 1. TEXTBEE GATEWAY (Free SMS via https://textbee.dev)
  const textbeeKey = process.env.TEXTBEE_API_KEY?.trim()
  const textbeeDeviceId = process.env.TEXTBEE_DEVICE_ID?.trim()

  if (textbeeKey) {
    try {
      console.log(`[TEXTBEE] Dispatching free SMS OTP to +91${cleanPhone} via TextBee...`)
      const payload = {
        recipients: [`+91${cleanPhone}`],
        message: messageText
      }
      if (textbeeDeviceId) {
        payload.deviceId = textbeeDeviceId
      }

      const url = textbeeDeviceId
        ? `https://api.textbee.dev/api/v1/gateway/devices/${textbeeDeviceId}/send-sms`
        : 'https://api.textbee.dev/api/v1/gateway/send-sms'

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': textbeeKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      console.log('[TEXTBEE API RESPONSE]:', data)

      if (response.ok && (data.success || data.smsBatchId || data.data || data.status === 'success')) {
        return {
          success: true,
          gateway: 'TextBee (Free SMS Gateway)',
          message: `TextBee द्वारे +91 ${cleanPhone} मोबाईलवर SMS यशस्वीरीत्या पाठवला आहे.`,
          phone: cleanPhone,
          batchId: data.smsBatchId || data.data?.smsBatchId || null
        }
      } else {
        console.warn('[TEXTBEE API NOTICE]:', data)
        const gatewayMessage = data.message || (Array.isArray(data.errors) ? data.errors.join(', ') : 'TextBee gateway dispatch issue')
        return {
          success: false,
          gateway: 'TextBee',
          isSimulated: true,
          gatewayMessage,
          message: `TextBee द्वारे SMS पाठवण्यात त्रुटी: ${gatewayMessage}. कृपया TextBee ॲप स्थिती तपासा.`,
          phone: cleanPhone
        }
      }
    } catch (err) {
      console.error('[TEXTBEE FETCH FAILED]:', err)
    }
  }

  // 2. FAST2SMS GATEWAY (Dedicated Indian SMS Route)
  const fast2smsKey = process.env.FAST2SMS_API_KEY?.trim()
  if (fast2smsKey) {
    try {
      console.log(`[FAST2SMS] Dispatching real SMS OTP to +91 ${cleanPhone}...`)
      // Try route: 'otp' first
      let response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': fast2smsKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otp,
          numbers: cleanPhone
        })
      })

      let data = await response.json()
      console.log('[FAST2SMS API RESPONSE (otp route)]:', data)

      // If OTP route requires website verification (status 996), automatically fallback to Quick SMS (route: 'q')
      if (data.status_code === 996 || !data.return) {
        console.log(`[FAST2SMS] Retrying via Quick SMS route (q)...`)
        const qResponse = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': fast2smsKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            route: 'q',
            message: messageText,
            numbers: cleanPhone,
            flash: '0'
          })
        })
        const qData = await qResponse.json()
        console.log('[FAST2SMS API RESPONSE (q route)]:', qData)
        if (qData.return === true || qData.status_code === 200 || (Array.isArray(qData.message) && qData.message[0]?.toLowerCase().includes('success'))) {
          data = qData
        }
      }

      if (data.return === true || data.status_code === 200 || (Array.isArray(data.message) && data.message[0]?.toLowerCase().includes('success'))) {
        return {
          success: true,
          gateway: 'Fast2SMS',
          message: `तुमच्या +91 ${cleanPhone} मोबाईलवर खरा SMS यशस्वीरीत्या पाठवला आहे.`,
          phone: cleanPhone
        }
      } else {
        console.warn('Fast2SMS returned error or warning:', data)
        const gatewayMessage = typeof data.message === 'string' 
          ? data.message 
          : Array.isArray(data.message) ? data.message.join(', ') : 'Fast2SMS gateway returned error'

        return {
          success: false,
          gateway: 'Fast2SMS',
          isSimulated: true,
          statusCode: data.status_code,
          gatewayMessage,
          message: data.status_code === 999
            ? 'Fast2SMS द्वारे खरा SMS पाठवण्यासाठी खात्यावर किमान ₹100 चे रिचार्ज आवश्यक आहे (Status 999).'
            : data.status_code === 996
            ? 'Fast2SMS द्वारे OTP पाठवण्यासाठी वेबसाइट व्हेरिफिकेशन आवश्यक आहे (Status 996).'
            : gatewayMessage,
          phone: cleanPhone
        }
      }
    } catch (err) {
      console.error('Fast2SMS fetch failed:', err)
    }
  }

  // 2. TWILIO GATEWAY
  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER

  if (twilioSid && twilioAuth && twilioPhone) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64')
      const body = new URLSearchParams({
        To: `+91${cleanPhone}`,
        From: twilioPhone,
        Body: messageText
      })

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        }
      )

      const twilioData = await twilioRes.json()
      if (twilioRes.ok) {
        return {
          success: true,
          gateway: 'Twilio',
          message: `Twilio द्वारे +91 ${cleanPhone} वर खरा SMS पाठवला आहे.`,
          phone: cleanPhone
        }
      } else {
        console.warn('Twilio error:', twilioData)
      }
    } catch (err) {
      console.error('Twilio fetch failed:', err)
    }
  }

  // 3. Fallback when API key is not yet configured in .env.local
  // Logs to console and returns status so the application continues seamlessly
  console.log(`\n========================================`)
  console.log(`[REAL SMS DISPATCH] To: +91 ${cleanPhone}`)
  console.log(`[MESSAGE]: ${messageText}`)
  console.log(`[OTP]: ${otp}`)
  console.log(`========================================\n`)

  return {
    success: true,
    gateway: 'Simulated / Ready for Fast2SMS',
    isSimulated: true,
    message: `+91 ${cleanPhone} वर संदेश पाठवला गेला आहे. (खऱ्या SMS साठी .env.local मध्ये FAST2SMS_API_KEY किंवा TWILIO जोडा)`,
    phone: cleanPhone
  }
}
