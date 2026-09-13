// Who gets the calendar on /ai-closer: everyone, for now.
//
// 13 Sep 2026, Alexander's call: take every call while there is capacity and put a
// filter back when the calendar fills up. So this no longer decides WHETHER they book.
// It decides the TIER, which sets the call order, what the Telegram alert says, and
// whether Meta hears a QualifiedLead.
//
// The tier is the monthly enquiry value: enquiries a week x 4.3 x average sale. That
// figure is the only thing that really decides whether a Closer pays for itself.
//
//   A   S$1M a month or more    guarantee territory, call within the hour
//   B   S$100k a month or more  a Closer clearly pays for itself
//   C   below that              still books, but check it can pay back before quoting
//
// Meta only ever hears QualifiedLead for A and B. Tier C booking a call is fine; the
// ad account learning to go and find more tier C is not.

(function () {
  // Midpoints, used to work out roughly how much money moves through their WhatsApp
  // each month. That figure is the only thing that really decides whether a Closer
  // pays for itself, so it is what sets the tier.
  var ENQ_PER_WEEK = { under20: 10, '20to50': 35, '50to150': 100, '150plus': 250 };
  var AVG_SALE = { under500: 250, '500to2k': 1200, '2kto10k': 5000, '10kplus': 15000 };

  // Everyone books. Alexander's call (13 Sep 2026): take the calls while there is
  // capacity, and put the filter back when the calendar is full. The tier does the
  // judging instead, so the call order is still right and the Telegram alert still
  // says who to ring first.
  //
  // The old rule gated on volume AND ticket separately, which threw out a business
  // doing 35 enquiries a week at S$5,000 a sale: S$753k a month walking past. Tiering
  // on the value itself does not have that blind spot.
  var TIER_A_FLOOR = 1000000;   // S$1M a month of enquiry value: guarantee territory
  var TIER_B_FLOOR = 100000;    // S$100k a month: a Closer clearly pays for itself

  var money = function (n) { return 'S$' + Math.round(n).toLocaleString('en-SG'); };

  window.qualify41 = function (answers) {
    var a = answers || {};
    var enq = ENQ_PER_WEEK[a.enquiries] || 0;
    var sale = AVG_SALE[a.saleValue] || 0;
    var value = Math.round(enq * 4.3 * sale);

    if (value >= TIER_A_FLOOR) {
      return { qualified: true, tier: 'A', value: value,
               reason: 'About ' + money(value) + ' a month through WhatsApp. Guarantee territory, call first' };
    }
    if (value >= TIER_B_FLOOR) {
      return { qualified: true, tier: 'B', value: value,
               reason: 'About ' + money(value) + ' a month through WhatsApp. Enough for a Closer to pay for itself' };
    }
    return { qualified: true, tier: 'C', value: value,
             reason: value
               ? 'Only about ' + money(value) + ' a month through WhatsApp. Booked anyway, but check it can pay back before quoting'
               : 'No volume or ticket given. Booked anyway, qualify on the call' };
  };
})();
