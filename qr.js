const qr = require('qr-image');

function generateQR({due, ddt, acc, iref, pt = 'PG'}) {
  return qr.imageSync(
    JSON.stringify({
      uqr: 1,
      tp: 1,
      name: 'test',
      cid: '555555-5555',
      iref,
      idt: '20200101',
      ddt,
      due,
      vat: 0,
      pt,
      acc
    }),
    {type: 'png', size: 3});
}

module.exports = generateQR;
