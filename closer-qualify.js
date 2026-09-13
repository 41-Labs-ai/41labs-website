// Who gets the calendar on /ai-closer.
//
// The rule Alexander set (13 Sep 2026): enough enquiries AND a big enough average
// sale for the Closer to pay for itself. Everything else is context for the call,
// not a gate.
//
//   at least 50 WhatsApp enquiries a week   AND   average sale of at least S$500
//
// Why those two and nothing else: volume x ticket is the only thing that decides
// whether recovering a slice of missed enquiries covers S$9,600 + S$1,490/mo. A
// business doing 50 enquiries a week at S$500 has roughly S$107k a month walking
// through WhatsApp, so recovering even 10% pays for the build in the first month.
// Industry, tooling and what they have tried before change how we SELL, not whether
// the maths works, so they are no longer asked.
//
// Every submission is saved to Twenty either way. This only decides what happens next:
//   pass -> book a time now, then straight to the AI Closer on WhatsApp
//   hold -> we look properly and come back. NOT handed to the closer automatically.

(function () {
  // Midpoints, used only to show them a monthly figure and to rank call order.
  var ENQ_PER_WEEK = { under20: 10, '20to50': 35, '50to150': 100, '150plus': 250 };
  var AVG_SALE = { under500: 250, '500to2k': 1200, '2kto10k': 5000, '10kplus': 15000 };

  // The gate itself is bucket membership, not a midpoint, so the threshold is exactly
  // the one written on the form rather than an artefact of where we put the midpoint.
  var ENOUGH_ENQUIRIES = ['50to150', '150plus'];
  var ENOUGH_SALE = ['500to2k', '2kto10k', '10kplus'];

  // Clearly above the floor on both axes: worth calling first, and the tier the
  // S$20,000 guarantee is offered from once the maths is checked on the call.
  var STRONG_ENQUIRIES = ['150plus'];
  var STRONG_SALE = ['2kto10k', '10kplus'];

  function has(list, v) { return list.indexOf(v) !== -1; }

  window.qualify41 = function (answers) {
    var a = answers || {};
    var enq = ENQ_PER_WEEK[a.enquiries] || 0;
    var sale = AVG_SALE[a.saleValue] || 0;
    var value = Math.round(enq * 4.3 * sale);   // enquiry value a month, rough

    var enoughEnquiries = has(ENOUGH_ENQUIRIES, a.enquiries);
    var enoughSale = has(ENOUGH_SALE, a.saleValue);

    if (!enoughEnquiries && !enoughSale) {
      return { qualified: false, tier: 'C', value: value,
               reason: 'Under 50 enquiries a week and under S$500 a sale, so the Closer would not pay for itself yet' };
    }
    if (!enoughEnquiries) {
      return { qualified: false, tier: 'C', value: value,
               reason: 'Good ticket size, but under 50 enquiries a week there is not enough volume to recover' };
    }
    if (!enoughSale) {
      return { qualified: false, tier: 'C', value: value,
               reason: 'Good volume, but under S$500 a sale the recovered enquiries do not cover the fee' };
    }

    var strong = has(STRONG_ENQUIRIES, a.enquiries) || has(STRONG_SALE, a.saleValue);
    return strong
      ? { qualified: true, tier: 'A', value: value,
          reason: 'High enquiry value. Guarantee-eligible once the maths is checked on the call' }
      : { qualified: true, tier: 'B', value: value,
          reason: 'Enough volume and ticket size for the Closer to pay for itself' };
  };
})();
