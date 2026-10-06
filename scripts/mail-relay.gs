/**
 * VYSVI mail relay - a Google Apps Script web app that sends the app's emails
 * from YOUR Gmail account. Free, no domain, and it works from hosts that block
 * SMTP ports (Render's free tier). Setup steps: DEPLOYMENT.md, "Email without SMTP".
 *
 * The backend POSTs JSON { secret, to, replyTo, subject, text, html } over HTTPS
 * (app.mail.mode=relay, AppsScriptMailTransport) and gets { ok: true } or
 * { ok: false, error } back.
 *
 * The secret lives in Project Settings -> Script properties as RELAY_SECRET (never
 * in this file). Without it anyone who found the web app's URL could send mail as
 * you, so every request that does not carry it is refused.
 *
 * Limit: a consumer Gmail account may send to 100 recipients a day through Apps Script.
 */

var SENDER_NAME = 'VYSVI';

function doPost(e) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty('RELAY_SECRET');
    var data = JSON.parse(e.postData.contents);

    if (!secret || data.secret !== secret) {
      return reply({ ok: false, error: 'unauthorized' });
    }
    if (!data.to || !data.subject || !(data.text || data.html)) {
      return reply({ ok: false, error: 'missing to / subject / body' });
    }

    var options = { name: SENDER_NAME };
    if (data.html) options.htmlBody = data.html;
    if (data.replyTo) options.replyTo = data.replyTo;
    MailApp.sendEmail(data.to, data.subject, data.text || '', options);

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

// Run this once from the editor (Run -> authorize) so Google asks you to allow the
// script to send mail; the web app cannot show that prompt itself.
function authorize() {
  Logger.log('Remaining emails today: ' + MailApp.getRemainingDailyQuota());
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
