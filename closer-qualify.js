// Who gets the calendar on /ai-closer. Built from the 41 Closer ICP:
//   money walks in over WhatsApp (volume x ticket) and the chats are real sales
//   work (quotes, bookings, stock checks, orders), not FAQs a cheap bot can answer.
//
// Every submission is saved to Twenty either way. This only decides the NEXT screen:
//   qualified -> pick a call time now;  not -> "we'll WhatsApp you within one working day".
//
// Thresholds come from our price (S$9,600 build + S$1,490/mo):
//   S$50k/mo enquiry value  ~ enough for ~10% recovered to earn 3x the monthly fee
//   S$100k/mo + real complexity ~ enough for ~15% recovered to hit the S$20k guarantee
// Both recovery rates are assumptions. Recheck against real leads after ~50 submissions.

(function () {
  var ENQ_PER_WEEK = { under20: 10, '20to50': 35, '50to150': 100, '150plus': 200 };
  var AVG_SALE = { under200: 100, '200to1k': 600, '1kto5k': 3000, '5kplus': 8000 };
  var COMPLEX_JOBS = ['quotes', 'bookings', 'stock', 'orders'];
  var CALL_FLOOR = 50000;
  var GUARANTEE_FLOOR = 100000;

  window.qualify41 = function (answers) {
    var a = answers || {};
    var jobs = Array.isArray(a.jobs) ? a.jobs : [];
    var value = Math.round((ENQ_PER_WEEK[a.enquiries] || 0) * 4.3 * (AVG_SALE[a.saleValue] || 0));
    var complex = jobs.filter(function (j) { return COMPLEX_JOBS.indexOf(j) !== -1; }).length;

    if (value < CALL_FLOOR) {
      return { qualified: false, tier: 'C', value: value, reason: 'Low volume and low value for now' };
    }
    if (complex === 0 && value < GUARANTEE_FLOOR) {
      return { qualified: false, tier: 'C', value: value, reason: 'Mostly simple questions, a basic bot may be enough' };
    }
    if (value >= GUARANTEE_FLOOR && complex >= 2) {
      return { qualified: true, tier: 'A', value: value, reason: 'High enquiry value and real sales work in chat. Guarantee-eligible, call first' };
    }
    return { qualified: true, tier: 'B', value: value, reason: 'Enough enquiry value for the Closer to pay for itself' };
  };
})();
