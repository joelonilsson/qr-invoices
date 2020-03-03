const cheerio = require('cheerio');
const {google} = require('googleapis');
const generateQR = require('./qr');

const emailAddress = process.env.EMAIL_ADDRESS;
const userId = 'me';
const handledInvoicesLabel = '[AUTO] Hanterade fakturor';
const unhandledInvoicesLabel = '[AUTO] Ohanterade fakturor';

const companies = {
  KOMPLETT: 'komplett'
};

async function handleInvoices(auth) {
  const gmail = google.gmail({version: 'v1', auth});
  const { handledLabelId, unhandledLabelId } = await getLabelIds(gmail);
  const messagesList = await gmail.users.messages.list({userId, labelIds: [unhandledLabelId]});
  const {data} = messagesList;
  const {messages} = data;
  if (!messages) {
    console.log('No messages found');
  } else {
    for (const message of messages) {
      const {data: msg} = await gmail.users.messages.get({userId, id: message['id']});
      const company = getCompany(msg['snippet']);
      const subject = `QR-faktura från ${company}`;
      const b64Encoded = msg['payload']['body']['data'];
      const htmlString = Buffer.from(b64Encoded, 'base64').toString();
      // Using Cheerio to parse and select information from the html string
      const $ = cheerio.load(htmlString);
      const code = generateQR(getInvoiceInfo($, company));
      const encodedMessage = createMessage(emailAddress, subject, code);
      const _ = await sendMessage(gmail, userId, encodedMessage)
        .catch(err => console.error(err));
      const _2 = await modifyMessageLabels(gmail, userId, message['id'], [handledLabelId], [unhandledLabelId])
        .catch(err => console.error(err));
      console.log('Done');
    }
  }
}

function getCompany(text) {
  if (text.toLowerCase().includes('komplett bank')) {
    return companies.KOMPLETT;
  }
}

async function modifyMessageLabels(gmail, userId, messageId, labelsToAdd, labelsToRemove) {
  return gmail.users.messages.modify({
    userId,
    id: messageId,
    resource: {
      addLabelIds: labelsToAdd,
      removeLabelIds: labelsToRemove,
    }
  });
}

function getInvoiceInfo($, company) {
  if (company === companies.KOMPLETT) {
    return {
      due: $('p:contains("Utestående kredit")').parent().next().children().first().text().split('kr')[0].trim().replace(/\s+/g, ''),
      ddt: $('p:contains("Förfallodatum")').parent().next().children().first().text().trim().split('-').join(''),
      iref: $('p:contains("OCR")').parent().next().children().first().text().trim(),
      acc: $('p:contains("Plusgiro")').parent().next().children().first().text().trim(),
      pt: 'PG'
    };
  }
}

async function sendMessage(gmail, userId, message) {
  return await gmail.users.messages.insert({
    userId,
    resource: {
      raw: message,
      labelIds: ['INBOX', 'UNREAD'],
    },
  });
}

function createMessage(to, subject, code) {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const boundary = "__ctrlq_dot_org__";
  const fileName = 'code.png';
  const nl = '\n';
  const attachment = Buffer.from(code).toString('base64');

  const messageParts = [
    'MIME-Version: 1.0',
    'Message-ID: <random-id-1234567890@mail.gmail.com>',
    `Subject: ${utf8Subject}`,
    `From: <${to}>`,
    `To: <${to}>`,
    "Content-Transfer-Encoding: 7bit",
    "Content-Type: multipart/alternate; boundary=" + boundary + nl,
    "--" + boundary,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit" + nl,
    `<div><img src="cid:${fileName}@some.domain" alt="${fileName}" width="183" height="183"></div>`,
    "--" + boundary,
    "--" + boundary,
    `Content-Type: image/svg+xml; name=${fileName}`,
    `Content-Id: <${fileName}@some.domain>`,
    `Content-Disposition: attachment; filename=${fileName}`,
    "Content-Transfer-Encoding: base64" + nl,
    attachment,
    "--" + boundary + "--",
  ];
  const message = messageParts.join('\n');

  // The body needs to be base64url encoded.
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getLabelIds(gmail) {
  const { data } = await gmail.users.labels.list({
    userId: 'me',
  }).catch(err => console.error(err));
  const { labels } = data;
  if (labels.length) {
    const handledLabelId = labels.find(label => label.name === handledInvoicesLabel).id;
    const unhandledLabelId = labels.find(label => label.name === unhandledInvoicesLabel).id;
    return {
      handledLabelId,
      unhandledLabelId,
    };
  } else {
    console.log('No labels found.');
  }
}

module.exports = handleInvoices;
